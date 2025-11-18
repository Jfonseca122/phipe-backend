import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import tableRoutes from "./routes/tables.js";
import orderRoutes from "./routes/orders.js";
import configuracionRoutes from "./routes/configuracion.js";
import pedidosTempRoutes from "./routes/pedidosTemp.js";

const app = express();
const httpServer = createServer(app);

export const ClientesConectados = {};

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

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
  
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => { console.log(PORT) });
