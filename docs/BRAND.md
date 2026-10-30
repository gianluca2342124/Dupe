# Marca — Gemelu

> Nombre provisional. Todo el texto de marca sale de `src/config/brand.ts`: cambiar el nombre o el dominio es editar ese archivo (más el dominio en `wrangler.jsonc` y en Cloudflare).

## 1. Referencia conceptual

Dupe.com ([web](https://dupe.com), [FAQ](https://dupe.com/faq)) popularizó el gesto de **añadir su dominio delante de un enlace** (`dupe.com/https://…`) para encontrar alternativas más baratas con comparación visual (silueta, estilo, color, material). Gemelu toma ese gesto como mecánica principal, pero con identidad propia, foco inicial en hogar y decoración en España, alternativas de AliExpress con envío a España y una política explícita de honestidad (sin porcentajes inventados, sin réplicas).

## 2. Investigación de nombres (30/10/2026)

Criterios: 5–8 letras, palabra inventada, fácil de pronunciar y **de escribir al oírla** en español (clave para vídeos: «pon _gemelu punto com_ delante»), evitar b/v, ll/y, j/g, h y z ambiguas, no parecerse a «Dupe» ni a marcas conocidas, con potencial de uso como sustantivo/verbo.

Disponibilidad `.com` comprobada con RDAP de Verisign (`rdap.verisign.com`, 404 = no registrado; 200 = registrado). **Que no esté registrado no garantiza que se pueda comprar** (puede estar reservado o en periodo de gracia); no se ha comprado ningún dominio.

| # | Nombre | .com (RDAP) | Valoración |
|---|---|---|---|
| 1 | **Gemelu** ✅ | No registrado | De «gemelo»: la metáfora exacta del producto («el gemelo barato de tu lámpara»). 6 letras, cálido, memorable, se escribe bien al oírlo en España. En inglés se leería «jeh-MEH-loo»: distinto pero sencillo. |
| 2 | Semelu | No registrado | De «semejante». Pronunciación idéntica ES/EN; significado menos evidente. |
| 3 | Parelu | No registrado | De «par/parecido/paralelo». Neutro y fácil; menos emocional. |
| 4 | Igualu | No registrado | Muy claro en español («igual»); difícil en inglés («gua»). |
| 5 | Tuigual | No registrado | Expresivo («tu igual») pero descriptivo: marca débil. |
| 6 | Twinlu | No registrado | Base inglesa; al oírlo en español se duda cómo escribirlo. |
| 7 | Parezu | No registrado | La «z» se pronuncia distinto en España, Latinoamérica e inglés. |
| 8 | Mismelo | No registrado | Suena a conjugación («mísmelo»), poco natural. |
| 9 | Mesmo | Registrado | «Mismo» en gallego/portugués; muy bueno pero no disponible. |
| 10 | Semblo | Registrado | Raíz común ES/EN (semblanza/resemble); no disponible. |
| 11 | Sosia | Registrado | Palabra española para «doble»; no disponible. |
| 12 | Lomismo | Registrado | Descriptivo y no disponible. |

Otros descartados por estar registrados en `.com`: Igualo, Clavao, Mellio, Parelo, Tupar, Twinzo, Pareido, Simila, Similo…

### Conflictos de marca

- **Búsqueda web**: sin resultados de marcas llamadas Gemelu, Semelu, Parelu o Igualu. Nombres parecidos en otros sectores: GEMÜ (válvulas industriales) y GEMELLii (bebidas). Riesgo de confusión bajo en las clases relevantes, pero **no evaluado jurídicamente**.
- **OEPM / EUIPO / TMview**: **no verificado**. TMview rechazó las consultas automáticas (cortafuegos), EUIPO eSearch no respondió desde este entorno y el Localizador de la OEPM requiere interacción en el navegador. Antes de invertir en la marca hay que buscar manualmente «GEMELU» (y variantes fonéticas) en OEPM, EUIPO y TMview, clases de Niza **35** (publicidad, comparación de precios), **42** (software/plataformas) y **9** (apps).
- No se ha registrado ninguna marca ni comprado ningún dominio.

## 3. Identidad visual

- **Isotipo — «arcos gemelos»**: dos arcos (como dos ventanas o dos espejos arqueados, un guiño a la decoración): el original en tinta y su gemelo en terracota, superpuestos con un filo de papel. Funciona a 16 px (favicon) y como avatar. Archivos: `public/brand/isotype.svg`, `public/brand/logo.svg`, `public/favicon.svg`, iconos PNG en `public/brand/`.
- **Logotipo**: isotipo + «gemelu» en minúsculas, Instrument Sans semibold, tracking −3,5 %.
- **Tipografía** (licencia OFL, alojadas por nosotros: sin peticiones a Google Fonts):
  - Titulares: **Instrument Serif** (con cursiva para el acento: «_Por mucho menos._»).
  - Interfaz y textos: **Instrument Sans** (variable).
- **Color** (tokens en `src/styles/global.css`):

| Token | Hex | Uso |
|---|---|---|
| paper | `#FAF8F4` | fondo |
| card | `#FFFFFF` | tarjetas |
| ink | `#1A1915` | texto principal, botón primario |
| ink-2 / ink-3 | `#4A463F` / `#7A7469` | texto secundario / terciario |
| line | `#E7E1D6` | bordes finos |
| terracotta | `#B4532F` | acento de marca, CTA «Ver en AliExpress» |
| save | `#1D6B47` | dinero ahorrado (solo para eso) |
| demo | `#7A5C00` sobre `#FBF0C9` | etiquetas DEMO y avisos de borrador |

- **Componentes**: botones píldora (`.btn-primary`, `.btn-accent`, `.btn-ghost`), tarjetas con radio 20 px y sombra suave, chips para etiquetas de nivel («Muy similar») y de dato («Más barato»), barra de dirección como elemento gráfico recurrente (el truco).
- **Imagen social**: `public/og/default.png` (1200×630), generada con `npm run brand:assets`.
- **Movimiento**: entradas suaves (`rise`), pulso en el paso activo del progreso; todo desactivado con `prefers-reduced-motion`.

## 4. Voz y microcopy

- Español de España, tuteo, frases cortas, sin tecnicismos ni promesas infladas.
- **Promesa**: «Lo mismo. Por mucho menos.» · Posicionamiento: «Descubre lo mismo por mucho menos.»
- Honestidad explícita: «Parecido no es idéntico», «Precio ficticio (demo)», «Envío no indicado», «sin contar el envío».
- Nunca: «réplica», «copia», «falsificación», «garantizado», porcentajes de parecido sin calibrar, urgencia artificial.
- Ejemplos: «Encontramos 7 alternativas más baratas», «Preferimos no enseñarte nada antes que algo que no se parece», «La tienda no nos deja leer esta página», «¿No se parece?».
