# Motor de matching

`URL → extracción → análisis → recuperación de candidatos → verificación → comparación → ranking → resultados`

Código: `src/lib/matching/` · Configuración: `src/config/matching.ts` (`ALGORITHM_VERSION = m1.0.0`).

## 1. Análisis del original (determinista)

`analyzeProduct()` convierte título, migas de pan, categoría, color, material, descripción y URL en conceptos canónicos usando un léxico de hogar ES/EN (`lexicon.ts`):

- **Categoría** (≈50 hojas en 8 grupos: iluminación, asientos, mesas, espejos, almacenaje, decoración, textil, menaje). Se prefiere el sustantivo antes de «para/for» («Pantalla **para** lámpara» es una pantalla), la frase más larga y la fuente más fiable (título › última miga › categoría › URL › descripción). Las categorías genéricas («lámpara», «mesa») ceden ante las específicas.
- **Color, material, forma, estilo, características** con relaciones parciales (roble≈madera 0,85; ratán≈mimbre 0,85; beige≈crema 0,7…).
- **Medidas** normalizadas a cm (Ø, alto, ancho, fondo, «120 x 60 x 75 cm», mm/m/pulgadas, QuantitativeValue de schema.org).
- **Packs** («set de 2», «4 pcs») sin confundir «45 x 45 cm».
- **Marcas y modelos** (marca, nombres en MAYÚSCULAS como «AKTERSPRING», nombre de la tienda) → nunca se usan en búsquedas.

Visión opcional (`VISION_PROVIDER=anthropic`): solo cuando la categoría no se reconoce con confianza; la respuesta está restringida por JSON Schema a los identificadores del léxico (no puede inventar precios ni medidas), con límite diario y caché.

## 2. Consultas

`buildQueries()` genera hasta `maxQueries` (4) consultas complementarias, la más precisa primero, en inglés (mejor rendimiento en AliExpress) y una en español: «mushroom opal glass table lamp», «white opal glass table lamp dimmable», «scandinavian mushroom table lamp», «lámpara de mesa seta vidrio ópalo blanco». Nunca incluyen marcas, modelos ni nombres de diseños protegidos. Techo de precio: 110 % del original (solo si `ALIEXPRESS_USE_PRICE_FILTER=true`; por defecto se filtra en local).

## 3. Recuperación

Por proveedor (`AffiliateProductProvider.searchByText`, en paralelo; una consulta fallida no tumba la búsqueda). AliExpress: `aliexpress.affiliate.product.query` con `ship_to_country=ES`, `target_currency=EUR`. Awin: función SQL `search_catalog` (texto completo con semántica OR + trigramas). Búsqueda por imagen: **no disponible** en la API de afiliados (solo existe `aliexpress.ds.image.searchV2` en la API de dropshipping, con otra app y autorización); la interfaz `searchByImage` queda preparada.

## 4. Verificación (filtros que descartan)

| Motivo | Regla |
|---|---|
| `out_of_stock` | el proveedor indica agotado |
| `not_shipping_to_spain` | el proveedor indica que no envía a España |
| `category_mismatch` | grupos distintos con confianza ≥ 0,6, u hojas distintas e incompatibles con confianza ≥ 0,75 (compatibles: mesa auxiliar↔mesa de centro, cesta↔caja, jarrón↔macetero, espejo de pared↔de pie) |
| `accessory` | categoría accesorio (bombilla, pantalla) o términos fuertes («replacement», «solo pantalla», «cord kit», «slipcover»…), o términos débiles («cable», «funda», «pata») **antes** del sustantivo |
| `brand_misuse` | menciona marcas/diseñadores/diseños protegidos o la marca/modelo del original |
| `counterfeit_signal` | «replica», «1:1», «AAA quality», «inspired by»… |
| `price_missing`, `currency_mismatch`, `no_image` | datos imprescindibles ausentes |
| `price_not_representative` | precio < 6 % del original, o rango de variantes > ×6 (p. ej. «desde 3,99 €» porque la opción barata es una bombilla) |
| `not_cheaper` | si conocemos el precio original, solo mostramos alternativas más baratas |
| `size_mismatch` | la medida principal difiere más de ×2,2 |

