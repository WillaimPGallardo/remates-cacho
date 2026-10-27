const CAMPOS = `p.id_producto, p.sku, p.nombre, p.referencia, p.id_categoria, c.nombre AS categoria, p.id_ubicacion,
  CASE WHEN u.id_ubicacion IS NULL THEN NULL ELSE u.zona || ' · ' || u.estante || coalesce(' · ' || u.nivel, '') END AS ubicacion,
  p.precio_compra, p.precio_venta, p.stock_actual, p.stock_minimo, p.estado, p.fecha_actualizacion,
  cb.valor AS codigo, cb.tipo AS tipo_codigo, (p.stock_actual <= p.stock_minimo) AS bajo_stock`;
const FROM = `FROM producto p JOIN categoria c USING (id_categoria) LEFT JOIN ubicacion u USING (id_ubicacion)
  LEFT JOIN codigo_barras cb ON cb.id_producto = p.id_producto`;

function buscar(db, { q, id_categoria, estado, bajo_stock }, soloActivos, limite, desplazamiento) {
  const cond = []; const p = [];
  if (q) {
    p.push(q.trim());
    p.push(`%${q.trim().toLowerCase()}%`);
    cond.push(`(upper(p.sku) = upper($${p.length - 1}) OR cb.valor = $${p.length - 1} OR lower(p.nombre) LIKE $${p.length})`);
  }
  if (id_categoria) { p.push(id_categoria); cond.push(`p.id_categoria = $${p.length}`); }
  if (soloActivos) cond.push(`p.estado = 'ACTIVO'`);
  else if (estado) { p.push(estado); cond.push(`p.estado = $${p.length}`); }
  if (bajo_stock === 'true') cond.push('p.stock_actual <= p.stock_minimo');
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const orden = q ? `ORDER BY (upper(p.sku) = upper($1) OR cb.valor = $1) DESC, p.nombre` : 'ORDER BY p.nombre';
  return Promise.all([
    db.query(`SELECT ${CAMPOS} ${FROM} ${where} ${orden} LIMIT ${limite} OFFSET ${desplazamiento}`, p),
    db.query(`SELECT count(*)::int AS total ${FROM} ${where}`, p),
  ]).then(([a, b]) => ({ productos: a.rows, total: b.rows[0].total }));
}

const obtener = (db, id, bloquear = false) => db.query(`SELECT ${CAMPOS} ${FROM} WHERE p.id_producto = $1 ${bloquear ? 'FOR UPDATE OF p' : ''}`, [id]).then(r => r.rows[0]);
const existeSku = (db, sku, excepto = 0) => db.query('SELECT 1 FROM producto WHERE sku = $1 AND id_producto <> $2', [sku, excepto]).then(r => r.rowCount > 0);
const duenoCodigo = (db, valor) => db.query('SELECT p.id_producto, p.sku FROM codigo_barras cb JOIN producto p USING (id_producto) WHERE cb.valor = $1', [valor]).then(r => r.rows[0]);
const existeCategoria = (db, id) => db.query('SELECT 1 FROM categoria WHERE id_categoria = $1', [id]).then(r => r.rowCount > 0);
const existeUbicacion = (db, id) => db.query('SELECT 1 FROM ubicacion WHERE id_ubicacion = $1', [id]).then(r => r.rowCount > 0);
const crear = (db, d) => db.query(
  `INSERT INTO producto (id_categoria, id_ubicacion, sku, nombre, referencia, precio_compra, precio_venta, stock_minimo, estado)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVO') RETURNING id_producto`,
  [d.id_categoria, d.id_ubicacion || null, d.sku, d.nombre, d.referencia || null, d.precio_compra, d.precio_venta, d.stock_minimo]).then(r => r.rows[0].id_producto);
const actualizar = (db, id, d) => db.query(
  `UPDATE producto SET id_categoria=$2, id_ubicacion=$3, sku=$4, nombre=$5, referencia=$6, precio_compra=$7, precio_venta=$8,
   stock_minimo=$9, estado=$10, fecha_actualizacion = now() WHERE id_producto = $1`,
  [id, d.id_categoria, d.id_ubicacion || null, d.sku, d.nombre, d.referencia || null, d.precio_compra, d.precio_venta, d.stock_minimo, d.estado]);
const siguienteInterno = db => db.query(`SELECT nextval('seq_codigo_interno') AS n`).then(r => Number(r.rows[0].n));
const guardarCodigo = (db, id, valor, tipo) => db.query(
  `INSERT INTO codigo_barras (id_producto, valor, tipo) VALUES ($1,$2,$3)
   ON CONFLICT (id_producto) DO UPDATE SET valor = EXCLUDED.valor, tipo = EXCLUDED.tipo, fecha_asignacion = now()`, [id, valor, tipo]);
const categorias = db => db.query('SELECT id_categoria, nombre FROM categoria ORDER BY nombre').then(r => r.rows);
const ubicaciones = db => db.query(`SELECT id_ubicacion, zona || ' · ' || estante || coalesce(' · ' || nivel, '') AS nombre FROM ubicacion ORDER BY zona, estante, nivel`).then(r => r.rows);

module.exports = { buscar, obtener, existeSku, duenoCodigo, existeCategoria, existeUbicacion, crear, actualizar, siguienteInterno, guardarCodigo, categorias, ubicaciones };
