// P2.1 Listado de usuarios, P2.2 Creación y P2.3 Edición (RF-02, CU-002)
import { useEffect, useState } from 'react';
import { api, fechaHora } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Campo, Entrada, Selector, Alerta, Modal, Insignia } from '../../comun/ui';
import { ListaRequisitos } from '../auth/CambioContrasena';

const ROLES = [{ valor: 'GERENCIA', texto: 'Gerencia / Administrador' }, { valor: 'CAJERO', texto: 'Cajero' }, { valor: 'BODEGUERO', texto: 'Bodeguero' }];
const nombreRol = r => ({ GERENCIA: 'Gerencia', CAJERO: 'Cajero', BODEGUERO: 'Bodeguero' }[r]);

function Estado({ u }) {
  if (u.estado === 'INACTIVO') return <Insignia tipo="no">Inactivo</Insignia>;
  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) return <Insignia tipo="w">Bloqueado hasta {new Date(u.bloqueado_hasta).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</Insignia>;
  return <Insignia tipo="ok">Activo</Insignia>;
}

function Formulario({ editar, onListo, onCancelar }) {
  const [d, setD] = useState(editar ? { ...editar } : { nombre_completo: '', nombre_usuario: '', correo: '', rol: 'CAJERO', contrasena: '', confirmacion: '' });
  const [err, setErr] = useState({ campos: {}, mensaje: '' });
  const set = k => e => setD({ ...d, [k]: e.target.value });
  async function guardar(e) {
    e.preventDefault();
    try {
      const r = editar ? await api(`/usuarios/${editar.id_usuario}`, { metodo: 'PUT', datos: d }) : await api('/usuarios', { metodo: 'POST', datos: d });
      onListo(r, editar ? 'Cambios guardados' : 'Usuario creado. Deberá cambiar la contraseña inicial en su primer ingreso');
    } catch (ex) { setErr({ campos: ex.campos, mensaje: ex.message }); }
  }
  const c = err.campos;
  return (
    <form className="card" style={{ maxWidth: 780 }} onSubmit={guardar} noValidate>
      <h2>{editar ? `Editar usuario · ${editar.nombre_usuario}` : 'Nuevo usuario'}</h2>
      <div className="row">
        <Campo etiqueta="Nombre completo" obligatorio error={c.nombre_completo} ayuda="2 a 100 letras y espacios"><Entrada value={d.nombre_completo} onChange={set('nombre_completo')} error={c.nombre_completo} /></Campo>
        <Campo etiqueta="Nombre de usuario" obligatorio={!editar} error={c.nombre_usuario} ayuda={editar ? 'No se modifica: identifica al usuario en la auditoría' : '4 a 30: minúsculas, números, punto o guion bajo'}>
          {editar ? <Entrada className="in ro" readOnly value={d.nombre_usuario} /> : <Entrada value={d.nombre_usuario} onChange={set('nombre_usuario')} error={c.nombre_usuario} />}
        </Campo>
      </div>
      <div className="row">
        <Campo etiqueta="Correo" obligatorio error={c.correo}><Entrada type="email" value={d.correo} onChange={set('correo')} error={c.correo} /></Campo>
        <Campo etiqueta="Rol" obligatorio error={c.rol} ayuda={editar ? 'Si cambia el rol se cierran sus sesiones' : 'Un solo rol por usuario'}><Selector opciones={ROLES} value={d.rol} onChange={set('rol')} error={c.rol} /></Campo>
      </div>
      {!editar && (<>
        <div className="row">
          <Campo etiqueta="Contraseña inicial" obligatorio error={c.contrasena}><Entrada type="password" value={d.contrasena} onChange={set('contrasena')} error={c.contrasena} /></Campo>
          <Campo etiqueta="Confirmar contraseña" obligatorio error={c.confirmacion || (d.confirmacion && d.confirmacion !== d.contrasena ? 'Las contraseñas no coinciden' : '')}>
            <Entrada type="password" value={d.confirmacion} onChange={set('confirmacion')} error={c.confirmacion} />
          </Campo>
        </div>
        <ListaRequisitos clave={d.contrasena} usuario={d.nombre_usuario} />
      </>)}
      <Alerta>{err.mensaje && err.mensaje !== 'Revise los datos ingresados' && err.mensaje !== 'Datos duplicados' ? err.mensaje : ''}</Alerta>
      <div className="row derecha"><button type="button" className="btn" onClick={onCancelar}>Cancelar</button><button className="btn p">Guardar</button></div>
    </form>
  );
}

