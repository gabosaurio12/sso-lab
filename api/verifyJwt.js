import jwt from "jsonwebtoken";
import JwksClient from "jwks-rsa";

const ISSUER = process.env.ISSUER;

const client = JwksClient({
    jwksUri: `${ISSUER}/protocol/openid-connect/certs`,
});

function getKey(header, callback) {
    client.getSigningKey(headir.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

export function verifyJwt(req, res, next) {
    const auth = req.get("authorization") || "";
    const match = auth.match(/^Bearer (.+)$/);

    if (!match) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = match[1];

    jwt.verify(
        token,
        getKey,
        {
            algorithms: ["RS256"],
            issuer: ISSUER,
        },
        (err, decoded) => {
            if (err) {
                console.error("JWT verificación fallida:", err);
                return res.status(401).json({ error: "Invalid token" });
            }

            req.user = decoded;
            next();
        }
    );
}