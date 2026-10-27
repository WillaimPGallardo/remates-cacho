// RF-06 Entradas, RF-07 Salidas por despacho y RF-10 Kardex.
// El stock SOLO cambia mediante aplicarMovimiento (PG-10), dentro de una transacción con bloqueo de fila.
const P = require('../../config/parametros');
const repo = require('./inventario.repositorio');
const { pool } = require('../../config/db');
const { enTransaccion } = require('../../comun/transaccion');
const { registrar } = require('../../comun/auditoria');
const { reglas, validar, rangoFechas, texto } = require('../../comun/validaciones');
const { validacion, noEncontrado, conflicto } = require('../../comun/errores');

const SUBTIPOS = { ENTRADA: ['RECEPCION', 'INICIAL', 'REVERSION_VENTA'], SALIDA: ['DESPACHO', 'VENTA'] };

// Uso interno de otros módulos (p. ej., la entrada INICIAL de RF-03). db debe estar en transacción.
async function aplicarMovimiento(db, { idProducto, idUsuario, tipo, subtipo, cantidad, motivo }, ctx) {
  const prod = await repo.bloquearProducto(db, idProducto);   // SELECT ... FOR UPDATE
  if (!prod) throw noEncontrado('Producto no encontrado');
  const anterior = prod.stock_actual;
  const nuevo = tipo === 'ENTRADA' ? anterior + cantidad : anterior - cantidad;
  if (nuevo < 0) throw conflicto(`Existencia insuficiente. Disponible: ${anterior}`, { cantidad: `Existencia insuficiente. Disponible: ${anterior}` });
  const mov = await repo.insertarMovimiento(db, { id_producto: idProducto, id_usuario: idUsuario, tipo, subtipo, cantidad, stock_anterior: anterior, stock_nuevo: nuevo, motivo });
  await repo.actualizarStock(db, idProducto, nuevo);
  await registrar(db, { ...ctx, modulo: 'Inventario', tipo: 'MOVIMIENTO_INVENTARIO', entidad: 'producto', idEntidad: idProducto,
    anterior: { stock: anterior }, nuevo: { stock: nuevo, tipo, subtipo, cantidad, id_movimiento: mov.id_movimiento } });
  return { id_movimiento: mov.id_movimiento, fecha_hora: mov.fecha_hora, sku: prod.sku, nombre: prod.nombre, stock_anterior: anterior, stock_nuevo: nuevo };
}

// Entradas por recepción y salidas por despacho registradas por el usuario
async function registrar_(datos, ctx) {
  const tipo = datos.tipo;
  const subtipo = tipo === 'ENTRADA' ? 'RECEPCION' : tipo === 'SALIDA' ? 'DESPACHO' : null;
  const errores = validar(datos, { id_producto: [true, null], tipo: [true, () => (subtipo ? null : 'Seleccione Entrada o Salida')],
    cantidad: [true, reglas.entero(1, P.CANTIDAD_MAXIMA)] });
  if (datos.motivo && texto(datos.motivo).length > 255) errores.motivo = 'Máximo 255 caracteres';
  if (Object.keys(errores).length) throw validacion(errores);
  return enTransaccion(async db => {
    const prod = await repo.bloquearProducto(db, datos.id_producto);
    if (!prod) throw noEncontrado('Producto no encontrado');
    if (prod.estado !== 'ACTIVO') throw conflicto('Producto inactivo. Consulte a la Gerencia');
    return aplicarMovimiento(db, { idProducto: prod.id_producto, idUsuario: ctx.idUsuario, tipo, subtipo, cantidad: Number(datos.cantidad), motivo: texto(datos.motivo) }, ctx);
  });
}

async function kardex(idProducto, q) {
  const r = rangoFechas(q.desde, q.hasta);
  if (r.error) throw validacion({ fechas: r.error });
  if (q.tipo && !['ENTRADA', 'SALIDA', 'AJUSTE'].includes(q.tipo)) throw validacion({ tipo: 'Tipo no válido' });
  const prod = await pool.query('SELECT id_producto, sku, nombre, stock_actual, stock_minimo FROM producto WHERE id_producto = $1', [idProducto]).then(x => x.rows[0]);
  if (!prod) throw noEncontrado('El producto no existe');
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const datos = await repo.kardex(pool, idProducto, { desde: r.desde, hasta: r.hasta, tipo: q.tipo }, P.POR_PAGINA_KARDEX, (pagina - 1) * P.POR_PAGINA_KARDEX);
  return { producto: prod, desde: r.desde, hasta: r.hasta, pagina, ...datos,
    mensaje: datos.total === 0 ? 'No hay movimientos para el período seleccionado' : null };
}

module.exports = { aplicarMovimiento, registrar: registrar_, kardex, SUBTIPOS };
