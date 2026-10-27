const bloquearProducto = (db, id) => db.query('SELECT id_producto, sku, nombre, estado, stock_actual FROM producto WHERE id_producto = $1 FOR UPDATE', [id]).then(r => r.rows[0]);
const insertarMovimiento = (db, m) => db.query(
  `INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo_movimiento, subtipo, cantidad, stock_anterior, stock_nuevo, motivo)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_movimiento, fecha_hora`,
  [m.id_producto, m.id_usuario, m.tipo, m.subtipo, m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo || null]).then(r => r.rows[0]);
const actualizarStock = (db, id, stock) => db.query('UPDATE producto SET stock_actual = $2 WHERE id_producto = $1', [id, stock]);

function kardex(db, idProducto, { desde, hasta, tipo }, limite, desplazamiento) {
  const p = [idProducto, desde, hasta]; let filtro = '';
  if (tipo) { p.push(tipo); filtro = `AND m.tipo_movimiento = $${p.length}`; }
  const where = `WHERE m.id_producto = $1 AND m.fecha_hora BETWEEN $2 AND $3 ${filtro}`;
  return Promise.all([
    db.query(`SELECT m.id_movimiento, m.fecha_hora, m.tipo_movimiento, m.subtipo, m.cantidad, m.stock_anterior, m.stock_nuevo,
                     m.motivo, u.nombre_usuario AS usuario
              FROM movimiento_inventario m JOIN usuario u USING (id_usuario) ${where}
              ORDER BY m.fecha_hora, m.id_movimiento LIMIT ${limite} OFFSET ${desplazamiento}`, p),
    db.query(`SELECT count(*)::int AS total,
                     coalesce(sum(cantidad) FILTER (WHERE stock_nuevo > stock_anterior), 0)::int AS entradas,
                     coalesce(sum(cantidad) FILTER (WHERE stock_nuevo < stock_anterior), 0)::int AS salidas
              FROM movimiento_inventario m ${where}`, p),
  ]).then(([f, t]) => ({ movimientos: f.rows, ...t.rows[0] }));
}

module.exports = { bloquearProducto, insertarMovimiento, actualizarStock, kardex };
