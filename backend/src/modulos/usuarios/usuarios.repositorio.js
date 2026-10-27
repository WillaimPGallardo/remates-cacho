const CAMPOS = `u.id_usuario, u.nombre_completo, u.nombre_usuario, u.correo, r.nombre AS rol, u.estado,
  u.intentos_fallidos, u.bloqueado_hasta, u.requiere_cambio_contrasena, u.fecha_creacion, u.fecha_actualizacion,
  (SELECT max(fecha_inicio) FROM sesion s WHERE s.id_usuario = u.id_usuario) AS ultimo_acceso`;

function listar(db, { q, rol, estado }) {
  const cond = []; const p = [];
  if (q) { p.push(`%${q.toLowerCase()}%`); cond.push(`(lower(u.nombre_completo) LIKE $${p.length} OR lower(u.nombre_usuario) LIKE $${p.length} OR lower(u.correo) LIKE $${p.length})`); }
  if (rol) { p.push(rol); cond.push(`r.nombre = $${p.length}`); }
  if (estado === 'BLOQUEADO') cond.push('u.bloqueado_hasta > now()');
  else if (estado) { p.push(estado); cond.push(`u.estado = $${p.length}`); }
  return db.query(`SELECT ${CAMPOS} FROM usuario u JOIN rol r USING (id_rol) ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY u.nombre_completo`, p).then(r => r.rows);
}
const obtener = (db, id, bloquear = false) => db.query(`SELECT ${CAMPOS}, u.id_rol FROM usuario u JOIN rol r USING (id_rol) WHERE u.id_usuario = $1 ${bloquear ? 'FOR UPDATE OF u' : ''}`, [id]).then(r => r.rows[0]);
const idRol = (db, nombre) => db.query('SELECT id_rol FROM rol WHERE nombre = $1', [nombre]).then(r => r.rows[0]?.id_rol);
const existeUsuario = (db, nombre, excepto = 0) => db.query('SELECT 1 FROM usuario WHERE lower(nombre_usuario) = lower($1) AND id_usuario <> $2', [nombre, excepto]).then(r => r.rowCount > 0);
const existeCorreo = (db, correo, excepto = 0) => db.query('SELECT 1 FROM usuario WHERE lower(correo) = lower($1) AND id_usuario <> $2', [correo, excepto]).then(r => r.rowCount > 0);
const crear = (db, d) => db.query(
  `INSERT INTO usuario (id_rol, nombre_completo, nombre_usuario, correo, contrasena_hash, requiere_cambio_contrasena)
   VALUES ($1,$2,$3,$4,$5, TRUE) RETURNING id_usuario`, [d.id_rol, d.nombre_completo, d.nombre_usuario, d.correo, d.hash]).then(r => r.rows[0].id_usuario);
const actualizar = (db, id, d) => db.query(
  'UPDATE usuario SET nombre_completo = $2, correo = $3, id_rol = $4, fecha_actualizacion = now() WHERE id_usuario = $1', [id, d.nombre_completo, d.correo, d.id_rol]);
const cambiarEstado = (db, id, estado) => db.query(
  `UPDATE usuario SET estado = $2::varchar, intentos_fallidos = CASE WHEN $2::varchar = 'ACTIVO' THEN 0 ELSE intentos_fallidos END,
   bloqueado_hasta = CASE WHEN $2::varchar = 'ACTIVO' THEN NULL ELSE bloqueado_hasta END, fecha_actualizacion = now() WHERE id_usuario = $1`, [id, estado]);
const gerentesActivos = db => db.query(`SELECT count(*)::int AS n FROM usuario u JOIN rol r USING (id_rol) WHERE r.nombre = 'GERENCIA' AND u.estado = 'ACTIVO'`).then(r => r.rows[0].n);
const fijarTemporal = (db, id, hash, expira) => db.query(
  `UPDATE usuario SET contrasena_hash = $2, requiere_cambio_contrasena = TRUE, contrasena_temporal_expira = $3,
   intentos_fallidos = 0, bloqueado_hasta = NULL, fecha_actualizacion = now() WHERE id_usuario = $1`, [id, hash, expira]);

module.exports = { listar, obtener, idRol, existeUsuario, existeCorreo, crear, actualizar, cambiarEstado, gerentesActivos, fijarTemporal };
