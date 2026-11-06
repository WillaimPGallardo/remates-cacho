// Componentes de interfaz reutilizables
import { cloneElement, isValidElement, useId } from 'react';

// Campo con etiqueta asociada al control (label for/id) y mensaje vinculado con aria-describedby (accesibilidad)
export function Campo({ etiqueta, error, ayuda, children, obligatorio }) {
  const id = useId();
  const idMsg = id + '-msg';
  const asociable = isValidElement(children) && [Entrada, Selector, 'input', 'select', 'textarea'].includes(children.type);
  const control = asociable ? cloneElement(children, {
    id: children.props.id || id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || ayuda ? idMsg : undefined,
  }) : children;
  return (
    <div className="f">
      <label htmlFor={asociable ? control.props.id : undefined}>{etiqueta}{obligatorio && ' *'}</label>
      {control}
      {error ? <div className="msg-e" id={idMsg}>{error}</div> : ayuda ? <div className="msg-h" id={idMsg}>{ayuda}</div> : null}
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
