# Convención UTM

Gemelu registra `utm_source`, `utm_medium` y `utm_campaign` (máx. 80 caracteres) sin cookies ni identificadores. En los enlaces con prefijo (`gemelu.com/https://…?utm_…`) los parámetros `utm_*` se eliminan de la URL de la tienda antes de buscar.

| Canal | utm_source | utm_medium | utm_campaign |
|---|---|---|---|
| Bio de TikTok | tiktok | social | bio |
| Vídeo concreto | tiktok | video | yyyy-mm-dd-tema |
| Bio de Instagram | instagram | social | bio |
| Reel | instagram | reel | yyyy-mm-dd-tema |
| Creador | instagram/tiktok | influencer | nombre-creador |
| Newsletter | newsletter | email | numero |
| PWA | pwa | app | (automático en start_url) |

Ejemplo: `https://gemelu.com/?utm_source=tiktok&utm_medium=video&utm_campaign=2026-11-05-lampara-seta`
