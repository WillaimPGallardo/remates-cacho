// Ajustes derivados de la revisión del análisis (Taller 5, Tabla 12)
const crypto = require('crypto');
const { reiniciarBD, sql, sesion, movimiento, app, pool, request } = require('./ayuda');
const { requisitosContrasena } = require('../src/comun/validaciones');
const { registrarAparte, conciliarPendientes, ARCHIVO_PENDIENTES } = require('../src/comun/auditoria');
const fs = require('fs');

let g, b;
const CLAVE_G = 'Gerencia de Remates 2026';
beforeAll(async () => {
  await reiniciarBD();
  g = await sesion('gerente', 'Cambiar2026', CLAVE_G);
  await g.post('/api/v1/usuarios').send({ nombre_completo: 'Usuario Bodega', nombre_usuario: 'bodeguero1', correo: 'bodega@rematescacho.com', rol: 'BODEGUERO', contrasena: 'bodega principal norte', confirmacion: 'bodega principal norte' });
  b = await sesion('bodeguero1', 'bodega principal norte', 'bodega principal sur 27');
});
afterAll(() => pool.end());

const producto = { sku: 'TAL-0001', nombre: 'Taladro percutor', id_categoria: 1, precio_compra: '100', precio_venta: '150', stock_minimo: '1', existencia_inicial: '10', codigo: '' };

describe('PG-03 Política de contraseñas', () => {
  test('exige de 12 a 64 caracteres y admite frases, sin reglas de composición', () => {
    expect(requisitosContrasena('Corta1234ab')).toContain('Mínimo 12 caracteres');
    expect(requisitosContrasena('mi casa tiene tres gatos')).toEqual([]);
    expect(requisitosContrasena('x'.repeat(30) + 'y'.repeat(35))).toContain('Máximo 64 caracteres');
  });
  test('rechaza contraseñas comunes, secuencias y las que contienen el nombre de usuario', () => {
    expect(requisitosContrasena('password1234')).toContain('Es una contraseña común o filtrada');
    expect(requisitosContrasena('123456789012')).toContain('Es una contraseña común o filtrada');
    expect(requisitosContrasena('abcabcabcabc')).toContain('No debe ser una secuencia o repetición simple');
    expect(requisitosContrasena('soy cajero1 de remates', 'cajero1')).toContain('No debe contener el nombre de usuario');
  });
  test('la API aplica la política al crear usuarios', async () => {
    const r = await g.post('/api/v1/usuarios').send({ nombre_completo: 'Otra Persona', nombre_usuario: 'cajero9', correo: 'c9@rematescacho.com', rol: 'CAJERO', contrasena: 'password1234', confirmacion: 'password1234' });
    expect(r.status).toBe(400);
    expect(r.body.campos.contrasena).toMatch(/común o filtrada/);
  });
});

describe('RF-01 Sesión restringida y orden de las comprobaciones', () => {
  test('con contraseña temporal la sesión es restringida y se reemplaza por una completa tras el cambio', async () => {
    const [u] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'bodeguero1'`);
    const t = await g.post(`/api/v1/usuarios/${u.id_usuario}/restablecer`);
    const ag = request.agent(app);
    await ag.post('/api/v1/auth/login').send({ usuario: 'bodeguero1', contrasena: t.body.contrasenaTemporal });
    const [s] = await sql(`SELECT restringida FROM sesion WHERE id_usuario = $1 AND activa`, [u.id_usuario]);
    expect(s.restringida).toBe(true);
    const otra = await ag.get('/api/v1/productos?q=taladro');
    expect(otra.status).toBe(403);
    expect(otra.body.codigo).toBe('CAMBIO_CONTRASENA_REQUERIDO');
    const c = await ag.post('/api/v1/auth/cambiar-contrasena').send({ actual: t.body.contrasenaTemporal, nueva: 'bodega principal este', confirmacion: 'bodega principal este' });
    expect(c.status).toBe(200);
    const sesiones = await sql(`SELECT restringida FROM sesion WHERE id_usuario = $1 AND activa`, [u.id_usuario]);
    expect(sesiones).toEqual([{ restringida: false }]);   // la restringida quedó invalidada
    expect((await ag.get('/api/v1/productos?q=taladro')).status).toBe(200);
    b = ag;
  });

  test('una cuenta inactiva con contraseña incorrecta recibe el mensaje genérico', async () => {
    await g.post('/api/v1/usuarios').send({ nombre_completo: 'Cajero Temporal', nombre_usuario: 'cajero2', correo: 'c2@rematescacho.com', rol: 'CAJERO', contrasena: 'caja del mostrador dos', confirmacion: 'caja del mostrador dos' });
    const [u] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'cajero2'`);
    await g.patch(`/api/v1/usuarios/${u.id_usuario}/estado`).send({ estado: 'INACTIVO' });
    const mala = await request(app).post('/api/v1/auth/login').send({ usuario: 'cajero2', contrasena: 'no es la clave correcta' });
    expect(mala.status).toBe(401);
    expect(mala.body.mensaje).toMatch(/^Usuario o contraseña incorrectos/);
    const buena = await request(app).post('/api/v1/auth/login').send({ usuario: 'cajero2', contrasena: 'caja del mostrador dos' });
    expect(buena.status).toBe(403);
    expect(buena.body.mensaje).toBe('Cuenta inactiva. Comuníquese con la Gerencia');
  });
});

