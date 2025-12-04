import express from "express";
import session from "cookie-session";
import dotenv from "dotenv";
import { Issuer, generators } from "openid-client";

dotenv.config();

const app = express();

app.use(
  session({
    name: "session",
    keys: [process.env.SESSION_SECRET || "secret"],
    maxAge: 24 * 60 * 60 * 1000,
  })
);

let client;
let codeVerifier;
let codeChallenge;

async function setupClient() {
  const keycloak = await Issuer.discover(process.env.ISSUER);
  client = new keycloak.Client({
    client_id: process.env.CLIENT_ID,
    token_endpoint_auth_method: "none",
  });
}

setupClient();

app.get("/login", async (req, res) => {
  codeVerifier = generators.codeVerifier();
  codeChallenge = generators.codeChallenge(codeVerifier);

  const url = client.authorizationUrl({
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: `http://${process.env.HOST}:3000/callback`,
  });

  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const params = client.callbackParams(req);

  const tokenSet = await client.callback(
    `http://${process.env.HOST}:3000/callback`,
    params,
    {
      code_verifier: codeVerifier,
    }
  );

  req.session.tokens = tokenSet;
  res.redirect("/me");
});

app.get("/me", async (req, res) => {
  if (!req.session.tokens) return res.send("No estás logueado");

  const userinfo = await client.userinfo(req.session.tokens.access_token);

  res.json({
    id_token: req.session.tokens.id_token,
    access_token: req.session.tokens.access_token,
    userinfo: userinfo,
  });
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.send("Sesión cerrada");
});

app.listen(process.env.PORT, () => {
  console.log("BFF listening on port", process.env.PORT);
});