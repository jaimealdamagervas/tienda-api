import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const router = Router();

function generarTokens(usuario) {
  const payload = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  // "tipo: refresh" impide usar el refresh token como token de acceso (y al revés)
  const refresh = jwt.sign({ ...payload, tipo: 'refresh' }, process.env.JWT_SECRET,
                           { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });
  return { token, refresh };
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registro
router.post('/registro', async (req, res, next) => {
  try {
    const nombre = String(req.body.nombre ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');

    // El navegador ya valida, pero la API no puede fiarse de lo que le llega
    if (!nombre || !EMAIL_VALIDO.test(email) || password.length < 6)
      return res.status(400).json({ error: 'Nombre, email válido y contraseña de al menos 6 caracteres' });

    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?,?,?)', [nombre, email, hash]
    );
    const usuario = { id: r.insertId, nombre, email, rol: 'cliente' };
    res.status(201).json({ datos: { ...usuario, ...generarTokens(usuario) } });
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El email ya está registrado' });
    next(e);
  }
});

// Login con email/password
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const [filas] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!filas.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const u = filas[0];
    if (!u.password_hash || !(await bcrypt.compare(password, u.password_hash)))
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    res.json({ datos: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, ...generarTokens(u) } });
  } catch(e) { next(e); }
});

// Comprueba con Google que el id_token es auténtico, no ha caducado
// y fue emitido para NUESTRA aplicación. Devuelve sus datos o null.
async function verificarTokenGoogle(idToken) {
  if (typeof idToken !== 'string' || !idToken) return null;
  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!r.ok) return null; // Firma falsa, token caducado o mal formado
  const datos = await r.json();

  const emisorOk = ['accounts.google.com', 'https://accounts.google.com'].includes(datos.iss);
  const paraNosotros = datos.aud === process.env.GOOGLE_CLIENT_ID;
  const emailVerificado = datos.email_verified === true || datos.email_verified === 'true';
  if (!emisorOk || !paraNosotros || !emailVerificado || !datos.email) return null;
  return datos;
}

// Login/registro con Google
router.post('/google', async (req, res, next) => {
  try {
    // Antes se decodificaba el token sin verificarlo: cualquiera podía inventarse
    // uno con el email que quisiera (incluido el de un admin) y entrar.
    const google = await verificarTokenGoogle(req.body.token);
    if (!google) return res.status(401).json({ error: 'Token de Google no válido' });

    const email = google.email.toLowerCase();
    const nombre = google.name ?? email.split('@')[0];

    const [filas] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    let u;
    if (filas.length) {
      u = filas[0];
    } else {
      const [r] = await pool.query(
        "INSERT INTO usuarios (nombre, email, proveedor) VALUES (?,?,'google')", [nombre, email]
      );
      u = { id: r.insertId, nombre, email, rol: 'cliente' };
    }
    res.json({ datos: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, ...generarTokens(u) } });
  } catch(e) { next(e); }
});

// Renovar tokens: recibe el refresh token y devuelve un token de acceso nuevo.
// Así la sesión no "muere" cuando caduca el token de acceso (1 h).
router.post('/refresh', async (req, res, next) => {
  try {
    let datos;
    try {
      datos = jwt.verify(String(req.body.refresh ?? ''), process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Refresh token inválido o caducado' });
    }
    if (datos.tipo !== 'refresh') return res.status(401).json({ error: 'Refresh token inválido' });

    // Leemos el usuario de la base de datos por si le han cambiado el rol o ya no existe
    const [filas] = await pool.query('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?', [datos.id]);
    if (!filas.length) return res.status(401).json({ error: 'Usuario no encontrado' });
    const u = filas[0];
    res.json({ datos: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, ...generarTokens(u) } });
  } catch(e) { next(e); }
});

export default router;
