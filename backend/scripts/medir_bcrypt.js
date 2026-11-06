// Mide el tiempo de verificación de bcrypt con el costo configurado (PG-03).
// Criterio: entre 100 y 400 ms por verificación en el servidor; si no se cumple, ajuste BCRYPT_COSTO.
// Uso: npm run medir:bcrypt [-- repeticiones]
const bcrypt = require('bcryptjs');
const P = require('../src/config/parametros');

const repeticiones = Number(process.argv[2]) || 30;
const hash = bcrypt.hashSync('frase de prueba para medir', P.BCRYPT_COSTO);
const tiempos = [];
for (let i = 0; i < repeticiones; i++) {
  const t = process.hrtime.bigint();
  bcrypt.compareSync('frase de prueba para medir', hash);
  tiempos.push(Number(process.hrtime.bigint() - t) / 1e6);
}
tiempos.sort((a, b) => a - b);
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
const p90 = tiempos[Math.ceil(0.9 * tiempos.length) - 1];
console.log(`Costo ${P.BCRYPT_COSTO} · ${repeticiones} verificaciones · promedio ${prom.toFixed(0)} ms · mínimo ${tiempos[0].toFixed(0)} ms · máximo ${tiempos.at(-1).toFixed(0)} ms · p90 ${p90.toFixed(0)} ms`);
const ok = prom >= 100 && prom <= 400;
console.log(ok ? 'Cumple el criterio de 100 a 400 ms.' : `No cumple el criterio de 100 a 400 ms: ${prom < 100 ? 'aumente' : 'reduzca'} BCRYPT_COSTO.`);
process.exitCode = ok ? 0 : 1;
