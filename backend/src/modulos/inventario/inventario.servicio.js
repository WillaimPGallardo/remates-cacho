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
async function aplicarMovimiento(db, { idProducto, idUsuario, tipo, subtipo, cantidad, motivo, claveOperacion }, ctx) {
  const prod = await repo.bloquearProducto(db, idProducto);   // SELECT ... FOR UPDATE
  if (!prod) throw noEncontrado('Producto no encontrado');
  const anterior = prod.stock_actual;
  const nuevo = tipo === 'ENTRADA' ? anterior + cantidad : anterior - cantidad;
  if (nuevo < 0) throw conflicto(`Existencia insuficiente. Disponible: ${anterior}`, { cantidad: `Existencia insuficiente. Disponible: ${anterior}` });
  const mov = await repo.insertarMovimiento(db, { id_producto: idProducto, id_usuario: idUsuario, tipo, subtipo, cantidad, stock_anterior: anterior, stock_nuevo: nuevo, motivo, clave_operacion: claveOperacion });
  await repo.actualizarStock(db, idProducto, nuevo);
  await registrar(db, { ...ctx, modulo: 'Inventario', tipo: 'MOVIMIENTO_INVENTARIO', entidad: 'producto', idEntidad: idProducto,
    anterior: { stock: anterior }, nuevo: { stock: nuevo, tipo, subtipo, cantidad, id_movimiento: mov.id_movimiento } });
  return { id_movimiento: mov.id_movimiento, fecha_hora: mov.fecha_hora, sku: prod.sku, nombre: prod.nombre, stock_anterior: anterior, stock_nuevo: nuevo };
}

// Respuesta uniforme de un movimiento ya registrado con la misma clave de operación
const resultadoExistente = m => ({ id_movimiento: m.id_movimiento, fecha_hora: m.fecha_hora, sku: m.sku, nombre: m.nombre,
  stock_anterior: m.stock_anterior, stock_nuevo: m.stock_nuevo, repetido: true });

// Entradas por recepción y salidas por despacho registradas por el usuario.
// Cada operación trae una clave única (encabezado Idempotency-Key, PG-15): si ya se registró, se devuelve el resultado
// original sin volver a aplicarla; así un reintento después de perder la conexión no duplica el movimiento (RNF-05).
async function registrar_(datos, ctx) {
  const tipo = datos.tipo;
  const subtipo = tipo === 'ENTRADA' ? 'RECEPCION' : tipo === 'SALIDA' ? 'DESPACHO' : null;
  const errores = validar(datos, { id_producto: [true, null], tipo: [true, () => (subtipo ? null : 'Seleccione Entrada o Salida')],
    cantidad: [true, reglas.entero(1, P.CANTIDAD_MAXIMA)] });
  const motivo = texto(datos.motivo);
  if (motivo.length > 255) errores.motivo = 'Máximo 255 caracteres';
  // La salida por despacho no corresponde a ventas de mostrador (esas se descuentan con SALIDA · VENTA, RF-12):
  // exige el destino o el número de remisión para poder distinguirla en el kardex.
  if (tipo === 'SALIDA' && motivo.length < 3) errores.motivo = 'Indique el destino o el número de remisión del despacho';
  if (!ctx.claveOperacion) errores.clave_operacion = 'Falta la clave de operación (encabezado Idempotency-Key)';
  if (Object.keys(errores).length) throw validacion(errores);
  const previo = await repo.porClave(pool, ctx.claveOperacion);
  if (previo) return resultadoExistente(previo);
  try {
    return await enTransaccion(async db => {
      const prod = await repo.bloquearProducto(db, datos.id_producto);
      if (!prod) throw noEncontrado('Producto no encontrado');
      if (prod.estado !== 'ACTIVO') throw conflicto('Producto inactivo. Consulte a la Gerencia');
      return aplicarMovimiento(db, { idProducto: prod.id_producto, idUsuario: ctx.idUsuario, tipo, subtipo, cantidad: Number(datos.cantidad),
        motivo, claveOperacion: ctx.claveOperacion }, ctx);
    });
  } catch (e) {
    // Dos envíos simultáneos con la misma clave: el segundo choca con el índice único y devuelve el primero
    if (e.code === '23505' && /uq_movimiento_clave/.test(e.constraint || e.message)) {
      const m = await repo.porClave(pool, ctx.claveOperacion);
      if (m) return resultadoExistente(m);
    }
    throw e;
  }
}

// Consulta el resultado de una operación por su clave (la interfaz la usa en el estado «Verificando…»)
async function porClave(clave, usuario) {
  const c = String(clave || '').toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(c)) throw noEncontrado('La operación no está registrada');
  const m = await repo.porClave(pool, c);
  if (!m || m.id_usuario !== usuario.id_usuario) throw noEncontrado('La operación no está registrada');
  return resultadoExistente(m);
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

module.exports = { aplicarMovimiento, registrar: registrar_, porClave, kardex, SUBTIPOS };
