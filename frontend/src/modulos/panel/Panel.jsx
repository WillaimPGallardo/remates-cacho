// P1.3 Panel de inicio (versión inicial: indicadores de catálogo e inventario)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';

export default function Panel() {
  const { usuario, puede } = useSesion();
  const [d, setD] = useState(null);
  const [hora, setHora] = useState(new Date());
  useEffect(() => {
    if (!puede('PRODUCTOS_CONSULTAR')) return;
    const cargar = () => Promise.all([api('/productos?limite=20'), api('/productos?bajo_stock=true&limite=20')])
      .then(([todos, bajos]) => { setD({ total: todos.total, bajos }); setHora(new Date()); }).catch(() => {});
    cargar();
    const t = setInterval(cargar, 60000);   // se recalcula cada 60 s
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <h1>Panel de inicio</h1>
      <div className="sub">Bienvenido, {usuario.nombre} · datos en tiempo real · actualizado {hora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>
      {d && (
        <>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="kpi"><span>Productos registrados</span><b>{d.total}</b></div>
            <div className="kpi"><span>Productos con bajo stock</span><b>{d.bajos.total}</b><small>stock actual ≤ stock mínimo</small></div>
          </div>
          <div className="card"><b>Productos con bajo stock</b>
            {d.bajos.total === 0 ? <p className="mut">No hay productos bajo el mínimo.</p> : (
              <table style={{ marginTop: 8 }}><thead><tr><th>SKU</th><th>Producto</th><th className="right">Stock</th><th className="right">Mínimo</th></tr></thead>
                <tbody>{d.bajos.productos.map(p => <tr key={p.id_producto}><td>{p.sku}</td><td>{p.nombre}</td><td className="right">{p.stock_actual}</td><td className="right">{p.stock_minimo}</td></tr>)}</tbody></table>)}
          </div>
        </>
      )}
      <div className="row">
        {puede('PRODUCTOS_GESTIONAR') && <Link className="btn" to="/productos/nuevo">Nuevo producto</Link>}
        {puede('MOVIMIENTOS_REGISTRAR') && <Link className="btn" to="/movimientos">Registrar movimiento</Link>}
        {puede('KARDEX_CONSULTAR') && <Link className="btn" to="/kardex">Consultar kardex</Link>}
      </div>
    </>
  );
}
