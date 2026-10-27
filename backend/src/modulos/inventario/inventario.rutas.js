const router = require('express').Router();
const s = require('./inventario.servicio');
const { autenticar, permitir } = require('../../comun/seguridad');
const { contexto } = require('../../comun/auditoria');

const h = fn => (req, res, next) => fn(req, res).catch(next);
router.post('/movimientos', autenticar, permitir('MOVIMIENTOS_REGISTRAR'), h(async (req, res) => res.status(201).json(await s.registrar(req.body || {}, contexto(req)))));
router.get('/productos/:id/kardex', autenticar, permitir('KARDEX_CONSULTAR'), h(async (req, res) => res.json(await s.kardex(Number(req.params.id), req.query))));

module.exports = router;
