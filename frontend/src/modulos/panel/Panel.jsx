// P1.3 Panel de inicio (versión inicial: indicadores de catálogo e inventario)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import Icono from '../../comun/iconos';

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
            <Link className="kpi kpi-ico azul" to="/productos"><i><Icono n="catalogo" tam={22} /></i><div><span>Productos registrados</span><b>{d.total}</b></div></Link>
            <div className={'kpi kpi-ico ' + (d.bajos.total ? 'rojo' : 'verde')}><i><Icono n={d.bajos.total ? 'alerta' : 'guardar'} tam={22} /></i><div><span>Productos con bajo stock</span><b>{d.bajos.total}</b><small>stock actual ≤ stock mínimo</small></div></div>
          </div>
          <div className="card"><b className="titulo-ico"><Icono n="alerta" />Productos con bajo stock</b>
            {d.bajos.total === 0 ? <p className="mut">No hay productos bajo el mínimo.</p> : (
              <table style={{ marginTop: 8 }}><thead><tr><th>SKU</th><th>Producto</th><th className="right">Stock</th><th className="right">Mínimo</th></tr></thead>
                <tbody>{d.bajos.productos.map(p => <tr key={p.id_producto}><td>{p.sku}</td><td>{p.nombre}</td><td className="right"><span className="stock-bajo">{p.stock_actual}</span></td><td className="right">{p.stock_minimo}</td></tr>)}</tbody></table>)}
          </div>
        </>
      )}
      <h2 className="sec">Accesos rápidos</h2>
      <div className="accesos">
        {puede('PRODUCTOS_GESTIONAR') && <Link className="acceso" to="/productos/nuevo"><i><Icono n="mas" tam={22} /></i><b>Nuevo producto</b><span>Registrar en el catálogo</span></Link>}
        {puede('MOVIMIENTOS_REGISTRAR') && <Link className="acceso" to="/movimientos"><i><Icono n="movimientos" tam={22} /></i><b>Registrar movimiento</b><span>Entradas y salidas</span></Link>}
        {puede('KARDEX_CONSULTAR') && <Link className="acceso" to="/kardex"><i><Icono n="kardex" tam={22} /></i><b>Consultar kardex</b><span>Historial por producto</span></Link>}
        {puede('USUARIOS_GESTIONAR') && <Link className="acceso" to="/usuarios"><i><Icono n="usuarios" tam={22} /></i><b>Usuarios</b><span>Cuentas y roles</span></Link>}
      </div>
    </>
  );
}
