# Arquitectura de TallerTech Manager

## 1. Vista general

```text
Navegador (React SPA, responsive)
        │  fetch /api (cookie httpOnly)
        ▼
Express 5 (Node.js)
  ├─ Middleware: helmet, CSP, JSON, auth JWT, auditoría
  ├─ Rutas REST por módulo
  ├─ Servicios: PDFKit, ExcelJS, reportes, respaldos, uploads
  ▼
SQLite (node:sqlite, WAL)
  ├─ data/tallertech.db
  ├─ data/uploads/<orden>/*.jpg
  └─ data/backups/*.db
```

- **Frontend**: aplicación SPA con React Router. En desarrollo se sirve con Vite y proxy `/api`; en producción Express sirve `dist/` y la API desde el mismo origen.
- **Backend**: API REST en Express, validación con Zod, reglas de negocio transaccionales y auditoría.
- **Persistencia**: SQLite en modo WAL, con claves foráneas y transacciones `BEGIN IMMEDIATE` para operaciones críticas.

## 2. Modelo de datos

```mermaid
erDiagram
  users ||--o{ orders : crea
  users ||--o{ payments : registra
  users ||--o{ activity_log : genera
  clients ||--o{ orders : posee
  clients ||--o{ payments : realiza
  equipment_types ||--o{ orders : clasifica
  technicians ||--o{ orders : atiende
  orders ||--o{ order_status_history : registra
  orders ||--o{ order_interventions : contiene
  orders ||--o{ order_parts : usa
  orders ||--o{ order_photos : adjunta
  orders ||--o{ payments : cobra
  orders ||--o{ transactions : impacta
  products ||--o{ order_parts : provee
  products ||--o{ inventory_movements : mueve
  product_categories ||--o{ products : agrupa
  suppliers ||--o{ products : abastece
  suppliers ||--o{ transactions : compra
  payments ||--r| transactions : genera
  settings {
    key TEXT PK
    value TEXT
  }
```

### Tablas
| Tabla | Propósito |
|---|---|
| `users` | Usuarios, hash bcrypt, rol y estado. |
| `clients` | Clientes con `phone_normalized` único para deduplicar. |
| `equipment_types` | Tipos de equipos configurables. |
| `technicians` | Técnicos asignables. |
| `orders` | Orden de reparación, equipo, falla, estado, costos y fechas. |
| `order_status_history` | Trazabilidad de cada cambio de estado. |
| `order_interventions` | Diagnóstico, reparación, prueba o nota. |
| `order_parts` | Repuestos usados, costos/precios y baja lógica por reversión. |
| `order_photos` | Metadatos de fotos en disco. |
| `payments` | Señas, pagos parciales y finales; baja lógica. |
| `products` | Inventario, stock, mínimos, precios, proveedor y ubicación. |
| `inventory_movements` | Entradas, salidas y ajustes con stock resultante. |
| `product_categories` | Categorías del inventario. |
| `suppliers` | Proveedores. |
| `transactions` | Libro de ingresos y egresos (caja). |
| `activity_log` | Auditoría de acciones. |
| `login_attempts` | Control de fuerza bruta. |
| `settings` | Configuración del taller y metadatos internos. |

### Decisiones clave
- **Pagos ↔ finanzas**: cada pago inserta una fila en `transactions` con `payment_id`. Anular el pago da de baja lógica ambas filas.
- **Saldo**: derivado (`precio final o presupuesto` − pagos activos). No se almacena duplicado.
- **Stock**: derivado de `products.stock`, actualizado junto con un movimiento dentro de la misma transacción.
- **Datos sensibles**: `orders.unlock_secret_enc` contiene cifrado AES-256-GCM; la clave se genera en `data/.secrets.json` o por variable de entorno.
- **Baja lógica**: pagos, movimientos de caja y partes removidas conservan el registro para auditoría.

## 3. Estados de reparación

