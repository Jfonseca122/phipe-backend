import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

let pool;

try {
  const requiredVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missingVars = requiredVars.filter((key) => !process.env[key] && process.env[key] !== "");

  if (missingVars.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missingVars.join(", ")}`);
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
  });

  
} catch  {
 
}

export default pool;
