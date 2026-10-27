import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from './sesion';

const MENU = [
  { a: '/', t: 'Inicio', p: null },
  { a: '/usuarios', t: 'Usuarios', p: 'USUARIOS_GESTIONAR' },
  { a: '/productos', t: 'Catálogo', p: 'PRODUCTOS_CONSULTAR' },
  { a: '/movimientos', t: 'Movimientos', p: 'MOVIMIENTOS_REGISTRAR' },
  { a: '/kardex', t: 'Kardex', p: 'KARDEX_CONSULTAR' },
];
const NOMBRE_ROL = { GERENCIA: 'Gerencia', CAJERO: 'Cajero', BODEGUERO: 'Bodeguero' };

export default function Layout() {
  const { usuario, salir, puede } = useSesion();
  return (
    <div className="app">
      <nav className="side">
        <div className="brand"><b>REMATES CACHO</b><span>Control de inventario y ventas</span></div>
        {MENU.filter(m => !m.p || puede(m.p)).map(m => (
          <NavLink key={m.a} to={m.a} end={m.a === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>{m.t}</NavLink>
        ))}
      </nav>
      <div className="main">
        <header className="top">
          <span>{usuario.usuario}</span><span className="chip">{NOMBRE_ROL[usuario.rol]}</span>
          <button className="btn sm" onClick={salir}>Cerrar sesión</button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
