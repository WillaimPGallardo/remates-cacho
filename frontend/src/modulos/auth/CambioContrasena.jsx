// P1.2 Cambio de contraseña obligatorio (PG-03, PG-04)
import { useState } from 'react';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Campo, EntradaClave, Alerta } from '../../comun/ui';
import Icono from '../../comun/iconos';

// PG-03: de 12 a 64 caracteres, se admiten frases con espacios y no se exigen mayúsculas, números ni símbolos.
// El servidor además rechaza las contraseñas comunes o filtradas y las secuencias simples.
export const requisitos = (c, usuario) => [
  ['De 12 a 64 caracteres (puede ser una frase con espacios)', [...c].length >= 12 && [...c].length <= 64],
  ['No contiene el nombre de usuario', !!c && !(usuario && c.toLowerCase().includes(usuario.toLowerCase()))],
];

export function ListaRequisitos({ clave, usuario }) {
  return (
    <div className="req">
      {requisitos(clave, usuario).map(([t, ok]) => <div key={t} className={ok ? 'y' : 'n'}><Icono n={ok ? 'guardar' : 'cerrar'} tam={14} /> {t}</div>)}
      <div className="mut">Al guardar se verifica que no sea una contraseña común o filtrada ni una secuencia simple.</div>
    </div>
  );
}

export default function CambioContrasena() {
  const { usuario, refrescar, salir } = useSesion();
  const [d, setD] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [err, setErr] = useState({ campos: {}, mensaje: '' });
  const cumple = requisitos(d.nueva, usuario.usuario).every(([, ok]) => ok) && d.nueva === d.confirmacion && d.actual;

  async function enviar(e) {
    e.preventDefault();
    try { await api('/auth/cambiar-contrasena', { metodo: 'POST', datos: d }); await refrescar(); }
    catch (ex) { setErr({ campos: ex.campos, mensaje: ex.message }); }
  }
  return (
    <div className="centro">
      <form className="card login" onSubmit={enviar}>
        <div className="logo"><span className="logo-ico"><Icono n="llave" tam={26} /></span></div><b style={{ fontSize: 19 }}>Cambio de contraseña obligatorio</b>
        <p className="mut" style={{ margin: '4px 0 14px' }}>Hola, {usuario.nombre}. Defina una contraseña nueva para continuar.</p>
        <Campo etiqueta="Contraseña temporal o actual" obligatorio error={err.campos.actual}>
          <EntradaClave value={d.actual} onChange={e => { const v = e.target.value; setD(x => ({ ...x, actual: v })); }} error={err.campos.actual} />
        </Campo>
        <Campo etiqueta="Nueva contraseña" obligatorio error={err.campos.nueva}>
          <EntradaClave value={d.nueva} onChange={e => { const v = e.target.value; setD(x => ({ ...x, nueva: v })); }} error={err.campos.nueva} />
        </Campo>
        <ListaRequisitos clave={d.nueva} usuario={usuario.usuario} />
        <Campo etiqueta="Confirmar nueva contraseña" obligatorio error={d.confirmacion && d.confirmacion !== d.nueva ? 'Las contraseñas no coinciden' : err.campos.confirmacion}>
          <EntradaClave value={d.confirmacion} onChange={e => { const v = e.target.value; setD(x => ({ ...x, confirmacion: v })); }} error={d.confirmacion && d.confirmacion !== d.nueva} />
        </Campo>
        <button className={'btn full ' + (cumple ? 'p' : 'dis')} disabled={!cumple}><Icono n="guardar" />Guardar contraseña</button>
        <button type="button" className="btn full" onClick={salir}><Icono n="salir" />Cancelar y salir</button>
        <Alerta>{err.mensaje !== 'Revise los datos ingresados' ? err.mensaje : ''}</Alerta>
      </form>
    </div>
  );
}
