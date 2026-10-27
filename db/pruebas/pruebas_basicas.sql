-- =====================================================================
-- Pruebas básicas de inserción, consulta e integridad (Taller 5, Actividad 3)
-- Ejecutar: psql -d remates_cacho -f db/pruebas/pruebas_basicas.sql
-- Todo se ejecuta dentro de una transacción que se revierte al final.
-- =====================================================================
\set VERBOSITY default
\set ON_ERROR_STOP off
BEGIN;

\echo '--- P1. Inserción válida de producto'
INSERT INTO producto (id_categoria, id_ubicacion, sku, nombre, precio_compra, precio_venta, stock_minimo)
VALUES (1, 2, 'FER-0012', 'Martillo de uña 16 oz', 60.00, 85.00, 5)
RETURNING id_producto, sku, stock_actual, estado, fecha_creacion IS NOT NULL AS fecha_automatica;
SAVEPOINT p1;

\echo '--- P2. Consulta con relaciones (producto, categoría y ubicación)'
SELECT p.sku, p.nombre, c.nombre AS categoria, u.zona || '·' || u.estante || '·' || u.nivel AS ubicacion
FROM producto p JOIN categoria c USING (id_categoria) LEFT JOIN ubicacion u USING (id_ubicacion);

\echo '--- P3. SKU duplicado (UNIQUE, se espera 23505)'
INSERT INTO producto (id_categoria, sku, nombre, precio_compra, precio_venta) VALUES (1, 'FER-0012', 'Otro', 1, 2);
ROLLBACK TO SAVEPOINT p1;

\echo '--- P4. Precio de venta cero (CHECK, se espera 23514)'
INSERT INTO producto (id_categoria, sku, nombre, precio_compra, precio_venta) VALUES (1, 'FER-0099', 'Prueba', 10, 0);
ROLLBACK TO SAVEPOINT p1;

\echo '--- P5. Campo obligatorio ausente: nombre (NOT NULL, se espera 23502)'
INSERT INTO producto (id_categoria, sku, precio_compra, precio_venta) VALUES (1, 'FER-0098', 10, 12);
ROLLBACK TO SAVEPOINT p1;

\echo '--- P6. Categoría inexistente (FK, se espera 23503)'
INSERT INTO producto (id_categoria, sku, nombre, precio_compra, precio_venta) VALUES (999, 'FER-0097', 'Prueba', 10, 12);
ROLLBACK TO SAVEPOINT p1;

\echo '--- P7. Código EAN-13 con 12 dígitos (CHECK, se espera 23514)'
INSERT INTO codigo_barras (id_producto, valor, tipo) SELECT id_producto, '770123456789', 'EAN_13' FROM producto WHERE sku = 'FER-0012';
ROLLBACK TO SAVEPOINT p1;

\echo '--- P8. Código interno válido con la secuencia'
INSERT INTO codigo_barras (id_producto, valor, tipo)
SELECT id_producto, 'RC' || lpad(nextval('seq_codigo_interno')::text, 8, '0'), 'INTERNO' FROM producto WHERE sku = 'FER-0012'
RETURNING valor, tipo;
SAVEPOINT p8;

\echo '--- P9. Movimiento de entrada coherente (stock 0 + 10 = 10)'
INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo_movimiento, subtipo, cantidad, stock_anterior, stock_nuevo)
SELECT id_producto, 1, 'ENTRADA', 'RECEPCION', 10, 0, 10 FROM producto WHERE sku = 'FER-0012'
RETURNING tipo_movimiento, subtipo, cantidad, stock_anterior, stock_nuevo;
SAVEPOINT p9;

\echo '--- P10. Movimiento con aritmética incorrecta (CHECK, se espera 23514)'
INSERT INTO movimiento_inventario (id_producto, id_usuario, tipo_movimiento, subtipo, cantidad, stock_anterior, stock_nuevo)
SELECT id_producto, 1, 'SALIDA', 'DESPACHO', 3, 10, 9 FROM producto WHERE sku = 'FER-0012';
ROLLBACK TO SAVEPOINT p9;

\echo '--- P11. Stock negativo en producto (CHECK, se espera 23514)'
UPDATE producto SET stock_actual = -1 WHERE sku = 'FER-0012';
ROLLBACK TO SAVEPOINT p9;

\echo '--- P12. Nombre de usuario duplicado sin distinguir mayúsculas (se espera 23505)'
INSERT INTO usuario (id_rol, nombre_completo, nombre_usuario, correo, contrasena_hash) VALUES (1, 'Copia', 'gerente', 'otro@x.com', 'x');
ROLLBACK TO SAVEPOINT p9;

\echo '--- P13. Correo con formato inválido (CHECK, se espera 23514)'
INSERT INTO usuario (id_rol, nombre_completo, nombre_usuario, correo, contrasena_hash) VALUES (2, 'Caja', 'cajero1', 'caja-sin-arroba', 'x');
ROLLBACK TO SAVEPOINT p9;

\echo '--- P14. El usuario de la aplicación no puede borrar auditoría (se espera 42501)'
SET LOCAL ROLE app_remates;
DELETE FROM registro_auditoria;
ROLLBACK TO SAVEPOINT p9;

\echo '--- P15. El usuario de la aplicación no puede modificar movimientos (se espera 42501)'
SET LOCAL ROLE app_remates;
UPDATE movimiento_inventario SET cantidad = 1;
ROLLBACK TO SAVEPOINT p9;

ROLLBACK;
\echo '--- Fin: todas las pruebas se revirtieron'
