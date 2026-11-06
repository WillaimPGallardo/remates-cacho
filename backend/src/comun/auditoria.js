// Servicio transversal de auditoría (RF-16).
// registrar(): dentro de la transacción de la operación (si falla la operación, se revierte con ella).
// registrarAparte(): en su propia conexión, para accesos denegados, intentos fallidos y operaciones FALLIDAS.
//   Si la base de datos no está disponible, el evento se escribe en un archivo JSON (una línea por evento)
//   y se concilia después con «npm run auditoria:conciliar».
// id_correlacion agrupa los eventos de una misma operación (p. ej., un movimiento y su auditoría, o una venta,
// sus salidas y su comprobante): es la clave de operación cuando existe; si no, un UUID por petición.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/db');

const json = v => (v === undefined || v === null ? null : JSON.stringify(v));
const ARCHIVO_PENDIENTES = process.env.AUDITORIA_PENDIENTE || path.join(__dirname, '..', '..', 'logs', 'auditoria_pendiente.jsonl');

async function registrar(db, ev) {
  await db.query(
    `INSERT INTO registro_auditoria (id_usuario, modulo, tipo_operacion, entidad_afectada, id_entidad_afectada,
       valor_anterior, valor_nuevo, direccion_ip, dispositivo, resultado, codigo_error, id_correlacion, fecha_hora)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, coalesce($13::timestamptz, now()))`,
    [ev.idUsuario ?? null, ev.modulo, ev.tipo, ev.entidad ?? null, ev.idEntidad != null ? String(ev.idEntidad) : null,
      json(ev.anterior), json(ev.nuevo), ev.ip ?? null, ev.dispositivo ? String(ev.dispositivo).slice(0, 150) : null,
      ev.resultado || 'EXITOSO', ev.codigoError ?? null, ev.correlacion ? String(ev.correlacion).slice(0, 64) : null,
      ev.fechaHora ?? null]);
}

// Respaldo en archivo cuando la base de datos no está disponible
function guardarPendiente(ev, motivo) {
  try {
    fs.mkdirSync(path.dirname(ARCHIVO_PENDIENTES), { recursive: true });
    fs.appendFileSync(ARCHIVO_PENDIENTES, JSON.stringify({ ...ev, fechaHora: ev.fechaHora || new Date().toISOString(), motivoPendiente: motivo }) + '\n');
  } catch (e) { console.error('No se pudo guardar el evento de auditoría pendiente', e.message); }
}

async function registrarAparte(ev) {
  try { await registrar(pool, ev); } catch (e) {
    console.error('No se pudo registrar la auditoría en la base de datos; se guarda en el archivo de pendientes', e.message);
    guardarPendiente(ev, e.code || e.message);
  }
}

// Inserta en la base los eventos pendientes del archivo y lo vacía. Devuelve cuántos se conciliaron.
async function conciliarPendientes(db = pool) {
  if (!fs.existsSync(ARCHIVO_PENDIENTES)) return 0;
  const lineas = fs.readFileSync(ARCHIVO_PENDIENTES, 'utf8').split('\n').filter(Boolean);
  let n = 0;
  for (const l of lineas) {
    const ev = JSON.parse(l);
    delete ev.motivoPendiente;
    await registrar(db, ev);
    n += 1;
  }
  fs.writeFileSync(ARCHIVO_PENDIENTES, '');
  return n;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const claveOperacion = req => {
  const c = req.get('Idempotency-Key');
  return c && UUID.test(c) ? c.toLowerCase() : null;
};

// Middleware: identificador de correlación de la petición
function correlacion(req, _res, next) {
  req.claveOperacion = claveOperacion(req);
  req.correlacion = req.claveOperacion || crypto.randomUUID();
  next();
}

// Datos de contexto de la petición
const contexto = req => ({ idUsuario: req.usuario?.id_usuario, ip: req.ip, dispositivo: req.get('user-agent'),
  correlacion: req.correlacion, claveOperacion: req.claveOperacion });

module.exports = { registrar, registrarAparte, conciliarPendientes, contexto, correlacion, ARCHIVO_PENDIENTES };
