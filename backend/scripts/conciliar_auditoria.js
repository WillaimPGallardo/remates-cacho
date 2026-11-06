// Inserta en registro_auditoria los eventos que no pudieron guardarse porque la base de datos
// no estaba disponible (archivo logs/auditoria_pendiente.jsonl). Uso: npm run auditoria:conciliar
require('dotenv').config({ quiet: true });
const { conciliarPendientes, ARCHIVO_PENDIENTES } = require('../src/comun/auditoria');
const { pool } = require('../src/config/db');

conciliarPendientes()
  .then(n => console.log(`${n} evento(s) conciliado(s) desde ${ARCHIVO_PENDIENTES}`))
  .catch(e => { console.error('No fue posible conciliar:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
