# Despliegue con costo USD 0

Esta es la ruta recomendada para publicar TallerTech Manager sin pagar hosting, manteniendo la aplicación actual:

```text
Vercel Hobby
  └── React + PWA + proxy /api/*

Render Free
  └── API Express + SQLite (sin disco persistente)

Supabase Free
  └── bucket privado con la réplica del SQLite vía Litestream
```

La idea central: **Render Free no tiene disco persistente**, pero Litestream replica el archivo SQLite a un bucket de Supabase Storage. Cuando Render se duerme o reinicia, al volver restaura la base automáticamente.

Las fotografías también se guardan **dentro de la base SQLite** (BLOB), por lo que viajan en la misma réplica. No se necesita un segundo sistema de archivos.

> **Concesión:** no se usa Supabase PostgreSQL. Supabase Storage se usa como almacenamiento durable de la réplica de SQLite. Se conservan todas las funciones de la app, pero no se pueden consultar las tablas desde el panel de Supabase. Es el intercambio para no reescribir toda la app y mantener costo cero.

---

## 1. Crear Supabase y el bucket

1. Crear un proyecto en https://supabase.com (plan Free).
2. Ir a **Storage → New bucket**.
3. Nombre: `tallertech-db`.
4. Marcarlo **privado**.
5. Ir a **Settings → Storage → S3 Access Keys** y generar:
   - `Access Key ID`
   - `Secret Access Key`
6. Guardar el endpoint S3 del proyecto. Formato:

```text
https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
```

La región es la del proyecto (por ejemplo `us-east-1`).

> No uses estas claves en el navegador. Solo van en Render.

### Tamaño
Supabase Free incluye 1 GB de Storage y 500 MB de base. Al guardar las fotos en SQLite, el tamaño de la réplica incluye las fotos. Para un taller chico es suficiente al principio; monitoreá el uso.

---

## 2. Desplegar la API en Render Free

1. Subir el proyecto a GitHub.
2. En Render: **New → Blueprint** (usar `render.yaml`) o **New → Web Service**.
3. Si es manual:
   - Root Directory: `tallertech-manager`
   - Runtime: Node
   - Plan: **Free**
   - **Build Command:**
     ```bash
     npm ci --omit=dev && mkdir -p bin && curl -fSL https://github.com/benbjohnson/litestream/releases/download/v0.5.18/litestream-0.5.18-linux-amd64.tar.gz -o /tmp/litestream.tar.gz && tar -xzf /tmp/litestream.tar.gz -C bin && chmod +x bin/litestream
     ```
   - **Start Command:**
     ```bash
     bash scripts/start-render.sh
     ```
   - Health check path: `/api/health`
4. **No agregues disco persistente.** Render Free no lo incluye y no es necesario con Litestream.
5. Variables de entorno:

```env
NODE_ENV=production
DATA_DIR=/tmp/tallertech
COOKIE_SECURE=true
SEED_DEMO=true
ADMIN_USER=admin
ADMIN_PASSWORD=UNA_CONTRASEÑA_SEGURA
JWT_SECRET=UN_SECRETO_LARGO_ALEATORIO
ENCRYPTION_KEY=UNA_CLAVE_HEXADECIMAL_DE_64_CARACTERES

LITESTREAM_REPLICA_URL=s3://tallertech-db/litestream?endpoint=https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3&region=us-east-1
LITESTREAM_ACCESS_KEY_ID=TU_ACCESS_KEY
LITESTREAM_SECRET_ACCESS_KEY=TU_SECRET_KEY
```

6. Deploy.
7. Abrir:

```text
https://tu-api.onrender.com/api/health
```

### Primer arranque
- Litestream busca una réplica en Supabase.
- Si el bucket está vacío, arranca la app y crea la base con datos demo.
- A partir de ahí replica automáticamente cada cambio.

### Probar que la persistencia funciona
1. Crear una orden o un cliente.
2. En Render hacer **Manual Deploy → Restart Service**.
3. Esperar el arranque.
4. Verificar que la orden sigue existiendo.

