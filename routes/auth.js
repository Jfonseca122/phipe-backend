import express from "express";
import db from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from "../middleware/config.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Usuario y contraseña son requeridos" });

  try {
    const [rows] = await db.query(
      "SELECT id, username, passwordHash FROM `user` WHERE username = ? LIMIT 1",
      [username]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, username: user.username });
  } catch (err) {
  
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

export default router;
