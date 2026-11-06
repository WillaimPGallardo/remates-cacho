// Taller 7 · Parte 2: pruebas unitarias de funciones internas (sin base de datos).
// Cada función tiene casos normales, casos límite y un caso erróneo. Los ID (PU-xx) son los del documento.
const { digitoControlGS1, validarCodigo, formatoInterno } = require('../src/comun/codigos');
const { reglas, validar, requisitosContrasena, rangoFechas } = require('../src/comun/validaciones');
const { generarTemporal } = require('../src/modulos/usuarios/usuarios.servicio');

describe('PU-01 digitoControlGS1()', () => {
  test('normal: calcula el dígito de control de un EAN-13', () => expect(digitoControlGS1('770123456789')).toBe(7));
  test('normal: calcula el dígito de control de un UPC-A', () => expect(digitoControlGS1('03600029145')).toBe(2));
  test('límite: si la suma ya es múltiplo de 10 el dígito es 0', () => expect(digitoControlGS1('000000000000')).toBe(0));
  test('erróneo: un cuerpo con letras no produce un dígito válido', () => expect(digitoControlGS1('77012345678A')).toBeNaN());
});

describe('PU-02 validarCodigo()', () => {
  test('normal: acepta EAN-13, UPC-A y Code 128 válidos', () => {
    expect(validarCodigo('EAN_13', '7701234567897')).toBeNull();
    expect(validarCodigo('UPC_A', '036000291452')).toBeNull();
    expect(validarCodigo('CODE_128', 'ABC-123')).toBeNull();
  });
  test('límite: Code 128 de 1 y de 48 caracteres se acepta; de 49 se rechaza', () => {
    expect(validarCodigo('CODE_128', 'X')).toBeNull();
    expect(validarCodigo('CODE_128', 'A'.repeat(48))).toBeNull();
    expect(validarCodigo('CODE_128', 'A'.repeat(49))).toMatch(/1 a 48/);
  });
  test('límite: EAN-13 con 12 dígitos se rechaza por longitud', () => expect(validarCodigo('EAN_13', '770123456789')).toMatch(/13 dígitos/));
  test('erróneo: dígito de control incorrecto y tipo desconocido', () => {
    expect(validarCodigo('EAN_13', '7701234567890')).toBe('El dígito de control no es válido');
    expect(validarCodigo('QR', '123')).toBe('Tipo de código no válido');
  });
});

describe('PU-03 formatoInterno()', () => {
  test('normal: arma RC + 8 dígitos', () => expect(formatoInterno(125)).toBe('RC00000125'));
  test('límite: primer y último consecutivo de 8 dígitos', () => {
    expect(formatoInterno(1)).toBe('RC00000001');
    expect(formatoInterno(99999999)).toBe('RC99999999');
  });
  test('erróneo: un consecutivo de 9 dígitos ya no cumple el formato RC + 8 dígitos', () => expect(formatoInterno(100000000)).not.toMatch(/^RC\d{8}$/));
});

describe('PU-04 requisitosContrasena()', () => {
  test('normal: una frase de contraseña cumple la política', () => expect(requisitosContrasena('bodega principal norte', 'bodeguero1')).toEqual([]));
  test('límite: 11 caracteres no cumple, 12 sí; 64 sí, 65 no', () => {
    expect(requisitosContrasena('frase corta')).toContain('Mínimo 12 caracteres');
    expect(requisitosContrasena('frase cortas')).toEqual([]);
    const larga = 'el martillo de una cabeza sirve para clavar puntillas en la madera de pino';
    expect(requisitosContrasena(larga.slice(0, 64))).toEqual([]);
    expect(requisitosContrasena(larga.slice(0, 65))).toContain('Máximo 64 caracteres');
  });
  test('erróneo: contraseña común, secuencia y nombre de usuario', () => {
    expect(requisitosContrasena('password1234')).toContain('Es una contraseña común o filtrada');
    expect(requisitosContrasena('zzzzzzzzzzzz')).toContain('No debe ser una secuencia o repetición simple');
    expect(requisitosContrasena('hola soy cajero1', 'cajero1')).toContain('No debe contener el nombre de usuario');
  });
});

