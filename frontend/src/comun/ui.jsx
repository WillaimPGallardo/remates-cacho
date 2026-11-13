// Componentes de interfaz reutilizables
import { cloneElement, isValidElement, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Icono from './iconos';

// Campo con etiqueta asociada al control (label for/id) y mensaje vinculado con aria-describedby (accesibilidad)
export function Campo({ etiqueta, error, ayuda, children, obligatorio }) {
  const id = useId();
  const idMsg = id + '-msg';
  const asociable = isValidElement(children) && [Entrada, EntradaClave, Selector, 'input', 'select', 'textarea'].includes(children.type);
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

// Contraseña con botón para mostrarla u ocultarla
export function EntradaClave({ error, ...p }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="clave">
      <input className={'in' + (error ? ' err' : '')} {...p} type={ver ? 'text' : 'password'} />
      <button type="button" className="clave-ojo" aria-pressed={ver} title={ver ? 'Ocultar' : 'Mostrar'} aria-label={ver ? 'Ocultar el texto' : 'Ver el texto'} onClick={() => setVer(!ver)}>
        <Icono n={ver ? 'ojoNo' : 'ojo'} tam={17} />
      </button>
    </div>
  );
}

export function Selector({ error, opciones, vacio, ...p }) {
  return (
    <select className={'in' + (error ? ' err' : '')} {...p}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
    </select>
  );
}

const ICONO_ALERTA = { e: 'alerta', w: 'alerta', s: 'guardar', i: 'info' };
export function Alerta({ tipo = 'e', children }) {
  if (!children) return null;
  return <div className={`al al-${tipo}`} role="alert"><Icono n={ICONO_ALERTA[tipo]} tam={17} /><span>{children}</span></div>;
}

export function Modal({ titulo, children, onCerrar }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCerrar?.()}>
      <div className="modal" role="dialog" aria-label={titulo}><h3>{titulo}</h3>{children}</div>
    </div>
  );
}

export const Insignia = ({ tipo, children }) => <span className={`bd b-${tipo}`}>{children}</span>;

// Botón solo con ícono: el texto va en aria-label (lectores de pantalla) y en un tooltip al pasar el cursor.
// Con «a» se comporta como enlace interno de la aplicación.
export function BotonIcono({ icono, texto, a, tono = '', ...p }) {
  const props = { className: `bi ${tono}`, 'aria-label': texto, 'data-tip': texto, ...p };
  const ico = <Icono n={icono} tam={17} />;
  return a ? <Link to={a} {...props}>{ico}</Link> : <button type="button" {...props}>{ico}</button>;
}
