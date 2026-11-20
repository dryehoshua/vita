# La Vita · Gamificación para descubrir el barrio

## Qué sumar y por qué

| Principio | Evidencia o referencia | Decisión de La Vita |
|---|---|---|
| Objetivos de distinta duración | Pokémon GO separa investigaciones de campo, especiales y temporales. [Tipos de investigación](https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/45-types-of-research/?hl=en&l=en) | Misiones de barrio sin vencimiento, retos mensuales y la colección permanente de 50 medallas conviven. |
| Explorar con un propósito | Las rutas de Pokémon GO dan una razón para recorrer puntos del mapa y reconocen la primera finalización. [Routes](https://pokemongo.com/en/routes) | La Ruta de café propone dos cafeterías distintas. Es una ruta temática, sin itinerario GPS obligatorio. Cuenta la verificación QR de cada lugar. |
| Mostrar qué falta | Los desafíos de colección muestran objetivos concretos y relacionan retos con el reconocimiento de hitos. [Collection Challenges](https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/4392-what-are-collection-challenges/) | Progreso en números, requisitos a la vista y combinaciones con medallas obtenidas y pendientes. |
| Medir qué motiva | Sailer, Hense, Mayr y Mandl encontraron efectos distintos según el elemento de diseño. El estudio experimental ayuda a formular hipótesis, pero no prueba retención en un programa local. [Estudio original](https://doi.org/10.1016/j.chb.2016.12.033) | Dar opciones comprensibles y feedback verificable. Probar qué misiones llevan a descubrir lugares, no medir el éxito solo por los puntos emitidos. |

## Implementado

- **Una primera parada:** verifica una visita en un negocio participante.
- **Ruta de café:** verifica visitas en dos cafeterías distintas.
- **Cambia de plan:** verifica visitas en dos establecimientos de categorías diferentes.
- Cada misión empieza cuando la eliges. Puedes fijar otra en el resumen sin perder lo avanzado. Tus intereses del onboarding ordenan las sugerencias.
- El progreso usa visitas QR desde la fecha de inicio. Una visita repetida al mismo lugar no completa dos paradas. Una operación revertida deja de contar.
- Las misiones no cambian el saldo, el grado ni la lógica de las 50 medallas. Tampoco añaden permisos de ubicación, clasificaciones públicas ni una obligación de entrar cada día.

## Qué evaluar en el piloto

- **Activación:** cuentas que inician una misión y logran su primera visita verificada.
- **Descubrimiento:** proporción de participantes que visitan un segundo establecimiento distinto. Separar visitas repetidas de lugares nuevos.
- **Continuidad:** cuántas personas vuelven y registran otra visita en los 7 y 30 días siguientes. Comparar cohortes solo cuando haya suficiente actividad.
- **Fricción:** QR rechazados, misiones empezadas sin lugares participantes y dudas sobre qué cuenta. Los errores del lector y la falta de oferta son problemas del flujo, no de motivación.

Con suficiente actividad, el siguiente experimento sería una ruta editorial de tres paradas confirmadas en Roma-Condesa, con horarios y una alternativa accesible. El criterio de éxito es que la gente descubra un lugar, no que abra una pantalla más.
