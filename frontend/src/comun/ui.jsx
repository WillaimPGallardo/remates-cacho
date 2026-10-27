// Componentes de interfaz reutilizables
export function Campo({ etiqueta, error, ayuda, children, obligatorio }) {
  return (
    <div className="f">
      <label>{etiqueta}{obligatorio && ' *'}</label>
      {children}
      {error ? <div className="msg-e">{error}</div> : ayuda ? <div className="msg-h">{ayuda}</div> : null}
    </div>
  );
}

export function Entrada({ error, ...p }) {
  return <input className={'in' + (error ? ' err' : '')} {...p} />;
}

export function Selector({ error, opciones, vacio, ...p }) {
  return (
    <select className={'in' + (error ? ' err' : '')} {...p}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
    </select>
  );
}

export function Alerta({ tipo = 'e', children }) {
  if (!children) return null;
  return <div className={`al al-${tipo}`} role="alert">{children}</div>;
}

export function Modal({ titulo, children, onCerrar }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCerrar?.()}>
      <div className="modal" role="dialog" aria-label={titulo}><h3>{titulo}</h3>{children}</div>
    </div>
  );
}

export const Insignia = ({ tipo, children }) => <span className={`bd b-${tipo}`}>{children}</span>;
