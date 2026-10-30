# AliExpress Open Platform (afiliados) — configuración

Implementación: `src/lib/providers/aliexpress/` · Verificado contra la documentación oficial de openservice.aliexpress.com el 30/10/2026 (sección *Affiliate Developers*: «API endpoint URLs» docId 1388, «Signature algorithm» docId 1386, «HTTP request sample» docId 1385, y fichas de cada API).

## 1. Altas (manual)

1. Cuenta en **AliExpress Portals** (programa de afiliados) y crea un **tracking ID** para Gemelu.
2. Cuenta de desarrollador en **openservice.aliexpress.com** → completa el perfil como *Affiliate* (empresa o particular).
3. App Console → **Create App** (categoría de afiliados) → espera la aprobación.
4. Copia **App Key** y **App Secret** desde la vista de la app.

## 2. Secretos

```bash
npx wrangler secret put ALIEXPRESS_APP_KEY
npx wrangler secret put ALIEXPRESS_APP_SECRET
npx wrangler secret put ALIEXPRESS_TRACKING_ID
```

y en `wrangler.jsonc` → `vars`: `"PRODUCT_PROVIDER": "aliexpress"`. Opcionales: `ALIEXPRESS_LANGUAGE` (ES), `ALIEXPRESS_CURRENCY` (EUR), `ALIEXPRESS_SHIP_TO` (ES), `ALIEXPRESS_SHIPPING_LOOKUPS` (6), `ALIEXPRESS_USE_PRICE_FILTER` (false).

## 3. Verificación

```bash
ALIEXPRESS_APP_KEY=… ALIEXPRESS_APP_SECRET=… ALIEXPRESS_TRACKING_ID=… npm run smoke:aliexpress -- "mushroom table lamp"
```

Debe devolver productos y «with promotion_link» > 0. Después: `/api/health?deep=1` en producción.

## 4. Llamadas implementadas

Pasarela de negocio: `https://api-sg.aliexpress.com/sync?method={api}&…` · parámetros de sistema `app_key`, `timestamp` (ms), `sign_method=sha256`, `sign` · firma: parámetros (incluido `method`, sin `sign`) ordenados por nombre, concatenados `clavevalor`, HMAC-SHA256 con el App Secret, hexadecimal en mayúsculas. Los tests reproducen los vectores oficiales de la documentación.

| Método | Uso en Gemelu |
|---|---|
| `aliexpress.affiliate.product.query` | Búsqueda por palabras clave con `ship_to_country=ES`, `target_currency=EUR`, `target_language`, `tracking_id` (devuelve `promotion_link`) |
| `aliexpress.affiliate.product.shipping.get` | Coste de envío y plazo real para los mejores candidatos (requiere `sku_id`, `tax_rate`, `target_sale_price`) |
| `aliexpress.affiliate.link.generate` | Enlaces oficiales para productos sin `promotion_link` (hasta 50 por llamada) |
| `aliexpress.affiliate.productdetail.get` | Detalle (incluye `ean_code` → coincidencia verificada) |
| `aliexpress.affiliate.order.list` | Importación de pedidos/comisiones (cron diario) |

Errores (`error_response`, `resp_code ≠ 200`) → `ProviderError` tipado; reintentos con backoff para límites/temporales; circuit breaker tras 5 fallos.

## 5. Lo que NO se asume

- **Búsqueda por imagen**: no figura en la API de afiliados. Existe `aliexpress.ds.image.searchV2` en la API de *Dropshipping*, que requiere otro tipo de app y autorización de usuario; no está integrada ni activada.
- `max_sale_price`/`min_sale_price` se documentan «en céntimos»; por eso el filtro de precio en la API está desactivado por defecto y se filtra en local.
- Cuotas/QPS: dependen de la app; vigila el panel de la Open Platform. El presupuesto diario (`DAILY_SEARCH_BUDGET`) y la caché limitan el consumo.
- Atribución: el seguimiento lo hace AliExpress con su `promotion_link`; Gemelu no lo modifica.

## 6. Pendiente de validar con credenciales reales

- Formato exacto de respuestas en producción (el código acepta lista simple y envuelta `{product:[…]}`).
- Calidad de resultados en español frente a inglés (`ALIEXPRESS_LANGUAGE`).
- Que `ship_to_days` y `evaluate_rate` lleguen con los valores esperados.
