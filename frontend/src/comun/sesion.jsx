import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useSesion = () => useContext(Ctx);

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(undefined);   // undefined = cargando, null = sin sesión
  const refrescar = () => api('/auth/yo').then(r => setUsuario(r.usuario)).catch(() => setUsuario(null));
  useEffect(() => {
    refrescar();
    const expirar = () => setUsuario(null);
    window.addEventListener('sesion-expirada', expirar);
    return () => window.removeEventListener('sesion-expirada', expirar);
  }, []);
  const salir = async () => { try { await api('/auth/logout', { metodo: 'POST' }); } finally { setUsuario(null); } };
  const puede = p => !!usuario?.permisos?.includes(p);
  return <Ctx.Provider value={{ usuario, setUsuario, refrescar, salir, puede }}>{children}</Ctx.Provider>;
}
