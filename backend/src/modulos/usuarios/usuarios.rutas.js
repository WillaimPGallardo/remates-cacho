const router = require('express').Router();
const s = require('./usuarios.servicio');
const { autenticar, permitir } = require('../../comun/seguridad');
const { contexto } = require('../../comun/auditoria');

router.use(autenticar, permitir('USUARIOS_GESTIONAR'));
const h = fn => (req, res, next) => fn(req, res).catch(next);

router.get('/', h(async (req, res) => res.json(await s.listar(req.query))));
router.get('/:id', h(async (req, res) => res.json(await s.obtener(req.params.id))));
router.post('/', h(async (req, res) => res.status(201).json(await s.crear(req.body || {}, contexto(req)))));
router.put('/:id', h(async (req, res) => res.json(await s.modificar(Number(req.params.id), req.body || {}, contexto(req)))));
router.patch('/:id/estado', h(async (req, res) => res.json(await s.cambiarEstado(Number(req.params.id), req.body?.estado, contexto(req)))));
router.post('/:id/restablecer', h(async (req, res) => res.json(await s.restablecer(Number(req.params.id), contexto(req)))));

module.exports = router;
