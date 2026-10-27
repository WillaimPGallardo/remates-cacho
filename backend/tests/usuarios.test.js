// RF-02 · Criterios de aceptación de HU-01
const { reiniciarBD, sql, sesion, app, pool, request } = require('./ayuda');
let g;
beforeAll(async () => { await reiniciarBD(); g = await sesion('gerente', 'Cambiar2026', 'Gerencia2026'); });
afterAll(() => pool.end());

const nuevo = { nombre_completo: 'María Fernanda Ruiz', nombre_usuario: 'cajero1', correo: 'caja@rematescacho.com', rol: 'CAJERO', contrasena: 'Caja2026x', confirmacion: 'Caja2026x' };

describe('RF-02 Gestión de usuarios', () => {
  test('crea la cuenta activa, cifrada y con cambio obligatorio', async () => {
    const r = await g.post('/api/v1/usuarios').send(nuevo);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ nombre_usuario: 'cajero1', rol: 'CAJERO', estado: 'ACTIVO', requiere_cambio_contrasena: true });
    const [u] = await sql(`SELECT contrasena_hash FROM usuario WHERE nombre_usuario = 'cajero1'`);
    expect(u.contrasena_hash).toMatch(/^\$2[aby]\$12\$/);          // nunca en texto plano
    const [a] = await sql(`SELECT valor_nuevo FROM registro_auditoria WHERE tipo_operacion = 'GESTION_USUARIO'`);
    expect(a.valor_nuevo).not.toMatch(/Caja2026x/);
  });

  test('rechaza usuario y correo duplicados (sin distinguir mayúsculas)', async () => {
    const r = await g.post('/api/v1/usuarios').send({ ...nuevo, correo: 'CAJA@rematescacho.com' });
    expect(r.status).toBe(409);
    expect(r.body.campos).toEqual({ nombre_usuario: 'El nombre de usuario ya se encuentra registrado', correo: 'El correo ya se encuentra registrado' });
  });

  test('valida formato de correo, política de contraseña y confirmación', async () => {
    const r = await g.post('/api/v1/usuarios').send({ ...nuevo, nombre_usuario: 'otro', correo: 'mal', contrasena: 'corta', confirmacion: 'distinta' });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.campos).sort()).toEqual(['confirmacion', 'contrasena', 'correo']);
  });

  test('impide desactivar la propia cuenta', async () => {
    const [yo] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'gerente'`);
    const r = await g.patch(`/api/v1/usuarios/${yo.id_usuario}/estado`).send({ estado: 'INACTIVO' });
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toBe('No puede desactivar su propia cuenta');
  });

  test('desactiva, el usuario no puede ingresar, y al reactivar sí', async () => {
    const [c] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'cajero1'`);
    expect((await g.patch(`/api/v1/usuarios/${c.id_usuario}/estado`).send({ estado: 'INACTIVO' })).body.estado).toBe('INACTIVO');
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'cajero1', contrasena: 'Caja2026x' });
    expect(r.status).toBe(403);
    expect(r.body.mensaje).toBe('Cuenta inactiva. Comuníquese con la Gerencia');
    await g.patch(`/api/v1/usuarios/${c.id_usuario}/estado`).send({ estado: 'ACTIVO' });
    expect((await request(app).post('/api/v1/auth/login').send({ usuario: 'cajero1', contrasena: 'Caja2026x' })).status).toBe(200);
  });

  test('restablecer genera una temporal de 24 h que permite ingresar y exige el cambio', async () => {
    const [c] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'cajero1'`);
    const r = await g.post(`/api/v1/usuarios/${c.id_usuario}/restablecer`);
    expect(r.status).toBe(200);
    expect(r.body.contrasenaTemporal).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{10}$/);
    const l = await request(app).post('/api/v1/auth/login').send({ usuario: 'cajero1', contrasena: r.body.contrasenaTemporal });
    expect(l.body.usuario.requiereCambio).toBe(true);
  });

  test('un cajero no puede gestionar usuarios y el intento queda auditado', async () => {
    const [c] = await sql(`SELECT id_usuario FROM usuario WHERE nombre_usuario = 'cajero1'`);
    const t = await g.post(`/api/v1/usuarios/${c.id_usuario}/restablecer`);
    const cajero = await sesion('cajero1', t.body.contrasenaTemporal, 'Caja2026y');
    const r = await cajero.get('/api/v1/usuarios');
    expect(r.status).toBe(403);
    const [a] = await sql(`SELECT resultado FROM registro_auditoria WHERE tipo_operacion = 'ACCESO_DENEGADO' AND id_usuario = $1`, [c.id_usuario]);
    expect(a.resultado).toBe('DENEGADO');
  });
});
