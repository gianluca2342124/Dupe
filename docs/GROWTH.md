# Crecimiento

## Tesis

El producto se explica en un gesto visible: **poner `gemelu.com/` delante de un enlace**. Cada vídeo, cada enlace compartido y cada búsqueda enseña el truco a quien lo ve. El crecimiento se apoya en:

1. **Vídeo corto (TikTok, Reels, Shorts)** de 8–15 s: producto deseado → barra de direcciones → resultados con precio. Guiones en [growth/guiones-tiktok.md](growth/guiones-tiktok.md).
2. **Enlaces que se autoexplican**: «Compartir este hallazgo» comparte `gemelu.com/https://tienda/…`; quien lo recibe ve el patrón y lo reutiliza.
3. **PWA con share target**: en Android, «Compartir → Gemelu» desde la app de la tienda (definido en `manifest.webmanifest`).
4. **SEO selectivo**: solo páginas con valor propio (home, «Cómo funciona», guías editoriales futuras). Los resultados son `noindex` y están bloqueados en robots.txt: nada de páginas programáticas vacías.

## Funnel y métricas

| Etapa | Métrica | Fuente |
|---|---|---|
| Descubrimiento | visitas por `utm_source` / dominio de referencia | `search_events` (pageview) |
| Activación | búsquedas iniciadas, % por prefijo vs formulario | `search_jobs.entry_mode` |
| Éxito | % de búsquedas con resultados, media de alternativas, tiempo | panel `/admin` |
| Intención | CTR = clics / resultados vistos | `outbound_clicks` / `results_shown` |
| Ingreso | comisiones verificadas por la red | `commission_reports` (importadas) |
| Viralidad | compartidos y copias de enlace por búsqueda | eventos `share`, `copy_link` |

Eventos y convenciones de UTM: [growth/eventos-conversion.md](growth/eventos-conversion.md), [growth/utm.md](growth/utm.md).

## Primeras 8 semanas (propuesta)

1. Semanas 1–2: lanzar con proveedor real, 3 vídeos/semana con los guiones, medir % de búsquedas con resultados por tienda; ampliar léxico con fallos reales.
2. Semanas 3–4: colaboraciones con 3–5 creadores de deco/ahorro (contenido marcado como publicidad), kit de marca para ellos.
3. Semanas 5–8: guías editoriales indexables de alto valor («Lámparas seta: guía y alternativas») solo si aportan contenido original; newsletter opcional.

## Lo que no haremos

Cuentas falsas, automatización masiva de publicaciones o comentarios, promesas de viralidad, «réplicas», urgencia falsa o testimonios inventados.
