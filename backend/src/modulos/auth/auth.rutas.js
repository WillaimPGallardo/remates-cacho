const router = require('express').Router();
const servicio = require('./auth.servicio');
const { autenticar, COOKIE } = require('../../comun/seguridad');
const { contexto } = require('../../comun/auditoria');
const P = require('../../config/parametros');

const opcionesCookie = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: P.HORAS_SESION_MAXIMA * 3600000, path: '/' });

router.post('/login', async (req, res, next) => {
  try {
    const r = await servicio.iniciarSesion(req.body || {}, contexto(req));
    res.cookie(COOKIE, r.token, opcionesCookie()).json({ usuario: r.usuario });
  } catch (e) { next(e); }
});

// Estado de la sesión para la interfaz: sin sesión responde 200 con usuario nulo (evita errores 401 en la consola
// del navegador al abrir la pantalla de inicio). Las demás rutas siguen respondiendo 401 sin sesión.
router.get('/sesion', (req, res, next) => autenticar(req, res, err => {
  if (err && err.status === 401) return res.json({ usuario: null });
  if (err) return next(err);
  const u = req.usuario;
  res.json({ usuario: { id: u.id_usuario, nombre: u.nombre_completo, usuario: u.nombre_usuario, rol: u.rol, permisos: u.permisos, requiereCambio: u.requiere_cambio_contrasena } });
}));

router.get('/yo', autenticar, (req, res) => {
  const u = req.usuario;
  res.json({ usuario: { id: u.id_usuario, nombre: u.nombre_completo, usuario: u.nombre_usuario, rol: u.rol, permisos: u.permisos, requiereCambio: u.requiere_cambio_contrasena } });
});

router.post('/cambiar-contrasena', autenticar, async (req, res, next) => {
  try {
    const r = await servicio.cambiarContrasena(req.usuario.id_usuario, req.body || {}, contexto(req));
    res.cookie(COOKIE, r.token, opcionesCookie()).json({ mensaje: 'Contraseña actualizada' });   // nueva sesión completa
  } catch (e) { next(e); }
});

router.post('/logout', autenticar, async (req, res, next) => {
  try { await servicio.cerrarSesion(req.cookies[COOKIE], contexto(req)); res.clearCookie(COOKIE, { path: '/' }).json({ mensaje: 'Sesión cerrada' }); } catch (e) { next(e); }
});

module.exports = router;
