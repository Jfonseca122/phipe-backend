import express from "express";
import db from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { io } from "../server.js"; // 🔥 Importamos io para emitir eventos

const router = express.Router();

/* ============================================================
   📌 GET /orders
   Obtener todos los pedidos con sus items
============================================================ */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM `order` ORDER BY createdAt DESC"
    );

    const result = [];
    for (const order of orders) {
      const [items] = await db.query(
        `SELECT 
            oi.*, 
            p.name AS productName
         FROM orderitem oi
         JOIN product p ON oi.productId = p.id
         WHERE oi.orderId = ?`,
        [order.id]
      );
      result.push({ ...order, items });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error interno al obtener pedidos" });
  }
});

/* ============================================================
   📌 GET /orders/:tableId
   Obtener el pedido ABIERTO de una mesa
============================================================ */
router.get("/:tableId", authenticateToken, async (req, res) => {
  const { tableId } = req.params;

  try {
    const [orders] = await db.query(
      `SELECT * FROM \`order\`
       WHERE tableId = ? AND status = 'OPEN'
       ORDER BY createdAt DESC`,
      [tableId]
    );

    if (orders.length === 0) return res.json([]); // no hay pedido abierto

    const order = orders[0];
    const [items] = await db.query(
      `SELECT 
          oi.*, 
          p.name
       FROM orderitem oi
       JOIN product p ON oi.productId = p.id
       WHERE oi.orderId = ?`,
      [order.id]
    );

    res.json([{ ...order, items }]);
  } catch (err) {
    res.status(500).json({ error: "Error interno al obtener pedidos" });
  }
});

/* ============================================================
   📌 POST /orders
   Crear un pedido nuevo
============================================================ */
router.post("/", authenticateToken, async (req, res) => {
  const { tableId, items } = req.body;

  if (!tableId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Datos incompletos para crear pedido" });
  }

  try {
    const total = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0
    );

    const [result] = await db.query(
      `INSERT INTO \`order\` (tableId, total, status)
       VALUES (?, ?, 'OPEN')`,
      [tableId, total]
    );

    const orderId = result.insertId;

    for (const it of items) {
      const quantity = it.quantity || 1;
      const price = it.price || 0;

      await db.query(
        `INSERT INTO orderitem 
          (orderId, productId, quantity, unitPrice, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, it.id, quantity, price, price * quantity]
      );
    }

    // 🔥 Emitir evento a todos los clientes
    io.emit("pedido_creado", { orderId, tableId, total, items, status: "OPEN" });

    res.json({ orderId, total, message: "Pedido creado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error interno al crear pedido" });
  }
});

/* ============================================================
   📌 PUT /orders/order-items/:id
   Actualizar un item del pedido
============================================================ */
router.put("/order-items/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { productId, quantity, unitPrice } = req.body;

  if (!productId || !quantity || !unitPrice) {
    return res.status(400).json({ error: "Faltan datos para actualizar item" });
  }

  try {
    const subtotal = unitPrice * quantity;

    await db.query(
      `UPDATE orderitem
       SET productId = ?, quantity = ?, unitPrice = ?, subtotal = ?
       WHERE id = ?`,
      [productId, quantity, unitPrice, subtotal, id]
    );

    // 🔥 Emitir evento de actualización de pedido
    io.emit("pedido_actualizado", { itemId: id, productId, quantity, unitPrice, subtotal });

    res.json({ message: "Item actualizado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error interno al actualizar item" });
  }
});

/* ============================================================
   📌 DELETE /orders/order-items/:id
   Eliminar un item del pedido
============================================================ */
router.delete("/order-items/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM orderitem WHERE id = ?", [id]);

    // 🔥 Emitir evento de item eliminado
    io.emit("pedido_item_eliminado", { itemId: id });

    res.json({ message: "Item eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error interno al eliminar item" });
  }
});

/* ============================================================
   📌 PUT /orders/:id/close
   Cerrar un pedido
============================================================ */
router.put("/:id/close", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE \`order\`
       SET status = 'CLOSED'
       WHERE id = ?`,
      [id]
    );

    // 🔥 Emitir evento de pedido cerrado
    io.emit("pedido_cerrado", { id: Number(id) });

    res.json({ message: "Pedido cerrado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error interno al cerrar pedido" });
  }
});

export default router;
