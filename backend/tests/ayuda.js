const { Client } = require('pg');
const request = require('supertest');
const migrar = require('../scripts/migrar');
const app = require('../src/app');
const { pool } = require('../src/config/db');

// Recrea el esquema y aplica las migraciones
async function reiniciarBD() {
  const c = new Client({ connectionString: process.env.TEST_ADMIN_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  await migrar(process.env.TEST_ADMIN_URL, () => {});
}

async function sql(q, p) {
  const c = new Client({ connectionString: process.env.TEST_ADMIN_URL });
  await c.connect();
  try { return (await c.query(q, p)).rows; } finally { await c.end(); }
}

// Agente con sesión iniciada. Para el gerente inicial cambia la contraseña temporal.
async function sesion(usuario, contrasena, nueva) {
  const agente = request.agent(app);
  const r = await agente.post('/api/v1/auth/login').send({ usuario, contrasena });
  if (r.status !== 200) throw new Error(`login ${usuario}: ${r.status} ${JSON.stringify(r.body)}`);
  if (r.body.usuario.requiereCambio && nueva) {
    const c = await agente.post('/api/v1/auth/cambiar-contrasena').send({ actual: contrasena, nueva, confirmacion: nueva });
    if (c.status !== 200) throw new Error('cambio: ' + JSON.stringify(c.body));
  }
  return agente;
}

module.exports = { reiniciarBD, sql, sesion, app, pool, request };
