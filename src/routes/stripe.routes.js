import { Router } from 'express';
import Stripe from 'stripe';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { pool } from '../config/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = Router();

// PASO 1: el usuario pulsa "Pagar" -> creamos una sesión de Stripe Checkout
router.post('/crear-sesion', verificarToken, async (req, res, next) => {
  try {
    const [items] = await pool.query(
      `SELECT ci.cantidad, p.nombre, p.precio, p.id as producto_id
       FROM carrito_items ci JOIN productos p ON ci.producto_id = p.id
       WHERE ci.usuario_id = ?`, [req.usuario.id]
    );
    if (!items.length) return res.status(400).json({ error: 'Carrito vacío' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(req.usuario.id),
      line_items: items.map(i => ({
        price_data: {
          currency: 'eur',
          product_data: { name: i.nombre },
          unit_amount: Math.round(i.precio * 100), // Stripe trabaja en centavos
        },
        quantity: i.cantidad,
      })),
      success_url: `${process.env.CORS_ORIGIN}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.CORS_ORIGIN}/pago/cancelado`,
    });

    res.json({ url: session.url });
  } catch(e) { next(e); }
});

// PASO 2: Stripe llama aquí automáticamente cuando el pago se completa.
// No lleva JWT: verificamos la firma criptográfica de Stripe.
router.post('/webhook', async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).send('Firma inválida');
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = Number(s.client_reference_id);

    // Transacción: o se guarda todo (pedido + líneas + carrito vacío) o nada
    const con = await pool.getConnection();
    try {
      await con.beginTransaction();

      // 0. Stripe puede repetir el mismo aviso: si ya creamos este pedido, no hacemos nada
      const [yaExiste] = await con.query('SELECT id FROM pedidos WHERE stripe_session = ?', [s.id]);
      if (yaExiste.length) {
        await con.rollback();
        return res.json({ recibido: true, duplicado: true });
      }

      // 1. Leemos los items del carrito con sus precios actuales
      const [items] = await con.query(
        `SELECT producto_id, cantidad, p.precio
         FROM carrito_items ci JOIN productos p ON ci.producto_id = p.id
         WHERE ci.usuario_id = ? FOR UPDATE`, [userId]
      );

      if (items.length) {
        const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

        // 2. Creamos el pedido en estado 'pagado'
        const [pedido] = await con.query(
          'INSERT INTO pedidos (usuario_id, total, estado, stripe_session) VALUES (?,?,?,?)',
          [userId, total, 'pagado', s.id]
        );

        // 3. Guardamos cada línea del pedido
        const lineas = items.map(i => [pedido.insertId, i.producto_id, i.cantidad, i.precio]);
        await con.query('INSERT INTO pedido_lineas (pedido_id, producto_id, cantidad, precio_unit) VALUES ?', [lineas]);

        // 4. Vaciamos el carrito
        await con.query('DELETE FROM carrito_items WHERE usuario_id = ?', [userId]);
      } else {
        console.warn(`Webhook: pago ${s.id} sin items en el carrito del usuario ${userId}`);
      }

      await con.commit();
    } catch (e) {
      await con.rollback();
      console.error('Webhook: no se pudo guardar el pedido', e);
      // Respondemos 500 para que Stripe lo reintente más tarde
      return res.status(500).json({ error: 'No se pudo guardar el pedido' });
    } finally {
      con.release();
    }
  }

  res.json({ recibido: true });
});

export default router;