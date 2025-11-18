import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

let pool;

try {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error("Faltan variables de entorno para la conexión a la base de datos");
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,   // <-- CORREGIDO
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000, // 20 segundos
  });

  console.log("📌 Conectado correctamente a MySQL en Railway");
} catch (err) {
  console.error("❌ Error al iniciar la conexión MySQL:", err.message);
}

export default pool;
