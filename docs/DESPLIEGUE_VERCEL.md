# Despliegue en Vercel

## Respuesta corta

**Sí, la aplicación se puede publicar en Vercel.** Vercel aloja:

- el frontend React,
- la PWA instalable,
- el manifest y el service worker,
- un proxy nativo de `/api/*` hacia la API.

Pero Vercel **no puede ejecutar el backend actual** (Express + SQLite + archivos en disco) porque las funciones no tienen disco persistente ni un proceso Node permanente. La API se despliega en **Render, Railway o un VPS**, y Vercel la expone bajo el mismo dominio mediante un **rewrite externo**. El usuario final solo ve la URL de Vercel.

```text
Celular / PC
   │  https://tu-app.vercel.app
   ▼
Vercel
   ├── React + PWA + assets
   └── /api/:path* → API Node (Render/Railway/VPS)
                        └── SQLite + fotos en disco persistente
```

Esto conserva **todas las funciones actuales**, incluida la recepción rápida, la cámara, los PDF y los Excel. La única concesión es que el backend no vive dentro de Vercel.

El archivo `vercel.json` ya incluye el rewrite. Solo hay que reemplazar la URL de ejemplo por la URL real de la API.

---

## 1. Desplegar primero la API

La API necesita un disco persistente. Opciones:

| Servicio | Ventaja |
|---|---|
| **Railway** | Fácil, volumen persistente y HTTPS automático. |
| **Render** | Similar; el disco persistente requiere plan pago. |
| **VPS** | Control total y costo fijo. |

### Render

1. Subir el proyecto a GitHub.
2. **New → Web Service**.
3. Configurar:
   - Root Directory: `tallertech-manager`
   - Runtime: Node
   - Build Command: `npm ci`
   - Start Command: `node server/index.js`
   - Node: 22 o 24
4. Agregar un **Persistent Disk**:
   - Mount path: `/var/data`
   - Tamaño: 1 GB o más.
5. Variables de entorno:

```env
NODE_ENV=production
PORT=10000
DATA_DIR=/var/data
SEED_DEMO=true
COOKIE_SECURE=true
ADMIN_USER=admin
ADMIN_PASSWORD=UNA_CONTRASEÑA_SEGURA
JWT_SECRET=UN_SECRETO_LARGO_ALEATORIO
ENCRYPTION_KEY=UNA_CLAVE_HEXADECIMAL_DE_64_CARACTERES
```

6. Verificar:

```text
https://tu-api.onrender.com/api/health
```

> No uses `DATA_DIR=./data` en producción con disco efímero: los datos se perderían en cada deploy.

### Railway

1. Crear proyecto desde GitHub.
2. Start Command: `node server/index.js`.
3. Agregar un volumen persistente montado en `/var/data`.
4. Configurar `DATA_DIR=/var/data` y las variables del ejemplo.
5. Verificar `/api/health`.

### Dominio estable para la API

Podés usar la URL del proveedor (`https://tu-api.onrender.com`) o asignarle un subdominio propio:

```text
https://api.tudominio.com
```

Es mejor un subdominio estable: si cambiás de proveedor, solo cambiás el DNS y no la configuración de Vercel.

---

## 2. Configurar Vercel

1. Configurar la URL de la API en `vercel.json`:

```bash
npm run vercel:api -- https://tu-api.onrender.com
```

También se puede editar manualmente el `destination` de `vercel.json`. El script valida que sea HTTPS.

El resultado debe quedar así:

```json
"destination": "https://tu-api.onrender.com/api/:path*"
```

2. Entrar a https://vercel.com → **Add New → Project**.
3. Importar el repositorio de GitHub.
4. Configurar:
   - **Root Directory:** `tallertech-manager`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
   - **Node.js Version:** 22 o 24
5. Deploy.

No hace falta configurar `API_ORIGIN`: el destino está en `vercel.json`.

### Cómo funciona el proxy

