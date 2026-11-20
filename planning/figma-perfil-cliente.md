# Figma · Perfil del cliente de La Vita Roma Condesa

Diseña un **prototipo mobile first** para el perfil del cliente de La Vita Roma Condesa. Debe verse como una cartera de puntos y un pasaporte del barrio, con el toque de un videojuego de colección. La persona puede mostrar su QR, consultar o transferir puntos, desbloquear condecoraciones en **My Adventures** y ver promociones en **Exclusive**. Es el mismo perfil para turistas, residentes de CDMX y vecinos de Roma-Condesa.

Diseña solamente esas pantallas. Usa datos de ejemplo. El QR y los puntos ya existen en el producto. Las transferencias, las condecoraciones, los grados y Exclusive son funciones nuevas que este prototipo debe especificar.

## Dirección visual

- Marco principal de **390 × 844 px**, con una sola columna, margen lateral de 16 px y controles táctiles de 48 px. Comprueba el ancho de 320 px y respeta la zona segura inferior.
- Paleta La Vita: vino **#641D32**, vino oscuro **#431323**, marfil **#F7F3EC**, blanco **#FFFFFF**, tinta **#242020** y latón **#B59A6A** para detalles. Usa el logotipo existente de La Vita. Bodoni para encabezados editoriales e Inter para saldo, formularios y navegación.
- Recuerda un pasaporte de barrio con medallas esmaltadas. Evita marcos pesados y una estética de casino. Cada medalla tiene silueta e icono propios. Dibuja el arte en Figma como vector editable, con suficiente contraste también a 48 px.
- Diseña la interfaz en español y su variante en inglés. Conserva los nombres **My Adventures**, **Exclusive** y los títulos de las medallas en ambos idiomas. Los requisitos, errores y botones se traducen.
- Evita una portada alta. El avatar, el nombre y el grado caben en el encabezado compacto. El saldo y el botón **Mostrar QR** aparecen en la primera vista sin hacer scroll.

## Pantallas y navegación

### 1. Perfil

Diseña el perfil de **Sofía** con foto pequeña, grado **Rostro conocido** y una indicación discreta de cuántas visitas le faltan para el siguiente grado. Debajo, una tarjeta de saldo muestra **120 pts** y el nombre del programa activo. Si participa en varios programas, el selector de programa aparece ahí mismo y cada saldo se muestra por separado.

La acción principal es **Mostrar QR**. Las secundarias son **Transferir puntos** y **Movimientos**. Más abajo hay dos módulos compactos:

- **My Adventures** muestra hasta tres medallas desbloqueadas, la siguiente que está cerca y el enlace **Ver colección**.
- **Exclusive** muestra una promoción disponible y, si aplica, otra cerrada con el grado que pide. El acceso **Ver promociones** lleva a la lista completa.

### 2. Mostrar QR

Usa pantalla completa, QR negro sobre blanco con margen claro, nombre del establecimiento o del programa y un contador de vigencia. Distingue **Acumular puntos** de **Canjear recompensa**. Cuando se canjea, muestra la recompensa y su costo antes de generar el código.

Incluye **Copiar código** para captura manual, además de los estados **Vence en 05:00**, **Código vencido** con **Generar otro**, y **Operación confirmada** con el cambio de saldo. El QR es temporal y de un solo uso. Para el prototipo usa un QR de muestra marcado como demo.

### 3. Puntos, movimientos y transferencia

**Movimientos** muestra una lista por fecha con el establecimiento, la operación y su cambio de saldo: visita, canje, puntos enviados, puntos recibidos o comisión. Mantén el nombre del programa visible.

Diseña la transferencia en tres pasos:

1. **Destinatario y cantidad.** Buscar por identificador exacto de La Vita y mostrar solo su nombre público y avatar para verificar a quién se enviará. Elegir cantidad entera y mostrar saldo disponible.
2. **Confirmación.** Mostrar de forma separada lo que recibe la otra persona, la comisión y lo que se descontará al cliente. Ejemplo de prototipo: saldo de **120 pts**, destinatario recibe **40 pts**, comisión de **5 pts**, total descontado de **45 pts**, saldo final de **75 pts**. Botón **Confirmar transferencia**.
3. **Recibo.** Mostrar destinatario, importe, comisión, saldo restante y referencia. Dibujar también destinatario no encontrado, saldo insuficiente, error de red y operación en verificación. Después de confirmar, si se pierde conexión, mostrar **Consultar estado** con la misma referencia antes de ofrecer un nuevo envío.

