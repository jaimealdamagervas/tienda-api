import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { pool } from '../config/db.js';

const router = Router();
router.use(verificarToken); // Todas las rutas del carrito requieren sesión

// Entero entre 1 y 99: evita cantidades negativas o enormes que alteren el pago
const cantidadValida = (n) => Number.isInteger(n) && n >= 1 && n <= 99;

// Ver carrito
router.get('/', async (req, res, next) => {
  try {
    const [items] = await pool.query(
      `SELECT ci.*, p.nombre, p.precio, p.imagen
       FROM carrito_items ci JOIN productos p ON ci.producto_id = p.id
       WHERE ci.usuario_id = ?`, [req.usuario.id]
    );
    res.json({ datos: items });
  } catch(e) { next(e); }
});

// Agregar producto
router.post('/', async (req, res, next) => {
  try {
    const productoId = Number(req.body.productoId);
    const cantidad = Number(req.body.cantidad ?? 1);
    if (!Number.isInteger(productoId) || !cantidadValida(cantidad))
      return res.status(400).json({ error: 'Producto o cantidad no válidos' });
    await pool.query(
      'INSERT INTO carrito_items (usuario_id, producto_id, cantidad) VALUES (?,?,?) ON DUPLICATE KEY UPDATE cantidad = LEAST(cantidad + ?, 99)',
      [req.usuario.id, productoId, cantidad, cantidad]
    );
    res.status(201).json({ ok: true });
  } catch(e) { next(e); }
});

// Cambiar cantidad
router.put('/:productoId', async (req, res, next) => {
  try {
    const cantidad = Number(req.body.cantidad);
    if (!cantidadValida(cantidad)) return res.status(400).json({ error: 'Cantidad no válida' });
    await pool.query(
      'UPDATE carrito_items SET cantidad = ? WHERE usuario_id = ? AND producto_id = ?',
      [cantidad, req.usuario.id, req.params.productoId]
    );
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// Quitar producto
router.delete('/:productoId', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM carrito_items WHERE usuario_id = ? AND producto_id = ?',
      [req.usuario.id, req.params.productoId]
    );
    res.status(204).end();
  } catch(e) { next(e); }
});

export default router;