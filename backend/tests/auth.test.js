// RF-01 · Criterios de aceptación de HU-18
const { reiniciarBD, sql, sesion, app, pool, request } = require('./ayuda');

beforeAll(reiniciarBD);
afterAll(() => pool.end());

describe('RF-01 Inicio de sesión', () => {
  test('campos vacíos: 400 sin consultar la base de datos', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: '', contrasena: '' });
    expect(r.status).toBe(400);
    expect(r.body.campos).toEqual({ usuario: 'Campo obligatorio', contrasena: 'Campo obligatorio' });
  });

  test('usuario inexistente: mensaje genérico y auditoría con usuario nulo', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'nadie', contrasena: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.mensaje).toBe('Usuario o contraseña incorrectos');
    const a = await sql(`SELECT id_usuario, resultado FROM registro_auditoria WHERE tipo_operacion = 'INICIO_SESION_FALLIDO' AND codigo_error = 'NO_EXISTE'`);
    expect(a[0]).toEqual({ id_usuario: null, resultado: 'FALLIDO' });
  });

  test('contraseña temporal: exige el cambio antes de usar otras funciones', async () => {
    const ag = require('supertest').agent(app);
    const r = await ag.post('/api/v1/auth/login').send({ usuario: 'gerente', contrasena: 'Cambiar2026' });
    expect(r.status).toBe(200);
    expect(r.body.usuario.requiereCambio).toBe(true);
    expect((await ag.get('/api/v1/usuarios')).status).toBe(403);
    const debil = await ag.post('/api/v1/auth/cambiar-contrasena').send({ actual: 'Cambiar2026', nueva: 'abc', confirmacion: 'abc' });
    expect(debil.status).toBe(400);
    expect(debil.body.campos.nueva).toMatch(/no cumple los requisitos/);
    const ok = await ag.post('/api/v1/auth/cambiar-contrasena').send({ actual: 'Cambiar2026', nueva: 'Gerencia2026', confirmacion: 'Gerencia2026' });
    expect(ok.status).toBe(200);
    expect((await ag.get('/api/v1/usuarios')).status).toBe(200);
  });

  test('tres intentos fallidos consecutivos bloquean la cuenta 15 minutos', async () => {
    const intento = () => request(app).post('/api/v1/auth/login').send({ usuario: 'gerente', contrasena: 'Equivocada1' });
    const r1 = await intento(); expect(r1.status).toBe(401); expect(r1.body.mensaje).toMatch(/Le quedan 2 intentos/);
    const r2 = await intento(); expect(r2.body.mensaje).toMatch(/Le queda 1 intento/);
    const r3 = await intento(); expect(r3.status).toBe(423); expect(r3.body.mensaje).toMatch(/Cuenta bloqueada temporalmente/);
    // Con el bloqueo vigente ni siquiera la contraseña correcta permite ingresar
    const r4 = await request(app).post('/api/v1/auth/login').send({ usuario: 'gerente', contrasena: 'Gerencia2026' });
    expect(r4.status).toBe(423);
    const [u] = await sql(`SELECT intentos_fallidos, bloqueado_hasta > now() + interval '14 minutes' AS quince FROM usuario WHERE nombre_usuario = 'gerente'`);
    expect(u).toEqual({ intentos_fallidos: 3, quince: true });
  });

  test('al vencer el bloqueo puede ingresar y el contador se reinicia', async () => {
    await sql(`UPDATE usuario SET bloqueado_hasta = now() - interval '1 minute' WHERE nombre_usuario = 'gerente'`);
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'gerente', contrasena: 'Gerencia2026' });
    expect(r.status).toBe(200);
    const [u] = await sql(`SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE nombre_usuario = 'gerente'`);
    expect(u).toEqual({ intentos_fallidos: 0, bloqueado_hasta: null });
  });

  test('sesión inactiva por más de 30 minutos expira', async () => {
    const ag = await sesion('gerente', 'Gerencia2026');
    await sql(`UPDATE sesion SET ultima_actividad = now() - interval '31 minutes'`);
    const r = await ag.get('/api/v1/auth/yo');
    expect(r.status).toBe(401);
  });
});
