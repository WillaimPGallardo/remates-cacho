// P4.1 Registrar movimiento de inventario: entradas (RF-06) y salidas por despacho (RF-07).
// Los ajustes con autorización (RF-08) se incorporan en la siguiente entrega.
import { useEffect, useState } from 'react';
import { api } from '../../comun/api';
import { Campo, Entrada, Alerta } from '../../comun/ui';

export function BuscadorProducto({ valor, onElegir, error }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (q.trim().length < 3) return setRes([]);
    const t = setTimeout(() => api('/productos?limite=20&q=' + encodeURIComponent(q)).then(r => setRes(r.productos)).catch(() => setRes([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  if (valor) return (<div className="elegido"><span><b>{valor.sku}</b> · {valor.nombre}</span><button type="button" className="lnk" onClick={() => onElegir(null)}>Cambiar</button></div>);
  return (
    <div className="buscador">
      <Entrada placeholder="Nombre, SKU o código de barras" value={q} onChange={e => setQ(e.target.value)} error={error} autoFocus />
      {res.length > 0 && <div className="sugerencias">{res.map(p => (
        <button type="button" key={p.id_producto} onClick={() => { onElegir(p); setQ(''); }}><b>{p.sku}</b> · {p.nombre} <span className="mut">· existencia {p.stock_actual} · {p.ubicacion || 'sin ubicación'}</span></button>))}</div>}
    </div>
  );
}

export default function Movimiento() {
  const [prod, setProd] = useState(null);
  const [d, setD] = useState({ tipo: 'ENTRADA', cantidad: '', motivo: '' });
  const [err, setErr] = useState({ campos: {}, mensaje: '' });
  const [ok, setOk] = useState('');
  const n = /^\d+$/.test(d.cantidad) ? Number(d.cantidad) : null;
  const resultante = prod && n != null ? (d.tipo === 'ENTRADA' ? prod.stock_actual + n : prod.stock_actual - n) : null;

  async function registrar(e) {
    e.preventDefault(); setOk('');
    if (!prod) return setErr({ campos: { id_producto: 'Seleccione un producto' }, mensaje: '' });
    try {
      const r = await api('/movimientos', { metodo: 'POST', datos: { ...d, id_producto: prod.id_producto } });
      setOk(`${d.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada. ${r.sku}: stock ${r.stock_anterior} → ${r.stock_nuevo}`);
      setProd({ ...prod, stock_actual: r.stock_nuevo }); setD({ ...d, cantidad: '', motivo: '' }); setErr({ campos: {}, mensaje: '' });
    } catch (ex) { setErr({ campos: ex.campos, mensaje: ex.message }); }
  }
  const c = err.campos;
  return (
    <form onSubmit={registrar} noValidate>
      <h1>Registrar movimiento de inventario</h1><div className="sub">P4.1 · RF-06 entradas · RF-07 salidas por despacho</div>
      <div className="row arriba">
        <div className="card" style={{ flex: 1.6 }}>
          <Campo etiqueta="Producto" obligatorio error={c.id_producto}><BuscadorProducto valor={prod} onElegir={setProd} error={c.id_producto} /></Campo>
          <div className="f"><label>Tipo de movimiento *</label>
            <div className="seg">{[['ENTRADA', 'Entrada · Recepción'], ['SALIDA', 'Salida · Despacho']].map(([v, t]) =>
              <button type="button" key={v} className={d.tipo === v ? 'on' : ''} onClick={() => setD({ ...d, tipo: v })}>{t}</button>)}</div>
            <div className="msg-h">Las salidas por venta y las entradas iniciales las genera el sistema.</div></div>
          <div className="row">
            <Campo etiqueta="Cantidad" obligatorio error={c.cantidad} ayuda="Entero de 1 a 99 999"><Entrada inputMode="numeric" value={d.cantidad} onChange={e => setD({ ...d, cantidad: e.target.value })} error={c.cantidad} /></Campo>
            <Campo etiqueta="Stock resultante" error={resultante < 0 ? `Existencia insuficiente. Disponible: ${prod.stock_actual}` : ''}>
              <Entrada className={'in ro' + (resultante < 0 ? ' err' : '')} readOnly value={resultante == null ? '' : `${prod.stock_actual} ${d.tipo === 'ENTRADA' ? '+' : '−'} ${n} = ${resultante}`} />
            </Campo>
          </div>
          <Campo etiqueta={d.tipo === 'ENTRADA' ? 'Observación (proveedor o remisión)' : 'Observación (destino u orden)'} error={c.motivo}><Entrada value={d.motivo} onChange={e => setD({ ...d, motivo: e.target.value })} /></Campo>
          <Alerta>{err.mensaje !== 'Revise los datos ingresados' ? err.mensaje : ''}</Alerta>
          <Alerta tipo="s">{ok}</Alerta>
          <div className="row derecha"><button className="btn p">Registrar {d.tipo === 'ENTRADA' ? 'entrada' : 'salida'}</button></div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <b>Ficha del producto</b>
          {prod ? (<>
            <div className="kv"><span>SKU</span>{prod.sku}</div><div className="kv"><span>Categoría</span>{prod.categoria}</div>
            <div className="kv"><span>Ubicación</span>{prod.ubicacion || '—'}</div><div className="kv"><span>Stock actual</span><b>{prod.stock_actual}</b></div>
            <div className="kv"><span>Stock mínimo</span>{prod.stock_minimo}</div><div className="kv"><span>Código</span><span className="mono">{prod.codigo}</span></div>
          </>) : <p className="mut">Seleccione un producto para ver su ficha.</p>}
        </div>
      </div>
    </form>
  );
}
