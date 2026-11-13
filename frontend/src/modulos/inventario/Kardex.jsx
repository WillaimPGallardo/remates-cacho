// P4.2 Historial de movimientos — kardex (RF-10)
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fechaHora } from '../../comun/api';
import { Campo, Entrada, Selector, Alerta } from '../../comun/ui';
import { BuscadorProducto } from './Movimiento';
import Icono from '../../comun/iconos';

const hoy = () => new Date().toISOString().slice(0, 10);
const hace30 = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const SUB = { RECEPCION: 'Recepción', INICIAL: 'Inicial', REVERSION_VENTA: 'Reversión de venta', DESPACHO: 'Despacho', VENTA: 'Venta', AJUSTE_POSITIVO: 'Ajuste +', AJUSTE_NEGATIVO: 'Ajuste −' };

export default function Kardex() {
  const [params] = useSearchParams();
  const [prod, setProd] = useState(null);
  const [f, setF] = useState({ desde: hace30(), hasta: hoy(), tipo: '' });
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { const id = params.get('producto'); if (id) api(`/productos/${id}`).then(setProd); }, []);
  useEffect(() => { if (prod) consultar(); }, [prod]);

  async function consultar() {
    try { setR(await api(`/productos/${prod.id_producto}/kardex?` + new URLSearchParams(f))); setError(''); }
    catch (e) { setR(null); setError(e.campos?.fechas || e.message); }
  }
  return (
    <>
      <h1>Historial de movimientos (kardex)</h1><div className="sub">P4.2 · RF-10 · solo movimientos aplicados</div>
      <div className="card"><div className="row">
        <Campo etiqueta="Producto" obligatorio><BuscadorProducto valor={prod} onElegir={p => { setProd(p); setR(null); }} /></Campo>
        <Campo etiqueta="Desde"><Entrada type="date" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} /></Campo>
        <Campo etiqueta="Hasta"><Entrada type="date" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} /></Campo>
        <Campo etiqueta="Tipo"><Selector vacio="Todos" opciones={['ENTRADA', 'SALIDA', 'AJUSTE'].map(v => ({ valor: v, texto: v[0] + v.slice(1).toLowerCase() }))} value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} /></Campo>
        <button className={'btn ' + (prod ? 'p' : 'dis')} disabled={!prod} onClick={consultar}><Icono n="buscar" />Consultar</button>
        <button className="btn" disabled={!r} onClick={() => window.print()}><Icono n="imprimir" />Imprimir</button>
      </div></div>
      <Alerta>{error}</Alerta>
      {r && (<>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="kpi kpi-ico azul"><i><Icono n="catalogo" tam={22} /></i><div><span>Stock actual</span><b>{r.producto.stock_actual}</b></div></div><div className="kpi kpi-ico gris"><i><Icono n="alerta" tam={22} /></i><div><span>Stock mínimo</span><b>{r.producto.stock_minimo}</b></div></div>
          <div className="kpi kpi-ico verde"><i><Icono n="entrada" tam={22} /></i><div><span>Entradas del período</span><b>+{r.entradas}</b></div></div><div className="kpi kpi-ico rojo"><i><Icono n="salida" tam={22} /></i><div><span>Salidas del período</span><b>−{r.salidas}</b></div></div>
        </div>
        <div className="card tabla"><table>
          <thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Subtipo</th><th className="right">Cantidad</th><th className="right">Stock anterior</th><th className="right">Stock nuevo</th><th>Usuario</th><th>Referencia</th></tr></thead>
          <tbody>{r.movimientos.map(m => (
            <tr key={m.id_movimiento}><td>{fechaHora(m.fecha_hora)}</td><td><span className={'bd ' + (m.tipo_movimiento === 'ENTRADA' ? 'b-ok' : m.tipo_movimiento === 'SALIDA' ? 'b-e' : 'b-w')}>{m.tipo_movimiento[0] + m.tipo_movimiento.slice(1).toLowerCase()}</span></td><td>{SUB[m.subtipo]}</td>
              <td className={'right cant ' + (m.stock_nuevo > m.stock_anterior ? 'mas' : 'menos')}>{m.stock_nuevo > m.stock_anterior ? '+' : '−'}{m.cantidad}</td><td className="right">{m.stock_anterior}</td><td className="right">{m.stock_nuevo}</td><td>{m.usuario}</td><td>{m.motivo || `Mov. ${m.id_movimiento}`}</td></tr>))}
            {!r.movimientos.length && <tr><td colSpan="8" className="mut">{r.mensaje}</td></tr>}
          </tbody></table></div>
      </>)}
    </>
  );
}
