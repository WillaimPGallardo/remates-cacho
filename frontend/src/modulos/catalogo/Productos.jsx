// P3.1 Listado y consulta de productos (RF-03, RF-05)
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, dinero } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Campo, Entrada, Selector, Alerta, Insignia } from '../../comun/ui';

export default function Productos() {
  const { puede } = useSesion();
  const { state } = useLocation();
  const gestiona = puede('PRODUCTOS_GESTIONAR');
  const [listas, setListas] = useState({ categorias: [] });
  const [f, setF] = useState({ q: '', id_categoria: '', estado: gestiona ? '' : 'ACTIVO', bajo_stock: '' });
  const [r, setR] = useState({ productos: [], total: 0 });
  const [error, setError] = useState('');

  useEffect(() => { api('/productos/listas').then(setListas).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (f.q && f.q.trim().length < 3 && !/^\d+$/.test(f.q.trim())) return setError('Escriba al menos 3 caracteres');
      api('/productos?' + new URLSearchParams(f)).then(x => { setR(x); setError(''); }).catch(e => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  return (
    <>
      <h1>Catálogo de productos</h1><div className="sub">P3.1 · RF-03 / RF-05 · {r.total} productos</div>
      <div className="card"><div className="row">
        <Campo etiqueta="Buscar"><Entrada placeholder="Nombre (mín. 3 caracteres), SKU o código de barras" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} autoFocus /></Campo>
        <Campo etiqueta="Categoría"><Selector vacio="Todas" opciones={listas.categorias.map(c => ({ valor: c.id_categoria, texto: c.nombre }))} value={f.id_categoria} onChange={e => setF({ ...f, id_categoria: e.target.value })} /></Campo>
        {gestiona && <Campo etiqueta="Estado"><Selector vacio="Todos" opciones={[{ valor: 'ACTIVO', texto: 'Activos' }, { valor: 'INACTIVO', texto: 'Inactivos' }]} value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} /></Campo>}
        <label className="check"><input type="checkbox" checked={f.bajo_stock === 'true'} onChange={e => setF({ ...f, bajo_stock: e.target.checked ? 'true' : '' })} /> Solo bajo stock</label>
        {gestiona && <Link className="btn p" to="/productos/nuevo">+ Nuevo producto</Link>}
      </div></div>
      <Alerta tipo="s">{state?.aviso}</Alerta>
      <Alerta>{error}</Alerta>
      <div className="card tabla"><table>
        <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Código</th><th className="right">Precio venta</th>{gestiona && <th className="right">Precio compra</th>}<th className="right">Stock</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{r.productos.map(p => (
          <tr key={p.id_producto}>
            <td>{p.sku}</td><td>{p.nombre}</td><td>{p.categoria}</td><td className="mono">{p.codigo}</td><td className="right">{dinero(p.precio_venta)}</td>
            {gestiona && <td className="right">{dinero(p.precio_compra)}</td>}
            <td className={'right' + (p.bajo_stock ? ' bajo' : '')}>{p.stock_actual}{p.bajo_stock ? ' ⚠' : ''}</td><td>{p.ubicacion || '—'}</td>
            <td>{p.estado === 'ACTIVO' ? <Insignia tipo="ok">Activo</Insignia> : <Insignia tipo="no">Inactivo</Insignia>}</td>
            <td className="acciones">
              {gestiona && <Link className="lnk" to={`/productos/${p.id_producto}`}>Editar</Link>}
              {gestiona && <Link className="lnk" to={`/productos/${p.id_producto}/codigo`}>Código y etiquetas</Link>}
              {puede('KARDEX_CONSULTAR') && <Link className="lnk" to={`/kardex?producto=${p.id_producto}`}>Kardex</Link>}
            </td>
          </tr>))}
          {!r.productos.length && <tr><td colSpan="10" className="mut">{r.mensaje || 'No se encontraron productos'}</td></tr>}
        </tbody></table></div>
    </>
  );
}
