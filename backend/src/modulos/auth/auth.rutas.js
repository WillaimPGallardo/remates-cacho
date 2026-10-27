const router = require('express').Router();
const servicio = require('./auth.servicio');
const { autenticar, COOKIE } = require('../../comun/seguridad');
const { contexto } = require('../../comun/auditoria');
const P = require('../../config/parametros');

const opcionesCookie = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: P.HORAS_SESION_MAXIMA * 3600000, path: '/' });

router.post('/login', async (req, res, next) => {
  try {
    const r = await servicio.iniciarSesion(req.body || {}, { ip: req.ip, dispositivo: req.get('user-agent') });
    res.cookie(COOKIE, r.token, opcionesCookie()).json({ usuario: r.usuario });
  } catch (e) { next(e); }
});

router.get('/yo', autenticar, (req, res) => {
  const u = req.usuario;
  res.json({ usuario: { id: u.id_usuario, nombre: u.nombre_completo, usuario: u.nombre_usuario, rol: u.rol, permisos: u.permisos, requiereCambio: u.requiere_cambio_contrasena } });
});

router.post('/cambiar-contrasena', autenticar, async (req, res, next) => {
  try { await servicio.cambiarContrasena(req.usuario.id_usuario, req.body || {}, contexto(req)); res.json({ mensaje: 'Contraseña actualizada' }); } catch (e) { next(e); }
});

router.post('/logout', autenticar, async (req, res, next) => {
  try { await servicio.cerrarSesion(req.cookies[COOKIE], contexto(req)); res.clearCookie(COOKIE, { path: '/' }).json({ mensaje: 'Sesión cerrada' }); } catch (e) { next(e); }
});

module.exports = router;
