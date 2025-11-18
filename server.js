import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import pool from "./db.js"; // <-- tu conexión MySQL

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import tableRoutes from "./routes/tables.js";
import orderRoutes from "./routes/orders.js";
import configuracionRoutes from "./routes/configuracion.js";
import pedidosTempRoutes from "./routes/pedidosTemp.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

export const ClientesConectados = {};

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO
io.on("connection", (socket) => {
  socket.on("registraCliente", (telefono) => {
    if (typeof telefono === "string") {
      ClientesConectados[telefono] = socket.id;
    }
  });

  socket.on("disconnect", () => {
    for (const tel in ClientesConectados) {
      if (ClientesConectados[tel] === socket.id) {
        delete ClientesConectados[tel];
        break;
      }
    }
  });
});

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.get("/", (req, res) =>
  res.send("Servidor funcionando correctamente con MariaDB")
);
app.use("/login", authRoutes);
app.use("/products", productRoutes);
app.use("/tables", tableRoutes);
app.use("/orders", orderRoutes);
app.use("/configuracion", configuracionRoutes);
app.use("/pedidos-temp", pedidosTempRoutes);

// Error global
app.use((err, req, res, next) => {
  console.error(err); // log para depuración
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 4000;

// Función para probar la conexión a MySQL antes de levantar el servidor
async function probarConexion() {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS resultado");
    console.log("📌 Prueba MySQL exitosa:", rows[0].resultado); // debería imprimir 2
  } catch (err) {
    console.error("❌ Error ejecutando prueba MySQL:", err);
    process.exit(1); // cierra el servidor si falla la DB
  }
}

// Primero probamos la conexión, luego arrancamos el servidor
probarConexion().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  });
});
