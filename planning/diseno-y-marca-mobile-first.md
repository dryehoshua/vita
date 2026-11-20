# La Vita Roma Condesa · Diseño y marca mobile first

**Brief para Figma · 20 de noviembre de 2026**

La Vita ayuda a decidir qué hacer en Roma-Condesa y a operar lo que se publica en la plataforma. La cara pública se siente como una guía de barrio. Cada back office debe empezar por la tarea que corresponde a la persona que entra. El piloto ya tiene roles, contenido revisable y transacciones de puntos. Este documento define el rediseño y marca qué pantallas dependen de funciones nuevas.

## Qué cambiar del panel actual

- Todos los roles entran a «Puntos y recompensas». El periodista debería caer en sus borradores, el editor en su cola y el personal del bar en el lector.
- Bar y hotel comparten un formulario de establecimiento. Conservaremos la cuenta y los permisos comunes, pero cada tipo de negocio tendrá un inicio y un menú distintos.
- La navegación de botones que saltan de línea y los formularios largos se sustituyen por listas cortas, subtareas con su propia pantalla y una acción principal visible.
- Los formularios piden primero lo indispensable. Fotos, fuentes, horarios, amenidades y reglas del negocio se editan en pasos separados, con estado visible y vuelta al detalle.
- La exploración pública conserva fotos, cuponera filtrable, búsqueda por nombre y categorías. El perfil y los puntos permanecen compactos. En un panel operativo, dar espacio a imágenes cuando sea necesario elegir, recortar o revisar una foto.

## Qué observamos en otros productos

