import express from "express";
import { verifyJwt } from "./verifyJwt.js";

const router = express.Router();

router.get("/perfil", verifyJwt, (req, res) => {
    res.json({
        message: "OK",
        user: req.user,
    });
});

export default router;