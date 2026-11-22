# Operación del piloto de La Vita

La base de datos, fotos y claves se guardan en `~/Library/Application Support/La Vita Runtime/.local-data`. La copia anterior en el proyecto se conserva como respaldo previo a la transición. El servicio usa una copia de ejecución fuera de Documentos, ya que macOS protege esa carpeta para procesos que inician en segundo plano.

Tras construir la web, sincronizar la copia de ejecución con `zsh scripts/sync-vita-runtime.sh`. Reiniciar solo los servicios que cambiaron con `launchctl kickstart -k gui/$(id -u)/app.roma-condesa.vita.backend` y el servicio equivalente `local`. La base debe permanecer en el puerto 8000 de loopback. La actualización de la interfaz pública se hace con el Worker de Cloudflare.

Los servicios supervisados se llaman `app.roma-condesa.vita.database`, `.local`, `.backend` y, cuando se configura, `.tunnel`. El respaldo se programa a las 04:00 del Mac. FileVault exige desbloquear el inicio después de un apagado completo.

## Túnel fijo

1. Autorizar Cloudflare Tunnel en `roma-condesa.app`. Crear el túnel local con nombre `la-vita-mac` y su ruta DNS `origin-vita.roma-condesa.app` mediante el conector oficial.
2. Ejecutar `scripts/configure-vita-tunnel.py` desde la copia de ejecución con la ruta al archivo privado de credenciales del túnel. Ejecutar `scripts/install-vita-services.py --node RUTA_NODE --install` desde esa copia.
3. Comprobar que la URL del origen fijo rechaza las solicitudes sin clave y responde al Worker con la clave. Cambiar únicamente `BACKEND_ORIGIN` del Worker a la dirección fija y repetir las pruebas de sesión. Mantener el túnel temporal hasta comprobar el acceso público a través del fijo. Guardar el identificador de la versión anterior para revertir si se necesita.

## Cuentas y fidelidad

Crea una cuenta en `http://localhost:4173/cuenta?view=registro`. El código de seis dígitos está en `http://localhost:4173/dev/mail`, vence en diez minutos y solo se usa una vez. Al entrar al perfil se puede reclamar una sola vez el bono de bienvenida de diez puntos del programa de prueba. No cuenta como visita. Para dar acceso de negocio a una cuenta de prueba verificada, ejecutar `node scripts/loyalty-pilot.mjs correo@example.test`. La cuenta de negocio se asigna al programa de prueba. También puede dar acceso de equipo a otra cuenta verificada desde Mi cuenta. Los puntos son persistentes y los beneficios del negocio de prueba no tienen valor comercial.

`support@roma-condesa.app` es el correo que recibe los tickets y la única cuenta que puede ejercer permisos de administrador. Tras verificar esa cuenta en La Vita, asignarle el rol con `node scripts/local-operator.mjs admin`. Configurar el doble factor en Mi cuenta antes de abrir las métricas o aprobar contenido.

## Respaldo y restauración

`scripts/backup-vita.py` usa una instantánea en línea de la base local y copia fotos al directorio `backups/scheduled`. No copia las claves del puente. Para verificar la restauración, copiar la instantánea a una carpeta aislada, levantar DynamoDB Local con ese directorio y otro puerto de loopback y consultar los datos restaurados. Antes de restaurar en producción, detener los servicios que escriben, respaldar el estado actual y conservar ambas copias.

## Habilitar registro público con correo

La pantalla publicada muestra las pestañas **Regístrate** y **Login**. La primera habilita el formulario cuando el servicio tiene configurado el remitente. Crear el buzón `noreply@roma-condesa.app` en Hostinger Mail y ejecutar `scripts/configure-transactional-mail.command` en el Mac. El script pide la contraseña sin mostrarla, comprueba la conexión segura al servidor de correo de Hostinger y guarda el acceso fuera del repositorio.

Después de configurar, reiniciar `app.roma-condesa.vita.backend`, comprobar la opción de registro y realizar un alta con un correo autorizado de prueba. El código de seis dígitos se entrega por correo desde La Vita; el buzón de desarrollo queda restringido al acceso local.