describe('PU-05 reglas.precio()', () => {
  test('normal: acepta enteros y hasta 2 decimales', () => {
    expect(reglas.precio('85')).toBeNull();
    expect(reglas.precio('12.50')).toBeNull();
  });
  test('límite: 0.01 se acepta y 0 se rechaza', () => {
    expect(reglas.precio('0.01')).toBeNull();
    expect(reglas.precio('0')).toBe('Debe ser mayor que cero');
  });
  test('erróneo: texto, negativos y 3 decimales', () => {
    expect(reglas.precio('abc')).toMatch(/hasta 2 decimales/);
    expect(reglas.precio('-5')).toMatch(/hasta 2 decimales/);
    expect(reglas.precio('1.999')).toMatch(/hasta 2 decimales/);
  });
});

describe('PU-06 reglas.entero(min, max)', () => {
  const cantidad = reglas.entero(1, 99999);
  test('normal: acepta una cantidad entera dentro del rango', () => expect(cantidad('10')).toBeNull());
  test('límite: 1 y 99 999 se aceptan; 0 y 100 000 se rechazan', () => {
    expect(cantidad('1')).toBeNull();
    expect(cantidad('99999')).toBeNull();
    expect(cantidad('0')).toMatch(/entre 1 y/);
    expect(cantidad('100000')).toMatch(/entre 1 y/);
  });
  test('erróneo: decimales y texto', () => {
    expect(cantidad('2.5')).toBe('Ingrese un número entero');
    expect(cantidad('diez')).toBe('Ingrese un número entero');
  });
});

describe('PU-07 reglas.correo()', () => {
  test('normal: acepta un correo con dominio', () => expect(reglas.correo('caja@rematescacho.com')).toBeNull());
  test('límite: 100 caracteres se aceptan y 101 no', () => {
    const correo = n => 'a'.repeat(n - '@rc.com'.length) + '@rc.com';
    expect(reglas.correo(correo(100))).toBeNull();
    expect(reglas.correo(correo(101))).toMatch(/Correo no válido/);
  });
  test('erróneo: sin @, sin dominio o con espacios', () => {
    for (const c of ['caja.rematescacho.com', 'caja@rematescacho', 'caja @rc.com']) expect(reglas.correo(c)).toMatch(/Correo no válido/);
  });
});

describe('PU-08 rangoFechas()', () => {
  test('normal: un rango válido devuelve desde y hasta', () => {
    const r = rangoFechas('2026-10-01', '2026-10-31');
    expect(r.error).toBeUndefined();
    expect(r.desde < r.hasta).toBe(true);
  });
  test('límite: el mismo día es válido; más de 12 meses no', () => {
    expect(rangoFechas('2026-10-15', '2026-10-15').error).toBeUndefined();
    expect(rangoFechas('2025-01-01', '2026-10-31').error).toBe('El rango máximo es de 12 meses');
  });
  test('erróneo: fecha inicial mayor que la final, fecha futura y fecha no válida', () => {
    expect(rangoFechas('2026-10-20', '2026-10-01').error).toBe('La fecha inicial no puede ser mayor que la final');
    expect(rangoFechas('2026-10-01', '2099-01-01').error).toBe('No se permiten fechas futuras');
    expect(rangoFechas('2026-13-45', '2026-10-01').error).toBe('Fecha no válida');
  });
});

describe('PU-09 generarTemporal()', () => {
  test('normal: genera 12 caracteres sin caracteres ambiguos', () => expect(generarTemporal()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/));
  test('límite: 200 contraseñas generadas son distintas y todas cumplen la política', () => {
    const lista = Array.from({ length: 200 }, generarTemporal);
    expect(new Set(lista).size).toBe(200);
    for (const c of lista) expect(requisitosContrasena(c)).toEqual([]);
  });
  test('erróneo: nunca contiene 0, O, 1, l ni I', () => {
    for (let i = 0; i < 200; i++) expect(generarTemporal()).not.toMatch(/[0O1lI]/);
  });
});

describe('PU-10 validar(datos, esquema)', () => {
  const esquema = { sku: [true, reglas.sku], referencia: [false, null] };
  test('normal: datos correctos no producen errores', () => expect(validar({ sku: 'FER-0012' }, esquema)).toEqual({}));
  test('límite: un campo opcional vacío se omite y un SKU de 3 caracteres es válido', () => expect(validar({ sku: 'ABC', referencia: '' }, esquema)).toEqual({}));
  test('erróneo: campo obligatorio vacío y formato inválido', () => {
    expect(validar({ sku: '   ' }, esquema)).toEqual({ sku: 'Campo obligatorio' });
    expect(validar({ sku: 'fer 12' }, esquema)).toEqual({ sku: 'De 3 a 20 caracteres: mayúsculas, números o guion' });
  });
});