También podés esperar a que Render duerma por inactividad (15 minutos) y hacer una petición después.

---

## 3. Publicar el frontend en Vercel

1. Copiar la URL de Render.
2. Configurarla en `vercel.json`:

```bash
npm run vercel:api -- https://tu-api.onrender.com
```

3. En Vercel: **Add New → Project**.
4. Configurar:
   - Root Directory: `tallertech-manager`
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Node 22 o 24
5. Deploy.
6. Verificar:

```text
https://tu-app.vercel.app/api/health
https://tu-app.vercel.app/manifest.webmanifest
https://tu-app.vercel.app/sw.js
```

La app se usa desde el dominio de Vercel, pero la API corre en Render y los datos viven replicados en Supabase.

---

## 4. Evitar el “dormido” de Render

Render Free duerme el servicio tras **15 minutos sin tráfico**. La primera petición puede tardar cerca de un minuto.

Para un taller, conviene crear un monitor HTTP gratuito:

- **UptimeRobot Free** o **cron-job.org**
- URL: `https://tu-api.onrender.com/api/health`
- Frecuencia: cada 5 minutos.

Eso mantiene la API despierta dentro de las 750 horas mensuales del plan Free. Sin monitor, la app funciona igual, pero la primera recepción del día puede tardar.

### Supabase Free y la pausa por inactividad
Supabase Free pausa proyectos con muy poca actividad durante 7 días. Si el proyecto se pausa:

1. Entrar a Supabase y reactivarlo.
2. Reiniciar el servicio de Render.
3. Litestream restaura la base desde el bucket.

Los datos no se borran. Para un negocio con uso semanal no debería ser un problema; si querés evitarlo, usá actividad periódica en el proyecto o un storage sin pausa (por ejemplo Cloudflare R2 Free).

---

## 5. Fotos y respaldos

- Las fotos se guardan como BLOB en SQLite y viajan en la réplica de Litestream.
- **Configuración → Respaldos → Respaldo JSON** sigue disponible e incluye las fotos.
- Los snapshots locales automáticos se desactivan cuando `LITESTREAM_REPLICA_URL` está presente, porque no tendrían sentido en un disco efímero.
- El bucket de Supabase es la copia durable de la base.
- Descargá un respaldo JSON periódicamente y guardalo fuera de Supabase.

---

## 6. Costos reales

| Servicio | Plan | Costo |
|---|---|---|
| Vercel | Hobby | USD 0 |
| Render | Free | USD 0 |
| Supabase | Free | USD 0 |
| UptimeRobot | Free | USD 0 |
| Dominio propio | opcional | ~USD 10-15/año |

Total: **USD 0/mes** usando subdominios gratuitos (`*.vercel.app`, `*.onrender.com`).

### Advertencia sobre Vercel Hobby
El plan Hobby de Vercel está limitado a proyectos personales/no comerciales. Un taller que cobra reparaciones técnicamente debería usar Vercel Pro o mover el frontend a Cloudflare Pages (gratis). Si el objetivo es cero dólares y cumplir términos para un negocio, Cloudflare Pages es la alternativa; la app y el proxy son compatibles.

---

## 7. Checklist

- [ ] Proyecto Supabase creado.
- [ ] Bucket privado `tallertech-db`.
- [ ] S3 Access Keys generadas.
- [ ] API en Render Free con Build/Start correctos.
- [ ] Variables de Litestream cargadas en Render.
- [ ] `/api/health` responde.
- [ ] Se creó una orden y sobrevivió a un reinicio de Render.
- [ ] Vercel apunta a la URL de Render con `npm run vercel:api`.
- [ ] Login, PDF, Excel y cámara probados desde Vercel.
- [ ] PWA instalada en Android/iPhone.
- [ ] Monitor de Render configurado (opcional pero recomendado).
- [ ] Respaldo JSON descargado.
