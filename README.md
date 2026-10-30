# Gemelu — Lo mismo. Por mucho menos.

Herramienta web (España, español, euros) para encontrar **alternativas casi idénticas y más baratas** a un producto de cualquier tienda online. Su gesto principal: añadir el dominio delante del enlace del producto.

```
https://www.ikea.com/es/es/p/lampara-mesa-…/
https://gemelu.com/https://www.ikea.com/es/es/p/lampara-mesa-…/
```

Gemelu lee la ficha del producto (datos estructurados públicos), entiende qué es (tipo, forma, material, color, medidas), busca alternativas en AliExpress con envío a España, las verifica (accesorios, réplicas, agotados, precios engañosos…), las ordena por **parecido** y por **utilidad de compra**, y enlaza a cada una con un enlace oficial de afiliación cuando existe. Sin registro, sin cookies de seguimiento, sin apps.

> Nombre provisional: **Gemelu** (`gemelu.com`, no registrado según RDAP el 30/10/2026). Ver [docs/BRAND.md](docs/BRAND.md).

## Estado

| Área | Estado |
|---|---|
| Captura `dominio/https://…` (raw URL en el Worker, antes del router) | ✅ |
| Extracción: JSON-LD, microdatos, Open Graph, meta, HTML; adaptadores; detección de bloqueos; modo «solo URL» | ✅ |
| Seguridad: SSRF (IPs, DNS-rebinding vía DoH, redirecciones), límites de tiempo/tamaño, robots.txt, rate limiting | ✅ |
| Motor de matching determinista ES/EN, filtros, dos puntuaciones, niveles, ahorro comparable, deduplicación | ✅ |
| Proveedor DEMO (catálogo ficticio etiquetado, ilustraciones propias) | ✅ funcionando |
| Proveedor AliExpress (API oficial firmada, enlaces de afiliado, envío real) | ✅ implementado · ⏳ sin credenciales |
| Proveedor Awin (importación de feed, búsqueda en catálogo, deep links, comisiones) | ✅ implementado · ⏳ sin credenciales |
| Supabase (migración validada en Postgres/PGlite, RLS) | ✅ implementado · ⏳ sin proyecto |
| UI: home, resultados con todos los estados, ejemplos, legales, admin | ✅ |
| Tests: 102 unitarios + 74 E2E (móvil y escritorio) | ✅ en verde |

Detalle de límites y pendientes en [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

## Arrancar en local

Requisitos: **Node ≥ 22.23.4** (recomendado 24 LTS, ver `.nvmrc`).

```bash
npm install
cp .dev.vars.example .dev.vars     # variables locales (modo demo)
npm run dev                         # http://localhost:4321  (workerd vía @cloudflare/vite-plugin)
```

Prueba el truco: `http://localhost:4321/https://www.ikea.com/es/es/p/<un-producto>/`, o un ejemplo: `http://localhost:4321/ejemplo/lampara-seta`.

Build de producción ejecutado en el runtime de Workers:

```bash
npm run build && npm run preview            # wrangler dev sobre dist/
npm run preview:fixtures                    # igual, sin Internet (páginas de tienda simuladas)
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con recarga |
| `npm run build` | Build (estático + Worker) |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run typecheck` | `tsc` + `astro check` |
| `npm run lint` | ESLint (incluye regla que impide importar código de servidor desde componentes) |
| `npm test` | Vitest (unitarios, incluida la migración SQL en PGlite) |
| `npm run test:e2e` | Build + Playwright (iPhone 13 y escritorio) contra workerd con fixtures |
| `npm run smoke:search -- <url> [--fixtures]` | Ejecuta el pipeline completo en Node e imprime resultados |
| `npm run smoke:aliexpress -- "keywords"` | Verifica credenciales de AliExpress con una llamada real |
| `npm run sync:awin` | Importa el feed de Awin a Supabase |
| `npm run eval:matching [labels.json]` | Precisión del matching sobre un conjunto etiquetado |
| `npm run check:env` | Valida variables para producción (sin mostrar secretos) |
| `npm run brand:assets` | Regenera PNG de marca (OG, iconos) |

## Pasar de DEMO a proveedores reales

1. AliExpress: `PRODUCT_PROVIDER=aliexpress` + `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID` → [docs/ALIEXPRESS_SETUP.md](docs/ALIEXPRESS_SETUP.md).
2. Awin: Supabase + feed autorizado + `PRODUCT_PROVIDER=awin` → [docs/AWIN_SETUP.md](docs/AWIN_SETUP.md).
3. Comprueba con `npm run check:env` y `/api/health?deep=1`.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) · [Motor de matching](docs/PRODUCT_MATCHING.md) · [Seguridad](docs/SECURITY.md)
- [Despliegue](docs/DEPLOYMENT.md) · [Checklist de lanzamiento](docs/LAUNCH_CHECKLIST.md)
- [Afiliación](docs/AFFILIATE_SETUP.md) · [AliExpress](docs/ALIEXPRESS_SETUP.md) · [Awin](docs/AWIN_SETUP.md)
- [Marca](docs/BRAND.md) · [Crecimiento](docs/GROWTH.md) · [Kit de contenido](docs/growth/README.md)

## Stack

Astro 7 + TypeScript (strict) · React 19 (islas) · Tailwind CSS 4 · Cloudflare Workers (static assets, KV, Rate Limiting, Cron) · Supabase PostgreSQL (pg_trgm, pgvector preparado) · AliExpress Open Platform · Awin · Vitest · Playwright · ESLint.
