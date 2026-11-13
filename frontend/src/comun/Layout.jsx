import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from './sesion';
import Icono from './iconos';
import { BotonIcono } from './ui';

const MENU = [
  { a: '/', t: 'Inicio', i: 'inicio', p: null },
  { a: '/usuarios', t: 'Usuarios', i: 'usuarios', p: 'USUARIOS_GESTIONAR' },
  { a: '/productos', t: 'Catálogo', i: 'catalogo', p: 'PRODUCTOS_CONSULTAR' },
  { a: '/movimientos', t: 'Movimientos', i: 'movimientos', p: 'MOVIMIENTOS_REGISTRAR' },
  { a: '/kardex', t: 'Kardex', i: 'kardex', p: 'KARDEX_CONSULTAR' },
];
const NOMBRE_ROL = { GERENCIA: 'Gerencia', CAJERO: 'Cajero', BODEGUERO: 'Bodeguero' };
const iniciales = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function Layout() {
  const { usuario, salir, puede } = useSesion();
  const { pathname } = useLocation();
  return (
    <div className="app">
      <nav className="side" aria-label="Menú principal">
        <div className="brand"><span className="brand-logo"><Icono n="etiqueta" tam={20} /></span>
          <div><b>REMATES CACHO</b><span>Inventario y ventas</span></div></div>
        {MENU.filter(m => !m.p || puede(m.p)).map(m => (
          <NavLink key={m.a} to={m.a} end={m.a === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
            <Icono n={m.i} /><span>{m.t}</span>
          </NavLink>
        ))}
      </nav>
      <div className="main">
        <header className="top">
          <div className="perfil">
            <span className="avatar" aria-hidden="true">{iniciales(usuario.nombre || usuario.usuario)}</span>
            <div className="perfil-txt"><b>{usuario.nombre || usuario.usuario}</b><span className="chip">{NOMBRE_ROL[usuario.rol]}</span></div>
          </div>
          <BotonIcono icono="salir" texto="Cerrar sesión" tono="peligro" onClick={salir} />
        </header>
        {/* key: la animación de entrada se repite al cambiar de pantalla */}
        <main className="content" key={pathname}><Outlet /></main>
      </div>
    </div>
  );
}
