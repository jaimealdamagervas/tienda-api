import { Router } from 'express';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';
import * as ctrl from '../controllers/productos.controller.js';

const router = Router();

// Rutas públicas: cualquiera puede ver productos
router.get('/',    ctrl.listar);
router.get('/:id', ctrl.detalle);

// Rutas protegidas: primero token JWT válido, luego rol admin
router.post('/',   verificarToken, soloAdmin, ctrl.crear);
router.put('/:id', verificarToken, soloAdmin, ctrl.actualizar);
router.delete('/:id', verificarToken, soloAdmin, ctrl.eliminar);

export default router;