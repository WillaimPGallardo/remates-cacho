-- =====================================================================
-- Remates Cacho · Sistema web de inventario y ventas
-- Migración 001: tablas de los módulos priorizados para la primera versión
--   Seguridad (RF-01, RF-02), Catálogo y códigos (RF-03, RF-04, RF-05),
--   Movimientos de inventario (RF-06, RF-07, RF-10) y Auditoría (RF-16).
-- Gestor: PostgreSQL 16
-- Las tablas de solicitudes, ventas y comprobantes se crean en la migración
-- 004 (Sprint 2); allí se agrega la FK movimiento_inventario.id_venta.
-- =====================================================================

BEGIN;

-- ---------- Seguridad ----------
CREATE TABLE rol (
  id_rol       SERIAL PRIMARY KEY,
  nombre       VARCHAR(30)  NOT NULL UNIQUE,
  descripcion  VARCHAR(150)
);

CREATE TABLE permiso (
  id_permiso   SERIAL PRIMARY KEY,
  codigo       VARCHAR(50)  NOT NULL UNIQUE,
  descripcion  VARCHAR(150) NOT NULL,
  modulo       VARCHAR(50)  NOT NULL
);

CREATE TABLE rol_permiso (
  id_rol      INT NOT NULL REFERENCES rol(id_rol) ON DELETE CASCADE,
  id_permiso  INT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
  PRIMARY KEY (id_rol, id_permiso)
);