describe('RF-06 y RF-07 Clave de operación y despacho', () => {
  let id;
  beforeAll(async () => { id = (await g.post('/api/v1/productos').send(producto)).body.id_producto; });

  test('un reintento con la misma clave no duplica la entrada', async () => {
    const clave = crypto.randomUUID();
    const r1 = await movimiento(b, { id_producto: id, tipo: 'ENTRADA', cantidad: '5', motivo: 'Remisión 100' }, clave);
    const r2 = await movimiento(b, { id_producto: id, tipo: 'ENTRADA', cantidad: '5', motivo: 'Remisión 100' }, clave);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body).toMatchObject({ id_movimiento: r1.body.id_movimiento, repetido: true });
    const [p] = await sql('SELECT stock_actual FROM producto WHERE id_producto = $1', [id]);
    expect(p.stock_actual).toBe(15);
    const v = await b.get(`/api/v1/movimientos/clave/${clave}`);
    expect(v.status).toBe(200);
    expect(v.body.stock_nuevo).toBe(15);
  });

  test('dos envíos simultáneos con la misma clave registran un solo movimiento', async () => {
    const clave = crypto.randomUUID();
    const res = await Promise.all([1, 2].map(() => movimiento(b, { id_producto: id, tipo: 'ENTRADA', cantidad: '1', motivo: 'Remisión 101' }, clave)));
    expect(res.map(x => x.status).sort()).toEqual([200, 201]);
    const m = await sql('SELECT count(*)::int AS n FROM movimiento_inventario WHERE clave_operacion = $1', [clave]);
    expect(m[0].n).toBe(1);
  });

  test('sin clave de operación se rechaza; una clave desconocida no está registrada', async () => {
    const r = await b.post('/api/v1/movimientos').send({ id_producto: id, tipo: 'ENTRADA', cantidad: '1' });
    expect(r.status).toBe(400);
    expect(r.body.campos.clave_operacion).toBeDefined();
    expect((await b.get(`/api/v1/movimientos/clave/${crypto.randomUUID()}`)).status).toBe(404);
  });

  test('la salida por despacho exige el destino o la remisión', async () => {
    const r = await movimiento(b, { id_producto: id, tipo: 'SALIDA', cantidad: '1' });
    expect(r.status).toBe(400);
    expect(r.body.campos.motivo).toMatch(/destino o el número de remisión/);
  });
});

