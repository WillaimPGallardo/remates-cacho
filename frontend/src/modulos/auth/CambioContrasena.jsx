// P1.2 Cambio de contraseña obligatorio (PG-03, PG-04)
import { useState } from 'react';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Campo, Entrada, Alerta } from '../../comun/ui';

export const requisitos = (c, usuario) => [
  ['Mínimo 8 caracteres', c.length >= 8],
  ['Al menos una letra mayúscula y una minúscula', /[A-Z]/.test(c) && /[a-z]/.test(c)],
  ['Al menos un número', /\d/.test(c)],
  ['Diferente del nombre de usuario', !!c && c.toLowerCase() !== (usuario || '').toLowerCase()],
];

export function ListaRequisitos({ clave, usuario }) {
  return (
    <div className="req">
      {requisitos(clave, usuario).map(([t, ok]) => <div key={t} className={ok ? 'y' : 'n'}>{ok ? '✓' : '✗'} {t}</div>)}
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
        <b style={{ fontSize: 19 }}>Cambio de contraseña obligatorio</b>
        <p className="mut" style={{ margin: '4px 0 14px' }}>Hola, {usuario.nombre}. Defina una contraseña nueva para continuar.</p>
        <Campo etiqueta="Contraseña temporal o actual" obligatorio error={err.campos.actual}>
          <Entrada type="password" value={d.actual} onChange={e => setD({ ...d, actual: e.target.value })} error={err.campos.actual} />
        </Campo>
        <Campo etiqueta="Nueva contraseña" obligatorio error={err.campos.nueva}>
          <Entrada type="password" value={d.nueva} onChange={e => setD({ ...d, nueva: e.target.value })} error={err.campos.nueva} />
        </Campo>
        <ListaRequisitos clave={d.nueva} usuario={usuario.usuario} />
        <Campo etiqueta="Confirmar nueva contraseña" obligatorio error={d.confirmacion && d.confirmacion !== d.nueva ? 'Las contraseñas no coinciden' : err.campos.confirmacion}>
          <Entrada type="password" value={d.confirmacion} onChange={e => setD({ ...d, confirmacion: e.target.value })} error={d.confirmacion && d.confirmacion !== d.nueva} />
        </Campo>
        <button className={'btn full ' + (cumple ? 'p' : 'dis')} disabled={!cumple}>Guardar contraseña</button>
        <button type="button" className="btn full" onClick={salir}>Cancelar y salir</button>
        <Alerta>{err.mensaje !== 'Revise los datos ingresados' ? err.mensaje : ''}</Alerta>
      </form>
    </div>
  );
}
