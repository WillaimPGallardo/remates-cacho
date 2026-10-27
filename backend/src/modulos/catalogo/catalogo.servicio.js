// RF-03 Gestión de productos, RF-04 Códigos y etiquetas, RF-05 Consulta de productos
const bwipjs = require('bwip-js');
const P = require('../../config/parametros');
const repo = require('./catalogo.repositorio');
const inventario = require('../inventario/inventario.servicio');
const { pool } = require('../../config/db');
const { enTransaccion } = require('../../comun/transaccion');
const { registrar } = require('../../comun/auditoria');
const { validar, reglas, texto, vacio } = require('../../comun/validaciones');
const { validarCodigo, formatoInterno } = require('../../comun/codigos');
const { validacion, noEncontrado, conflicto } = require('../../comun/errores');

const TIPOS_CODIGO = ['EAN_13', 'UPC_A', 'CODE_128'];

// Oculta el precio de compra a quien no tiene el permiso (RF-05)
const vista = (p, permisos) => (p && !permisos.includes('PRECIO_COMPRA_VER') ? { ...p, precio_compra: undefined } : p);

async function buscar(q, usuario) {
  const criterio = texto(q.q);
  if (criterio && criterio.length < 3 && !/^\d+$/.test(criterio)) throw validacion({ q: 'Escriba al menos 3 caracteres' });
  const soloActivos = !usuario.permisos.includes('PRODUCTOS_GESTIONAR');
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const limite = q.limite === '20' ? 20 : P.POR_PAGINA_LISTADOS;
  const r = await repo.buscar(pool, { ...q, q: criterio }, soloActivos, limite, (pagina - 1) * limite);
  return { ...r, pagina, productos: r.productos.map(p => vista(p, usuario.permisos)), mensaje: r.total === 0 ? 'No se encontraron productos' : null };
}

async function obtener(id, usuario) {
  const p = await repo.obtener(pool, id);
  if (!p || (p.estado !== 'ACTIVO' && !usuario.permisos.includes('PRODUCTOS_GESTIONAR'))) throw noEncontrado('El producto no existe');
  return vista(p, usuario.permisos);
}

function validarProducto(d, creando) {
  const esquema = {
    sku: [true, reglas.sku], nombre: [true, v => (texto(v).length <= 120 ? null : 'Máximo 120 caracteres')], id_categoria: [true, null],
    precio_compra: [true, reglas.precio], precio_venta: [true, reglas.precio], stock_minimo: [true, reglas.entero(0, P.CANTIDAD_MAXIMA)],
    referencia: [false, v => (texto(v).length <= 60 ? null : 'Máximo 60 caracteres')],
  };
  if (creando) esquema.existencia_inicial = [false, reglas.entero(0, P.CANTIDAD_MAXIMA)];
  else esquema.estado = [true, v => (['ACTIVO', 'INACTIVO'].includes(v) ? null : 'Estado no válido')];
  const errores = validar(d, esquema);
  if (creando && !vacio(d.codigo)) {
    if (!TIPOS_CODIGO.includes(d.tipo_codigo)) errores.tipo_codigo = 'Seleccione el tipo de código';
    else { const m = validarCodigo(d.tipo_codigo, d.codigo); if (m) errores.codigo = m; }
  }
  // Venta por debajo del costo: se permite con confirmación (PG-08)
  if (!errores.precio_compra && !errores.precio_venta && Number(d.precio_venta) < Number(d.precio_compra) && d.confirmar_precio_bajo !== true) {
    errores.precio_venta = 'El precio de venta es menor que el de compra. Confirme para continuar';
    errores._requiereConfirmacion = true;
  }
  return errores;
}

const normalizar = d => ({ ...d, sku: texto(d.sku).toUpperCase(), nombre: texto(d.nombre), referencia: texto(d.referencia),
  id_categoria: Number(d.id_categoria), id_ubicacion: d.id_ubicacion ? Number(d.id_ubicacion) : null, codigo: texto(d.codigo) });

// RF-03 subflujo A: registrar
async function crear(datos, ctx) {
  const d = normalizar(datos);
  const errores = validarProducto(d, true);
  if (Object.keys(errores).length) throw validacion(errores);
  return enTransaccion(async db => {
    if (!(await repo.existeCategoria(db, d.id_categoria))) throw validacion({ id_categoria: 'Categoría no válida' });
    if (d.id_ubicacion && !(await repo.existeUbicacion(db, d.id_ubicacion))) throw validacion({ id_ubicacion: 'Ubicación no válida' });
    if (await repo.existeSku(db, d.sku)) throw conflicto('El SKU ya existe', { sku: 'El SKU ya existe' });
    let valor = d.codigo, tipo = d.tipo_codigo;
    if (valor) {
      const dueno = await repo.duenoCodigo(db, valor);
      if (dueno) throw conflicto('Código duplicado', { codigo: `El código ya está asignado al producto ${dueno.sku}` });
    } else { valor = formatoInterno(await repo.siguienteInterno(db)); tipo = 'INTERNO'; }   // RF-04
    const id = await repo.crear(db, d);   // stock_actual = 0
    await repo.guardarCodigo(db, id, valor, tipo);
    await registrar(db, { ...ctx, modulo: 'Catálogo', tipo: 'CREACION_PRODUCTO', entidad: 'producto', idEntidad: id,
      nuevo: { sku: d.sku, nombre: d.nombre, precio_compra: d.precio_compra, precio_venta: d.precio_venta, codigo: valor, tipo_codigo: tipo } });
    const inicial = Number(d.existencia_inicial || 0);
    if (inicial > 0) {   // la existencia inicial se registra como movimiento ENTRADA · INICIAL
      await inventario.aplicarMovimiento(db, { idProducto: id, idUsuario: ctx.idUsuario, tipo: 'ENTRADA', subtipo: 'INICIAL', cantidad: inicial, motivo: 'Existencia inicial al registrar el producto' }, ctx);
    }
    return repo.obtener(db, id);
  });
}