`vercel.json` contiene:

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "https://tu-api.onrender.com/api/:path*"
  },
  {
    "source": "/:path*",
    "destination": "/index.html"
  }
]
```

- `/api/*` se reenvía a la API.
- El resto de las rutas vuelve al `index.html` para que React Router funcione.
- El navegador ve un único origen, por lo que no hay CORS y la cookie `httpOnly` de sesión funciona.

### Verificar

```text
https://tu-app.vercel.app/api/health
https://tu-app.vercel.app/manifest.webmanifest
https://tu-app.vercel.app/sw.js
```

Después probar:
1. Login.
2. Crear una orden.
3. Descargar un comprobante PDF.
4. Reportes PDF/Excel.
5. Recepción rápida desde el celular.
6. Instalación de la PWA.

---

## 3. Dominio propio

En Vercel → **Settings → Domains**:

1. Agregar `taller.tudominio.com`.
2. Configurar el DNS indicado.
3. HTTPS se emite automáticamente.
4. Mantener `COOKIE_SECURE=true` en la API.

La PWA y la cámara necesitan HTTPS. Vercel y Render/Railway lo entregan automáticamente.

---

## 4. PWA y celular

La app ya incluye:

- `public/manifest.webmanifest`
- `public/sw.js`
- íconos de instalación
- banner **Instalar TallerTech**
- recepción rápida en 3 pasos
- cámara directa (`capture="environment"`)
- borrador local de recepción
- indicador sin conexión

Vercel publica estos archivos tal cual. Solo hay que verificar que `https://tu-dominio/sw.js` y `https://tu-dominio/manifest.webmanifest` respondan 200.

**Android/Chrome:** menú → Instalar aplicación.  
**iPhone/Safari:** Compartir → Agregar a pantalla de inicio.

---

## 5. Limitaciones y cuidados

| Tema | Detalle |
|---|---|
| Backend fuera de Vercel | Es la concesión principal; no se pierde ninguna función. |
| API con disco persistente | Render/Railway/VPS debe tener volumen para SQLite y fotos. |
| Sin timers en Vercel | Los respaldos automáticos los sigue haciendo la API Node. |
| Respaldos grandes | Descargarlos/restaurarlos directamente contra la API o por el proveedor. |
| Plan Hobby | Vercel Hobby no está pensado para uso comercial; usar Pro para el taller real. |
| Dominio de la API | Si cambia, actualizar el `destination` de `vercel.json`. |

---

## 6. ¿Y si quiero TODO dentro de Vercel, sin Render/Railway?

También es posible, pero es una migración de arquitectura, no solo configuración:

1. Pasar Express a **Vercel Functions** o a un framework compatible.
2. Reemplazar SQLite por **Supabase Postgres** o Vercel Postgres/Neon.
3. Mover fotos a **Vercel Blob** o Supabase Storage.
4. Reescribir las consultas SQLite a PostgreSQL.
5. Volver asíncrona la capa de datos.
6. Eliminar respaldos binarios SQLite y timers internos.
7. Adaptar la restauración de respaldos a límites serverless.
8. Volver a probar todos los flujos.

Esto conserva órdenes, inventario, finanzas, reportes y PWA, pero **el backend ya no puede ser el actual con SQLite local**. Es el siguiente paso si el requisito es no tener ningún servidor externo.

---

## 7. Checklist

- [ ] API desplegada con disco persistente y `/api/health` OK.
- [ ] Variables `JWT_SECRET`, `ENCRYPTION_KEY` y `ADMIN_PASSWORD` configuradas.
- [ ] `DATA_DIR=/var/data` con volumen persistente.
- [ ] `vercel.json` apuntando a la URL real de la API.
- [ ] `/api/health` responde desde el dominio de Vercel.
- [ ] Login, orden, pago, PDF y Excel funcionando desde Vercel.
- [ ] PWA instalada y probada en Android y iPhone.
- [ ] Cámara de recepción rápida funcionando por HTTPS.
- [ ] Copias de seguridad de `data/` programadas desde el proveedor de la API.