```text
RECIBIDO
  → PENDIENTE_DIAGNOSTICO
  → EN_DIAGNOSTICO
  → PRESUPUESTADO
  → ESPERANDO_APROBACION
  → ESPERANDO_REPUESTOS
  → EN_REPARACION
  → EN_PRUEBAS
  → REPARADO
  → LISTO_PARA_RETIRAR
  → ENTREGADO
  ↳ SIN_REPARACION / CANCELADO (finales alternativos)
```

La API acepta cualquier transición explícita (el taller puede corregir estados), pero cada cambio registra estado anterior, nuevo estado, usuario, fecha y nota. `ENTREGADO` setea `delivered_at`; si hay saldo pendiente, la API devuelve una advertencia.

## 4. Flujos transaccionales

### Ingreso de equipo
1. Validar datos y tipo de equipo.
2. Buscar/crear cliente, rechazando teléfono duplicado.
3. Generar número de orden por año.
4. Insertar orden + historial inicial + diagnóstico inicial (si existe).
5. Si hay seña, insertar pago y transacción de ingreso.
6. Guardar fotos en disco y registrar metadatos.
7. Auditar y devolver la orden completa.

### Agregar repuesto
1. Verificar producto activo y stock.
2. Bloquear si el stock quedaría negativo sin autorización admin.
3. Insertar `order_parts`.
4. Descontar stock y crear `inventory_movements` tipo `SALIDA`.
5. Auditar; devolver stock y advertencia si corresponde.

### Registrar pago
1. Calcular saldo actual.
2. Rechazar sobrepago cuando el importe facturado ya está definido.
3. Insertar pago y transacción de ingreso.
4. Auditar; devolver orden con nuevo saldo.

### Respaldos
- **Automático**: `PRAGMA wal_checkpoint(FULL)` + `VACUUM INTO` a `data/backups/`, retención de 12.
- **JSON completo**: exporta tablas y fotos en base64, descargable por admin.
- **Restauración**: valida formato y admin, deshabilita FKs, borra e inserta en orden de dependencias, reactiva FKs y restaura fotos.

## 5. Seguridad y permisos

| Acción | Técnico | Administrador |
|---|---|---|
| Ver dashboard/órdenes/clientes/inventario/finanzas | Sí | Sí |
| Crear y editar órdenes, repuestos, pagos | Sí | Sí |
| Eliminar/quitar repuestos | No | Sí |
| Anular pagos y movimientos | No | Sí |
| Dar de baja productos/proveedores | No | Sí |
| Configuración, usuarios, tipos, respaldos | No | Sí |
| Ver dato de desbloqueo | Sí (auditado) | Sí (auditado) |

- JWT firmado con `issuer`, `exp` y cookie httpOnly/SameSite Strict.
- bcrypt con 12 rondas.
- Bloqueo temporal tras 8 fallos en 15 minutos.
- Helmet con CSP, `X-Frame-Options`, `nosniff`.
- Validación Zod en todos los endpoints de escritura.
- Consultas parametrizadas en todas las rutas.

## 6. Frontend

- `AuthProvider` mantiene la sesión consultando `/api/auth/me` y escucha eventos 401.
- `UIProvider` gestiona toasts y confirmaciones asíncronas.
- `useApiQuery` encapsula carga, errores, cancelación y refetch.
- `Layout` implementa:
  - sidebar fijo en escritorio,
  - drawer en tablet/móvil,
  - barra inferior con accesos rápidos,
  - búsqueda global que navega a órdenes.
- Tailwind centraliza el tema oscuro en `src/index.css` y `tailwind.config.js`.
- Gráficos Recharts con tooltips monetarios.
- Reportes dinámicos: el backend devuelve columnas y filas; el frontend renderiza la vista previa y solicita el archivo PDF/XLSX.

## 7. Despliegue

- **Local**: `npm run build && npm start`.
- **Desarrollo**: `npm run dev`.
- **Producción recomendada**: Node bajo systemd/PM2 + Nginx/Caddy con HTTPS, datos en volumen persistente y copias externas.
- SQLite admite un único proceso escritor. Para múltiples sucursales o alta concurrencia, migrar a PostgreSQL y almacenamiento de objetos para fotos.
