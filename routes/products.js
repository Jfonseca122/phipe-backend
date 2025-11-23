// 📁 routes/products.js
import express from "express";
import db from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { io } from "../server.js"; // 🔥 Esto permite emitir eventos


const router = express.Router();

/* =====================================================================================
   🟩 GET /products — Obtener todos los productos (solo personal autenticado)
   - Evita SELECT * para no exponer columnas innecesarias.
   - Mejor rendimiento y seguridad.
====================================================================================== */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, price, type, image FROM product"
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

/* =====================================================================================
   🟩 GET /products/types — Obtener lista de tipos definidos en el ENUM
   - Extrae el enum directamente desde MariaDB.
   - Limpia el formato y devuelve solo un array de strings.
   - Aún mejor: esto se podría **cachear**, pero lo dejamos simple por ahora.
====================================================================================== */
router.get("/types", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'product' AND COLUMN_NAME = 'type'
    `);

    if (rows.length === 0) return res.json([]);

    const enumStr = rows[0].COLUMN_TYPE;

    // Ej: "enum('HAMBURGUESA','PERRO','BEBIDA')"
    const types = enumStr
      .replace("enum(", "")
      .replace(")", "")
      .split(",")
      .map(t => t.replace(/'/g, ""));

    res.json(types);
  } catch (err) {
   
    res.status(500).json({ error: "Error al obtener tipos de productos" });
  }
});

/* =====================================================================================
   🟩 GET /products/public — Productos visibles para clientes
   - No usa token.
   - NO se recomienda enviar TODOS los campos → solo columnas necesarias.
   - Mejor agregar un campo visible=1 en el futuro.
====================================================================================== */
router.get("/public", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, price, type, image FROM product"
    );
    res.json(rows);
  } catch  {
   
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

/* =====================================================================================
   🟧 POST /products — Crear nuevo producto
   - Valida datos básicos.
   - Comprueba que price sea número.
   - Evita insertar datos corruptos.
====================================================================================== */
router.post("/", authenticateToken, async (req, res) => {
  const { name, price, type, image } = req.body;

  // Validaciones básicas
  if (!name || !price || !type )
    return res.status(400).json({ error: "Faltan datos" });

  if (isNaN(price))
    return res.status(400).json({ error: "El precio debe ser un número válido" });

  try {
    const [result] = await db.query(
      "INSERT INTO product (name, price, type, image) VALUES (?, ?, ?, ?)",
      [name, price, type, image]
    );
    const product = { id: result.insertId, name, price, type, image };

    io.emit("producto_creado", product);

    res.json({
      id: result.insertId,
      name,
      price,
      type,
      image,
    });
  } catch (err) {
   
    res.status(500).json({ error: "Error al crear producto" });
  }
});

/* =====================================================================================
   🟧 PUT /products/:id — Editar producto existente
   - Igual validación que POST.
   - Usa LIMIT 1 para mayor seguridad.
   - Comprueba si realmente se modificó el producto.
====================================================================================== */
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, price, type, image } = req.body;

  if (!name || !price || !type || !image)
    return res.status(400).json({ error: "Faltan datos" });

  if (isNaN(price))
    return res.status(400).json({ error: "El precio debe ser un número válido" });

  try {
    const [result] = await db.query(
      "UPDATE product SET name = ?, price = ?, type = ?, image = ? WHERE id = ? LIMIT 1",
      [name, price, type, image, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Producto no encontrado" });

     const updatedProduct = { id: Number(id), name, price, type, image };
      io.emit("producto_actualizado", updatedProduct);

    res.json({ message: "Producto actualizado" });
  } catch (err) {
  
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

/* =====================================================================================
   🟥 DELETE /products/:id — Eliminar producto
   - Verifica si el producto está asociado a pedidos (orderitem).
   - Si está usado, no permite eliminar → evita inconsistencia en la BD.
   - Usa LIMIT 1 para mayor seguridad.
 ====================================================================================== */
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si el producto está en pedidos
    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM orderitem WHERE productId = ?",
      [id]
    );

    if (rows[0].count > 0) {
      return res.status(409).json({
        error: "No se puede eliminar este producto porque ya está en pedidos.",
      });
    }

    // Eliminar normalmente
    const [result] = await db.query(
      "DELETE FROM product WHERE id = ? LIMIT 1",
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Producto no encontrado" });

        io.emit("producto_eliminado", { id: Number(id) }); //

    res.json({ message: "Producto eliminado correctamente" });

  } catch (err) {
    
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

/* =====================================================================================
   Exportación del router
====================================================================================== */
export default router;
