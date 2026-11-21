# Manual rápido de uso

## 1. Ingresar
1. Abrir `http://localhost:4000`.
2. Ingresar con el usuario administrador.
3. Cambiar la contraseña desde el menú del avatar (arriba a la derecha).

## 2. Instalar la app en el celular

La aplicación se puede instalar como app (PWA), sin pasar por Play Store ni App Store:

- **Android:** abrir el sitio en Chrome → menú de tres puntos → **Instalar aplicación**. También aparece el aviso “Instalá TallerTech” dentro de la app.
- **iPhone/iPad:** abrir el sitio en Safari → **Compartir** → **Agregar a pantalla de inicio**.
- La app instalada abre en pantalla completa, con su ícono, y accede a la cámara del teléfono.
- Requiere que el sistema esté publicado con **HTTPS**.

## 3. Recepción rápida desde el celular (3 pasos)

1. Tocar el botón central de la barra inferior (ícono de cámara) o **Recepción rápida**.
2. **Cliente:** buscar uno existente por nombre o teléfono, o cargar nombre, apellido y teléfono.
3. **Equipo:** tipo, marca, modelo, falla y fotos opcionales. El botón **Tomar foto** abre la cámara directamente.
4. **Cierre:** presupuesto, seña, método de pago y fecha estimada.
5. Confirmar. Se genera la orden y se muestra el detalle para completar diagnóstico, técnico y demás datos.

El borrador se guarda en el dispositivo: si se corta la conexión antes de confirmar, al volver a ingresar se recuperan los datos cargados (las fotos no se conservan en el borrador).

## 4. Registrar un equipo con el formulario completo
1. Ir a **Nuevo ingreso**.
2. Buscar un cliente por nombre, teléfono o DNI. Si no existe, completar los campos de cliente nuevo.
3. Seleccionar el tipo de equipo y cargar marca, modelo, serie e IMEI si corresponde.
4. Registrar la falla declarada y el estado físico.
5. Si el cliente entrega contraseña/patrón, seleccionar el tipo y cargarlo. Se guarda cifrado.
6. Adjuntar hasta 6 fotos del equipo.
7. Completar presupuesto, seña y fecha estimada.
8. Presionar **Confirmar ingreso**. Se genera el número de orden y se puede descargar el comprobante PDF.

> Si el teléfono ya existe, el sistema ofrece usar el cliente existente para no duplicarlo.

## 5. Seguir una reparación
1. Abrir la orden desde **Órdenes** o el **Tablero**.
2. Usar **Cambiar estado** para mover la orden por las etapas; se puede dejar una nota.
3. Agregar diagnóstico/reparación en **Intervenciones**.
4. Agregar repuestos en **Repuesto**; el stock se descuenta automáticamente.
5. Registrar pagos en **Registrar pago**. El saldo y la caja se actualizan.
6. Editar precio final, costos, técnico y datos del equipo con **Editar**.
7. Entregar la orden desde **Cambiar estado → Entregado**. Si hay saldo, el sistema lo advierte.
8. Descargar el comprobante de recepción con **Comprobante PDF**.

## 6. Inventario
- **Productos**: alta, edición, búsqueda y filtro de stock bajo.
- **Movimiento**: registrar entrada, salida o ajuste. El sistema muestra el stock resultante.
- **Proveedores**: alta y edición. Solo el administrador puede darlos de baja.
- Si un repuesto no alcanza, no se permite stock negativo salvo autorización explícita del administrador.

## 7. Finanzas
- Cambiar el período con los botones **Este mes / 30 días / 90 días / Este año** o fechas personalizadas.
- **Facturación**: reparaciones entregadas; **Cobrado**: dinero real; **Gastos**; **Resultado de caja**; **Ganancia estimada**.
- Registrar gastos o ingresos directos con **Movimiento**.
- Ver deudas en **Cuentas por cobrar**.
- Exportar el período a PDF o Excel desde los botones superiores.

## 8. Clientes
- Buscar por nombre, teléfono, correo o DNI.
- Abrir la ficha para ver equipos, órdenes, deuda y pagos.
- Crear una nueva orden desde la ficha con **Nuevo ingreso**.

## 9. Reportes
1. Elegir el tipo de reporte.
2. Configurar período y filtros.
3. Revisar la vista previa.
4. Descargar **PDF** o **Excel**.

## 10. Configuración
- **General**: datos del taller usados en PDF, moneda y garantía.
- **Usuarios y técnicos**: crear usuarios, roles, activar/desactivar, agregar técnicos.
- **Tipos de equipo**: agregar nuevos dispositivos.
- **Respaldos**: descargar JSON completo, crear snapshot SQLite y restaurar.

> La restauración reemplaza todos los datos. Descargar un respaldo previo y escribir `RESTAURAR`.

## 11. Consejos
- Mantener actualizado el stock mínimo.
- Registrar los pagos desde la orden (no como ingreso directo) para que se actualice el saldo del cliente.
- No eliminar clientes con órdenes: el sistema conserva el historial.
- Descargar respaldos regularmente y guardarlos fuera de la PC del taller.
