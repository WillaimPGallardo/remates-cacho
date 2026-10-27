// RF-03, RF-04, RF-05, RF-06, RF-07 y RF-10 · Criterios de HU-02, HU-03, HU-08, HU-04, HU-12, HU-13
const { reiniciarBD, sql, sesion, pool } = require('./ayuda');
const { validarCodigo } = require('../src/comun/codigos');
let g, b;
beforeAll(async () => {
  await reiniciarBD();
  g = await sesion('gerente', 'Cambiar2026', 'Gerencia2026');
  await g.post('/api/v1/usuarios').send({ nombre_completo: 'Usuario Bodega', nombre_usuario: 'bodeguero1', correo: 'bodega@rematescacho.com', rol: 'BODEGUERO', contrasena: 'Bodega2026', confirmacion: 'Bodega2026' });
  b = await sesion('bodeguero1', 'Bodega2026', 'Bodega2027');
});
afterAll(() => pool.end());

const martillo = { sku: 'fer-0012', nombre: 'Martillo de uña 16 oz', id_categoria: 1, id_ubicacion: 2, precio_compra: '60', precio_venta: '85', stock_minimo: '5', existencia_inicial: '12', tipo_codigo: 'EAN_13', codigo: '7701234567897' };
let idMartillo;

describe('RF-04 Validación de códigos', () => {
  test('dígito de control EAN-13 y UPC-A', () => {
    expect(validarCodigo('EAN_13', '7701234567897')).toBeNull();
    expect(validarCodigo('EAN_13', '7701234567890')).toBe('El dígito de control no es válido');
    expect(validarCodigo('UPC_A', '036000291452')).toBeNull();
    expect(validarCodigo('EAN_13', '770123456789')).toMatch(/13 dígitos/);
  });
});

describe('RF-03 Registro y actualización de productos', () => {
  test('registra con stock por movimiento ENTRADA · INICIAL', async () => {
    const r = await g.post('/api/v1/productos').send(martillo);
    expect(r.status).toBe(201);
    idMartillo = r.body.id_producto;
    expect(r.body).toMatchObject({ sku: 'FER-0012', stock_actual: 12, codigo: '7701234567897', tipo_codigo: 'EAN_13' });
    const m = await sql('SELECT tipo_movimiento, subtipo, cantidad, stock_anterior, stock_nuevo FROM movimiento_inventario WHERE id_producto = $1', [idMartillo]);
    expect(m).toEqual([{ tipo_movimiento: 'ENTRADA', subtipo: 'INICIAL', cantidad: 12, stock_anterior: 0, stock_nuevo: 12 }]);
  });

  test('sin código comercial genera RC + 8 dígitos', async () => {
    const r = await g.post('/api/v1/productos').send({ ...martillo, sku: 'HOG-0230', nombre: 'Juego de ollas', codigo: '', existencia_inicial: '0' });
    expect(r.body.codigo).toMatch(/^RC\d{8}$/);
    expect(r.body.stock_actual).toBe(0);
  });

  test('rechaza SKU duplicado, código ya asignado y precio cero', async () => {
    const dup = await g.post('/api/v1/productos').send({ ...martillo, codigo: '' });
    expect(dup.status).toBe(409); expect(dup.body.campos.sku).toBe('El SKU ya existe');
    const cod = await g.post('/api/v1/productos').send({ ...martillo, sku: 'FER-0013' });
    expect(cod.status).toBe(409); expect(cod.body.campos.codigo).toBe('El código ya está asignado al producto FER-0012');
    const cero = await g.post('/api/v1/productos').send({ ...martillo, sku: 'FER-0014', codigo: '', precio_venta: '0' });
    expect(cero.status).toBe(400); expect(cero.body.campos.precio_venta).toBe('Debe ser mayor que cero');
  });

  test('precio de venta menor que el de compra requiere confirmación', async () => {
    const r = await g.post('/api/v1/productos').send({ ...martillo, sku: 'FER-0015', codigo: '', precio_venta: '50' });
    expect(r.status).toBe(400);
    const ok = await g.post('/api/v1/productos').send({ ...martillo, sku: 'FER-0015', codigo: '', precio_venta: '50', confirmar_precio_bajo: true });
    expect(ok.status).toBe(201);
  });

  test('actualizar precio no cambia el stock y queda CAMBIO_PRECIO en auditoría', async () => {
    const p = (await g.get(`/api/v1/productos/${idMartillo}`)).body;
    const r = await g.put(`/api/v1/productos/${idMartillo}`).send({ ...p, precio_venta: '90', stock_actual: 999 });
    expect(r.status).toBe(200);
    expect(r.body.stock_actual).toBe(12);
    const [a] = await sql(`SELECT valor_anterior, valor_nuevo FROM registro_auditoria WHERE tipo_operacion = 'CAMBIO_PRECIO'`);
    expect(JSON.parse(a.valor_anterior).precio_venta).toBe('85.00');
    expect(JSON.parse(a.valor_nuevo).precio_venta).toBe('90.00');
    const viejo = await g.put(`/api/v1/productos/${idMartillo}`).send({ ...p, precio_venta: '95' });   // ficha desactualizada
    expect(viejo.status).toBe(409);
  });
});