// RF-03 subflujo B: actualizar (el stock no se modifica aquí)
async function actualizar(id, datos, ctx) {
  const d = normalizar(datos);
  const errores = validarProducto(d, false);
  if (Object.keys(errores).length) throw validacion(errores);
  return enTransaccion(async db => {
    const antes = await repo.obtener(db, id, true);
    if (!antes) throw noEncontrado('El producto no existe');
    if (datos.fecha_actualizacion && new Date(datos.fecha_actualizacion).getTime() !== new Date(antes.fecha_actualizacion).getTime()) {
      throw conflicto('El producto fue modificado por otro usuario. Recargue la ficha');
    }
    if (!(await repo.existeCategoria(db, d.id_categoria))) throw validacion({ id_categoria: 'Categoría no válida' });
    if (d.sku !== antes.sku && await repo.existeSku(db, d.sku, id)) throw conflicto('El SKU ya existe', { sku: 'El SKU ya existe' });
    await repo.actualizar(db, id, d);
    const campos = ['sku', 'nombre', 'referencia', 'id_categoria', 'id_ubicacion', 'precio_compra', 'stock_minimo', 'estado'];
    const ant = {}, nue = {};
    for (const c of campos) if (String(antes[c] ?? '') !== String(d[c] ?? '')) { ant[c] = antes[c]; nue[c] = d[c]; }
    if (Object.keys(nue).length) await registrar(db, { ...ctx, modulo: 'Catálogo', tipo: 'ACTUALIZACION_PRODUCTO', entidad: 'producto', idEntidad: id, anterior: ant, nuevo: nue });
    if (Number(antes.precio_venta) !== Number(d.precio_venta)) {
      await registrar(db, { ...ctx, modulo: 'Catálogo', tipo: 'CAMBIO_PRECIO', entidad: 'producto', idEntidad: id, anterior: { precio_venta: antes.precio_venta }, nuevo: { precio_venta: Number(d.precio_venta).toFixed(2) } });
    }
    return repo.obtener(db, id);
  });
}

// RF-04: asignar código comercial o generar interno
async function asignarCodigo(id, { tipo, codigo, generar }, ctx) {
  let valor = texto(codigo), t = tipo;
  if (!generar) {
    if (!TIPOS_CODIGO.includes(t)) throw validacion({ tipo: 'Seleccione el tipo de código' });
    const m = validarCodigo(t, valor); if (m) throw validacion({ codigo: m });
  }
  return enTransaccion(async db => {
    const p = await repo.obtener(db, id, true);
    if (!p) throw noEncontrado('El producto no existe');
    if (generar) { valor = formatoInterno(await repo.siguienteInterno(db)); t = 'INTERNO'; }
    else { const dueno = await repo.duenoCodigo(db, valor); if (dueno && dueno.id_producto !== id) throw conflicto('Código duplicado', { codigo: `El código ya está asignado al producto ${dueno.sku}` }); }
    await repo.guardarCodigo(db, id, valor, t);
    await registrar(db, { ...ctx, modulo: 'Catálogo', tipo: 'ASIGNACION_CODIGO', entidad: 'producto', idEntidad: id, anterior: { codigo: p.codigo, tipo: p.tipo_codigo }, nuevo: { codigo: valor, tipo: t } });
    return repo.obtener(db, id);
  });
}

// RF-04: imagen SVG del código de barras para la etiqueta de 50 × 25 mm
async function codigoSvg(id) {
  const p = await repo.obtener(pool, id);
  if (!p || !p.codigo) throw noEncontrado('El producto no tiene código asignado');
  const bcid = { EAN_13: 'ean13', UPC_A: 'upca', CODE_128: 'code128', INTERNO: 'code128' }[p.tipo_codigo];
  return bwipjs.toSVG({ bcid, text: p.codigo, height: 12, includetext: true, textxalign: 'center' });
}

const listas = async () => ({ categorias: await repo.categorias(pool), ubicaciones: await repo.ubicaciones(pool) });

module.exports = { buscar, obtener, crear, actualizar, asignarCodigo, codigoSvg, listas };
