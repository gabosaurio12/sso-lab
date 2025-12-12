import express from "express";
import { verifyJwt } from "./verifyJwt.js";

const router = express.Router();

router.get("/perfil2", async (req, res) => {
    try {
        if (!req.client) {
            return res.status(500).json({ error: "OIDC client not initialized" });
        }

        const auth = req.get("authorization") || "";
        const match = auth.match(/^Bearer\s+(.+)$/i);
        if (!match) return res.status(401).json({ error: "Missing or invalid Authorization header" });

        const accessToken = match[1];
        let userinfo = {};
        try {
        userinfo = await client.userinfo(accessToken);
        } catch (e) {
        console.warn("No se pudo obtener userinfo con access_token:", e.message || e);
        return res.status(401).json({ error: "Invalid access token " });
        }

        res.json({ userinfo });
    } catch (err) {
        console.error("Error en api/perfil:", err);
        res.status(500).send("Error interno");
    }
});

router.get("/perfil", verifyJwt, (req, res) => {
    res.json({
        message: "OK",
        user: req.user,
    });
});

export default router;