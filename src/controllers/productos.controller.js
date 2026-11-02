import * as svc from '../services/productos.service.js';

export async function listar(req, res, next) {
  try {
    const productos = await svc.listar(req.query);
    res.json({ datos: productos });
  } catch(e) { next(e); }
}

export async function detalle(req, res, next) {
  try {
    const p = await svc.obtenerPorId(req.params.id);
    res.json({ datos: p });
  } catch(e) { next(e); }
}

// 201 = "Created": el recurso se creó correctamente
export async function crear(req, res, next) {
  try {
    const p = await svc.crear(req.body);
    res.status(201).json({ datos: p });
  } catch(e) { next(e); }
}

export async function actualizar(req, res, next) {
  try {
    const p = await svc.actualizar(req.params.id, req.body);
    res.json({ datos: p });
  } catch(e) { next(e); }
}

// 204 = "No Content": borrado correcto, no hay nada que devolver
export async function eliminar(req, res, next) {
  try {
    await svc.eliminar(req.params.id);
    res.status(204).end();
  } catch(e) { next(e); }
}