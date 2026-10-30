# Afiliación — visión general

Gemelu se financia con comisiones cuando alguien compra tras pulsar «Ver en AliExpress». Dos vías oficiales, intercambiables con `PRODUCT_PROVIDER`:

| | AliExpress directo (`aliexpress`) | Awin (`awin`) |
|---|---|---|
| Alta | Portals de AliExpress + app de afiliado en Open Platform | Cuenta de publisher en Awin + aprobación en el programa de AliExpress |
| Búsqueda | En tiempo real (`aliexpress.affiliate.product.query`) | Sobre el catálogo importado del feed (actualización diaria) |
| Enlaces | `promotion_link` en la respuesta o `aliexpress.affiliate.link.generate` | `aw_deep_link` del feed o deep link oficial `cread.php` |
| Envío/plazo | `aliexpress.affiliate.product.shipping.get` | columnas del feed (si el anunciante las publica) |
| Comisiones | `aliexpress.affiliate.order.list` (cron) | Publisher API de Awin – transacciones (cron) |
| Guía | [ALIEXPRESS_SETUP.md](ALIEXPRESS_SETUP.md) | [AWIN_SETUP.md](AWIN_SETUP.md) |

Recomendación: empezar por la que se apruebe antes. La API directa da búsqueda en tiempo real (mejor experiencia); Awin depende de lo que contenga el feed autorizado.

## Principios (implementados)

1. **Nunca se fabrican enlaces**: si el proveedor no da o no puede generar un enlace de afiliado, el botón enlaza a la ficha normal y se marca como directo (sin «Afiliado»). En demo no hay destino.
2. **No se interfiere en la atribución**: el enlace oficial se usa tal cual. Única modificación: el parámetro `clickref` de Awin (documentado por Awin) con un id de clic anónimo para conciliar comisiones.
3. **Redirección interna `/go/<token>`**: registra el clic (sin datos personales) y redirige con 302. Token firmado + lista de hosts: no hay redirección abierta.
4. **Caché de enlaces** (30 días) para no regenerarlos.
5. **Transparencia**: «Afiliado» bajo cada botón con enlace de afiliación, página `/afiliacion`, aviso en el pie y en resultados. Las comisiones no influyen en el orden.
6. **Clics ≠ ventas**: el panel separa clics locales de conversiones importadas de la red (`commission_reports`).

## Variables

`PRODUCT_PROVIDER`, `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID`, `AWIN_PUBLISHER_ID`, `AWIN_API_TOKEN`, `AWIN_FEED_URL`, `AWIN_ALIEXPRESS_ADVERTISER_ID`, `AWIN_DEEPLINK_ENABLED`, `LINK_SIGNING_SECRET`, `GO_ALLOWED_HOSTS`. Descripción completa en `.env.example`.

## Cumplimiento

- Lee y cumple las condiciones de cada programa (uso de marcas, materiales, prohibición de pujar por marcas en SEM, contenido incentivado, etc.).
- Identifica la publicidad en redes sociales (#publi / «colaboración pagada» cuando proceda) conforme a la normativa española de publicidad y a las guías de la AECC/Autocontrol.
- Las imágenes y textos de productos de AliExpress se muestran desde la API/feed autorizados; no se descargan ni se reutilizan fuera de los resultados.