describe('RF-10 Kardex con movimientos del mismo instante', () => {
  test('ordena por fecha y hora y desempata por id_movimiento', async () => {
    const id = (await g.post('/api/v1/productos').send({ ...producto, sku: 'TAL-0002', existencia_inicial: '0' })).body.id_producto;
    const [u] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'gerente'`);
    await sql(`INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo_movimiento, subtipo, cantidad, stock_anterior, stock_nuevo, fecha_hora)
               VALUES ($1,$2,'ENTRADA','RECEPCION',3,0,3,'2026-11-01 10:00'), ($1,$2,'SALIDA','DESPACHO',1,3,2,'2026-11-01 10:00')`, [id, u.id_usuario]);
    const r = await g.get(`/api/v1/productos/${id}/kardex?desde=2026-11-01&hasta=2026-11-02`);
    expect(r.body.movimientos.map(m => [m.subtipo, m.stock_anterior, m.stock_nuevo])).toEqual([['RECEPCION', 0, 3], ['DESPACHO', 3, 2]]);
  });
});

describe('RF-03 SKU permanente, edición simultánea e inactivación', () => {
  test('el SKU no se puede modificar', async () => {
    const p = (await g.get('/api/v1/productos?q=TAL-0001')).body.productos[0];
    const r = await g.put(`/api/v1/productos/${p.id_producto}`).send({ ...p, sku: 'TAL-9999' });
    expect(r.status).toBe(400);
    expect(r.body.campos.sku).toMatch(/no se puede modificar/);
  });

  test('el aviso de edición simultánea indica quién modificó la ficha', async () => {
    const p = (await g.get('/api/v1/productos?q=TAL-0001')).body.productos[0];
    expect((await g.put(`/api/v1/productos/${p.id_producto}`).send({ ...p, precio_venta: '160' })).status).toBe(200);
    const r = await g.put(`/api/v1/productos/${p.id_producto}`).send({ ...p, precio_venta: '170' });   // ficha desactualizada
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toMatch(/^El producto fue modificado por gerente a las .+\. Recargue la ficha$/);
  });

  test('inactivar con existencias requiere confirmación y conserva el stock', async () => {
    let p = (await g.get('/api/v1/productos?q=TAL-0001')).body.productos[0];
    const r = await g.put(`/api/v1/productos/${p.id_producto}`).send({ ...p, estado: 'INACTIVO' });
    expect(r.status).toBe(400);
    expect(r.body.campos.estado).toMatch(/unidades en existencia/);
    const ok = await g.put(`/api/v1/productos/${p.id_producto}`).send({ ...p, estado: 'INACTIVO', confirmar_inactivar: true });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ estado: 'INACTIVO', stock_actual: p.stock_actual });
    p = ok.body;
    await g.put(`/api/v1/productos/${p.id_producto}`).send({ ...p, estado: 'ACTIVO' });
  });
});

describe('RF-05 Búsqueda', () => {
  test('un código exacto se busca con cualquier longitud; con muchas coincidencias se informa el total', async () => {
    const id = (await g.post('/api/v1/productos').send({ ...producto, sku: 'TAL-0003', existencia_inicial: '0', tipo_codigo: 'CODE_128', codigo: 'X7' })).body.id_producto;
    expect((await g.get('/api/v1/productos?q=X7')).body.productos.map(p => p.id_producto)).toEqual([id]);
    for (let i = 10; i < 32; i++) await g.post('/api/v1/productos').send({ ...producto, sku: `SER-00${i}`, nombre: `Serrucho ${i}`, existencia_inicial: '0' });
    const r = await g.get('/api/v1/productos?q=serrucho&limite=20');
    expect(r.body.productos).toHaveLength(20);
    expect(r.body.mensaje).toBe('Se muestran 20 de 22 resultados. Escriba más caracteres para precisar la búsqueda');
  });
});

describe('RF-16 Auditoría', () => {
  test('los eventos de una operación comparten el identificador de correlación', async () => {
    const clave = crypto.randomUUID();
    const p = (await g.get('/api/v1/productos?q=TAL-0001')).body.productos[0];
    await movimiento(g, { id_producto: p.id_producto, tipo: 'ENTRADA', cantidad: '2', motivo: 'Remisión 300' }, clave);
    const a = await sql('SELECT tipo_operacion FROM registro_auditoria WHERE id_correlacion = $1', [clave]);
    expect(a.map(x => x.tipo_operacion)).toEqual(['MOVIMIENTO_INVENTARIO']);
  });

  test('ni siquiera el administrador de la base puede modificar o borrar la auditoría y el kardex', async () => {
    await expect(sql(`UPDATE registro_auditoria SET resultado = 'EXITOSO'`)).rejects.toThrow(/solo inserción/);
    await expect(sql('DELETE FROM registro_auditoria')).rejects.toThrow(/solo inserción/);
    await expect(sql('DELETE FROM movimiento_inventario')).rejects.toThrow(/solo inserción/);
  });

  test('si la base no está disponible el evento se guarda en archivo y luego se concilia', async () => {
    const { Pool } = require('pg');
    const original = pool.query;
    pool.query = () => Promise.reject(Object.assign(new Error('conexión rechazada'), { code: 'ECONNREFUSED' }));
    if (fs.existsSync(ARCHIVO_PENDIENTES)) fs.writeFileSync(ARCHIVO_PENDIENTES, '');
    await registrarAparte({ modulo: 'Seguridad', tipo: 'ACCESO_DENEGADO', resultado: 'DENEGADO', correlacion: 'prueba-pendiente' });
    pool.query = original;
    expect(fs.readFileSync(ARCHIVO_PENDIENTES, 'utf8')).toMatch(/prueba-pendiente/);
    const admin = new Pool({ connectionString: process.env.TEST_ADMIN_URL });
    expect(await conciliarPendientes(admin)).toBe(1);
    await admin.end();
    const [a] = await sql(`SELECT tipo_operacion FROM registro_auditoria WHERE id_correlacion = 'prueba-pendiente'`);
    expect(a.tipo_operacion).toBe('ACCESO_DENEGADO');
  });
});
