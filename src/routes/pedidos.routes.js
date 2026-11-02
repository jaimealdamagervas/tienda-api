import { Router } from 'express';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';
import { pool } from '../config/db.js';

const router = Router();
router.use(verificarToken);

// Historial del usuario
router.get('/', async (req, res, next) => {
  try {
    let sql = 'SELECT * FROM pedidos';
    let params = [];
    if (req.query.stripe_session) {
      // Solo pedidos del propio usuario: sin esto, cualquiera vería pedidos ajenos
      sql += ' WHERE stripe_session = ? AND usuario_id = ?'; params = [req.query.stripe_session, req.usuario.id];
    } else {
      sql += ' WHERE usuario_id = ?'; params = [req.usuario.id];
    }
    sql += ' ORDER BY creado_en DESC';
    const [pedidos] = await pool.query(sql, params);

    // Si es un pedido específico, traer las líneas
    if (pedidos.length === 1) {
      const [lineas] = await pool.query(
        'SELECT pl.*, p.nombre FROM pedido_lineas pl JOIN productos p ON pl.producto_id = p.id WHERE pl.pedido_id = ?',
        [pedidos[0].id]
      );
      pedidos[0].lineas = lineas;
    }
    res.json({ datos: pedidos.length === 1 ? pedidos[0] : pedidos });
  } catch(e) { next(e); }
});

// Detalle de pedido
router.get('/:id', async (req, res, next) => {
  try {
    const [pedidos] = await pool.query('SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuario.id]);
    if (!pedidos.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    const [lineas] = await pool.query(
      'SELECT pl.*, p.nombre FROM pedido_lineas pl JOIN productos p ON pl.producto_id = p.id WHERE pl.pedido_id = ?',
      [req.params.id]
    );
    res.json({ datos: { ...pedidos[0], lineas } });
  } catch(e) { next(e); }
});

// Admin: todos los pedidos
router.get('/admin/todos', soloAdmin, async (req, res, next) => {
  try {
    const [pedidos] = await pool.query('SELECT p.*, u.nombre as cliente FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id ORDER BY p.creado_en DESC');
    res.json({ datos: pedidos });
  } catch(e) { next(e); }
});

export default router;