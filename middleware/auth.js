import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "Token requerido o mal formado" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError")
        return res.status(401).json({ error: "Token expirado" });

      return res.status(403).json({ error: "Token inválido" });
    }

    req.user = user;
    next();
  });
}
