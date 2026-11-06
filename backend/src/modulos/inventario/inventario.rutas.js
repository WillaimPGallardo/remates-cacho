const router = require('express').Router();
const s = require('./inventario.servicio');
const { autenticar, permitir } = require('../../comun/seguridad');
const { contexto } = require('../../comun/auditoria');

const h = fn => (req, res, next) => fn(req, res).catch(next);
router.post('/movimientos', autenticar, permitir('MOVIMIENTOS_REGISTRAR'), h(async (req, res) => {
  const r = await s.registrar(req.body || {}, contexto(req));
  res.status(r.repetido ? 200 : 201).json(r);
}));
router.get('/movimientos/clave/:clave', autenticar, permitir('MOVIMIENTOS_REGISTRAR'), h(async (req, res) => res.json(await s.porClave(req.params.clave, req.usuario))));
router.get('/productos/:id/kardex', autenticar, permitir('KARDEX_CONSULTAR'), h(async (req, res) => res.json(await s.kardex(Number(req.params.id), req.query))));

module.exports = router;
