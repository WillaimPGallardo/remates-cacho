# Remates Cacho · Sistema web de inventario y ventas

Sistema web adaptativo para el control de inventarios y ventas de Remates Cacho (San Cristóbal, Táchira).
Trabajo de grado — Universidad de Santander, Ingeniería de Sistemas.
Autores: Brian Javier Oropeza Jacanamijoy y William Juan Diego Peña Gallardo · Directora: Ing. Marieth Perpiñán.

## Arquitectura

Cliente-servidor en tres capas (ver Fase de Diseño del documento):

| Capa | Carpeta | Tecnología |
|---|---|---|
| Presentación | `frontend/` | React 18 + Vite, CSS responsive |
| Lógica de negocio | `backend/src/modulos/*` (rutas → servicio → repositorio) | Node.js 20 + Express 4 |
| Datos | `db/migraciones`, `backend/src/config/db.js` | PostgreSQL 16 |

```
remates-cacho/
├── backend/
│   ├── src/
│   │   ├── app.js, server.js          # aplicación Express y arranque
│   │   ├── config/                    # conexión a la BD y parámetros PG-01…PG-17
│   │   ├── comun/                     # seguridad, auditoría, transacciones, validaciones, errores, códigos
│   │   └── modulos/
│   │       ├── auth/                  # RF-01
│   │       ├── usuarios/              # RF-02
│   │       ├── catalogo/              # RF-03, RF-04, RF-05
│   │       └── inventario/            # RF-06, RF-07, RF-10
│   ├── scripts/migrar.js              # aplica db/migraciones en orden
│   └── tests/                         # pruebas de la API (Jest + Supertest)
├── frontend/src/
│   ├── comun/                         # cliente API, sesión, layout, componentes
│   └── modulos/                       # pantallas P1 a P4 de los prototipos
├── db/
│   ├── migraciones/                   # 001 esquema, 002 datos iniciales, 003 usuario de la aplicación
│   └── pruebas/pruebas_basicas.sql    # pruebas de inserción, consulta e integridad
├── infra/                             # Dockerfile, docker-compose y Nginx (despliegue)
└── docs/                              # evidencias del Taller 5
```

## Puesta en marcha (desarrollo)

Requisitos: Node.js 20 o superior y PostgreSQL 16.

```bash
# 1. Base de datos
createdb remates_cacho
cd backend && cp .env.example .env      # ajustar usuario y contraseña de PostgreSQL
npm install
npm run db:migrar                         # crea tablas, datos iniciales y el usuario app_remates

# 2. API (puerto 3000)
npm run dev

# 3. Interfaz (puerto 5173, en otra terminal)
cd ../frontend && npm install && npm run dev
```

Abrir http://localhost:5173 e ingresar con **Gerente / William123**

## Pruebas

```bash
createdb remates_test
cd backend && npm test          # 25 pruebas de aceptación de RF-01 a RF-07 y RF-10
psql -d remates_cacho -f ../db/pruebas/pruebas_basicas.sql   # 15 pruebas de integridad de la BD
npm run lint
```

## Estado (primera versión funcional)

Implementado: RF-01, RF-02, RF-03, RF-04 (validación, generación e impresión de etiquetas), RF-05, RF-06, RF-07, RF-10 y el registro transversal de auditoría (RF-16).
Pendiente: RF-08 (ajustes con autorización), RF-09, RF-11 (escaneo con cámara), ventas y comprobantes (RF-12 a RF-15), consulta de auditoría y reportes (RF-16, RF-17).

## Publicación en internet (Render + Neon)

1. En **Neon** (https://neon.tech) cree un proyecto con PostgreSQL 16 y copie la cadena de conexión
   (*Connection string*, termina en `?sslmode=require`).
2. En **Render** (https://render.com) elija **New → Blueprint**, conecte este repositorio y Render leerá `render.yaml`.
3. Complete las variables que pide:
   - `DATABASE_ADMIN_URL`: la cadena de Neon.
   - `GERENTE_CONTRASENA_INICIAL`: la contraseña con la que el gerente entrará la primera vez.
4. Al terminar el despliegue, la aplicación queda en `https://remates-cacho.onrender.com` (o el nombre asignado).
   Cada arranque aplica solo las migraciones pendientes (tabla `schema_migraciones`).

El plan gratuito de Render suspende el servicio tras 15 minutos sin uso; la primera visita después tarda cerca de un minuto en responder.
