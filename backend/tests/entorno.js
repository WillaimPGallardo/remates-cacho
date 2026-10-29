// Las pruebas usan una base de datos aparte (remates_test), derivada de las URL del archivo .env
require('dotenv').config({ quiet: true });
const aPrueba = url => url && url.replace(/\/remates_cacho(\?|$)/, '/remates_test$1');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || aPrueba(process.env.DATABASE_URL);
process.env.TEST_ADMIN_URL = process.env.TEST_ADMIN_URL || aPrueba(process.env.DATABASE_ADMIN_URL);