**Reglas propuestas para el diseño:** comisión fija de 5 pts para el ejemplo, configurable cuando se implemente. El envío se hace dentro de un mismo programa habilitado para transferencias. No permite enviarse puntos a uno mismo ni sumar saldos de distintos programas. Los puntos recibidos sirven como saldo, pero no generan visitas, medallas ni grados.

### 4. My Adventures

Diseña una vitrina en cuadrícula de dos o tres columnas de acuerdo con el ancho. Arriba van el grado actual, el progreso hacia el siguiente y el contador de medallas. Cada condecoración se abre para ver su arte, nombre, condición y progreso. Cuando está desbloqueada, muestra la fecha. Cuando está pendiente, muestra el requisito en lenguaje normal, por ejemplo **3 de 5 bares visitados**.

Crea estas **ocho medallas originales** como componentes editables. Cada una necesita variantes **desbloqueada**, **en progreso** y **bloqueada**, distinguibles por icono, color y etiqueta.

| Condecoración | Condición | Diseño de la medalla |
|---|---|---|
| **First Footprint** | Completa tu primera visita verificada. | Azulejo redondo color vino con una huella sobre una banqueta. |
| **Beer Knight** | Visita 5 bares distintos. Cuenta la visita aunque no pidas alcohol. | Escudo de latón con casco medieval y una pequeña espiga de lúpulo. |
| **Lord of the Night** | Visita 10 establecimientos nocturnos distintos. | Escudo azul noche, luna creciente y corona con forma de letrero de neón. |
| **Taco Tactician** | Visita 5 taquerías distintas. | Hexágono ámbar con un taco y un mapa táctico dibujado con líneas. |
| **Espresso Express** | Visita 4 cafeterías distintas. | Medalla circular color café, tacita con un rayo y borde marfil. |
| **Culture Vulture** | Registra entrada en 3 eventos distintos de arte o cultura. | Óvalo verde con un buitre elegante que lleva un monóculo y sostiene un boleto. |
| **Brunch Bandit** | Visita 3 lugares distintos de brunch en su horario marcado. | Estrella suave color coral con un croissant de antifaz. |
| **Neighborhood Legend** | Visita 25 lugares distintos en al menos 5 categorías. | Medallón vino y latón con un mapa del barrio y una estrella en el centro. |

Cuenta visitas verificadas por QR. Repetir el mismo establecimiento no suma en medallas que exigen lugares distintos. La categoría nocturna se toma de la ficha del negocio. Las medallas de eventos y brunch muestran progreso solo cuando haya una entrada verificada y datos de categoría u horario que permitan comprobarla.

**Grados para el prototipo:** **Explorador** desde el inicio, **Rostro conocido** con 5 lugares distintos, **Insider** con 10 y **Leyenda del barrio** con 25 lugares en 5 categorías. El grado se gana por actividad verificada y se conserva aunque se gasten o transfieran puntos. Condecoración y grado son dos cosas distintas: una medalla reconoce un reto concreto; el grado refleja el recorrido general.

### 5. Exclusive

Diseña dos vistas: **Disponibles** y **Por desbloquear**. Cada promoción muestra foto, establecimiento, beneficio, fecha de vigencia y grado requerido. El detalle añade horario, cupo si aplica, condiciones y forma de uso. Ejemplos ficticios:

- **Rostro conocido** · café americano de cortesía con una compra en una cafetería participante.
- **Insider** · 15% de descuento en una experiencia de arte participante.
- **Leyenda del barrio** · acceso anticipado a una degustación de cupo limitado.

Estado disponible: **Ver promoción**. Estado bloqueado: indicar el requisito exacto, por ejemplo **Disponible con Insider · te faltan 2 lugares**. Incluir **Agotada** y **Vencida**. El grado da acceso a la oferta. Si una oferta requiere puntos, el costo se muestra antes de confirmar el canje.

## Entrega esperada en Figma

- Cinco secciones con los marcos **Perfil**, **QR**, **Puntos y transferencia**, **My Adventures** y **Exclusive**.
- Componentes reutilizables con Auto Layout: tarjeta de saldo, tarjeta de promoción, medalla, etiqueta de grado, progreso, fila de movimientos y confirmación.
- Cuatro flujos enlazados: **mostrar QR**, **enviar puntos y ver recibo**, **abrir una medalla**, **revisar una promoción disponible y una bloqueada**.
- Revisar que se pueda mostrar el QR con un toque desde el perfil, entender la comisión antes de enviar y saber qué falta para desbloquear una medalla o promoción sin adivinar.
