// P3.2 Formulario de producto: registro y actualización (RF-03). El stock es de solo lectura.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../comun/api';
import { Campo, Entrada, Selector, Alerta, Modal } from '../../comun/ui';

const TIPOS = [{ valor: 'EAN_13', texto: 'EAN-13' }, { valor: 'UPC_A', texto: 'UPC-A' }, { valor: 'CODE_128', texto: 'Code 128' }];

export default function ProductoForm() {
  const { id } = useParams();
  const editar = !!id;
  const nav = useNavigate();
  const [listas, setListas] = useState({ categorias: [], ubicaciones: [] });
  const [d, setD] = useState({ sku: '', nombre: '', referencia: '', id_categoria: '', id_ubicacion: '', precio_compra: '', precio_venta: '', stock_minimo: '0', existencia_inicial: '', tipo_codigo: 'EAN_13', codigo: '', estado: 'ACTIVO' });
  const [err, setErr] = useState({ campos: {}, mensaje: '' });
  const [confirmarPrecio, setConfirmarPrecio] = useState(false);

  useEffect(() => {
    api('/productos/listas').then(setListas);
    if (editar) api(`/productos/${id}`).then(p => setD({ ...p, id_ubicacion: p.id_ubicacion ?? '' })).catch(e => setErr({ campos: {}, mensaje: e.message }));
  }, [id]);
  const set = k => e => setD({ ...d, [k]: e.target.value });

  async function guardar(e, confirmado = false) {
    e?.preventDefault();
    try {
      const datos = { ...d, confirmar_precio_bajo: confirmado };
      const r = editar ? await api(`/productos/${id}`, { metodo: 'PUT', datos }) : await api('/productos', { metodo: 'POST', datos });
      if (editar) nav('/productos', { state: { aviso: `Producto ${r.sku} actualizado` } });
      else nav(`/productos/${r.id_producto}/codigo`, { state: { nuevo: true } });   // registrado: pasa a imprimir etiquetas
    } catch (ex) {
      if (ex.campos?._requiereConfirmacion) return setConfirmarPrecio(true);
      setErr({ campos: ex.campos, mensaje: ex.message });
    }
  }
  const c = err.campos;
  return (
    <form onSubmit={guardar} noValidate>
      <h1>{editar ? 'Editar producto' : 'Nuevo producto'}</h1><div className="sub">P3.2 · RF-03</div>
      <div className="row arriba">
        <div className="card" style={{ flex: 2 }}>
          <b>Datos del producto</b>
          <div className="row">
            <Campo etiqueta="SKU" obligatorio error={c.sku} ayuda="3 a 20: mayúsculas, números o guion"><Entrada value={d.sku} onChange={e => setD({ ...d, sku: e.target.value.toUpperCase() })} error={c.sku} /></Campo>
            <Campo etiqueta="Nombre" obligatorio error={c.nombre}><Entrada value={d.nombre} onChange={set('nombre')} error={c.nombre} /></Campo>
            <Campo etiqueta="Referencia" error={c.referencia}><Entrada value={d.referencia || ''} onChange={set('referencia')} /></Campo>
          </div>
          <div className="row">
            <Campo etiqueta="Categoría" obligatorio error={c.id_categoria}><Selector vacio="Seleccione…" opciones={listas.categorias.map(x => ({ valor: x.id_categoria, texto: x.nombre }))} value={d.id_categoria} onChange={set('id_categoria')} error={c.id_categoria} /></Campo>
            <Campo etiqueta="Ubicación"><Selector vacio="Sin ubicación" opciones={listas.ubicaciones.map(x => ({ valor: x.id_ubicacion, texto: x.nombre }))} value={d.id_ubicacion} onChange={set('id_ubicacion')} /></Campo>
            {editar && <Campo etiqueta="Estado" obligatorio><Selector opciones={[{ valor: 'ACTIVO', texto: 'Activo' }, { valor: 'INACTIVO', texto: 'Inactivo' }]} value={d.estado} onChange={set('estado')} /></Campo>}
          </div>
          <div className="row">
            <Campo etiqueta="Precio de compra (Bs.)" obligatorio error={c.precio_compra} ayuda="Mayor que cero, hasta 2 decimales"><Entrada inputMode="decimal" value={d.precio_compra} onChange={set('precio_compra')} error={c.precio_compra} /></Campo>
            <Campo etiqueta="Precio de venta (Bs.)" obligatorio error={c.precio_venta} ayuda="Cada cambio queda en auditoría"><Entrada inputMode="decimal" value={d.precio_venta} onChange={set('precio_venta')} error={c.precio_venta} /></Campo>
            <Campo etiqueta="Stock mínimo" obligatorio error={c.stock_minimo} ayuda="Entero de 0 a 99 999"><Entrada inputMode="numeric" value={d.stock_minimo} onChange={set('stock_minimo')} error={c.stock_minimo} /></Campo>
          </div>
        </div>
        <div className="card" style={{ flex: 1.2 }}>
          <b>Inventario</b>
          <Campo etiqueta="Stock actual" ayuda="Solo lectura: cambia únicamente con movimientos de inventario"><Entrada className="in ro" readOnly value={editar ? d.stock_actual : 0} /></Campo>
          {!editar && <Campo etiqueta="Existencia inicial (opcional)" error={c.existencia_inicial} ayuda="Se registra como ENTRADA · INICIAL en el kardex"><Entrada inputMode="numeric" value={d.existencia_inicial} onChange={set('existencia_inicial')} error={c.existencia_inicial} /></Campo>}
          <b style={{ display: 'block', marginTop: 12 }}>Código de barras</b>
          {editar ? <Campo etiqueta="Código asignado" ayuda="Se cambia en «Código y etiquetas»"><Entrada className="in ro mono" readOnly value={`${d.codigo || ''} (${d.tipo_codigo || ''})`} /></Campo> : (<>
            <Campo etiqueta="Tipo de código comercial"><Selector opciones={TIPOS} value={d.tipo_codigo} onChange={set('tipo_codigo')} error={c.tipo_codigo} /></Campo>
            <Campo etiqueta="Código comercial (opcional)" error={c.codigo} ayuda="Si se deja vacío se genera un código interno RC + 8 dígitos"><Entrada className={'in mono' + (c.codigo ? ' err' : '')} value={d.codigo} onChange={set('codigo')} /></Campo>
          </>)}
        </div>
      </div>
      <Alerta>{err.mensaje && !['Revise los datos ingresados', 'Código duplicado'].includes(err.mensaje) ? err.mensaje : ''}</Alerta>
      <div className="row derecha"><button type="button" className="btn" onClick={() => nav('/productos')}>Cancelar</button><button className="btn p">Guardar</button></div>
      {confirmarPrecio && (
        <Modal titulo="Precio de venta menor que el de compra" onCerrar={() => setConfirmarPrecio(false)}>
          <p className="mut">El precio de venta ({d.precio_venta}) es menor que el de compra ({d.precio_compra}). ¿Desea guardar de todas formas?</p>
          <div className="row derecha"><button type="button" className="btn" onClick={() => setConfirmarPrecio(false)}>Corregir</button><button type="button" className="btn p" onClick={() => { setConfirmarPrecio(false); guardar(null, true); }}>Guardar de todas formas</button></div>
        </Modal>)}
    </form>
  );
}
