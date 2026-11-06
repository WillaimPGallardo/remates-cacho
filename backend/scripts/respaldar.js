// Copia de seguridad manual de la base de datos (PB-18, parte inicial; PG-17).
// Se usa en desarrollo y pruebas antes de cada migración. En producción la copia automática
// (completa semanal, incremental diaria y archivo WAL) se configura con pgBackRest en el Sprint 3.
// Requiere pg_dump en el PATH. Uso: npm run db:respaldo
// Restaurar: pg_restore --clean --if-exists -d <url_de_la_base> respaldos/<archivo>.dump
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const url = process.env.DATABASE_ADMIN_URL;
if (!url) { console.error('Falta DATABASE_ADMIN_URL'); process.exit(1); }
const dir = process.env.DIR_RESPALDOS || path.join(__dirname, '..', 'respaldos');
fs.mkdirSync(dir, { recursive: true });
const nombre = new URL(url).pathname.slice(1) || 'remates_cacho';
const archivo = path.join(dir, `${nombre}_${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
execFileSync('pg_dump', ['--format=custom', '--no-owner', '--file', archivo, url], { stdio: 'inherit' });
console.log(`Respaldo creado: ${archivo} (${(fs.statSync(archivo).size / 1024).toFixed(1)} KB)`);
// Retención local: se conservan las 10 copias más recientes
const copias = fs.readdirSync(dir).filter(f => f.startsWith(nombre + '_') && f.endsWith('.dump')).sort();
for (const f of copias.slice(0, -10)) fs.unlinkSync(path.join(dir, f));
