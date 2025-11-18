import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

let pool;

try {
  // 🔍 Verificación de variables de entorno
  const requiredVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missingVars = requiredVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missingVars.join(", ")}`);
  }

  // 🛠️ Crear el pool de conexiones
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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

// 🧪 Test de conexión
async function testDB() {
  try {
    console.log("🔍 Variables cargadas:");
    console.log({
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD ? "✅ definida" : "❌ faltante",
      DB_NAME: process.env.DB_NAME,
    });

    const [rows] = await pool.query("SELECT 1 + 1 AS result");
    console.log("✅ Test query OK:", rows);
  } catch (err) {
    console.error("❌ Error en test query:", err.message);
  }
}

testDB();

export default pool;