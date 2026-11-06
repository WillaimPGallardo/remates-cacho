# Pruebas funcionales (Taller 7 · Parte 4)

Pruebas de las funcionalidades vistas por el usuario, en formato acción–respuesta, ejecutadas en el navegador
con Playwright. Cada funcionalidad tiene una prueba exitosa, una con error y una con datos inválidos; cada caso
guarda su captura en `evidencias/<ID>.png` y el resumen en `evidencias/resultados.json`.

| ID | Funcionalidad |
|----|---------------|
| PF-01 | Iniciar sesión |
| PF-02 | Registrar usuario (lo hace la Gerencia; el sistema no tiene autorregistro) |
| PF-03 | Cambio de contraseña obligatorio |
| PF-04 | Registrar producto |
| PF-05 | Consultar productos |
| PF-06 | Registrar entrada de inventario |
| PF-07 | Registrar salida por despacho |
| PF-08 | Consultar kardex |

## Cómo ejecutarlas

```bash
# 1. Base de datos vacía y migrada, API con la interfaz compilada
cd frontend && npm run build && cd ../backend
npm run db:migrar && npm start            # http://localhost:3000

# 2. En otra terminal: datos de prueba y pruebas
node pruebas/funcionales/datos_prueba.mjs
pip install playwright && playwright install chromium
python pruebas/funcionales/test_funcionales.py
```

Las pruebas modifican los datos (crean usuarios, productos y movimientos): vuelva a crear la base antes de
repetirlas. Otra URL: `URL_APP=https://... python pruebas/funcionales/test_funcionales.py`.
