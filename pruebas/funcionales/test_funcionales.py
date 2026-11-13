"""Taller 7 · Parte 4: pruebas funcionales desde la interfaz (vista del usuario) con Playwright.

Cada funcionalidad tiene una prueba exitosa, una con error y una con datos inválidos. Cada caso ejecuta la acción
en el navegador, verifica la respuesta esperada y guarda la captura de pantalla de la sesión en
pruebas/funcionales/evidencias/<ID>.png. El resultado de todos los casos queda en evidencias/resultados.json.

Requisitos: API en http://localhost:3000 con la interfaz compilada (npm run build en frontend) y la base
cargada con datos_prueba.mjs.  Instalación: pip install playwright && playwright install chromium
Uso: python pruebas/funcionales/test_funcionales.py
"""
import json
import os
import sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('URL_APP', 'http://localhost:3000')
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'evidencias')
GERENTE = ('gerente', 'la gerencia de remates')
os.makedirs(DIR, exist_ok=True)
resultados = []


def caso(pg, id_, funcionalidad, tipo, nombre, accion, esperada, pasos, verificar):
    """Ejecuta un caso acción–respuesta, verifica la respuesta y guarda la captura."""
    estado, obtenido = 'Aprobada', ''
    try:
        pasos()
        obtenido = verificar() or ''
    except Exception as e:  # el caso falla pero se conserva la evidencia
        estado, obtenido = 'Fallida', str(e).split('\n')[0][:200]
    pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(DIR, f'{id_}.png'))
    resultados.append(dict(id=id_, funcionalidad=funcionalidad, tipo=tipo, nombre=nombre, accion=accion,
                           esperada=esperada, obtenida=obtenido, estado=estado))
    print(f'{id_:8} {estado:9} {nombre}')


def visible(pg, texto):
    loc = pg.get_by_text(texto, exact=False).first
    expect(loc).to_be_visible(timeout=5000)
    return loc.inner_text().strip()


def ingresar(pg, usuario, clave):
    pg.goto(URL + '/')
    pg.get_by_label('Usuario o correo').fill(usuario)
    pg.get_by_label('Contraseña', exact=False).first.fill(clave)
    pg.get_by_role('button', name='Iniciar sesión').click()


def salir(pg):
    pg.context.clear_cookies()
    pg.goto(URL + '/')


def elegir_producto(pg, texto):
    pg.get_by_label('Buscar producto por nombre, SKU o código de barras').fill(texto)
    pg.locator('.sugerencias button').first.click()


