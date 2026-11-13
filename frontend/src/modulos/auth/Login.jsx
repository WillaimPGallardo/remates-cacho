// P1.1 Inicio de sesión (RF-01, CU-001)
import { useState } from 'react';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Campo, Entrada, EntradaClave, Alerta } from '../../comun/ui';
import Icono from '../../comun/iconos';

export default function Login() {
  const { refrescar } = useSesion();
  const [d, setD] = useState({ usuario: '', contrasena: '' });
  const [err, setErr] = useState({ campos: {}, mensaje: '', tipo: 'e' });
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const campos = {};
    if (!d.usuario.trim()) campos.usuario = 'Campo obligatorio';
    if (!d.contrasena) campos.contrasena = 'Campo obligatorio';
    if (Object.keys(campos).length) return setErr({ campos, mensaje: 'Debe completar todos los campos', tipo: 'e' });
    setEnviando(true);
    try {
      await api('/auth/login', { metodo: 'POST', datos: d });
      await refrescar();
    } catch (ex) {
      setErr({ campos: ex.status === 401 ? { usuario: ' ', contrasena: ' ' } : {}, mensaje: ex.message, tipo: ex.status === 423 || ex.status === 403 ? 'w' : 'e' });
      setD(x => ({ ...x, contrasena: '' }));
    } finally { setEnviando(false); }
  }

  return (
    <div className="centro">
      <form className="card login" onSubmit={enviar} noValidate>
        <div className="logo"><span className="logo-ico"><Icono n="etiqueta" tam={28} /></span><b>REMATES CACHO</b><div className="mut">Control de inventario y ventas</div></div>
        <Campo etiqueta="Usuario o correo" obligatorio error={err.campos.usuario?.trim()}>
          <Entrada error={err.campos.usuario} value={d.usuario} autoComplete="username" placeholder="usuario o correo"
            onChange={e => { const v = e.target.value; setD(x => ({ ...x, usuario: v })); }} />
        </Campo>
        <Campo etiqueta="Contraseña" obligatorio error={err.campos.contrasena?.trim()}>
          <EntradaClave error={err.campos.contrasena} value={d.contrasena} autoComplete="current-password" placeholder="contraseña"
            onChange={e => { const v = e.target.value; setD(x => ({ ...x, contrasena: v })); }} />
        </Campo>
        <button className="btn p full" disabled={enviando}>{enviando ? <><span className="giro" aria-hidden="true" />Verificando…</> : <><Icono n="candado" />Iniciar sesión</>}</button>
        <Alerta tipo={err.tipo}>{err.mensaje}</Alerta>
      </form>
    </div>
  );
}
