-- =====================================================================
-- Migración 003 (seguridad de la base de datos)
-- La aplicación se conecta con un usuario de privilegios mínimos.
-- registro_auditoria: solo INSERT y SELECT (los registros no se modifican ni eliminan, RF-16).
-- Ejecutar como superusuario. Cambiar la contraseña en producción.
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_remates') THEN
    CREATE ROLE app_remates LOGIN PASSWORD 'cambiar_en_produccion';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_remates;
GRANT SELECT, INSERT, UPDATE ON rol, permiso, rol_permiso, usuario, sesion, categoria, ubicacion,
      producto, codigo_barras TO app_remates;
GRANT SELECT, INSERT ON movimiento_inventario, registro_auditoria TO app_remates;   -- sin UPDATE ni DELETE
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_remates;
