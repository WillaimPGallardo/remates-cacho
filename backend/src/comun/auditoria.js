// Servicio transversal de auditoría (RF-16).
// registrar(): dentro de la transacción de la operación (si falla la operación, se revierte con ella).
// registrarAparte(): en su propia conexión, para accesos denegados, intentos fallidos y operaciones FALLIDAS.
const { pool } = require('../config/db');

const json = v => (v === undefined || v === null ? null : JSON.stringify(v));

async function registrar(db, ev) {
  await db.query(
    `INSERT INTO registro_auditoria (id_usuario, modulo, tipo_operacion, entidad_afectada, id_entidad_afectada,
       valor_anterior, valor_nuevo, direccion_ip, dispositivo, resultado, codigo_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [ev.idUsuario ?? null, ev.modulo, ev.tipo, ev.entidad ?? null, ev.idEntidad != null ? String(ev.idEntidad) : null,
      json(ev.anterior), json(ev.nuevo), ev.ip ?? null, ev.dispositivo ? String(ev.dispositivo).slice(0, 150) : null,
      ev.resultado || 'EXITOSO', ev.codigoError ?? null]);
}

async function registrarAparte(ev) {
  try { await registrar(pool, ev); } catch (e) { console.error('No se pudo registrar la auditoría', e.message); }
}

// Datos de contexto de la petición
const contexto = req => ({ idUsuario: req.usuario?.id_usuario, ip: req.ip, dispositivo: req.get('user-agent') });

module.exports = { registrar, registrarAparte, contexto };
