-- =====================================================================
-- Migración 002: datos iniciales y permisos de la base de datos
-- =====================================================================
BEGIN;

INSERT INTO rol (nombre, descripcion) VALUES
  ('GERENCIA',  'Gerente / Administrador: acceso total y autorizaciones'),
  ('CAJERO',    'Vendedor de mostrador: ventas y comprobantes'),
  ('BODEGUERO', 'Almacenista: interfaz móvil de bodega');

INSERT INTO permiso (codigo, descripcion, modulo) VALUES
  ('USUARIOS_GESTIONAR',   'Crear, modificar, desactivar y restablecer usuarios', 'usuarios'),
  ('PRODUCTOS_GESTIONAR',  'Registrar y actualizar productos, códigos y etiquetas', 'catalogo'),
  ('PRODUCTOS_CONSULTAR',  'Buscar productos y ver precio, existencia y ubicación', 'catalogo'),
  ('PRECIO_COMPRA_VER',    'Ver el precio de compra', 'catalogo'),
  ('MOVIMIENTOS_REGISTRAR','Registrar entradas y salidas de inventario', 'inventario'),
  ('KARDEX_CONSULTAR',     'Consultar el historial de movimientos', 'inventario'),
  ('AUDITORIA_CONSULTAR',  'Consultar el registro de auditoría', 'auditoria');

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM rol r CROSS JOIN permiso p WHERE r.nombre = 'GERENCIA';
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM rol r JOIN permiso p ON p.codigo IN ('PRODUCTOS_CONSULTAR') WHERE r.nombre = 'CAJERO';
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM rol r JOIN permiso p ON p.codigo IN ('PRODUCTOS_CONSULTAR', 'MOVIMIENTOS_REGISTRAR', 'KARDEX_CONSULTAR') WHERE r.nombre = 'BODEGUERO';

-- Usuario inicial de Gerencia. Contraseña temporal: Cambiar2026 (se exige cambiarla en el primer ingreso).
INSERT INTO usuario (id_rol, nombre_completo, nombre_usuario, correo, contrasena_hash, requiere_cambio_contrasena, contrasena_temporal_expira)
SELECT id_rol, 'Gerencia Remates Cacho', 'gerente', 'gerencia@rematescacho.com',
       '$2b$12$jD0XGFbcysL4vd3H4LW8ruvty3XCiTr6B.eC1acA.K5W7bmdtC2am', TRUE, now() + interval '7 days'
FROM rol WHERE nombre = 'GERENCIA';

INSERT INTO categoria (nombre, descripcion) VALUES
  ('Ferretería', 'Herramientas y artículos de ferretería'),
  ('Hogar', 'Artículos para el hogar'),
  ('Eléctricos', 'Material eléctrico e iluminación'),
  ('Varios', 'Otros productos');

INSERT INTO ubicacion (zona, estante, nivel) VALUES
  ('A', 'E1', 'N1'), ('A', 'E1', 'N2'), ('A', 'E2', 'N1'), ('B', 'E1', 'N1'), ('B', 'E3', 'N1');

COMMIT;
