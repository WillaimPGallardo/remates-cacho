-- =====================================================================
-- Migración 004 (ajustes derivados de la revisión del análisis)
-- - sesion.restringida: sesión que solo permite cambiar la contraseña (RF-01, CU-001).
-- - movimiento_inventario.clave_operacion: un reintento no duplica entradas ni salidas (RF-06, RF-07, PG-15, RNF-05).
-- - registro_auditoria.id_correlacion: agrupa los eventos de una misma operación (RF-16).
-- - Disparadores que impiden modificar o borrar la auditoría y el kardex, además de los privilegios de la 003.
-- =====================================================================
BEGIN;

ALTER TABLE sesion ADD COLUMN IF NOT EXISTS restringida BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS clave_operacion UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimiento_clave ON movimiento_inventario (clave_operacion) WHERE clave_operacion IS NOT NULL;

ALTER TABLE registro_auditoria ADD COLUMN IF NOT EXISTS id_correlacion VARCHAR(64);
CREATE INDEX IF NOT EXISTS ix_auditoria_correlacion ON registro_auditoria (id_correlacion) WHERE id_correlacion IS NOT NULL;

-- Los registros de auditoría y del kardex no se modifican ni se eliminan (RF-16, RF-06 a RF-08).
CREATE OR REPLACE FUNCTION fn_solo_insercion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción: no se permite %', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END $$;

DROP TRIGGER IF EXISTS tr_auditoria_solo_insercion ON registro_auditoria;
CREATE TRIGGER tr_auditoria_solo_insercion BEFORE UPDATE OR DELETE ON registro_auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();
DROP TRIGGER IF EXISTS tr_auditoria_sin_truncate ON registro_auditoria;
CREATE TRIGGER tr_auditoria_sin_truncate BEFORE TRUNCATE ON registro_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS tr_movimiento_solo_insercion ON movimiento_inventario;
CREATE TRIGGER tr_movimiento_solo_insercion BEFORE UPDATE OR DELETE ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

COMMIT;