describe('RF-05 Consulta de productos', () => {
  test('busca por nombre parcial, SKU y código; el bodeguero no ve el precio de compra', async () => {
    expect((await b.get('/api/v1/productos?q=marti')).body.productos.map(p => p.sku)).toContain('FER-0012');
    expect((await b.get('/api/v1/productos?q=FER-0012')).body.total).toBe(1);
    const r = await b.get('/api/v1/productos?q=7701234567897');
    expect(r.body.productos[0].precio_compra).toBeUndefined();
    expect((await b.get('/api/v1/productos?q=ma')).status).toBe(400);
    expect((await b.get('/api/v1/productos?q=zzzz')).body.mensaje).toBe('No se encontraron productos');
  });
});

describe('RF-06 y RF-07 Entradas y salidas; RF-10 Kardex', () => {
  test('entrada aumenta el stock y la salida lo disminuye', async () => {
    const e = await b.post('/api/v1/movimientos').send({ id_producto: idMartillo, tipo: 'ENTRADA', cantidad: '10', motivo: 'Remisión 4471' });
    expect(e.status).toBe(201); expect(e.body).toMatchObject({ stock_anterior: 12, stock_nuevo: 22 });
    const s = await b.post('/api/v1/movimientos').send({ id_producto: idMartillo, tipo: 'SALIDA', cantidad: '20' });
    expect(s.body).toMatchObject({ stock_anterior: 22, stock_nuevo: 2 });
  });

  test('rechaza cantidades inválidas y salidas mayores que la existencia', async () => {
    for (const cantidad of ['0', '-3', '2.5', 'abc', '100000']) {
      expect((await b.post('/api/v1/movimientos').send({ id_producto: idMartillo, tipo: 'ENTRADA', cantidad })).status).toBe(400);
    }
    const r = await b.post('/api/v1/movimientos').send({ id_producto: idMartillo, tipo: 'SALIDA', cantidad: '3' });
    expect(r.status).toBe(409); expect(r.body.mensaje).toBe('Existencia insuficiente. Disponible: 2');
  });

  test('dos salidas simultáneas por la última existencia: solo una se registra', async () => {
    const pedir = () => b.post('/api/v1/movimientos').send({ id_producto: idMartillo, tipo: 'SALIDA', cantidad: '2' });
    const res = await Promise.all([pedir(), pedir()]);
    expect(res.map(x => x.status).sort()).toEqual([201, 409]);
    const [p] = await sql('SELECT stock_actual FROM producto WHERE id_producto = $1', [idMartillo]);
    expect(p.stock_actual).toBe(0);
  });

  test('kardex: movimientos en orden con saldos que concilian con stock_actual', async () => {
    const r = await b.get(`/api/v1/productos/${idMartillo}/kardex`);
    expect(r.status).toBe(200);
    expect(r.body.movimientos.map(m => m.subtipo)).toEqual(['INICIAL', 'RECEPCION', 'DESPACHO', 'DESPACHO']);
    expect(r.body.movimientos.at(-1).stock_nuevo).toBe(r.body.producto.stock_actual);
    expect((await b.get(`/api/v1/productos/${idMartillo}/kardex?desde=2026-10-20&hasta=2026-10-01`)).body.campos.fechas).toBe('La fecha inicial no puede ser mayor que la final');
  });

  test('conciliación global: stock_actual = último stock_nuevo en todos los productos', async () => {
    const d = await sql(`SELECT p.sku FROM producto p WHERE p.stock_actual <> coalesce((SELECT m.stock_nuevo FROM movimiento_inventario m
      WHERE m.id_producto = p.id_producto ORDER BY m.id_movimiento DESC LIMIT 1), 0)`);
    expect(d).toEqual([]);
  });
});
