// Conexión única con PostgreSQL. Los módulos acceden a la base solo mediante sus repositorios.
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// Si no se define DATABASE_URL, se arma con el servidor de DATABASE_ADMIN_URL y el usuario app_remates
function urlAplicacion() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.DATABASE_ADMIN_URL && process.env.APP_DB_PASSWORD) {
    const u = new URL(process.env.DATABASE_ADMIN_URL);
    u.username = 'app_remates';
    u.password = encodeURIComponent(process.env.APP_DB_PASSWORD);
    return u.toString();
  }
  return undefined;
}

const pool = new Pool({ connectionString: urlAplicacion(), max: 10 });

module.exports = { pool, urlAplicacion };
