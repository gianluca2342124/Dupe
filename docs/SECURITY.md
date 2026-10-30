# Seguridad

## Modelo de amenazas principal

Gemelu descarga páginas de terceros a petición de cualquiera: el riesgo número uno es convertirse en un **proxy abierto** o en una herramienta de **SSRF**. Después: redirección abierta en `/go/`, XSS con datos de terceros, abuso/costes y fuga de secretos.

## Controles implementados

### SSRF y descargas (`src/lib/security/`)
- Solo `http`/`https`, puertos por defecto, sin credenciales en la URL (`validateOutboundUrl`).
- Política de hosts: rechaza **cualquier IP literal** (incluidas notaciones `0x7f.1`, `2130706433`, `[::ffff:…]`), `localhost`, `*.local`, `*.internal`, `metadata.google.internal`, etiquetas únicas, el propio dominio; modo allowlist opcional (`SOURCE_HOST_POLICY=allowlist`).
- **DNS-rebinding**: antes de cada salto se resuelve el host por DNS-over-HTTPS (1.1.1.1) y se exige que **todas** las IP sean públicas (RFC 6890, incluidos IPv4-mapped, NAT64, 6to4, Teredo, ULA, link-local).
- Redirecciones manuales (máx. 5), cada salto revalidado.
- Tiempo total máximo (9 s), tamaño máximo (4,5 MB, truncado controlado), solo `text/html`/`xhtml`, sin cookies, user agent honesto (`GemeluBot`).
- En Cloudflare Workers el `fetch` saliente no alcanza redes privadas; los controles anteriores son defensa en profundidad y la protección principal en Node.
- El HTML descargado **nunca** se devuelve al navegador: solo campos saneados.
- robots.txt respetado por defecto (`ROBOTS_POLICY=respect`); no se sortean CAPTCHAs ni muros anti-bot (solo se detectan).

### `/go/` sin redirección abierta (`src/lib/affiliate/go-token.ts`)
- El destino viaja en un token **firmado con HMAC-SHA256** (`LINK_SIGNING_SECRET`), comparación de doble HMAC (tiempo constante), caducidad 90 días.
- Aunque la firma sea válida, el destino debe pertenecer a la lista de hosts de AliExpress/Awin (ampliable con `GO_ALLOWED_HOSTS`).
- Tokens manipulados o ajenos → 404 sin cabecera `Location`.

### XSS y datos de terceros
- Todo texto externo pasa por `cleanText` (sin etiquetas, entidades decodificadas, sin caracteres de control/bidi, longitud acotada) y las URL por `cleanUrl` (solo http/https, sin credenciales).
- Astro y React escapan al renderizar; no se usa `innerHTML` con datos externos. JSON-LD propio se serializa escapando `<`.
- CSP: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, imágenes https; cabeceras `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `COOP`. Estáticas vía `public/_headers`, dinámicas vía `src/worker.ts`.

### Abuso y costes
- Rate limiting en el borde (binding de Cloudflare): 12 búsquedas nuevas/min/IP, 60 clics/eventos/min/IP. Los resultados en caché no consumen cupo.
- Presupuesto diario de búsquedas no cacheadas (`DAILY_SEARCH_BUDGET`) y de llamadas de visión (`VISION_DAILY_LIMIT`).
- Circuit breaker y reintentos con backoff + jitter por proveedor; consultas con tiempo límite.
- Recomendado además: regla WAF de rate limiting de Cloudflare para `/api/search` y Turnstile si aparece abuso.

### Secretos y privacidad
- Secretos solo en `wrangler secret`; `.env*`/`.dev.vars` en `.gitignore`.
- Los módulos de servidor no pueden importarse desde componentes (regla ESLint `no-restricted-imports`) y un test E2E comprueba que ninguna respuesta contiene los secretos de prueba.
- Logs JSON con redacción de claves sensibles y de parámetros firmados (`sign=`, `app_key=`, `/apikey/`).
- No se guardan IP, user agent, cookies ni identificadores; la IP solo se usa en memoria como clave de rate limit.

### Base de datos
- Supabase con **RLS activado en todas las tablas sin políticas** para `anon`/`authenticated`; funciones RPC revocadas a roles públicos y concedidas solo a `service_role`. Consultas parametrizadas vía PostgREST/RPC.

### Administración
- `/admin` devuelve 404 si no hay `ADMIN_USER`/`ADMIN_PASSWORD`; Basic Auth con comparación en tiempo constante, `no-store`, `noindex`. **Recomendado**: Cloudflare Access (Zero Trust, gratis hasta 50 usuarios) delante de `/admin*`.

## Pruebas de seguridad automatizadas

`tests/unit/security.test.ts`, `tests/unit/url.test.ts`, `tests/unit/affiliate-cache.test.ts`, `tests/e2e/security.spec.ts`: rangos IP, notaciones exóticas, redirección a metadatos, DNS privado, límites de tamaño/tiempo, robots.txt, tokens manipulados, destinos no permitidos, intentos SSRF por la API y por el prefijo, cabeceras, autenticación del panel, secretos ausentes en respuestas.

## Pendiente / recomendaciones

- Activar Cloudflare Access para `/admin` y reglas WAF.
- Rotar `LINK_SIGNING_SECRET` invalida los enlaces `/go/` emitidos (vida útil 90 días): planificar rotación con doble clave si se necesita.
- Revisión de seguridad externa antes de escalar tráfico.
- Hashear scripts inline para retirar `'unsafe-inline'` de la CSP (Astro genera scripts inline de hidratación).