| Referencia oficial | Patrón observado | Decisión para La Vita |
|---|---|---|
| [Airbnb · Guardados](https://www.airbnb.com/help/article/1236) | El guardado empieza en la ficha y se recupera desde una sección propia. | Corazón en las fichas y un tab **Guardados**. El visitante empieza en **Explorar**. |
| [Square · Cupones y recompensas](https://squareup.com/help/us/en/article/5522-apply-rewards-to-purchases) | La persona de caja valida la recompensa durante la transacción. | **Escanear QR** al entrar, captura manual alternativa, revisión explícita y recibo. |
| [Google Business Profile · Menú](https://support.google.com/business/answer/9455840?hl=en) y [OpenTable · Operación móvil](https://support.opentable.com/s/article/mobileapp?language=en_US) | Editar la carta es una tarea distinta de operar el turno. | Separar **Menú** de **Validar**. El plano de mesas o las reservas serían otra fase. |
| [Airbnb · Herramientas del anfitrión](https://www.airbnb.com/resources/hosting-homes/a/exploring-your-hosting-tools-738) y [Booking.com · Pulse](https://www.booking.com/propertyapp.en-gb.html) | Gestión separada de propiedad y de disponibilidad o reservas. | Diseñar **Propiedad**, **Habitaciones** y **Promociones** primero. Prototipar calendario y reservas como una fase independiente. |
| [GetYourGuide · Panel de proveedores](https://www.getyourguide.supply/articles/whats-new-in-your-supplier-portal-fall-2026-updates) | La oferta, las reservas y el rendimiento tienen contextos distintos. | **Recorridos** y **Perfil** como herramientas centrales del guía. En el piloto, WhatsApp es el contacto y no existe una reserva en La Vita. |
| [Ghost · Permisos editoriales](https://ghost.org/help/managing-staff-user-profiles/) y [Ghost · Publicación](https://ghost.org/help/publishing-content/) | Permisos distintos para escribir y publicar, con vista previa antes de liberar. | Separar **Redacción** de **Revisión**. El periodista se parece a un colaborador de Ghost en permisos, aunque su rol en La Vita se llama **Autor**. |

## Arquitectura por rol

Los menús representan el diseño objetivo. Cada sesión tiene una identidad; los permisos determinan sus espacios. Si alguien pertenece a más de un negocio o rol, el espacio activo se elige desde el encabezado y queda visible durante acciones sensibles. En móvil, mostrar hasta cuatro accesos en la barra inferior y agrupar el resto en **Más**. El editor de pantalla completa y el lector tienen navegación propia.

| Rol o contexto | Pantalla de entrada | Navegación y contenido |
|---|---|---|
| **Visitante, incluido turista** | **Explorar** con buscador, categorías, cuponera y planes cercanos por zona. | **Explorar · Guardados · Puntos · Cuenta**. Puntos muestra saldo por programa, recompensas y movimientos. Cuenta guarda foto, nombre, idioma y la preferencia turista / CDMX / Roma-Condesa. Las sugerencias por preferencia requieren trabajo nuevo. |
| **Propietario de bar, restaurante o cafetería** | **Hoy** con nombre y sucursal, estado de la ficha, pendientes de revisión, últimos movimientos y acceso directo al lector. | **Hoy · Menú · Validar · Más**. Más incluye ficha, fotos, horarios, promociones, movimientos y equipo. Menú se organiza por categorías con nombre, precio, disponibilidad y edición breve. Las reservas de mesas quedan fuera del piloto. |
| **Propietario de hotel u hostal** | **Propiedad** con vista previa pública, estado de revisión y tareas como completar fotos, amenidades o contacto. | **Propiedad · Habitaciones · Promos · Más**. Habitaciones distingue habitación privada, suite y cama en dormitorio, según aplique. Define tipos, fotos, capacidad, amenidades y condiciones. Más incluye servicios, horarios de entrada y salida, políticas, contacto y equipo. Inventario, ocupación, tarifas por fecha y reservas son fase posterior. |
| **Equipo del negocio** | **Validar QR** con negocio visible, acceso a cámara y campo manual alternativo. | **Validar · Movimientos · Cuenta**. Muestra recibos de su establecimiento. Sin edición de ficha, stock, reglas del programa o equipo. |
| **Guía turístico** | **Recorridos** con estado de publicación y acción «Nuevo recorrido». | **Recorridos · Perfil · Cuenta**. Cada recorrido muestra zona, duración, grupo, idioma, tarifa e itinerario. Perfil presenta bio, fotos, honorarios por hora y contacto. Zona admitida: CDMX, área metropolitana y Teotihuacán. |
| **Periodista de Socialité** | **Redacción**, con borradores, cambios solicitados y la acción «Nuevo artículo». | **Redacción · Publicados · Cuenta**. Filtrar por estado y tipo. El menú de creación ofrece artículo, evento y promoción a quien tenga permiso. El artículo incluye texto, portada, créditos, fuentes, vista previa y envío a revisión. La página pública con biografía y archivo de artículos requiere implementación. |
| **Editor** | **Cola de revisión**, con tipo, autor, fecha, estado y orden por antigüedad. | **Revisión · Publicados · Cuenta**. Abrir versión enviada, examinar textos, fotos y fuentes, solicitar cambios con motivo o aprobar. El autor no aprueba su propio envío. |
| **Administrador** | **Pendientes** con solicitudes por aprobar, contenido y accesos que requieren atención. | **Pendientes · Cuentas · Operaciones · Más**. Más incluye negocios, programas, auditoría y analítica. Acciones protegidas con doble factor. Mostrar cargas de página y cuentas verificadas, con etiquetas independientes y periodo visible. |

### Límite del piloto y dependencias

- **Ya conectado:** cuentas, favoritos, foto de perfil, preferencias, permisos, fichas y menú borrador, recorridos, contenido revisable, QR, movimientos y métrica de cargas de página. Rediseñar estos flujos sobre sus datos actuales.
- **Diseñar e implementar para conectar:** inicio por rol, selector de espacios, editor de habitaciones y amenidades, perfil público del periodista, métricas por negocio y flujo de solicitudes de promociones desde el negocio. Una promoción visible no implica que exista un canje comercial.
- **Fase posterior:** reservas, calendario operativo y tarifas por fecha, inventario por habitación, pagos, reseñas propias y recomendaciones por perfil. No mostrar tarjetas con ceros, ventas, ocupación o disponibilidad que La Vita aún no mide. No mostrar como activas las acciones pendientes de integración.

## Marca y sistema visual

**Idea:** una guía editorial de barrio en la cara pública y una herramienta de trabajo compacta en los paneles. La identidad se reconoce por el logotipo, el vino y las fotografías del lugar. La operación se apoya en texto legible, espacios claros y estados fáciles de escanear.

| Variable Figma | Valor | Uso |
|---|---|---|
| `brand/wine` | `#641D32` | Acción principal, selección y firma de marca. |
| `brand/deep` | `#431323` | Texto de marca y estado activo de la acción principal. |
| `surface/base` | `#F7F3EC` | Fondo marfil del sitio. |
| `surface/raised` | `#FFFFFF` | Editor, detalle, formularios y listas operativas. |
| `text/primary` | `#242020` | Texto principal. |
| `text/secondary` | `#746A68` | Ayuda y metadata, sujeto al contraste con su superficie. |
| `border/subtle` | `#D9CFC4` | Separadores de superficie; usar borde de mayor contraste en controles. |
| `brand/brass` | `#B59A6A` | Acento decorativo; evitarlo para texto funcional sobre marfil. |
| `state/success`, `state/attention`, `state/error` | `#216448`, `#805015`, `#A52237` | Estado con etiqueta o icono, además del color. |

- **Tipografía:** Bodoni en portadas, encabezados editoriales y fichas. Inter para navegación, precios, tablas, formularios y pantallas operativas. La caligrafía se reserva para el logotipo. Tamaños mobile: titular editorial 32/36, título operativo 24/30, título de sección 18/24, cuerpo 16/24, etiquetas 14/20, metadatos 12/16. Usar 16 px en entradas de texto.
- **Activos existentes:** `dist/assets/la-vita-logo-512.png` y los recursos del sitio. Referencia de identidad en `dist/styles.css`. Usar fotografías reales o con licencia verificada, con crédito cuando corresponda. Retratos o fotos generadas se identifican si podrían confundirse con un lugar o con una persona real.
- **Espacio:** escala 4, 8, 12, 16, 24 y 32 px. Márgenes de 16 px y una columna en móvil. Separadores y texto alineado antes que cajas para cada elemento. Radio 12 px para fichas y 8 px para campos; sombra suave solo para superficies superpuestas.
- **Iconos:** un solo estilo de línea, 20–24 px. Las acciones principales llevan texto. Los precios, puntos y horas se muestran con números alineados.
- **Voz:** verbos concretos y frases cortas. «Escanear QR», «Guardar borrador», «Solicitar cambios», «Consultando saldo». Mantener ES/EN y probar títulos largos. Formatos regionales para MXN, idioma y fechas en Ciudad de México.

## Composición y flujos para prototipar

| Flujo | Fotogramas clave | Qué comprobar |
|---|---|---|
| **Turista y personal en caja** | Puntos → elegir negocio → QR de acumular o canjear → cámara o captura manual → confirmar impacto → recibo. | El código y el negocio son visibles. Mostrar vencimiento, permiso de cámara denegado, saldo insuficiente, QR usado y reintento tras caída. Reintentar conserva la misma operación y nunca muestra éxito antes de confirmación. |
| **Bar publica un cambio** | Hoy → Menú → editar margarita, precio y disponibilidad → comprobar ficha → guardar o enviar. | Puede modificar un ítem sin recorrer toda la ficha. Si está en revisión, queda claro qué versión ve el público. |
| **Hotel completa su ficha** | Propiedad → Habitaciones → tipo de habitación → fotos, capacidad y amenidades → vista pública. | Se entiende qué viene de la ficha y qué necesita backend. No presentar datos ilustrativos como disponibilidad real. |
| **Periodista y editor** | Redacción → Nuevo artículo → texto → portada y fuentes → vista previa móvil → envío → cola del editor → solicitar cambios o aprobar → Socialité. | Autor ve el comentario y reenvía; editor ve quién envió y cuándo. Si se edita una pieza publicada, su versión anterior permanece visible hasta aprobar los cambios. |
| **Guía y administrador** | Recorridos → Editar recorrido → vista pública; Pendientes → revisar solicitud → decidir; analítica tras doble factor. | Horarios, tarifas, idioma y contacto claros. El rol y la organización nunca se infieren a partir de un botón visible. |

### Reglas mobile first

- Diseñar primero en **390 × 844**. Validar a **320**, **360** y **430 px** de ancho. Después adaptar a **768** y **1440 px** con barra lateral en escritorio. Los formularios conservan orden y prioridades.
- Usar áreas táctiles de **48 × 48 px** como objetivo del producto. Una acción primaria por pantalla. Barra inferior, botón fijo y teclado deben respetar las zonas seguras y dejar visible el campo con foco. Las tablas se convierten en filas de dos líneas y detalles al tocar. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- Preparar variantes de carga, vacío, error, sin conexión, sin permiso, éxito, borrador, en revisión y cambios solicitados. Cada estado indica una acción posible. Conservar los datos escritos ante fallos de red y definir cómo se recupera un borrador.
- El QR debe tener alto contraste, margen blanco y alternativa en texto para copiar. La cámara ocupa el centro de la pantalla y se cierra al salir. La foto del lugar y sus detalles se abren desde una tarjeta compacta.

## Organización del archivo Figma y criterio de entrega

1. **Marca:** logotipo, paleta, fotografía, tipografía y ejemplos de voz.
2. **Sistema:** variables semánticas, marcos con Auto Layout, barra inferior, selector de espacios, botones, campos, fichas, estados, lector QR y recibo.
3. **Visitante:** explorar, guardados, puntos, perfil y flujo del QR.
4. **Negocios:** bar, hotel y equipo. Mostrar las tres pantallas de entrada juntas para comprobar que sus prioridades difieren.
5. **Guías y Socialité:** recorridos, editor de artículos, vista previa y bandeja de revisión.
6. **Administración:** solicitudes, cuentas, movimientos y analítica.
7. **Prototipos:** enlaces de los cinco flujos, variantes ES/EN y notas de qué pantallas usan datos conectados, requieren cambios de backend o son de fase posterior.

Para revisar el primer diseño, una persona debe identificar su espacio y su acción principal al entrar, distinguir un borrador de lo público y completar su tarea con una sola mano. Priorizar cuatro prototipos móviles para la primera ronda: **turista y caja**, **bar**, **hotel** y **periodista y editor**. Probar también al menos un estado vacío y un error en cada flujo. No subir a Figma datos ni credenciales de la operación real.