## 5. Dos puntuaciones separadas

**Similitud (0–1)** — media ponderada **solo de las señales disponibles en ambos lados** (pesos renormalizados):

| Señal | Peso | Valor |
|---|---|---|
| categoría | 0,20 | 1 misma hoja · 0,75 con genérica · 0,45 mismo grupo |
| conceptos | 0,16 | cobertura de los conceptos del original |
| color | 0,12 | mejor coincidencia por color (con relaciones) |
| material | 0,14 | ídem |
| forma | 0,15 | ídem |
| estilo | 0,05 | ídem |
| características | 0,08 | proporción compartida |
| medidas | 0,10 | razón de medidas principales (1 si ≥ 0,9; 0 si ≤ 0,5) |
| visual | 0,30 | solo con proveedor de embeddings de imagen (no activo) |
| identidad | — | mismo EAN (≥ 8 dígitos) o referencia del fabricante → «Mismo producto» |

Si el original tiene un atributo distintivo que el candidato no menciona, se aplica una penalización suave (0,3 con medio peso) que **no cuenta como evidencia**. **Evidencia** = peso de señales observadas en ambos lados / peso total posible.

**Utilidad de compra (0–1)** — también solo con datos conocidos: precio (ahorro/70 %, o percentil si no hay precio original), envío conocido, plazo (≤7 días = 1, ≥30 = 0), valoración bayesiana (m = 4,2, C = 25; sin número de opiniones cuenta la mitad), popularidad (log de ventas) y completitud de datos.

**Final** = 0,7·similitud + 0,3·utilidad, ordenando primero por nivel.

## 6. Niveles

| Nivel | Condición |
|---|---|
| Mismo producto (`verified`) | identidad demostrada (EAN/referencia) |
| Muy similar | similitud ≥ 0,76, evidencia ≥ 0,55, la forma no contradice y la categoría coincide (≥ 0,75) |
| Similar | similitud ≥ 0,60 y evidencia ≥ 0,35 |
| Baja confianza | similitud ≥ 0,45 → se muestra aparte, plegado |
| Descartado | resto |

**No mostramos porcentaje de similitud**: `SHOW_SIMILARITY_PERCENT=false` hasta calibrar con datos reales etiquetados (`npm run eval:matching labels.json`). Las cifras actuales del script usan etiquetas de la demo y solo demuestran que el arnés funciona.

## 7. Ahorro comparable

- Precio comparable = precio + envío si el proveedor lo indica (`total_with_shipping`); si no, precio sin envío (`item_price_only`, «sin contar el envío»).
- Solo con la misma moneda, ambos precios conocidos y la alternativa realmente más barata (> 0,50 €).
- Packs: se compara por unidad (set de 3 frente a 1 unidad).
- Sin ahorro para precios «desde», tamaños muy distintos (< 0,6) ni **precios ficticios de demo frente a un producto real**.
- Etiquetas «Más parecido» (ventaja ≥ 0,03 de similitud) y «Más barato» (precio mínimo único, misma base de precio en todos) solo cuando están justificadas.

## 8. Deduplicación

Misma foto (URL normalizada de CDN) o título casi igual (Jaccard ≥ 0,8) con precio a ±12 % → se conserva el mejor puntuado y se cuenta el resto.

## 9. Calidad y próximos pasos

- Calibrar umbrales con 200+ pares reales etiquetados por categoría.
- Añadir embeddings de imagen (CLIP/SigLIP en un servicio aparte o Workers AI si hay modelo adecuado) → señal `visual` y columna `catalog_products.embedding` (pgvector, índice HNSW comentado en la migración).
- Revisar semanalmente la cola «¿No se parece?» del panel y ampliar el léxico.
