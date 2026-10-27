// Cliente HTTP de la API REST. Lanza ApiError con {status, mensaje, campos} para mostrarlos por campo.
export class ApiError extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'Ocurrió un error inesperado');
    this.status = status;
    this.campos = cuerpo?.campos || {};
  }
}

export async function api(ruta, { metodo = 'GET', datos } = {}) {
  let r;
  try {
    r = await fetch('/api/v1' + ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: datos ? { 'Content-Type': 'application/json' } : {},
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new ApiError(0, { mensaje: 'Sin conexión con el servidor. Verifique la red e intente de nuevo' });
  }
  const cuerpo = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
  if (!r.ok) {
    if (r.status === 401 && !ruta.startsWith('/auth/login')) window.dispatchEvent(new Event('sesion-expirada'));
    throw new ApiError(r.status, cuerpo);
  }
  return cuerpo;
}

export const dinero = v => (v == null ? '' : 'Bs. ' + Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const fechaHora = v => new Date(v).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
