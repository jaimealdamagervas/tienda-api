// Reenvía los webhooks de Stripe a la API local (solo para desarrollo).
// Uso: npm run stripe   (déjalo abierto mientras pruebas pagos)
//
// Usa la STRIPE_SECRET_KEY del .env, así no hace falta "stripe login"
// y la clave no aparece escrita en la terminal.
import 'dotenv/config';
import { spawn } from 'node:child_process';

const clave = process.env.STRIPE_SECRET_KEY;
if (!clave?.startsWith('sk_test_')) {
  console.error('Falta STRIPE_SECRET_KEY (sk_test_...) en el .env');
  process.exit(1);
}

const destino = `localhost:${process.env.PORT ?? 4000}/api/stripe/webhook`;
console.log(`Reenviando webhooks de Stripe a ${destino} (Ctrl+C para parar)\n`);

const proceso = spawn('stripe', [
  'listen',
  '--api-key', clave,
  '--events', 'checkout.session.completed',
  '--forward-to', destino,
], { stdio: 'inherit' });

proceso.on('error', () => {
  console.error('No se encontró el comando "stripe". Instálalo con: winget install Stripe.StripeCli');
  process.exit(1);
});
proceso.on('exit', (codigo) => process.exit(codigo ?? 0));
