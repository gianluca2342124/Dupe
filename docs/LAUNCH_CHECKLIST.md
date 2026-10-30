# Checklist de lanzamiento

## Imprescindible (bloquea el lanzamiento)

- [ ] **Marca**: búsqueda manual de «GEMELU» y variantes en OEPM, EUIPO y TMview (clases 9, 35, 42); decidir nombre definitivo; comprar `gemelu.com` (y `.es`).
- [ ] **Datos legales**: completar todos los campos `PENDIENTE` (titular, NIF, domicilio, registro, correo) en `/aviso-legal`, `/privacidad`, `/empresa`; revisión por un profesional (RGPD/LOPDGDD, LSSI-CE, consumo, publicidad).
- [ ] **Afiliación aprobada**: AliExpress Portals + Open Platform (App Key/Secret/Tracking ID) o Awin (publisher + programa AliExpress + feed).
- [ ] `PRODUCT_PROVIDER` ≠ `demo` en producción y `npm run check:env` sin errores.
- [ ] `LINK_SIGNING_SECRET` (≥ 32 caracteres aleatorios), `ADMIN_USER`/`ADMIN_PASSWORD` como secretos.
- [ ] Supabase creado (UE), migración aplicada, secretos configurados, `/admin` muestra `supabase`.
- [ ] Dominio en el Worker, HTTPS estricto, Cloudflare Access en `/admin*`, regla WAF para `/api/search`.
- [ ] Probar con 20–30 enlaces reales de IKEA, Sklum, Westwing, Zara Home, Kave Home, Maisons du Monde, Leroy Merlin y Amazon; revisar calidad y ajustar léxico.
- [ ] Revisar que los textos de demo no aparecen con el proveedor real (avisos `demo`).

## Muy recomendable

- [ ] Plan Workers Paid (CPU suficiente para fichas grandes).
- [ ] Monitor externo contra `/api/health` y alerta por correo.
- [ ] Etiquetar ≥ 200 pares reales y ejecutar `npm run eval:matching labels.json`; ajustar umbrales (`src/config/matching.ts`) y subir `ALGORITHM_VERSION`.
- [ ] `PUBLIC_CF_WEB_ANALYTICS_TOKEN` (analítica sin cookies) y revisar el panel semanalmente.
- [ ] Cuentas de TikTok/Instagram con el kit de `docs/growth/`.
- [ ] Turnstile si aparece abuso automatizado.

## Antes de activar anuncios (opcional)

- [ ] Aprobación de AdSense, `ADS_ENABLED=true`, `ADSENSE_CLIENT_ID`, `ADSENSE_SLOT_RESULTS`.
- [ ] CMP certificada por Google para el EEE (p. ej. «Privacidad y mensajes» de AdSense) y actualización de `/cookies`.
- [ ] Verificar que la CSP se amplía automáticamente (`ADS_ENABLED`) y que los anuncios no se confunden con resultados.

## Limitaciones conocidas

- Tiendas con protección anti-bot (Zara Home, Maisons du Monde, Leroy Merlin, Kave Home, Amazon — observado desde IP de centro de datos) no se leen: Gemelu usa el nombre del enlace o pide describir el producto. No se intenta sortear.
- Sin búsqueda por imagen (no disponible en la API de afiliados) ni embeddings visuales: el parecido se calcula con texto y atributos; la forma exacta puede no capturarse si el anuncio no la describe.
- Sin calibración: no se muestran porcentajes de parecido.
- Con Awin la frescura depende del feed (diario).
- La analítica en memoria (sin Supabase) se pierde al reciclar el isolate.
- El API de transacciones de Awin y las respuestas reales de AliExpress no se han probado con credenciales.
