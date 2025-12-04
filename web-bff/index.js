import express, { response } from "express";
import expressSession from "express-session";
import dotenv from "dotenv";
import { Issuer, generators } from "openid-client";
import https from "https";
import fs from "fs";
import perfilRouter from "../api/perfil.js";

const sslOptions = {
		key: fs.readFileSync("./ssl/key.pem"),
		cert: fs.readFileSync("./ssl/cert.pem"),
};

dotenv.config();

const app = express();

app.set("trust proxy", true);

app.use(
  expressSession({
    name: "session",
    secret: [process.env.SESSION_SECRET || "secret"],
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        httpOnly: true,
        sameSite: "none",
    },
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

  const state = generators.state();
  const nonce = generators.nonce();

  req.session.code_verifier = code_verifier;
  req.session.oidc_state = state;
  req.session.oidc_nonce = nonce;

  const protocol = req.protocol;
  const host = req.get("host");
  const redirectUri = `${protocol}://${host}/callback`;
  console.log("LOGIN redirectUri=", redirectUri);

  const url = client.authorizationUrl({
    response_type: "code",
    scope: "openid profile email",
    code_challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    state,
    nonce,
  });

  res.on("finish", () => {
    console.log("LOGIN setn Set-Cookie headoer:", res.getHeader("Set-Cookie"));
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
    const state = req.session.oidc_state;
    const nonce = req.session.oidc_nonce;

    if (!code_verifier) return res.status(400).send("Missing code_verifier in session");

    const tokenSet = await client.callback(redirectUri, params, {
      code_verifier,
      state,
      nonce,
    });

    req.session.tokens = {
      id_token: tokenSet.id_token,
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
    };

    delete req.session.code_verifier;
    delete req.session.oidc_state;
    delete req.session.oidc_nonce;

    res.redirect("/perfil");
  } catch (err) {
    console.error("Error en /callback:", err);
    res.status(500).send("Callback error: " + (err.message || err.toString()));
  }
});

app.use((rqu, res, enxt) => {
    req.client = client;
    next();
});

app.use("/api", perfilRouter);

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
