// Aplica las migraciones pendientes de db/migraciones sobre DATABASE_ADMIN_URL.
// - Registra cada script en schema_migraciones, así se puede ejecutar en cada arranque sin repetir nada.
// - Fija la contraseña del usuario de la aplicación (app_remates) con APP_DB_PASSWORD.
// - Si se define GERENTE_CONTRASENA_INICIAL, reemplaza la contraseña temporal del gerente inicial
//   mientras nunca haya iniciado sesión (evita usar la contraseña pública del repositorio en internet).
// Uso: npm run db:migrar
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const claveApp = () => process.env.APP_DB_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'cambiar_en_produccion');

async function migrar(url = process.env.DATABASE_ADMIN_URL, log = console.log) {
  if (!url) throw new Error('Falta DATABASE_ADMIN_URL');
  const dir = path.join(__dirname, '..', '..', 'db', 'migraciones');
  const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    const existe = (await cliente.query(`SELECT to_regclass('public.schema_migraciones') IS NOT NULL AS t, to_regclass('public.usuario') IS NOT NULL AS u`)).rows[0];
    await cliente.query('CREATE TABLE IF NOT EXISTS schema_migraciones (nombre VARCHAR(100) PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())');
    if (!existe.t && existe.u) {
      // Base creada antes del control de migraciones: 001 a 003 ya estaban aplicadas
      await cliente.query(`INSERT INTO schema_migraciones (nombre) VALUES ('001_esquema_sprint1.sql'), ('002_datos_iniciales.sql'), ('003_usuario_aplicacion.sql') ON CONFLICT DO NOTHING`);
    }
    const hechas = new Set((await cliente.query('SELECT nombre FROM schema_migraciones')).rows.map(r => r.nombre));
    for (const archivo of archivos) {
      if (hechas.has(archivo)) continue;
      await cliente.query(fs.readFileSync(path.join(dir, archivo), 'utf8'));
      await cliente.query('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [archivo]);
      log('Aplicada', archivo);
    }
    const clave = claveApp();
    if (!clave) throw new Error('En producción debe definir APP_DB_PASSWORD');
    await cliente.query(`ALTER ROLE app_remates WITH LOGIN PASSWORD ${cliente.escapeLiteral(clave)}`);
    const inicial = process.env.GERENTE_CONTRASENA_INICIAL;
    if (inicial) {
      const r = await cliente.query(
        `UPDATE usuario SET contrasena_hash = $1, contrasena_temporal_expira = now() + interval '7 days'
         WHERE nombre_usuario = 'gerente' AND requiere_cambio_contrasena
           AND NOT EXISTS (SELECT 1 FROM sesion s WHERE s.id_usuario = usuario.id_usuario)`, [bcrypt.hashSync(inicial, 12)]);
      if (r.rowCount) log('Contraseña inicial del gerente definida desde GERENTE_CONTRASENA_INICIAL');
    }
    log('Base de datos al día');
  } finally {
    await cliente.end();
  }
}

if (require.main === module) migrar().catch(e => { console.error(e.message); process.exit(1); });
module.exports = migrar;
