// Carga datos de prueba en una base recién migrada (gerente con contraseña temporal Cambiar2026).
// Uso: node pruebas/funcionales/datos_prueba.mjs   (con la API en http://localhost:3000)
const B=(process.env.URL_APP||'http://localhost:3000')+'/api/v1'; let cookie='';
async function api(m,p,d,h={}){const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',cookie,...h},body:d?JSON.stringify(d):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];const j=await r.json().catch(()=>null);if(!r.ok)console.log(m,p,r.status,JSON.stringify(j));return j}
await api('POST','/auth/login',{usuario:'gerente',contrasena:'Cambiar2026'});
await api('POST','/auth/cambiar-contrasena',{actual:'Cambiar2026',nueva:'la gerencia de remates',confirmacion:'la gerencia de remates'});
await api('POST','/usuarios',{nombre_completo:'María Fernanda Ruiz',nombre_usuario:'cajero1',correo:'caja@rematescacho.com',rol:'CAJERO',contrasena:'caja del mostrador uno',confirmacion:'caja del mostrador uno'});
await api('POST','/usuarios',{nombre_completo:'José Luis Pérez',nombre_usuario:'bodeguero1',correo:'bodega@rematescacho.com',rol:'BODEGUERO',contrasena:'bodega principal norte',confirmacion:'bodega principal norte'});
const L=await api('GET','/productos/listas'); console.log(L.categorias.map(c=>c.id_categoria+':'+c.nombre).join(', '), '|', L.ubicaciones.length);
const cat=n=>L.categorias.find(c=>c.nombre.startsWith(n))?.id_categoria||L.categorias[0].id_categoria;
const ub=i=>L.ubicaciones[i%L.ubicaciones.length].id_ubicacion;
const prods=[['FER-0012','Martillo de uña 16 oz','Ferr','60','85',5,12,'EAN_13','7701234567897'],['ELE-0105','Bombillo LED 9 W','Ele','8','12.5',10,48,'UPC_A','036000291452'],['FER-0018','Destornillador de estrella','Ferr','9','14',5,4,'',''],['HOG-0230','Juego de ollas 5 piezas','Hog','120','165',2,14,'',''],
['FER-0021','Alicate universal 8 pulgadas','Ferr','18','26',4,9,'',''],['FER-0033','Llave inglesa 10 pulgadas','Ferr','22','31',3,7,'',''],['FER-0040','Cinta métrica 5 m','Ferr','7','11',6,25,'',''],['ELE-0110','Extensión eléctrica 3 m','Ele','10','16',5,18,'',''],['ELE-0122','Linterna recargable','Ele','15','24',4,3,'',''],['HOG-0241','Sartén antiadherente 24 cm','Hog','30','45',3,11,'',''],['HOG-0255','Juego de cubiertos 24 piezas','Hog','40','58',2,6,'',''],['HOG-0260','Termo de acero 1 L','Hog','25','36',4,2,'',''],['FER-0050','Brocha de 2 pulgadas','Ferr','3','5',10,40,'',''],['ELE-0130','Pilas AA (paquete x4)','Ele','4','6.5',12,60,'','']];
for (const [i,[sku,nombre,c,pc,pv,min,ex,tipo,cod]] of prods.entries()){await api('POST','/productos',{sku,nombre,id_categoria:cat(c),id_ubicacion:ub(i),precio_compra:pc,precio_venta:pv,stock_minimo:String(min),existencia_inicial:String(ex),tipo_codigo:tipo||'EAN_13',codigo:cod});}
const f=await api('GET','/productos?q=FER-0012'); const id=f.productos[0].id_producto;
await api('POST','/movimientos',{id_producto:id,tipo:'SALIDA',cantidad:'7',motivo:'Remisión 1203 · Ferretería El Centro'},{'Idempotency-Key':crypto.randomUUID()});
await api('POST','/movimientos',{id_producto:id,tipo:'ENTRADA',cantidad:'10',motivo:'Proveedor Distribuidora Andina · factura 5521'},{'Idempotency-Key':crypto.randomUUID()});
// Producto inactivo para el caso de error de PF-06
await api('POST','/productos',{sku:'VAR-0001',nombre:'Candado de bronce 40 mm',id_categoria:cat('Var'),precio_compra:'12',precio_venta:'18',stock_minimo:'0',existencia_inicial:'0',codigo:''});
const v=await api('GET','/productos?q=VAR-0001'); const pv=v.productos[0];
await api('PUT','/productos/'+pv.id_producto,{...pv,estado:'INACTIVO'});
console.log('Datos de prueba cargados');
