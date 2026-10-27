import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProveedorSesion, useSesion } from './comun/sesion';
import Layout from './comun/Layout';
import Login from './modulos/auth/Login';
import CambioContrasena from './modulos/auth/CambioContrasena';
import Panel from './modulos/panel/Panel';
import Usuarios from './modulos/usuarios/Usuarios';
import Productos from './modulos/catalogo/Productos';
import ProductoForm from './modulos/catalogo/ProductoForm';
import CodigoEtiqueta from './modulos/catalogo/CodigoEtiqueta';
import Movimiento from './modulos/inventario/Movimiento';
import Kardex from './modulos/inventario/Kardex';

// Ruta visible solo para quien tiene el permiso (el servidor también lo verifica)
function Con({ permiso, children }) {
  const { puede } = useSesion();
  return puede(permiso) ? children : <Navigate to="/" replace />;
}

function Rutas() {
  const { usuario } = useSesion();
  if (usuario === undefined) return <div className="centro mut">Cargando…</div>;
  if (!usuario) return <Login />;
  if (usuario.requiereCambio) return <CambioContrasena />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="usuarios" element={<Con permiso="USUARIOS_GESTIONAR"><Usuarios /></Con>} />
        <Route path="productos" element={<Con permiso="PRODUCTOS_CONSULTAR"><Productos /></Con>} />
        <Route path="productos/nuevo" element={<Con permiso="PRODUCTOS_GESTIONAR"><ProductoForm /></Con>} />
        <Route path="productos/:id" element={<Con permiso="PRODUCTOS_GESTIONAR"><ProductoForm /></Con>} />
        <Route path="productos/:id/codigo" element={<Con permiso="PRODUCTOS_GESTIONAR"><CodigoEtiqueta /></Con>} />
        <Route path="movimientos" element={<Con permiso="MOVIMIENTOS_REGISTRAR"><Movimiento /></Con>} />
        <Route path="kardex" element={<Con permiso="KARDEX_CONSULTAR"><Kardex /></Con>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <ProveedorSesion><BrowserRouter><Rutas /></BrowserRouter></ProveedorSesion>;
}
