const router = require('express').Router();
const s = require('./catalogo.servicio');
const { autenticar, permitir } = require('../../comun/seguridad');
const { contexto } = require('../../comun/auditoria');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const consultar = [autenticar, permitir('PRODUCTOS_CONSULTAR', 'PRODUCTOS_GESTIONAR')];
const gestionar = [autenticar, permitir('PRODUCTOS_GESTIONAR')];

router.get('/listas', consultar, h(async (_req, res) => res.json(await s.listas())));
router.get('/', consultar, h(async (req, res) => res.json(await s.buscar(req.query, req.usuario))));
router.get('/:id', consultar, h(async (req, res) => res.json(await s.obtener(Number(req.params.id), req.usuario))));
router.get('/:id/codigo.svg', consultar, h(async (req, res) => res.type('image/svg+xml').send(await s.codigoSvg(Number(req.params.id)))));
router.post('/', gestionar, h(async (req, res) => res.status(201).json(await s.crear(req.body || {}, contexto(req)))));
router.put('/:id', gestionar, h(async (req, res) => res.json(await s.actualizar(Number(req.params.id), req.body || {}, contexto(req)))));
router.put('/:id/codigo', gestionar, h(async (req, res) => res.json(await s.asignarCodigo(Number(req.params.id), req.body || {}, contexto(req)))));

module.exports = router;
