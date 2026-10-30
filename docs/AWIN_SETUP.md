# Awin — configuración

Implementación: `src/lib/providers/awin/` (feed, proveedor, deep links), `scripts/sync-awin-feed.ts` (importación), `workers/scheduled.ts` (transacciones), `supabase/migrations` (`catalog_products`, `search_catalog`).

> Importante: descargar un feed **no** equivale a tener un buscador en tiempo real. Gemelu importa el feed a Supabase y busca sobre ese catálogo (texto completo + trigramas). Los resultados son tan frescos como la última importación, y se muestra «comprobado hace…».

## 1. Altas (manual)

1. Cuenta de **publisher** en Awin (España) con el sitio `gemelu.com`.
2. Solicita unirte al programa de **AliExpress** disponible para España en Awin y espera la aprobación. Anota el **advertiser ID** del programa (`AWIN_ALIEXPRESS_ADVERTISER_ID`) — no lo asumas, cópialo del panel.
3. Toolbox → **Create-a-Feed**: selecciona el feed del anunciante, idioma ES, formato CSV (recomendado gzip) e incluye al menos: `aw_product_id, product_name, search_price, currency, aw_deep_link, merchant_deep_link, merchant_image_url, aw_image_url, delivery_cost, delivery_time, in_stock, merchant_category, category_name, ean, colour, description, merchant_id`. Copia la **URL de descarga** → `AWIN_FEED_URL` (contiene tu clave: trátala como secreto). Si usas Enhanced Feeds (JSONL), usa su URL y `AWIN_API_TOKEN`.
4. Account → API credentials → crea el **token OAuth2** → `AWIN_API_TOKEN` (transacciones y, si procede, feeds Enhanced). Límite documentado: 20 llamadas/minuto.

## 2. Configuración

Worker:
```bash
npx wrangler secret put AWIN_API_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
`wrangler.jsonc` → `vars`: `"PRODUCT_PROVIDER": "awin"`, `"AWIN_PUBLISHER_ID": "…"`, `"AWIN_ALIEXPRESS_ADVERTISER_ID": "…"`, `"AWIN_DEEPLINK_ENABLED": "false"` (actívalo solo si el programa permite deep links).

GitHub (Settings → Secrets and variables → Actions): secretos `AWIN_FEED_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ opcionales) y variable `AWIN_SYNC_ENABLED=true`.

## 3. Primera importación

```bash
AWIN_FEED_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… MAX_ROWS=2000 npm run sync:awin
```

- Streaming (no carga el archivo entero en memoria), gzip y CSV con comillas/saltos de línea.
- Filtra: EUR, con imagen, no agotado y de categorías de hogar (`FEED_GROUPS`).
- Upsert por lotes de 500 en `catalog_products` (clave `provider + provider_product_id`).
- Productos ausentes del feed durante 7 días → `out_of_stock`.
- Cada ejecución queda registrada en `provider_sync_runs` (visible en `/admin`).

Después, el workflow `awin-feed-sync.yml` lo repite cada día.

## 4. Enlaces y comisiones

- Enlace preferente: `aw_deep_link` del feed (enlace oficial de seguimiento).
- Si falta y `AWIN_DEEPLINK_ENABLED=true`: deep link documentado `https://www.awin1.com/cread.php?awinmid={advertiser}&awinaffid={publisher}&ued={url}`.
- `/go/` añade `clickref=<id de clic anónimo>` (parámetro oficial de Awin) para conciliar comisiones.
- Cron: `GET https://api.awin.com/publishers/{id}/transactions/?startDate…&endDate…&timezone=UTC` con el token → `commission_reports`. **Verifica los parámetros con la documentación vigente de la Publisher API antes de activarlo** (no se ha podido probar sin credenciales).

## 5. Pendiente de validar con credenciales reales

- Columnas exactas del feed de AliExpress en Awin (el mapeo admite alternativas y JSONL).
- Volumen del feed y tiempos de importación (ajusta `FEED_GROUPS`/`MAX_ROWS`).
- Si el programa permite deep links y `clickref`.
