const { pool } = require('../config/db');

// Ejecuta fn(cliente) dentro de BEGIN/COMMIT; ante cualquier error hace ROLLBACK (RNF-04).
async function enTransaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

module.exports = { enTransaccion };
