// Las pruebas usan una base de datos aparte (remates_test)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://app_remates:cambiar_en_produccion@localhost:5432/remates_test?host=/tmp';
process.env.TEST_ADMIN_URL = process.env.TEST_ADMIN_URL || 'postgres://postgres@localhost:5432/remates_test?host=/tmp';
