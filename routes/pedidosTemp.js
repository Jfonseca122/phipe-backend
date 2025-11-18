// 📁 routes/pedidosTemp.js
import express from "express";
import db from "../db.js";
import { io, ClientesConectados} from "../server.js"; // Socket.IO
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   1️⃣  CREAR PEDIDO TEMPORAL (desde el cliente público)
   ========================================================= */
router.post("/", async (req, res) => {
  try {
    const {
      nombre_cliente,
      direccion_cliente,
      telefono_cliente,
      detalles_pedido,
      total,
    } = req.body;

    if (!nombre_cliente || !detalles_pedido || !Array.isArray(detalles_pedido)) {
      return res.status(400).json({ error: "Datos incompletos del pedido" });
    }

    // Insertar en la BD
    const [result] = await db.query(
      `INSERT INTO pedidos_temp 
       (nombre_cliente, direccion_cliente, telefono_cliente, detalles_pedido, total)
       VALUES (?, ?, ?, ?, ?)`,
      [
        nombre_cliente,
        direccion_cliente || "",
        telefono_cliente || "",
        JSON.stringify(detalles_pedido),
        total || 0,
      ]
    );



    // Construir objeto para mandar por socket
    const nuevoPedido = {
      id: result.insertId,
      nombre_cliente,
      direccion_cliente,
      telefono_cliente,
      detalles_pedido,
      total,
      creado_en: new Date().toISOString(),
    };

    // 🔥 Notificar al admin (estructura correcta)
    io.emit("nuevoPedidoTemp", { data: nuevoPedido });

    res.json({ message: "Pedido temporal guardado correctamente" });
  } catch (err) {
 
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =========================================================
   2️⃣  OBTENER TODOS LOS PEDIDOS TEMPORALES (admin)
   ========================================================= */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM pedidos_temp ORDER BY creado_en DESC"
    );

    const pedidos = rows.map((p) => ({
      ...p,
      detalles_pedido: JSON.parse(p.detalles_pedido),
    }));

    res.json(pedidos);
  } catch (err) {
 
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// =========================================================
// OBTENER TODOS LOS PEDIDOS TEMPORALES PARA PERSONAS DE DOMICILIOS
// =========================================================

router.get("/personDomicilios", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        detalles_pedido,
        nombre_cliente,
        direccion_cliente,
        telefono_cliente,
        total,
        estado,
        confiable,
        creado_en
      FROM pedidos_temp
      ORDER BY creado_en DESC
    `);

    res.json(rows);
  } catch (error) {
    
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// =========================================================
// ELIMINAR PEDIDO TEMPORAL PARA PERSONAS DE DOMICILIOS
// =========================================================

router.delete("/personDomicilios/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM pedidos_temp WHERE id = ?", [id]);

    res.json({ message: "Pedido eliminado correctamente" });
  } catch (error) {
   
    res.status(500).json({ error: "Error al eliminar" });
  }
});


// =========================================================
// ACTUALIZAR CONFIABLE PARA PERSONAS DE DOMICILIOS
// =========================================================
router.patch("/personDomicilios/:id/confiable", async (req, res) => {
  try {
    const { id } = req.params;
    const { confiable } = req.body;

    await db.query(
      "UPDATE pedidos_temp SET confiable = ? WHERE id = ?",
      [confiable ? 1 : 0, id]
    );

    res.json({ message: "Confiable actualizado" });
  } catch (error) {

    res.status(500).json({ error: "Error al actualizar confiable" });
  }
});






/* =========================================================
   2.1️⃣ OBTENER SOLO NO FACTURADOS
   ========================================================= */
router.get("/pendientes", async (req, res) => {
  try {
    const [rows] = await db.query(
     "SELECT * FROM pedidos_temp WHERE estado = 'pendiente' ORDER BY creado_en DESC"
    );

    const pedidos = rows.map((p) => ({
      ...p,
      detalles_pedido: JSON.parse(p.detalles_pedido),
    }));

    res.json(pedidos);
  } catch (err) {
  
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =========================================================
   3️⃣  ELIMINAR / RECHAZAR PEDIDO TEMPORAL
   ========================================================= */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Buscar pedido para obtener el teléfono del cliente
    const [rows] = await db.query(
      "SELECT telefono_cliente FROM pedidos_temp WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const telefonoCliente = rows[0].telefono_cliente;

    // 2️⃣ Eliminar pedido de la BD
    await db.query("UPDATE pedidos_temp SET estado = 'rechazado' WHERE id = ?", [id]);

    // 3️⃣ Notificar SOLO al cliente que hizo el pedido
    const socketIdCliente = ClientesConectados[telefonoCliente];
    if (socketIdCliente) {
      io.to(socketIdCliente).emit("pedidoTemporalRechazado", { id });
    }

    res.json({ message: "Pedido temporal rechazado y cliente notificado" });
  } catch (err) {
   
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


/* =========================================================
   4️⃣  APROBAR → MOVER A order Y orderitem
   ========================================================= */
router.post("/:id/aprobar", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Buscar pedido temporal
    const [rows] = await db.query(
      "SELECT * FROM pedidos_temp WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const pedido = rows[0];
    const detalles = JSON.parse(pedido.detalles_pedido);

    // 2️⃣ Calcular total real
    const total = detalles.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0
    );

    // 3️⃣ Insertar orden principal (tableId 57 = domicilios)
    const [orderResult] = await db.query(
      "INSERT INTO `order` (tableId, total, status, createdAt) VALUES (?, ?, 'OPEN', NOW())",
      [57, total]
    );

    const orderId = orderResult.insertId;

    // 4️⃣ Insertar cada item
    for (const item of detalles) {
      await db.query(
        "INSERT INTO `orderitem` (orderId, productId, quantity, unitPrice, subtotal) VALUES (?, ?, ?, ?, ?)",
        [
          orderId,
          item.id,
          item.quantity || 1,
          item.price || 0,
          (item.price || 0) * (item.quantity || 1),
        ]
      );
    }

    // 5️⃣ Marcar como facturado
    await db.query(
      "UPDATE pedidos_temp SET estado = 'facturado' WHERE id = ?",
      [id]
    );

    // 🔥 6️⃣ Notificar al admin
    io.emit("pedidoAprobado", { id });

    res.json({
      message: "✔ Pedido aprobado y guardado en tablas definitivas",
      orderId,
    });
  } catch (err) {
   
    res.status(500).json({ error: "Error al aprobar pedido" });
  }
});


// =========================================================
// VERIFICAR SI UN TELÉFONO ES CONFIABLE
// =========================================================
router.get("/verificarTelefono/:telefono", async (req, res) => {
  try {
    const { telefono } = req.params;

    const [rows] = await db.query(
      `SELECT telefono_cliente, confiable
        FROM pedidos_temp
        WHERE telefono_cliente = ?
        ORDER BY confiable ASC
        LIMIT 1`,
      [telefono]
    );

    if (rows.length === 0) {
      return res.json({ existe: false });
    }

    res.json({
      existe: true,
      confiable: rows[0].confiable,
    });
  } catch (error) {
    
    res.status(500).json({ error: "Error en el servidor" });
  }
});




export default router;
