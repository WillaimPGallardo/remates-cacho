// Aplicación Express: capa de lógica de negocio (API REST /api/v1)
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { pool } = require('./config/db');
const { manejadorErrores, noEncontrado } = require('./comun/errores');

const app = express();
app.set('trust proxy', 1);          // detrás de Nginx: IP real del cliente
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/v1/salud', async (_req, res, next) => {   // verificación de conexión (RNF-05)
  try { await pool.query('SELECT 1'); res.json({ estado: 'ok', hora: new Date() }); } catch (e) { next(e); }
});
app.use('/api/v1/auth', require('./modulos/auth/auth.rutas'));
app.use('/api/v1/usuarios', require('./modulos/usuarios/usuarios.rutas'));
app.use('/api/v1/productos', require('./modulos/catalogo/catalogo.rutas'));
app.use('/api/v1', require('./modulos/inventario/inventario.rutas'));
app.use('/api', (_req, _res, next) => next(noEncontrado('Recurso no encontrado')));

// En producción el backend también entrega el frontend compilado (en despliegue lo sirve Nginx)
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html'), err => err && res.status(404).end()));

app.use(manejadorErrores);
module.exports = app;
