import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db.js';
import { io } from '../server.js'; // ✅ Importamos el io del servidor

const router = express.Router();

// 🔹 Obtener configuración actual (solo 1 registro)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT domicilios_activos FROM configuracion LIMIT 1');
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Configuración no encontrada' });
    }
    res.json(rows[0]);
  } catch (error) {
   
    res.status(500).json({ error: 'Error del servidor al obtener configuración' });
  }
});

// 🔹 Actualizar estado de domicilios
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { domicilios_activos } = req.body;
    await db.query('UPDATE configuracion SET domicilios_activos = ? LIMIT 1', [domicilios_activos]);
    


    // ✅ Emitimos evento a todos los clientes conectados
    io.emit('estadoDomicilios', { activo: domicilios_activos });

    res.json({ success: true, message: 'Configuración actualizada correctamente' });
  } catch (error) {
   
    res.status(500).json({ error: 'Error del servidor al actualizar configuración' });
  }
});

// 🔹 Endpoint público sin autenticación (para página móvil QR)
router.get('/public', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT domicilios_activos FROM configuracion LIMIT 1');
    res.json(rows[0]);
  } catch (error) {
 
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
