import express from "express";
import session from "cookie-session";
import dotenv from "dotenv";
import { Issuer, generators } from "openid-client";
import https from "https";
import fs from "fs";

const sslOptions = {
		key: fs.readFileSync("./ssl/key.pem"),
		cert: fs.readFileSync("./ssl/cert.pem"),
};

dotenv.config();

const app = express();

app.set("trust proxy", true);

app.use(
  session({
    name: "session",
    keys: [process.env.SESSION_SECRET || "secret"],
    maxAge: 24 * 60 * 60 * 1000,

    secure: true,
    sameSite: "none",
    httpOnly: true,
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


let issuer;
let client;

async function initOidcClient() {
  try {
    issuer = await Issuer.discover(process.env.ISSUER);
    // Crear el client; al ser public client usamos token_endpoint_auth_method: 'none'
    client = new issuer.Client({
      client_id: process.env.CLIENT_ID,
      token_endpoint_auth_method: "none",
    });
    console.log("OIDC issuer descubierto y client creado:", issuer.issuer);
  } catch (err) {
    console.error("Error inicializando OIDC client:", err);
    process.exit(1);
  }
}

// Middleware para esperar a que el client esté listo
async function requireClient(req, res, next) {
  if (!client) {
    await initOidcClient();
  }
  next();
}

app.get("/login", requireClient, (req, res) => {
  // generar code_verifier y code_challenge y guardarlos en la sesión
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);

  // guarda el code_verifier en la sesión
  req.session.code_verifier = code_verifier;

  const protocol = req.protocol;
  const host = req.get("host");
  const redirectUri = `${protocol}://${host}/callback`;
  console.log("LOGIN redirectUri=", redirectUri);

  const url = client.authorizationUrl({
    scope: "openid profile email",
    code_challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
  });

  res.redirect(url);
});

app.get("/callback", requireClient, async (req, res) => {
  try {
    console.log("CALLBACK headers.cookie=", req.headers.cookie);
    const params = client.callbackParams(req);

    const protocol = req.protocol;
    const host = req.get("host");
    const redirectUri = `${protocol}://${host}/callback`;

    const code_verifier = req.session.code_verifier;
    if (!code_verifier) return res.status(400).send("Missing code_verifier in session");

    const tokenSet = await client.callback(redirectUri, params, {
      code_verifier,
    });

    // guarda tokens en la sesión (ten en cuenta tamaño y seguridad para el lab)
    req.session.tokens = {
      id_token: tokenSet.id_token,
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
    };

    // borrar el code_verifier (solo se usa una vez)
    delete req.session.code_verifier;

    res.redirect("/me");
  } catch (err) {
    console.error("Error en /callback:", err);
    res.status(500).send("Callback error: " + (err.message || err.toString()));
  }
});

app.get("/me", requireClient, async (req, res) => {
  try {
    if (!req.session.tokens || !req.session.tokens.access_token) {
      return res.status(401).send("No estás autenticado. Ve a /login");
    }

    // usa userinfo si el issuer lo soporta
    let userinfo = {};
    try {
      userinfo = await client.userinfo(req.session.tokens.access_token);
    } catch (e) {
      // si falla userinfo, igual mostramos los claims del id_token (decodificar si quieres)
      console.warn("No se pudo obtener userinfo:", e.message || e);
    }

    res.json({
      id_token: req.session.tokens.id_token,
      access_token: req.session.tokens.access_token,
      userinfo,
    });
  } catch (err) {
    console.error("Error en /me:", err);
    res.status(500).send("Error interno");
  }
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.send("Sesión cerrada localmente. Para logout completo en el IdP implementa end_session_endpoint.");
});

const PORT = Number(process.env.PORT || 3000);

initOidcClient().then(() => {
    https.createServer(sslOptions, app).listen(PORT, "0.0.0.0", () => {
            console.log(`HTTPS BFF ready at https://${process.env.HOST}:${PORT}`);
    });
});
