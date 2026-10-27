// Conexión única con PostgreSQL. Los módulos acceden a la base solo mediante sus repositorios.
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

module.exports = { pool };
