# JampierDev · Bóveda

Gestor de contraseñas privado, local y cifrado. Sin backend, sin cuentas, sin servidores. Todo ocurre en tu navegador.

## Características

- Cifrado AES-GCM 256-bit con PBKDF2 (250.000 iteraciones)
- La contraseña maestra nunca se guarda en ningún lado
- Bloqueo automático tras 5 intentos fallidos con cuenta regresiva de 5 min
- Modal de bloqueo levantado: avisa cuando ya puedes volver a intentar
- Cierre de sesión automático por 5 minutos de inactividad con modal informativo
- El formulario de nueva cuenta no se cierra al hacer clic afuera
- Categorías: Correos, Redes, Bancos, Streaming, Otros
- **Sesión persistente entre recargas**: F5 o recargar no cierra la sesión — solo cerrar la pestaña o bloquear manualmente la cierra
- **Cuentas favoritas**: marca con estrella y filtra por favoritas
- **Ordenar**: por fecha, A–Z o categoría
- **Historial de contraseñas**: guarda las últimas 3 por cuenta con opción a restaurar
- **Fecha de vencimiento**: alerta visual en rojo/amarillo cuando se acerca o ya venció
- **Vista cuadrícula o lista**: alterna entre tarjetas y filas compactas
- **Tema claro/oscuro**: toggle con botón, se guarda tu preferencia
- **Pantalla completa**: botón en el topbar
- **Contador de cuentas**: visible en el topbar
- **Doble clic en usuario** para copiarlo (vista cuadrícula)
- Generador de contraseñas seguras de 18 caracteres
- Copiar contraseñas al portapapeles (auto-borra a los 30s)
- Exportar e importar respaldo cifrado (JSON) con contraseña de respaldo protegida
- Cambiar contraseña maestra sin perder datos
- Responsive completo: móvil, tablet, desktop e iOS (safe-area, notch, home indicator)
- Modal de confirmación de borrado centrado en todas las pantallas
- 100% offline — funciona sin conexión a internet
- Invisible para buscadores (noindex, robots.txt, X-Robots-Tag)

## Tecnologías

- HTML5 + CSS3 + JavaScript Vanilla
- Web Crypto API (nativa del navegador)
- localStorage para persistencia local
- sessionStorage para mantener sesión entre recargas

## Cómo usar

1. Abre `index.html` en tu navegador **o** visita la versión desplegada
2. La primera vez: crea tu contraseña maestra (mínimo 8 caracteres)
3. Agrega tus cuentas con el botón `+`
4. Tus datos quedan cifrados en tu dispositivo — nadie más puede acceder

## Seguridad

- Los datos se cifran con AES-GCM 256-bit antes de guardarse en localStorage
- La clave se deriva con PBKDF2 usando un salt aleatorio distinto por bóveda
- La contraseña maestra vive solo en memoria mientras la sesión está activa
- La clave de sesión se guarda en sessionStorage (se borra al cerrar la pestaña)
- Al bloquear o cerrar la sesión, la clave se elimina de memoria y sessionStorage
- Exportar/Importar protegido con contraseña adicional (hash SHA-256, no visible en código)
- Invisible para motores de búsqueda

## Instalación local

```bash
git clone https://github.com/Jampier-Developer/Credenciales.git
cd Credenciales
# Abre index.html en tu navegador — no necesita servidor
```

## Autor

Jampier — [GitHub](https://github.com/Jampier-Developer)
