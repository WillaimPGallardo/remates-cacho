// P3.3 Código de barras y etiquetas (RF-04)
import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { api, dinero } from '../../comun/api';
import { Campo, Entrada, Selector, Alerta } from '../../comun/ui';

const TIPOS = [{ valor: 'EAN_13', texto: 'EAN-13 (13 dígitos)' }, { valor: 'UPC_A', texto: 'UPC-A (12 dígitos)' }, { valor: 'CODE_128', texto: 'Code 128' }];

export default function CodigoEtiqueta() {
  const { id } = useParams();
  const { state } = useLocation();
  const [p, setP] = useState(null);
  const [d, setD] = useState({ tipo: 'EAN_13', codigo: '' });
  const [copias, setCopias] = useState('1');
  const [msg, setMsg] = useState({ t: 's', m: state?.nuevo ? 'Producto registrado. Puede imprimir sus etiquetas.' : '', campos: {} });
  const [v, setV] = useState(0);
  useEffect(() => { api(`/productos/${id}`).then(setP); }, [id, v]);

  async function guardar(generar) {
    try {
      const r = await api(`/productos/${id}/codigo`, { metodo: 'PUT', datos: { ...d, generar } });
      setMsg({ t: 's', m: `Código ${r.codigo} asignado al producto ${r.sku}`, campos: {} }); setV(v + 1);
    } catch (e) { setMsg({ t: 'e', m: e.campos?.codigo || e.campos?.tipo || e.message, campos: e.campos }); }
  }
  const n = Number(copias);
  const copiasOk = /^\d+$/.test(copias) && n >= 1 && n <= 100;
  if (!p) return null;
  return (
    <>
      <h1>Código y etiquetas</h1><div className="sub">P3.3 · RF-04 · {p.sku} · {p.nombre}</div>
      <Alerta tipo={msg.t}>{msg.m}</Alerta>
      <div className="row arriba no-imprimir">
        <div className="card" style={{ flex: 1 }}>
          <b>Asignación del código</b>
          <Campo etiqueta="Código actual"><Entrada className="in ro mono" readOnly value={`${p.codigo} · ${p.tipo_codigo}`} /></Campo>
          <div className="row">
            <Campo etiqueta="Tipo de código comercial"><Selector opciones={TIPOS} value={d.tipo} onChange={e => setD({ ...d, tipo: e.target.value })} /></Campo>
            <Campo etiqueta="Código comercial" error={msg.campos?.codigo}><Entrada className={'in mono' + (msg.campos?.codigo ? ' err' : '')} value={d.codigo} onChange={e => setD({ ...d, codigo: e.target.value })} /></Campo>
          </div>
          <div className="row"><button className="btn p" onClick={() => guardar(false)}>Guardar código comercial</button><button className="btn" onClick={() => guardar(true)}>Generar código interno</button></div>
          <p className="mut">El código interno usa el formato RC + 8 dígitos consecutivos (Code 128) y no se repite.</p>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <b>Etiqueta (50 × 25 mm)</b>
          <div className="row"><Campo etiqueta="Número de copias" obligatorio error={copiasOk ? '' : 'Entero de 1 a 100'}><Entrada value={copias} onChange={e => setCopias(e.target.value)} error={!copiasOk} /></Campo>
            <button className={'btn ' + (copiasOk ? 'p' : 'dis')} disabled={!copiasOk} onClick={() => window.print()}>Imprimir etiquetas</button></div>
          <Alerta tipo="i">Antes de rotular, escanee una etiqueta impresa con el celular para comprobar su lectura.</Alerta>
          <Link to="/productos" className="lnk">← Volver al catálogo</Link>
        </div>
      </div>
      <div className="etiquetas">
        {Array.from({ length: copiasOk ? n : 1 }, (_, i) => (
          <div className="etiqueta" key={i}>
            <div className="et-nombre">{p.nombre}</div><div className="et-sub">SKU {p.sku} · {dinero(p.precio_venta)}</div>
            <img src={`/api/v1/productos/${id}/codigo.svg?v=${v}`} alt={`Código ${p.codigo}`} />
          </div>))}
      </div>
    </>
  );
}
