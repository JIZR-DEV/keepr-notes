# Política de Privacidad — Keepr Notes

**Última actualización: 6 de junio de 2026**

## Resumen en una frase

Keepr Notes **no recopila, no transmite y no vende ningún dato**. Todo lo que escribes vive en tu propio navegador, en tu propio dispositivo.

## Qué es Keepr Notes

Keepr Notes es una extensión de navegador (Manifest V3) que te permite tomar notas con marca de tiempo (timestamp) mientras ves vídeos en YouTube. Está diseñada bajo un principio **local-first**: funciona enteramente en tu equipo, sin servidores, sin cuentas y sin conexión a servicios externos.

## Qué datos se procesan y dónde se guardan

Cuando usas Keepr Notes, la extensión guarda **localmente** en tu navegador la siguiente información:

- El texto de las notas que escribes.
- El segundo (timestamp) del vídeo asociado a cada nota.
- El identificador del vídeo de YouTube y su título, para poder agrupar y mostrar tus notas por vídeo.
- Tus preferencias de la extensión (por ejemplo, ajustes de visualización).

Todo esto se almacena mediante la API `chrome.storage.local` (o el equivalente en Firefox), que es **almacenamiento local de tu navegador**. Estos datos:

- **Nunca** salen de tu dispositivo por iniciativa de la extensión.
- **No** se envían a Keepr Notes, a sus desarrolladores ni a ningún tercero.
- **No** se sincronizan con ninguna nube (no usamos `chrome.storage.sync`).

## Qué datos NO recopilamos

Para que quede explícito, Keepr Notes **no** recopila ni procesa nada de lo siguiente:

- Información de identificación personal (nombre, correo, dirección).
- Credenciales de inicio de sesión (la extensión no tiene cuentas ni login).
- Tu historial de navegación o de vídeos vistos.
- Datos de salud, ubicación, contactos ni información financiera.
- Datos de analítica, telemetría, métricas de uso o seguimiento.
- Cookies de seguimiento o identificadores publicitarios.

## Uso de la red

Keepr Notes **no realiza peticiones de red propias**. No tiene un servidor backend. No hay endpoints a los que enviar datos. La extensión no descarga ni sube vídeos.

La única red que interviene es la del propio sitio web de YouTube, que tu navegador carga de forma normal cuando visitas la página; eso ocurre con o sin la extensión y queda fuera del control de Keepr Notes. La extensión únicamente lee el momento actual de reproducción del reproductor que ya está cargado en la pestaña.

## Exportación, copia de seguridad y restauración

Keepr Notes incluye funciones para **exportar** tus notas (a Markdown) y para hacer **copia de seguridad / restauración** (en JSON). Estas operaciones:

- Las inicias **tú** de forma manual.
- Generan archivos que se guardan **donde tú elijas** en tu disco, a través del cuadro de descarga/guardado de tu propio navegador.
- No envían nada a internet.

A partir del momento en que exportas o haces una copia de seguridad, **tú** eres el único responsable de esos archivos y de dónde los guardas o compartes.

## Permisos de la extensión

Keepr Notes solicita el **mínimo de permisos** necesarios para funcionar. La justificación detallada de cada permiso está en la sección 2 de este documento y en la ficha de la tienda. En resumen, los permisos se usan para guardar tus notas localmente, mostrar el panel lateral y operar dentro de las páginas de vídeo de YouTube. Ningún permiso se usa para recopilar ni transmitir datos.

## Compartir datos con terceros

**No compartimos datos con terceros**, porque no recopilamos datos. No hay anunciantes, ni proveedores de analítica, ni intermediarios de datos involucrados.

## Venta de datos

**No vendemos tus datos.** No los tenemos.

## Menores

Keepr Notes no recopila datos de ninguna persona, incluidos los menores. La extensión no pide ni almacena información personal.

## Seguridad

Como todos tus datos permanecen en tu dispositivo, su seguridad depende principalmente de la seguridad de tu propio equipo y navegador. Te recomendamos mantener tu sistema operativo y navegador actualizados y proteger el acceso físico a tu dispositivo. Si compartes o exportas tus archivos de copia de seguridad, hazlo por canales que consideres seguros.

## Eliminación de tus datos

Tú controlas tus datos en todo momento. Puedes eliminarlos así:

- Borrar notas individuales o por vídeo desde el panel de la extensión.
- Desinstalar la extensión: al hacerlo, el navegador elimina el almacenamiento local asociado a Keepr Notes.
- Usar las herramientas de tu navegador para borrar los datos de las extensiones.

Como no tenemos servidores, no hay copias en la nube que solicitar ni eliminar.

## Cambios en esta política

Si en el futuro cambiamos el funcionamiento de la extensión de forma que afecte a la privacidad (por ejemplo, añadir una función de sincronización opcional), actualizaremos esta política y la fecha de "Última actualización", y lo comunicaremos en la ficha de la tienda antes de que el cambio entre en vigor. Cualquier función que implique red o sincronización sería **opcional y desactivada por defecto**, y se describiría con claridad.

## Cumplimiento

Esta política se ofrece para cumplir con los requisitos de Chrome Web Store, Firefox Add-ons (AMO) y con normativas de privacidad como el RGPD (UE) y la CCPA (California). Dado que Keepr Notes no recopila ni procesa datos personales en sus servidores (no tiene servidores), no hay un "responsable del tratamiento" que gestione datos de usuario más allá de tu propio dispositivo.

## Contacto

Si tienes preguntas sobre esta política o sobre la privacidad en Keepr Notes, escribe a:
**joseignaciozavalarocha@gmail.com**
