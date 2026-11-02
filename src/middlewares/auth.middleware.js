import jwt from 'jsonwebtoken';

export function verificarToken(req, res, next) {
  // El cliente envía: Authorization: Bearer eyJhbGciOi...
  const header = req.headers.authorization;

  // Si no hay cabecera o no empieza por "Bearer ", no hay token
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });

  try {
    // header.slice(7) quita "Bearer " y deja solo el token.
    // jwt.verify() comprueba la firma y que no haya expirado.
    const datos = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    // El refresh token solo sirve para pedir tokens nuevos, no para usar la API
    if (datos.tipo === 'refresh') throw new Error('Refresh token');
    req.usuario = datos;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Este middleware SIEMPRE va DESPUÉS de verificarToken,
// porque necesita que req.usuario ya exista.
export function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin')
    return res.status(403).json({ error: 'Se requiere rol admin' });
  next();
}