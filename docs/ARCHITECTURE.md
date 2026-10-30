# Arquitectura

## Visión general

```
Navegador ──► Cloudflare (CDN + static assets) ──► Worker (src/worker.ts)
                 │ páginas estáticas, SVG demo,       │ 1. captura gemelu.com/https://… (URL cruda)
                 │ fuentes, JS (sin invocar Worker)   │ 2. Astro (SSR) + API
                 ▼                                    │ 3. cabeceras de seguridad
                                                      ▼
            ┌──────────────── SearchService (src/lib/search/service.ts) ────────────────┐
            │ normaliza URL → caché (memoria → KV → Supabase) → dedupe en curso            │
            │ ProductExtractionService → análisis → runMatching → enlaces → payload        │
            └───────┬───────────────────────┬──────────────────────┬──────────────────────┘
                    ▼                       ▼                      ▼
           SafeFetcher (SSRF)     AffiliateProductProvider   DataStore (Memory | Supabase)
           robots.txt, DoH        Demo | AliExpress | Awin   eventos, clics, caché, métricas
```

Todo corre en **un único Worker** (Astro + `@astrojs/cloudflare` v14) con:

- **Static assets** para lo prerenderizado (home, legales, «Cómo funciona», ilustraciones demo, robots, sitemap): servido por la red de Cloudflare sin coste de Worker.
- **SSR** para `/buscar`, `/ejemplo/*`, `/go/*`, `/admin`, `/api/*`.
- **KV** `GEMELU_CACHE` (caché L2), **Rate Limiting** bindings (`SEARCH_LIMITER`, `CLICK_LIMITER`), **Cron Triggers** (importación de comisiones, retención).
- Tareas pesadas (importar feeds completos de Awin) fuera del Worker: `scripts/sync-awin-feed.ts` en GitHub Actions.

## Flujo de una búsqueda

1. **Entrada**: `gemelu.com/https://tienda/p/…` → `src/worker.ts` lee `request.url` sin procesar (`src/lib/url/capture.ts`), acepta `https://`, `https:/`, URL codificada completa y dominio sin esquema, y reescribe internamente a `/buscar?url=…&via=prefix` (sin redirección: la barra de direcciones conserva el enlace). Alternativas: formulario (GET `/buscar?url=`), `?q=` (descripción), share target de la PWA (`?text=`).
2. **SSR** (`src/pages/buscar.astro`): valida la URL; si hay resultado en caché lo renderiza en el servidor (instantáneo, con metadatos OG del producto); si no, monta la isla `ResultsApp`.
3. **Streaming** (`POST /api/search`, SSE): `validating → reading → analyzing → searching → comparing → done`. Cada evento corresponde a trabajo real; la UI solo activa un paso cuando el servidor lo emite.
4. **Extracción** (`src/lib/extraction/`): `SafeFetcher` → detección de muros anti-bot → escáner HTML lineal (regex, sin DOM; IKEA sirve ~1,2 MB) → JSON-LD › microdatos › Open Graph › meta › `<img>` → adaptador de tienda → confianza. Si la tienda bloquea: modo **solo URL** (nombre derivado del enlace, sin precio ni foto), o error claro con opción de describir el producto.
5. **Análisis** (`src/lib/matching/analyze.ts`): taxonomía + léxico ES/EN (categorías, colores, materiales, formas, estilos, características), medidas, packs, marcas/modelos a excluir. Opcional: enriquecimiento con visión (`VISION_PROVIDER=anthropic`) solo si la categoría es dudosa.
6. **Matching** (`src/lib/matching/pipeline.ts`): consultas → proveedor → verificación → similitud + utilidad → niveles → deduplicación → top N. Ver [PRODUCT_MATCHING.md](PRODUCT_MATCHING.md).
7. **Enlaces** (`src/lib/affiliate/`): enlace oficial del proveedor › generado por su API (cacheado) › enlace directo sin afiliación › ninguno (demo). Cada botón apunta a `/go/<token firmado>`.
8. **Persistencia** (`waitUntil`, sin bloquear la respuesta): caché de resultados, trabajo de búsqueda, eventos, productos de catálogo.

## Módulos

| Carpeta | Responsabilidad |
|---|---|
| `src/config/` | Marca, tiendas conocidas, pesos del matching |
| `src/types/` | Tipos de dominio compartidos |
| `src/lib/url/` | Captura del prefijo, normalización/canonicalización, dominios |
| `src/lib/security/` | IPs, política de hosts, DoH, SafeFetcher, robots.txt, saneado, HMAC, rate limit, reintentos/circuit breaker |
| `src/lib/extraction/` | Escáner, JSON-LD, precios, medidas, muros anti-bot, adaptadores, slug, servicio, fixtures |
| `src/lib/matching/` | Texto, léxico, análisis, consultas, filtros, puntuación, ahorro, deduplicación, ranking, pipeline, visión |
| `src/lib/providers/` | Contrato `AffiliateProductProvider` + Demo, AliExpress, Awin, fábrica |
| `src/lib/affiliate/` | Tokens `/go/`, resolución de enlaces |
| `src/lib/data/` | `DataStore` (memoria / Supabase), caché por capas |
| `src/lib/search/` | Orquestador, presentación pública, ejemplos |
| `src/lib/server/` | Configuración (zod), logger con redacción, contenedor de servicios, helpers de petición |
| `src/components/`, `src/layouts/`, `src/pages/` | UI (Astro + islas React), rutas y API |
| `workers/` | Tareas programadas (comisiones, retención) |
| `scripts/` | Feed de Awin, smoke tests, evaluación, assets de marca, validación de entorno |
| `supabase/migrations/` | Esquema SQL con RLS |
| `tests/unit`, `tests/e2e` | Vitest y Playwright |

## Caché y frescura

| Dato | Dónde | Caducidad |
|---|---|---|
| Resultado completo | memoria (15 min) → KV (6 h) → Supabase `search_results` (24 h) | por clave `algoritmo:proveedor:URL canónica` |
| Producto original | memoria (6 h) → KV (24 h) | `source_products.expires_at` |
| Similitud | `product_matches` (30 días, por versión de algoritmo) | cambia `ALGORITHM_VERSION` al tocar pesos |
| Precio / disponibilidad de alternativas | `catalog_products.price_checked_at` / `availability_checked_at` | se muestra «comprobado hace…» |
| Enlace de afiliado | memoria + `affiliate_links` (30 días) | |
| robots.txt | memoria 12 h (1 min si no responde) | |

Búsquedas idénticas simultáneas se calculan una sola vez (`ResultCache.dedupe`).

## Decisiones y desviaciones del stack propuesto

- **Astro 7 / Node 24**: Astro 7.4 exige Node ≥ 22.23.4.
- **Worker `main` propio** (`src/worker.ts`) en lugar de middleware: Astro colapsa `//` y redirige barras finales; la captura debe leer la URL cruda antes del router.
- **Escáner por expresiones regulares** en vez de DOM/htmlparser2: coste de CPU lineal y mínimo en Workers.
- **TypeScript 6.0** (no 7): typescript-eslint y `astro check` aún requieren el compilador en JS.
- **Feeds de Awin en GitHub Actions**: un feed completo puede superar los límites de CPU/subpeticiones de un Worker.
- **Supabase vía REST (supabase-js)** con service role en el servidor; RLS sin políticas para roles públicos.
