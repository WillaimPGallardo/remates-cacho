// Parámetros generales del sistema (Tabla de parámetros PG-01 a PG-17 del documento de análisis).
module.exports = Object.freeze({
  INTENTOS_MAXIMOS: 3,                 // PG-01
  MINUTOS_BLOQUEO: 15,                 // PG-01
  MINUTOS_INACTIVIDAD: 30,             // PG-02
  HORAS_SESION_MAXIMA: 12,             // PG-02
  BCRYPT_COSTO: 12,                    // PG-03
  HORAS_CONTRASENA_TEMPORAL: 24,       // PG-04
  CANTIDAD_MAXIMA: 99999,              // PG-09
  DIAS_RANGO_DEFECTO: 30,              // PG-14
  MESES_RANGO_MAXIMO: 12,              // PG-14
  POR_PAGINA_LISTADOS: 25,             // PG-14
  POR_PAGINA_KARDEX: 50,               // PG-14
  COPIAS_ETIQUETA_MAX: 100,            // PG-16
});
