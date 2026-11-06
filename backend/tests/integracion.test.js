// Taller 7 · Parte 3: pruebas de integración. Cada escenario recorre la API real (Express) y la base de datos
// PostgreSQL (remates_test), y verifica en la base el efecto de la operación. Para cada integración se prueba el
// flujo correcto, un error controlado y datos inválidos. Los ID (CI-xx) son los del documento.
const { reiniciarBD, sql, sesion, movimiento, app, pool, request } = require('./ayuda');

let g, cajero;
const CLAVE_G = 'Gerencia de Remates 2026';
beforeAll(async () => {
  await reiniciarBD();
  g = await sesion('gerente', 'Cambiar2026', CLAVE_G);
});
afterAll(() => pool.end());

describe('CI-01 API Login – BD (usuario, sesion, registro_auditoria)', () => {
  test('flujo correcto: credenciales válidas crean una sesión activa y auditan el ingreso', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'gerente', contrasena: CLAVE_G });
    expect(r.status).toBe(200);
    expect(r.headers['set-cookie'][0]).toMatch(/^rc_sesion=.+HttpOnly/);
    const [s] = await sql(`SELECT count(*)::int AS n FROM sesion s JOIN usuario u USING (id_usuario) WHERE u.nombre_usuario = 'gerente' AND s.activa`);
    expect(s.n).toBeGreaterThan(0);
  });
  test('error controlado: tres contraseñas incorrectas bloquean la cuenta 15 minutos en la BD', async () => {
    await g.post('/api/v1/usuarios').send({ nombre_completo: 'Cajero Uno', nombre_usuario: 'cajero1', correo: 'caja@rematescacho.com', rol: 'CAJERO', contrasena: 'caja del mostrador uno', confirmacion: 'caja del mostrador uno' });
    const intento = () => request(app).post('/api/v1/auth/login').send({ usuario: 'cajero1', contrasena: 'clave equivocada 1' });
    await intento(); await intento();
    const r = await intento();
    expect(r.status).toBe(423);
    const [u] = await sql(`SELECT intentos_fallidos, bloqueado_hasta > now() AS bloqueado FROM usuario WHERE nombre_usuario = 'cajero1'`);
    expect(u).toEqual({ intentos_fallidos: 3, bloqueado: true });
    await sql(`UPDATE usuario SET bloqueado_hasta = NULL, intentos_fallidos = 0 WHERE nombre_usuario = 'cajero1'`);
  });
  test('datos inválidos: campos vacíos responden 400 sin consultar ni modificar la BD', async () => {
    const antes = await sql('SELECT count(*)::int AS n FROM registro_auditoria');
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: '', contrasena: '' });
    expect(r.status).toBe(400);
    expect((await sql('SELECT count(*)::int AS n FROM registro_auditoria'))[0].n).toBe(antes[0].n);
  });
});

describe('CI-02 API Usuarios – BD – Auditoría', () => {
  test('flujo correcto: crea la cuenta con hash y registra GESTION_USUARIO', async () => {
    const r = await g.post('/api/v1/usuarios').send({ nombre_completo: 'José Luis Pérez', nombre_usuario: 'bodeguero1', correo: 'bodega@rematescacho.com', rol: 'BODEGUERO', contrasena: 'bodega principal norte', confirmacion: 'bodega principal norte' });
    expect(r.status).toBe(201);
    const [u] = await sql(`SELECT contrasena_hash LIKE '$2%' AS hash FROM usuario WHERE nombre_usuario = 'bodeguero1'`);
    expect(u.hash).toBe(true);
    const a = await sql(`SELECT 1 FROM registro_auditoria WHERE tipo_operacion = 'GESTION_USUARIO' AND id_entidad_afectada = $1`, [String(r.body.id_usuario)]);
    expect(a).toHaveLength(1);
  });
  test('error controlado: un nombre de usuario repetido responde 409 y no crea otra fila', async () => {
    const r = await g.post('/api/v1/usuarios').send({ nombre_completo: 'Otro', nombre_usuario: 'bodeguero1', correo: 'otro@rematescacho.com', rol: 'CAJERO', contrasena: 'otra frase de prueba', confirmacion: 'otra frase de prueba' });
    expect(r.status).toBe(409);
    expect((await sql(`SELECT count(*)::int AS n FROM usuario WHERE lower(nombre_usuario) = 'bodeguero1'`))[0].n).toBe(1);
  });
  test('datos inválidos: correo sin @ y contraseña común responden 400 por campo', async () => {
    const r = await g.post('/api/v1/usuarios').send({ nombre_completo: 'Persona', nombre_usuario: 'cajero7', correo: 'caja.rc.com', rol: 'CAJERO', contrasena: 'password1234', confirmacion: 'password1234' });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.campos).sort()).toEqual(['contrasena', 'correo']);
  });
});