CREATE TABLE usuario (
  id_usuario                  SERIAL PRIMARY KEY,
  id_rol                      INT          NOT NULL REFERENCES rol(id_rol),
  nombre_completo             VARCHAR(100) NOT NULL CHECK (char_length(nombre_completo) BETWEEN 2 AND 100),
  nombre_usuario              VARCHAR(30)  NOT NULL CHECK (nombre_usuario ~ '^[a-z0-9._]{4,30}$'),
  correo                      VARCHAR(100) NOT NULL CHECK (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contrasena_hash             VARCHAR(255) NOT NULL,
  estado                      VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  intentos_fallidos           SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta             TIMESTAMPTZ,
  requiere_cambio_contrasena  BOOLEAN      NOT NULL DEFAULT TRUE,
  contrasena_temporal_expira  TIMESTAMPTZ,
  fecha_creacion              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_actualizacion         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Unicidad sin distinguir mayúsculas (PG-05)
CREATE UNIQUE INDEX uq_usuario_nombre ON usuario (lower(nombre_usuario));
CREATE UNIQUE INDEX uq_usuario_correo ON usuario (lower(correo));

CREATE TABLE sesion (
  id_sesion         SERIAL PRIMARY KEY,
  id_usuario        INT          NOT NULL REFERENCES usuario(id_usuario),
  token_hash        VARCHAR(255) NOT NULL UNIQUE,
  fecha_inicio      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ultima_actividad  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  direccion_ip      VARCHAR(45),
  dispositivo       VARCHAR(150),
  activa            BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_sesion_usuario ON sesion (id_usuario) WHERE activa;

-- ---------- Catálogo ----------
CREATE TABLE categoria (
  id_categoria  SERIAL PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL UNIQUE,
  descripcion   VARCHAR(150)
);

CREATE TABLE ubicacion (
  id_ubicacion  SERIAL PRIMARY KEY,
  zona          VARCHAR(30) NOT NULL,
  estante       VARCHAR(30) NOT NULL,
  nivel         VARCHAR(30),
  descripcion   VARCHAR(150),
  UNIQUE (zona, estante, nivel)
);

CREATE TABLE producto (
  id_producto          SERIAL PRIMARY KEY,
  id_categoria         INT           NOT NULL REFERENCES categoria(id_categoria),
  id_ubicacion         INT           REFERENCES ubicacion(id_ubicacion),
  sku                  VARCHAR(20)   NOT NULL CHECK (sku ~ '^[A-Z0-9-]{3,20}$'),
  nombre               VARCHAR(120)  NOT NULL CHECK (char_length(nombre) >= 1),
  referencia           VARCHAR(60),
  precio_compra        NUMERIC(12,2) NOT NULL CHECK (precio_compra > 0),
  precio_venta         NUMERIC(12,2) NOT NULL CHECK (precio_venta > 0),
  stock_actual         INT           NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),     -- PG-10
  stock_minimo         INT           NOT NULL DEFAULT 0 CHECK (stock_minimo BETWEEN 0 AND 99999),
  estado               VARCHAR(10)   NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  fecha_creacion       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_producto_sku ON producto (sku);
CREATE INDEX ix_producto_nombre ON producto (lower(nombre));

CREATE TABLE codigo_barras (
  id_codigo         SERIAL PRIMARY KEY,
  id_producto       INT         NOT NULL UNIQUE REFERENCES producto(id_producto),   -- uno a uno
  valor             VARCHAR(48) NOT NULL UNIQUE,
  tipo              VARCHAR(10) NOT NULL CHECK (tipo IN ('EAN_13', 'UPC_A', 'CODE_128', 'INTERNO')),
  fecha_asignacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'EAN_13'  AND valor ~ '^[0-9]{13}$') OR
    (tipo = 'UPC_A'   AND valor ~ '^[0-9]{12}$') OR
    (tipo = 'INTERNO' AND valor ~ '^RC[0-9]{8}$') OR
    (tipo = 'CODE_128' AND char_length(valor) BETWEEN 1 AND 48)
  )
);
-- Consecutivo de códigos internos RC + 8 dígitos (PG-07)
CREATE SEQUENCE seq_codigo_interno START 1;

-- ---------- Inventario ----------
CREATE TABLE movimiento_inventario (
  id_movimiento            BIGSERIAL PRIMARY KEY,
  id_producto              INT         NOT NULL REFERENCES producto(id_producto),
  id_usuario               INT         NOT NULL REFERENCES usuario(id_usuario),
  id_venta                 INT,          -- FK a venta: migración 004 (Sprint 2)
  id_movimiento_revertido  BIGINT      UNIQUE REFERENCES movimiento_inventario(id_movimiento),
  tipo_movimiento          VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  subtipo                  VARCHAR(20) NOT NULL CHECK (subtipo IN ('RECEPCION', 'INICIAL', 'REVERSION_VENTA',
                                                                   'DESPACHO', 'VENTA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO')),
  cantidad                 INT         NOT NULL CHECK (cantidad BETWEEN 1 AND 99999),
  stock_anterior           INT         NOT NULL CHECK (stock_anterior >= 0),
  stock_nuevo              INT         NOT NULL CHECK (stock_nuevo >= 0),
  motivo                   VARCHAR(255),
  fecha_hora               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Coherencia entre tipo y subtipo
  CHECK (
    (tipo_movimiento = 'ENTRADA' AND subtipo IN ('RECEPCION', 'INICIAL', 'REVERSION_VENTA')) OR
    (tipo_movimiento = 'SALIDA'  AND subtipo IN ('DESPACHO', 'VENTA')) OR
    (tipo_movimiento = 'AJUSTE'  AND subtipo IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'))
  ),
  -- Coherencia aritmética del kardex
  CHECK (
    (tipo_movimiento = 'ENTRADA' OR subtipo = 'AJUSTE_POSITIVO') AND stock_nuevo = stock_anterior + cantidad OR
    (tipo_movimiento = 'SALIDA'  OR subtipo = 'AJUSTE_NEGATIVO') AND stock_nuevo = stock_anterior - cantidad
  )
);
CREATE INDEX ix_mov_producto_fecha ON movimiento_inventario (id_producto, fecha_hora);

-- ---------- Auditoría ----------
CREATE TABLE registro_auditoria (
  id_registro          BIGSERIAL PRIMARY KEY,
  id_usuario           INT         REFERENCES usuario(id_usuario),   -- nulo: usuario inexistente
  fecha_hora           TIMESTAMPTZ NOT NULL DEFAULT now(),
  modulo               VARCHAR(30) NOT NULL,
  tipo_operacion       VARCHAR(30) NOT NULL,
  entidad_afectada     VARCHAR(50),
  id_entidad_afectada  VARCHAR(50),
  valor_anterior       TEXT,
  valor_nuevo          TEXT,
  direccion_ip         VARCHAR(45),
  dispositivo          VARCHAR(150),
  resultado            VARCHAR(10) NOT NULL CHECK (resultado IN ('EXITOSO', 'FALLIDO', 'DENEGADO')),
  codigo_error         VARCHAR(50)
);
CREATE INDEX ix_auditoria_fecha ON registro_auditoria (fecha_hora DESC);

COMMIT;
