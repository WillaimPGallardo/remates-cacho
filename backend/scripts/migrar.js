// Aplica en orden los scripts de db/migraciones sobre la base indicada en DATABASE_ADMIN_URL.
// Uso: npm run db:migrar
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrar(url = process.env.DATABASE_ADMIN_URL, log = console.log) {
  const dir = path.join(__dirname, '..', '..', 'db', 'migraciones');
  const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    for (const archivo of archivos) {
      await cliente.query(fs.readFileSync(path.join(dir, archivo), 'utf8'));
      log('Aplicada', archivo);
    }
  } finally {
    await cliente.end();
  }
}

if (require.main === module) migrar().catch(e => { console.error(e.message); process.exit(1); });
module.exports = migrar;
