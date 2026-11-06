// P4.1 Registrar movimiento de inventario: entradas (RF-06) y salidas por despacho (RF-07).
// Los ajustes con autorización (RF-08) se incorporan en la siguiente entrega.
import { useEffect, useState } from 'react';
import { api, nuevaClave } from '../../comun/api';
import { Campo, Entrada, Alerta } from '../../comun/ui';

export function BuscadorProducto({ valor, onElegir, error }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    if (!q.trim()) { setAviso(''); return setRes([]); }
    const t = setTimeout(() => api('/productos?limite=20&q=' + encodeURIComponent(q.trim()))
      .then(r => { setRes(r.productos); setAviso(r.mensaje || ''); }).catch(() => { setRes([]); setAviso(''); }), 250);
    return () => clearTimeout(t);
  }, [q]);
  if (valor) return (<div className="elegido"><span><b>{valor.sku}</b> · {valor.nombre}</span><button type="button" className="lnk" onClick={() => onElegir(null)}>Cambiar</button></div>);
  return (
    <div className="buscador">
      <Entrada aria-label="Buscar producto por nombre, SKU o código de barras" placeholder="Nombre, SKU o código de barras" value={q} onChange={e => setQ(e.target.value)} error={error} autoFocus />
      {res.length > 0 && <div className="sugerencias">{res.map(p => (
        <button type="button" key={p.id_producto} onClick={() => { onElegir(p); setQ(''); }}><b>{p.sku}</b> · {p.nombre} <span className="mut">· existencia {p.stock_actual} · {p.ubicacion || 'sin ubicación'}</span></button>))}</div>}
      {aviso && q.trim() && <div className="msg-h">{aviso}</div>}
    </div>
  );
}

export default function Movimiento() {
  const [prod, setProd] = useState(null);
  const [d, setD] = useState({ tipo: 'ENTRADA', cantidad: '', motivo: '' });
  const [err, setErr] = useState({ campos: {}, mensaje: '' });
  const [ok, setOk] = useState('');
  const [verificando, setVerificando] = useState(false);
  // Clave de la operación en curso (PG-15): se conserva en los reintentos y se renueva al registrar con éxito
  const [clave, setClave] = useState(nuevaClave);
  const n = /^\d+$/.test(d.cantidad) ? Number(d.cantidad) : null;
  const resultante = prod && n != null ? (d.tipo === 'ENTRADA' ? prod.stock_actual + n : prod.stock_actual - n) : null;

  function exito(r) {
    setOk(`${d.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada${r.repetido ? ' (ya estaba registrada; no se duplicó)' : ''}. ${r.sku}: stock ${r.stock_anterior} → ${r.stock_nuevo}`);
    setProd({ ...prod, stock_actual: r.stock_nuevo }); setD(x => ({ ...x, cantidad: '', motivo: '' })); setErr({ campos: {}, mensaje: '' });
    setClave(nuevaClave());
  }

  // Si se perdió la respuesta, consulta el resultado real antes de informar (nunca supone que se revirtió)
  async function verificar() {
    setVerificando(true);
    try { exito(await api('/movimientos/clave/' + clave)); }
    catch (ex) {
      setErr({ campos: {}, mensaje: ex.status === 404
        ? 'El movimiento no se registró. Puede intentarlo de nuevo: el reintento no lo duplicará.'
        : 'No fue posible confirmar si el movimiento quedó registrado. Verifique la conexión y pulse «Verificar».' });
    } finally { setVerificando(false); }
  }

  async function registrar(e) {
    e.preventDefault(); setOk('');
    if (!prod) return setErr({ campos: { id_producto: 'Seleccione un producto' }, mensaje: '' });
    try {
      exito(await api('/movimientos', { metodo: 'POST', datos: { ...d, id_producto: prod.id_producto }, encabezados: { 'Idempotency-Key': clave } }));
    } catch (ex) {
      if (ex.status === 0) return verificar();   // sin respuesta del servidor: el resultado es desconocido
      setErr({ campos: ex.campos, mensaje: ex.message });
    }
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
              <button type="button" key={v} className={d.tipo === v ? 'on' : ''} onClick={() => setD(x => ({ ...x, tipo: v }))}>{t}</button>)}</div>
            <div className="msg-h">Las salidas por venta y las entradas iniciales las genera el sistema.</div></div>
          <div className="row">
            <Campo etiqueta="Cantidad" obligatorio error={c.cantidad} ayuda="Entero de 1 a 99 999"><Entrada inputMode="numeric" value={d.cantidad} onChange={e => { const v = e.target.value; setD(x => ({ ...x, cantidad: v })); }} error={c.cantidad} /></Campo>
            <Campo etiqueta="Stock resultante" error={resultante < 0 ? `Existencia insuficiente. Disponible: ${prod.stock_actual}` : ''}>
              <Entrada className={'in ro' + (resultante < 0 ? ' err' : '')} readOnly value={resultante == null ? '' : `${prod.stock_actual} ${d.tipo === 'ENTRADA' ? '+' : '−'} ${n} = ${resultante}`} />
            </Campo>
          </div>
          <Campo etiqueta={d.tipo === 'ENTRADA' ? 'Observación (proveedor o remisión)' : 'Destino o número de remisión'} obligatorio={d.tipo === 'SALIDA'} error={c.motivo}
            ayuda={d.tipo === 'SALIDA' ? 'Las ventas de mostrador no se registran aquí: las descuenta el sistema al vender' : ''}><Entrada value={d.motivo} onChange={e => { const v = e.target.value; setD(x => ({ ...x, motivo: v })); }} /></Campo>
          <Alerta>{err.mensaje !== 'Revise los datos ingresados' ? err.mensaje : ''}</Alerta>
          <Alerta tipo="s">{ok}</Alerta>
          {verificando && <Alerta tipo="s">Verificando…</Alerta>}
          <div className="row derecha">
            {err.mensaje.startsWith('No fue posible confirmar') && <button type="button" className="btn" onClick={verificar}>Verificar</button>}
            <button className="btn p" disabled={verificando}>Registrar {d.tipo === 'ENTRADA' ? 'entrada' : 'salida'}</button>
          </div>
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
