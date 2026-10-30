# Despliegue

Objetivo: coste fijo mínimo. Todo corre en **un Worker de Cloudflare** (estáticos + SSR + API + cron) y, cuando se active, **Supabase**.

## 0. Requisitos

- Cuenta de Cloudflare con el dominio (`gemelu.com`) en Cloudflare DNS.
- **Plan Workers Paid (≈ 5 US$/mes) recomendado**: el plan gratuito limita la CPU a ~10 ms por petición y analizar fichas grandes (IKEA sirve ~1,2 MB de HTML) puede superarlo. Comprueba los límites vigentes en la documentación de Cloudflare.
- Node ≥ 22.23.4 (24 LTS recomendado). `npx wrangler login`.
- (Opcional) proyecto de Supabase en región UE.

## 1. Primer despliegue (modo demo)

```bash
npm ci
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put LINK_SIGNING_SECRET
npx wrangler secret put ADMIN_USER
npx wrangler secret put ADMIN_PASSWORD
npm run deploy               # astro build + wrangler deploy --config dist/server/wrangler.json
```

- El namespace KV `GEMELU_CACHE` se aprovisiona automáticamente en el primer despliegue.
- Los bindings de rate limiting y los cron triggers vienen de `wrangler.jsonc`.
- Comprueba `https://<worker>.workers.dev/api/health`.

> Los secretos se guardan en el Worker con `wrangler secret put` (o en el panel: Workers → gemelu → Settings → Variables and Secrets). Nunca en `wrangler.jsonc` ni en el repositorio.

## 2. Dominio propio

Workers & Pages → `gemelu` → Settings → Domains & Routes → **Add custom domain** → `gemelu.com` (y `www.gemelu.com` con redirección a la raíz mediante una regla de Redirect).

Ajustes de zona recomendados:
- **Rules → Settings → URL Normalization**: deja «Normalize URLs to origin» desactivado. (La captura acepta también `https:/` si alguna capa fusiona las barras.)
- SSL/TLS: Full (strict) · Always Use HTTPS · HSTS cuando todo esté estable.
- Security → WAF: regla de rate limiting para `/api/search` (p. ej. 30 req/min/IP) como segunda barrera.
- Zero Trust → Access → Application para `gemelu.com/admin*` (correo del equipo).
- (Opcional) Web Analytics sin cookies: pon el token en `PUBLIC_CF_WEB_ANALYTICS_TOKEN` **en tiempo de build**.

Actualiza `PUBLIC_SITE_URL` en `wrangler.jsonc` → `vars` y en el entorno de build.

## 3. Supabase

1. Crea el proyecto (región UE, p. ej. Frankfurt).
2. Aplica la migración: `npx supabase link --project-ref <ref>` y `npx supabase db push`, o pega `supabase/migrations/20261030000001_init.sql` en el SQL Editor.
3. Secretos del Worker:
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
4. Comprueba `/admin`: el almacenamiento debe indicar `supabase`.

La migración activa RLS sin políticas: la clave `anon` no puede leer nada. No uses la clave `anon` en el navegador para nada de este proyecto.

## 4. Proveedores reales

- AliExpress: [ALIEXPRESS_SETUP.md](ALIEXPRESS_SETUP.md) → `PRODUCT_PROVIDER=aliexpress`.
- Awin: [AWIN_SETUP.md](AWIN_SETUP.md) → `PRODUCT_PROVIDER=awin` + feed programado en GitHub Actions.
- Cambia `PRODUCT_PROVIDER` en `wrangler.jsonc` (`vars`) y vuelve a desplegar. Valida con `npm run check:env` (con las variables en el entorno) y `/api/health?deep=1`.

## 5. GitHub Actions

- `ci.yml`: typecheck, lint, unitarios, build y E2E en cada PR/push a `main`.
- `awin-feed-sync.yml`: importación diaria del feed. Activa con la variable de repositorio `AWIN_SYNC_ENABLED=true` y los secretos `AWIN_FEED_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (opcionales `AWIN_API_TOKEN`, `AWIN_ALIEXPRESS_ADVERTISER_ID`).
- Despliegue continuo (opcional): añade un job con `cloudflare/wrangler-action` y un token con permiso «Edit Workers», o conecta el repositorio en Workers Builds (build command `npm run build`, deploy command `npx wrangler deploy --config dist/server/wrangler.json`, variable `NODE_VERSION=24`).

## 6. Salud y operación

- `GET /api/health` → estado y configuración (booleanos, nunca valores). `?deep=1` hace una llamada real al proveedor.
- Monitor externo (Cloudflare Health Checks o similar) contra `/api/health`.
- Logs: Workers → Observability (JSON estructurado, con redacción de secretos).
- Rollback: `npx wrangler rollback` (versiones en Workers → Deployments).
- Retención automática: cron diario `47 3 * * *` llama a `purge_expired_data()` (cachés caducadas, eventos > 13 meses).

## 7. Costes orientativos

| Servicio | Plan | Coste |
|---|---|---|
| Cloudflare Workers | Paid | ~5 US$/mes (incluye cuotas amplias de peticiones, KV y CPU) |
| Cloudflare static assets, CDN, DNS, Access (≤ 50 usuarios) | Free | 0 |
| Supabase | Free (500 MB) → Pro 25 US$/mes cuando el catálogo crezca | 0–25 US$ |
| AliExpress / Awin | Programas de afiliación | 0 (ingresos por comisión) |
| Visión con IA (opcional) | Por uso, limitado por `VISION_DAILY_LIMIT` | según modelo |
| GitHub Actions | Free tier | 0 |

Verifica precios y límites vigentes antes de lanzar.
