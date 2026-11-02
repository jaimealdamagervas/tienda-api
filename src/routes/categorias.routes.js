import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [filas] = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json({ datos: filas });
  } catch(e) { next(e); }
});

export default router;