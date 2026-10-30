# Eventos y conversiones

Todos los eventos se guardan sin IP, user agent completo, cookies ni identificadores (ver `/privacidad`).

| Evento | Dónde se genera | Uso |
|---|---|---|
| `pageview` | beacon en todas las páginas | visitas, fuentes (referrer/UTM), dispositivo |
| `search_submitted` | servidor, al iniciar una búsqueda nueva | activación; `entry_mode` = prefix / form / share / example |
| `search_completed` / `search_failed` | servidor | tasa de éxito, errores por código, tiempos |
| `results_shown` | navegador al mostrar resultados | base del CTR |
| `outbound_clicks` | servidor en `/go/` | clics por posición, nivel, proveedor, afiliado sí/no |
| `share`, `copy_link` | navegador | viralidad |
| `correction` (`product_corrections`) | botón «¿No se parece?» | calidad del matching |
| `commission_reports` | importación de AliExpress/Awin | **conversiones verificadas** (separadas de los clics) |

**Definiciones**
- Búsqueda con éxito: `result_count > 0`.
- CTR de afiliación: clics con `is_affiliate = true` / `results_shown`.
- Conversión: solo una transacción presente en `commission_reports`. Un clic nunca se cuenta como venta.