with sync_playwright() as p:
    nav = p.chromium.launch()
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-VE')

    # ---------------- PF-01 Iniciar sesión ----------------
    F = 'PF-01 Iniciar sesión'
    salir(pg)
    caso(pg, 'PF-01-3', F, 'Datos inválidos', 'Ingreso con campos vacíos',
         'Dejar usuario y contraseña vacíos y pulsar «Iniciar sesión».',
         'El sistema no consulta la base de datos, marca ambos campos y muestra «Debe completar todos los campos».',
         lambda: pg.get_by_role('button', name='Iniciar sesión').click(),
         lambda: visible(pg, 'Debe completar todos los campos'))
    caso(pg, 'PF-01-2', F, 'Error', 'Ingreso con contraseña incorrecta',
         'Escribir el usuario «gerente» y una contraseña equivocada y pulsar «Iniciar sesión».',
         'Mensaje genérico «Usuario o contraseña incorrectos. Le quedan 2 intentos»; no se crea sesión.',
         lambda: ingresar(pg, 'gerente', 'una clave equivocada'),
         lambda: visible(pg, 'Le quedan 2 intentos'))
    caso(pg, 'PF-01-1', F, 'Exitosa', 'Ingreso con credenciales válidas',
         'Escribir «gerente» y su contraseña y pulsar «Iniciar sesión».',
         'Se abre el panel de inicio de la Gerencia con el menú de su rol.',
         lambda: ingresar(pg, *GERENTE),
         lambda: visible(pg, 'Panel de inicio'))

    # ---------------- PF-02 Registrar usuario ----------------
    F = 'PF-02 Registrar usuario'

    def abrir_nuevo_usuario():
        pg.goto(URL + '/usuarios')
        pg.get_by_role('button', name='Nuevo usuario').click()

    def llenar_usuario(nombre, usuario, correo, clave, conf):
        abrir_nuevo_usuario()
        pg.get_by_label('Nombre completo').fill(nombre)
        pg.get_by_label('Nombre de usuario').fill(usuario)
        pg.get_by_label('Correo').fill(correo)
        pg.get_by_label('Rol').select_option('BODEGUERO')
        pg.get_by_label('Contraseña inicial').fill(clave)
        pg.get_by_label('Confirmar contraseña').fill(conf)
        pg.get_by_role('button', name='Guardar').click()

    caso(pg, 'PF-02-1', F, 'Exitosa', 'Registro de un usuario nuevo',
         'En Usuarios pulsar «Nuevo usuario», diligenciar Ana Gómez / bodeguero2 / ana@rematescacho.com, rol Bodeguero, '
         'contraseña inicial «bodega del sector sur» y su confirmación; pulsar «Guardar».',
         'Mensaje «Usuario creado. Deberá cambiar la contraseña inicial en su primer ingreso» y el usuario aparece Activo en el listado.',
         lambda: llenar_usuario('Ana Gómez', 'bodeguero2', 'ana@rematescacho.com', 'bodega del sector sur', 'bodega del sector sur'),
         lambda: visible(pg, 'Usuario creado'))
    caso(pg, 'PF-02-2', F, 'Error', 'Registro con nombre de usuario ya existente',
         'Repetir el registro con el nombre de usuario «bodeguero2» y otro correo.',
         'Mensaje en el campo «El nombre de usuario ya se encuentra registrado»; no se crea la cuenta.',
         lambda: llenar_usuario('Ana María Gómez', 'bodeguero2', 'ana2@rematescacho.com', 'bodega del sector sur', 'bodega del sector sur'),
         lambda: visible(pg, 'El nombre de usuario ya se encuentra registrado'))
    caso(pg, 'PF-02-3', F, 'Datos inválidos', 'Registro con correo inválido y contraseña común',
         'Diligenciar el correo «ana.rematescacho.com» y la contraseña «password1234» con confirmación distinta; pulsar «Guardar».',
         'Mensajes por campo: «Correo no válido…», requisitos de contraseña incumplidos y «Las contraseñas no coinciden».',
         lambda: llenar_usuario('Ana Gómez', 'bodeguero3', 'ana.rematescacho.com', 'password1234', 'password12345'),
         lambda: visible(pg, 'Correo no válido'))

    # ---------------- PF-03 Cambio de contraseña obligatorio ----------------
    F = 'PF-03 Cambio de contraseña obligatorio'
    salir(pg)
    ingresar(pg, 'bodeguero2', 'bodega del sector sur')
    expect(pg.get_by_text('Cambio de contraseña obligatorio')).to_be_visible()
    pw = lambda i: pg.locator('input[type=password]').nth(i)

    def cambiar(actual, nueva, conf, enviar=True):
        pw(0).fill(actual); pw(1).fill(nueva); pw(2).fill(conf)
        if enviar:
            pg.get_by_role('button', name='Guardar contraseña').click()

    caso(pg, 'PF-03-3', F, 'Datos inválidos', 'Nueva contraseña que no cumple la política',
         'En el primer ingreso de bodeguero2 escribir como nueva contraseña «Bodega2026» (10 caracteres).',
         'La lista de requisitos marca «De 12 a 64 caracteres» en rojo y el botón «Guardar contraseña» permanece deshabilitado.',
         lambda: cambiar('bodega del sector sur', 'Bodega2026', 'Bodega2026', enviar=False),
         lambda: (expect(pg.get_by_role('button', name='Guardar contraseña')).to_be_disabled(), visible(pg, '12 a 64 caracteres'))[1])
    caso(pg, 'PF-03-2', F, 'Error', 'Contraseña temporal incorrecta',
         'Escribir una contraseña temporal equivocada y una nueva válida «mi bodega del sector sur»; pulsar «Guardar contraseña».',
         'Mensaje «La contraseña actual no es correcta»; la contraseña no cambia y la sesión sigue restringida.',
         lambda: cambiar('no es la temporal', 'mi bodega del sector sur', 'mi bodega del sector sur'),
         lambda: visible(pg, 'La contraseña actual no es correcta'))
    caso(pg, 'PF-03-1', F, 'Exitosa', 'Cambio de contraseña obligatorio',
         'Escribir la contraseña temporal correcta y la nueva «mi bodega del sector sur» con su confirmación; pulsar «Guardar contraseña».',
         'Se guarda la contraseña, se crea la sesión completa del rol y se abre la interfaz del Bodeguero.',
         lambda: cambiar('bodega del sector sur', 'mi bodega del sector sur', 'mi bodega del sector sur'),
         lambda: visible(pg, 'Bienvenido'))

    # ---------------- PF-04 Registrar producto ----------------
    F = 'PF-04 Registrar producto'
    salir(pg)
    ingresar(pg, *GERENTE)
    expect(pg.get_by_text('Panel de inicio')).to_be_visible()

    def producto(sku, nombre, compra, venta, codigo=''):
        pg.goto(URL + '/productos/nuevo')
        pg.get_by_label('SKU').fill(sku)
        pg.get_by_label('Nombre').fill(nombre)
        pg.get_by_label('Categoría').select_option(label='Ferretería')
        pg.get_by_label('Precio de compra (Bs.)').fill(compra)
        pg.get_by_label('Precio de venta (Bs.)').fill(venta)
        pg.get_by_label('Stock mínimo').fill('3')
        pg.get_by_label('Existencia inicial (opcional)').fill('20')
        if codigo:
            pg.get_by_label('Tipo de código comercial').select_option('EAN_13')
            pg.get_by_label('Código comercial (opcional)').fill(codigo)
        pg.get_by_role('button', name='Guardar', exact=True).click()

    caso(pg, 'PF-04-1', F, 'Exitosa', 'Registro de producto sin código comercial',
         'En Catálogo pulsar «+ Nuevo producto», diligenciar FER-0060 «Serrucho de 20 pulgadas», Ferretería, compra 35, venta 52, '
         'mínimo 3, existencia inicial 20, sin código; pulsar «Guardar».',
         'Se registra el producto, se genera un código interno RC + 8 dígitos y se abre la pantalla de etiquetas.',
         lambda: producto('FER-0060', 'Serrucho de 20 pulgadas', '35', '52'),
         lambda: visible(pg, 'Producto registrado') + ' · ' + pg.get_by_label('Código actual').input_value())
    caso(pg, 'PF-04-2', F, 'Error', 'Registro con SKU duplicado',
         'Registrar otro producto con el SKU «FER-0012», que ya existe.',
         'Mensaje en el campo SKU «El SKU ya existe»; no se guarda el producto.',
         lambda: producto('FER-0012', 'Martillo repetido', '60', '85'),
         lambda: visible(pg, 'El SKU ya existe'))
    caso(pg, 'PF-04-3', F, 'Datos inválidos', 'Precio cero y EAN-13 con dígito de control incorrecto',
         'Registrar FER-0061 con precio de venta 0 y el código EAN-13 «7701234567890».',
         'Mensajes por campo: «Debe ser mayor que cero» y «El dígito de control no es válido».',
         lambda: producto('FER-0061', 'Escuadra metálica', '10', '0', '7701234567890'),
         lambda: visible(pg, 'Debe ser mayor que cero'))

    # ---------------- PF-05 Consultar productos ----------------
    F = 'PF-05 Consultar productos'
    buscar = lambda q: (pg.goto(URL + '/productos'), pg.get_by_label('Buscar').fill(q), pg.wait_for_timeout(900))
    caso(pg, 'PF-05-1', F, 'Exitosa', 'Búsqueda por nombre parcial',
         'En Catálogo escribir «mart» en el buscador.',
         'Se lista el producto «Martillo de uña 16 oz» con SKU, precio y existencia.',
         lambda: buscar('mart'),
         lambda: visible(pg, 'Martillo de uña 16 oz'))
    caso(pg, 'PF-05-2', F, 'Error', 'Búsqueda sin coincidencias',
         'Escribir «zzzz» en el buscador.',
         'Mensaje «No se encontraron productos».',
         lambda: buscar('zzzz'),
         lambda: visible(pg, 'No se encontraron productos'))
    caso(pg, 'PF-05-3', F, 'Datos inválidos', 'Búsqueda por nombre con menos de 3 caracteres',
         'Escribir «ma» en el buscador.',
         'Mensaje que indica que no hay un SKU o código con ese valor y que para buscar por nombre se requieren al menos 3 caracteres.',
         lambda: buscar('ma'),
         lambda: visible(pg, 'al menos 3 caracteres'))

    # ---------------- PF-06 Registrar entrada ----------------
    F = 'PF-06 Registrar entrada de inventario'

    def mov(tipo, producto, cantidad, obs):
        pg.goto(URL + '/movimientos')
        elegir_producto(pg, producto)
        pg.get_by_role('button', name='Entrada · Recepción' if tipo == 'E' else 'Salida · Despacho').click()
        pg.get_by_label('Cantidad').fill(cantidad)
        pg.locator('input').last.fill(obs)
        pg.get_by_role('button', name='Registrar ' + ('entrada' if tipo == 'E' else 'salida')).click()

    caso(pg, 'PF-06-1', F, 'Exitosa', 'Entrada por recepción de mercancía',
         'En Movimientos buscar «Martillo», elegir «Entrada · Recepción», cantidad 10, observación «Factura 5530 Distribuidora Andina»; pulsar «Registrar entrada».',
         'Mensaje «Entrada registrada. FER-0012: stock 15 → 25» y la ficha muestra el nuevo stock.',
         lambda: mov('E', 'Martillo', '10', 'Factura 5530 Distribuidora Andina'),
         lambda: visible(pg, 'Entrada registrada'))
    caso(pg, 'PF-06-2', F, 'Error', 'Entrada de un producto inactivo',
         'Buscar «Candado» (VAR-0001, producto inactivo), cantidad 5, observación «Remisión 77»; pulsar «Registrar entrada».',
         'Mensaje «Producto inactivo. Consulte a la Gerencia»; el stock no cambia.',
         lambda: mov('E', 'Candado', '5', 'Remisión 77'),
         lambda: visible(pg, 'Producto inactivo'))
    caso(pg, 'PF-06-3', F, 'Datos inválidos', 'Entrada con cantidad decimal',
         'Buscar «Martillo», cantidad «2.5»; pulsar «Registrar entrada».',
         'Mensaje en el campo «Ingrese un número entero»; no se registra el movimiento.',
         lambda: mov('E', 'Martillo', '2.5', 'Factura 5531'),
         lambda: visible(pg, 'Ingrese un número entero'))

    # ---------------- PF-07 Registrar salida por despacho ----------------
    F = 'PF-07 Registrar salida por despacho'
    caso(pg, 'PF-07-1', F, 'Exitosa', 'Salida por despacho',
         'Buscar «Bombillo», elegir «Salida · Despacho», cantidad 8, destino «Remisión 1210 · Ferretería El Centro»; pulsar «Registrar salida».',
         'Mensaje «Salida registrada. ELE-0105: stock 48 → 40».',
         lambda: mov('S', 'Bombillo', '8', 'Remisión 1210 · Ferretería El Centro'),
         lambda: visible(pg, 'Salida registrada'))
    caso(pg, 'PF-07-2', F, 'Error', 'Salida mayor que la existencia',
         'Buscar «Linterna» (existencia 3), cantidad 5, destino «Remisión 1211»; pulsar «Registrar salida».',
         'Mensaje «Existencia insuficiente. Disponible: 3»; el stock no cambia.',
         lambda: mov('S', 'Linterna', '5', 'Remisión 1211'),
         lambda: visible(pg, 'Existencia insuficiente. Disponible: 3'))
    caso(pg, 'PF-07-3', F, 'Datos inválidos', 'Salida sin destino ni remisión',
         'Buscar «Bombillo», cantidad 2 y dejar vacío el destino; pulsar «Registrar salida».',
         'Mensaje en el campo «Indique el destino o el número de remisión del despacho».',
         lambda: mov('S', 'Bombillo', '2', ''),
         lambda: visible(pg, 'Indique el destino o el número de remisión'))

    # ---------------- PF-08 Consultar kardex ----------------
    F = 'PF-08 Consultar kardex'
    hoy = date.today()

    def kardex(producto, desde=None, hasta=None):
        pg.goto(URL + '/kardex')
        elegir_producto(pg, producto)
        pg.wait_for_timeout(600)
        if desde:
            pg.get_by_label('Desde').fill(desde)
            pg.get_by_label('Hasta').fill(hasta)
            pg.get_by_role('button', name='Consultar').click()
            pg.wait_for_timeout(600)

    caso(pg, 'PF-08-1', F, 'Exitosa', 'Kardex de un producto',
         'En Kardex buscar «Martillo» (rango por defecto: últimos 30 días).',
         'Se listan los movimientos en orden (INICIAL, DESPACHO, RECEPCIÓN, RECEPCIÓN) con saldos; el último saldo es el stock actual.',
         lambda: kardex('Martillo'),
         lambda: visible(pg, 'Stock nuevo'))
    caso(pg, 'PF-08-2', F, 'Error', 'Período sin movimientos',
         'Consultar el kardex de «Martillo» entre el 01/01/2026 y el 31/01/2026.',
         'Mensaje «No hay movimientos para el período seleccionado».',
         lambda: kardex('Martillo', '2026-01-01', '2026-01-31'),
         lambda: visible(pg, 'No hay movimientos para el período seleccionado'))
    caso(pg, 'PF-08-3', F, 'Datos inválidos', 'Fecha inicial mayor que la final',
         'Consultar con «Desde» = hoy y «Hasta» = hace 10 días.',
         'Mensaje «La fecha inicial no puede ser mayor que la final».',
         lambda: kardex('Martillo', hoy.isoformat(), (hoy - timedelta(days=10)).isoformat()),
         lambda: visible(pg, 'La fecha inicial no puede ser mayor que la final'))

    nav.close()

with open(os.path.join(DIR, 'resultados.json'), 'w', encoding='utf-8') as f:
    json.dump(resultados, f, ensure_ascii=False, indent=2)
fallidas = [r for r in resultados if r['estado'] != 'Aprobada']
print(f'\n{len(resultados) - len(fallidas)} de {len(resultados)} pruebas funcionales aprobadas')
sys.exit(1 if fallidas else 0)