describe('CI-03 API Productos – Inventario – Auditoría', () => {
  const martillo = { sku: 'FER-0012', nombre: 'Martillo de uña 16 oz', id_categoria: 1, precio_compra: '60', precio_venta: '85', stock_minimo: '5', existencia_inicial: '12', tipo_codigo: 'EAN_13', codigo: '7701234567897' };
  test('flujo correcto: el producto, su código, la ENTRADA · INICIAL y la auditoría se guardan juntos', async () => {
    const r = await g.post('/api/v1/productos').send(martillo);
    expect(r.status).toBe(201);
    const m = await sql('SELECT subtipo, stock_nuevo FROM movimiento_inventario WHERE id_producto = $1', [r.body.id_producto]);
    expect(m).toEqual([{ subtipo: 'INICIAL', stock_nuevo: 12 }]);
    const a = await sql(`SELECT tipo_operacion FROM registro_auditoria WHERE entidad_afectada = 'producto' AND id_entidad_afectada = $1 ORDER BY id_registro`, [String(r.body.id_producto)]);
    expect(a.map(x => x.tipo_operacion)).toEqual(['CREACION_PRODUCTO', 'MOVIMIENTO_INVENTARIO']);
  });
  test('error controlado: un código de barras ya asignado responde 409 y no deja el producto a medias', async () => {
    const r = await g.post('/api/v1/productos').send({ ...martillo, sku: 'FER-0099' });
    expect(r.status).toBe(409);
    expect(await sql(`SELECT 1 FROM producto WHERE sku = 'FER-0099'`)).toHaveLength(0);
  });
  test('datos inválidos: precio cero y EAN-13 con dígito de control incorrecto responden 400', async () => {
    const r = await g.post('/api/v1/productos').send({ ...martillo, sku: 'FER-0098', precio_venta: '0', codigo: '7701234567890' });
    expect(r.status).toBe(400);
    expect(r.body.campos).toMatchObject({ precio_venta: 'Debe ser mayor que cero', codigo: 'El dígito de control no es válido' });
  });
});

describe('CI-04 API Movimientos – BD (bloqueo de fila y kardex)', () => {
  let id;
  beforeAll(async () => { id = (await sql(`SELECT id_producto FROM producto WHERE sku = 'FER-0012'`))[0].id_producto; });
  test('flujo correcto: una entrada actualiza stock_actual y el kardex en la misma transacción', async () => {
    const r = await movimiento(g, { id_producto: id, tipo: 'ENTRADA', cantidad: '10', motivo: 'Factura 5521' });
    expect(r.status).toBe(201);
    const [p] = await sql('SELECT stock_actual FROM producto WHERE id_producto = $1', [id]);
    const [k] = await sql('SELECT stock_nuevo FROM movimiento_inventario WHERE id_producto = $1 ORDER BY id_movimiento DESC LIMIT 1', [id]);
    expect([p.stock_actual, k.stock_nuevo]).toEqual([22, 22]);
  });
  test('error controlado: una salida mayor que la existencia responde 409 y el stock no cambia', async () => {
    const r = await movimiento(g, { id_producto: id, tipo: 'SALIDA', cantidad: '50', motivo: 'Remisión 1203' });
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toBe('Existencia insuficiente. Disponible: 22');
    expect((await sql('SELECT stock_actual FROM producto WHERE id_producto = $1', [id]))[0].stock_actual).toBe(22);
  });
  test('datos inválidos: cantidad decimal responde 400 y no inserta movimientos', async () => {
    const antes = (await sql('SELECT count(*)::int AS n FROM movimiento_inventario'))[0].n;
    const r = await movimiento(g, { id_producto: id, tipo: 'ENTRADA', cantidad: '2.5' });
    expect(r.status).toBe(400);
    expect((await sql('SELECT count(*)::int AS n FROM movimiento_inventario'))[0].n).toBe(antes);
  });
});

describe('CI-05 Middleware de seguridad – Auditoría', () => {
  beforeAll(async () => { cajero = await sesion('cajero1', 'caja del mostrador uno', 'caja del mostrador dos'); });
  test('flujo correcto: un rol con permiso accede a la ruta', async () => {
    expect((await cajero.get('/api/v1/productos?q=martillo')).status).toBe(200);
  });
  test('error controlado: el cajero no gestiona usuarios; responde 403 y queda ACCESO_DENEGADO', async () => {
    const r = await cajero.get('/api/v1/usuarios');
    expect(r.status).toBe(403);
    const a = await sql(`SELECT a.resultado FROM registro_auditoria a JOIN usuario u USING (id_usuario) WHERE u.nombre_usuario = 'cajero1' AND a.tipo_operacion = 'ACCESO_DENEGADO'`);
    expect(a.map(x => x.resultado)).toContain('DENEGADO');
  });
  test('datos inválidos: un token de sesión falso responde 401', async () => {
    const r = await request(app).get('/api/v1/productos').set('Cookie', 'rc_sesion=token-falsificado');
    expect(r.status).toBe(401);
  });
});

describe('CI-06 API Kardex – BD', () => {
  let id;
  beforeAll(async () => { id = (await sql(`SELECT id_producto FROM producto WHERE sku = 'FER-0012'`))[0].id_producto; });
  test('flujo correcto: lista los movimientos en orden y el último saldo coincide con el stock', async () => {
    const r = await g.get(`/api/v1/productos/${id}/kardex`);
    expect(r.status).toBe(200);
    expect(r.body.movimientos.map(m => m.subtipo)).toEqual(['INICIAL', 'RECEPCION']);
    expect(r.body.movimientos.at(-1).stock_nuevo).toBe(r.body.producto.stock_actual);
  });
  test('error controlado: un producto inexistente responde 404', async () => {
    expect((await g.get('/api/v1/productos/999999/kardex')).status).toBe(404);
  });
  test('datos inválidos: fecha inicial mayor que la final responde 400', async () => {
    const r = await g.get(`/api/v1/productos/${id}/kardex?desde=2026-10-20&hasta=2026-10-01`);
    expect(r.status).toBe(400);
    expect(r.body.campos.fechas).toBe('La fecha inicial no puede ser mayor que la final');
  });
});
