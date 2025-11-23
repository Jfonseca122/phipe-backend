/**
 * Rutas para la gestión de mesas en el sistema.
 * Incluye operaciones CRUD con validaciones, seguridad y buenas prácticas.
 */

import express from "express";
import db from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { io } from "../server.js";

const router = express.Router();

/* ============================================================
   📌 GET /tables
   Obtener todas las mesas
   ------------------------------------------------------------ */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM `table`");
    res.json(rows);
  } catch (err) {
   
    res.status(500).json({ error: "Error interno al obtener mesas" });
  }
});

/* ============================================================
   📌 POST /tables
   Crear una nueva mesa
   ------------------------------------------------------------ */
router.post("/", authenticateToken, async (req, res) => {
  const { name } = req.body;

  // Validación simple
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "El nombre de la mesa es obligatorio." });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO `table` (name) VALUES (?)",
      [name.trim()]
    );
    const mesa = { id: result.insertId, name: name.trim() };
    io.emit("mesa_creada", mesa);

    res.json({
      id: result.insertId,
      name: name.trim(),
      message: "Mesa creada correctamente"
    });
  } catch (err) {

    res.status(500).json({ error: "Error interno al crear mesa" });
  }
});

/* ============================================================
   📌 PUT /tables/:id
   Actualizar una mesa existente
   ------------------------------------------------------------ */
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Validación
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "El nombre es requerido." });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM `table` WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "La mesa no existe." });
    }

    await db.query(
      "UPDATE `table` SET name = ? WHERE id = ?",
      [name.trim(), id]
    );

    io.emit("mesa_actualizada", {
      id,
      name: name.trim()
    });

    res.json({ message: "Mesa actualizada correctamente" });
  } catch (err) {
   
    res.status(500).json({ error: "Error interno al actualizar mesa" });
  }
});

/* ============================================================
   📌 DELETE /tables/:id
   Eliminar una mesa
   - No se elimina si tiene pedidos asociados
   ------------------------------------------------------------ */
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si la mesa existe
    const [existing] = await db.query(
      "SELECT id FROM `table` WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Mesa no encontrada." });
    }

    // Verificar si tiene pedidos asociados
    const [orders] = await db.query(
      "SELECT id FROM `order` WHERE tableId = ?",
      [id]
    );

    if (orders.length > 0) {
      return res.status(400).json({
        error: "No se puede eliminar la mesa porque tiene pedidos asociados."
      });
    }

    await db.query("DELETE FROM `table` WHERE id = ?", [id]);

    io.emit("mesa_eliminada", { id });

    res.json({ message: "Mesa eliminada correctamente" });
  } catch (err) {
 
    res.status(500).json({ error: "Error interno al eliminar mesa" });
  }
});

export default router;
