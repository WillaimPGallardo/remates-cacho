// Íconos SVG propios (trazo de 24×24, heredan el color del texto). Son decorativos:
// el nombre accesible lo da el botón o enlace que los contiene (aria-label o texto).
const T = {
  salir: <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" /></>,
  editar: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  codigo: <><path d="M4 6v12M7 6v12M10 6v12M14 6v12M16 6v12M20 6v12" /></>,
  kardex: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></>,
  mas: <><path d="M12 5v14M5 12h14" /></>,
  inicio: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>,
  usuarios: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20" /></>,
  catalogo: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  movimientos: <><path d="M7 20V5M3 9l4-4 4 4" /><path d="M17 4v15M13 15l4 4 4-4" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  imprimir: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  guardar: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  cerrar: <><path d="M6 6l12 12M18 6L6 18" /></>,
  apagar: <><path d="M12 3v8" /><path d="M6.6 6.6a8 8 0 1 0 10.8 0" /></>,
  activar: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M15.5 12l2 2 4-4" /></>,
  llave: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2" /></>,
  alerta: <><path d="M12 3.5L2.5 20h19L12 3.5z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  entrada: <><path d="M12 3v11M7.5 9.5L12 14l4.5-4.5" /><path d="M4 15v4h16v-4" /></>,
  salida: <><path d="M12 14V3M7.5 7.5L12 3l4.5 4.5" /><path d="M4 15v4h16v-4" /></>,
  recargar: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  volver: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
  ojo: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  ojoNo: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  candado: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  etiqueta: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.5" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
};

export default function Icono({ n, tam = 18, className = '' }) {
  return (
    <svg className={'ico ' + className} width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{T[n]}</svg>
  );
}
