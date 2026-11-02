import { pool } from '../config/db.js';

export async function listar(query) {
  let sql = 'SELECT p.*, c.nombre as categoria FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id';
  const condiciones = [];
  const params = [];

  if (query.categoria) { condiciones.push('c.slug = ?'); params.push(query.categoria); }
  if (query.buscar) { condiciones.push('p.nombre LIKE ?'); params.push(`%${query.buscar}%`); }
  if (query.destacado) { condiciones.push('p.destacado = TRUE'); }
  if (condiciones.length) sql += ' WHERE ' + condiciones.join(' AND ');
  if (query.orden === 'precio') sql += ' ORDER BY p.precio';
  else sql += ' ORDER BY p.creado_en DESC';

  const [filas] = await pool.query(sql, params);
  return filas;
}

export async function obtenerPorId(id) {
  const [filas] = await pool.query('SELECT p.*, c.nombre as categoria FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?', [id]);
  if (!filas.length) { const e = new Error('Producto no encontrado'); e.status = 404; throw e; }
  return filas[0];
}

// Solo estas columnas se pueden crear o modificar desde el panel admin.
// Así un campo inesperado en el body (id, creado_en...) no llega a la base de datos.
const CAMPOS = ['nombre', 'descripcion', 'precio', 'imagen', 'stock', 'destacado', 'categoria_id'];

function conEstado(mensaje, status) {
  const e = new Error(mensaje);
  e.status = status;
  return e;
}

function limpiar(datos) {
  const limpio = {};
  for (const campo of CAMPOS) if (datos[campo] !== undefined) limpio[campo] = datos[campo];
  if (limpio.precio !== undefined && !(Number(limpio.precio) >= 0)) throw conEstado('Precio no válido', 400);
  if (limpio.stock !== undefined && !(Number.isInteger(Number(limpio.stock)) && Number(limpio.stock) >= 0))
    throw conEstado('Stock no válido', 400);
  if (!Object.keys(limpio).length) throw conEstado('No hay datos que guardar', 400);
  return limpio;
}

export async function crear(datos) {
  const [r] = await pool.query('INSERT INTO productos SET ?', [limpiar(datos)]);
  return obtenerPorId(r.insertId);
}

export async function actualizar(id, datos) {
  await pool.query('UPDATE productos SET ? WHERE id = ?', [limpiar(datos), id]);
  return obtenerPorId(id);
}

export async function eliminar(id) {
  await obtenerPorId(id); // Lanza 404 si no existe
  await pool.query('DELETE FROM productos WHERE id = ?', [id]);
}