export default function Usuarios() {
  const { usuario } = useSesion();
  const [lista, setLista] = useState([]);
  const [f, setF] = useState({ q: '', rol: '', estado: '' });
  const [vista, setVista] = useState(null);   // null | 'nuevo' | usuario a editar
  const [aviso, setAviso] = useState({ t: 's', m: '' });
  const [temporal, setTemporal] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const cargar = () => api('/usuarios?' + new URLSearchParams(f)).then(setLista).catch(e => setAviso({ t: 'e', m: e.message }));
  useEffect(() => { cargar(); }, [f]);

  async function ejecutar() {
    const { u, accion } = confirmar; setConfirmar(null);
    try {
      if (accion === 'restablecer') setTemporal({ u, ...(await api(`/usuarios/${u.id_usuario}/restablecer`, { metodo: 'POST' })) });
      else { await api(`/usuarios/${u.id_usuario}/estado`, { metodo: 'PATCH', datos: { estado: accion } }); setAviso({ t: 's', m: accion === 'INACTIVO' ? `Cuenta ${u.nombre_usuario} desactivada y sesiones cerradas` : `Cuenta ${u.nombre_usuario} reactivada` }); }
      cargar();
    } catch (e) { setAviso({ t: 'e', m: e.message }); }
  }

  if (vista) return <Formulario editar={vista === 'nuevo' ? null : vista} onCancelar={() => setVista(null)} onListo={(_, m) => { setVista(null); setAviso({ t: 's', m }); cargar(); }} />;

  return (
    <>
      <h1>Gestión de usuarios</h1><div className="sub">P2.1 · RF-02</div>
      <div className="card"><div className="row">
        <Campo etiqueta="Buscar"><Entrada placeholder="Nombre, usuario o correo" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /></Campo>
        <Campo etiqueta="Rol"><Selector opciones={ROLES} vacio="Todos" value={f.rol} onChange={e => setF({ ...f, rol: e.target.value })} /></Campo>
        <Campo etiqueta="Estado"><Selector opciones={[{ valor: 'ACTIVO', texto: 'Activo' }, { valor: 'INACTIVO', texto: 'Inactivo' }, { valor: 'BLOQUEADO', texto: 'Bloqueado' }]} vacio="Todos" value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} /></Campo>
        <button className="btn p" onClick={() => setVista('nuevo')}>+ Nuevo usuario</button>
      </div></div>
      <Alerta tipo={aviso.t}>{aviso.m}</Alerta>
      <div className="card tabla"><table>
        <thead><tr><th>Nombre completo</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead>
        <tbody>{lista.map(u => (
          <tr key={u.id_usuario}>
            <td>{u.nombre_completo}</td><td>{u.nombre_usuario}</td><td>{u.correo}</td><td>{nombreRol(u.rol)}</td><td><Estado u={u} /></td>
            <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : '—'}</td>
            <td className="acciones">
              <button className="lnk" onClick={() => setVista(u)}>Editar</button>
              {u.id_usuario !== usuario.id && (u.estado === 'ACTIVO'
                ? <button className="lnk" onClick={() => setConfirmar({ u, accion: 'INACTIVO' })}>Desactivar</button>
                : <button className="lnk" onClick={() => setConfirmar({ u, accion: 'ACTIVO' })}>Reactivar</button>)}
              {u.estado === 'ACTIVO' && <button className="lnk" onClick={() => setConfirmar({ u, accion: 'restablecer' })}>Restablecer contraseña</button>}
            </td>
          </tr>))}
          {!lista.length && <tr><td colSpan="7" className="mut">No se encontraron usuarios</td></tr>}
        </tbody></table></div>
      {confirmar && (
        <Modal titulo={{ INACTIVO: 'Desactivar cuenta', ACTIVO: 'Reactivar cuenta', restablecer: 'Restablecer contraseña' }[confirmar.accion]} onCerrar={() => setConfirmar(null)}>
          <p className="mut">{{ INACTIVO: `La cuenta ${confirmar.u.nombre_usuario} quedará inactiva y se cerrarán sus sesiones. Su historial se conserva.`, ACTIVO: `La cuenta ${confirmar.u.nombre_usuario} podrá volver a ingresar.`, restablecer: `Se generará una contraseña temporal de 24 horas para ${confirmar.u.nombre_usuario} y se cerrarán sus sesiones.` }[confirmar.accion]}</p>
          <div className="row derecha"><button className="btn" onClick={() => setConfirmar(null)}>Cancelar</button><button className="btn p" onClick={ejecutar}>Confirmar</button></div>
        </Modal>)}
      {temporal && (
        <Modal titulo="Contraseña temporal generada" onCerrar={() => setTemporal(null)}>
          <p className="mut">Entréguela personalmente a <b>{temporal.u.nombre_usuario}</b>. Se muestra una sola vez y no se envía por correo.</p>
          <div className="temporal">{temporal.contrasenaTemporal}</div>
          <Alerta tipo="w">Vigencia: hasta {fechaHora(temporal.expira)}. Deberá cambiarla en su próximo ingreso.</Alerta>
          <div className="row derecha"><button className="btn p" onClick={() => setTemporal(null)}>Entendido</button></div>
        </Modal>)}
    </>
  );
}
