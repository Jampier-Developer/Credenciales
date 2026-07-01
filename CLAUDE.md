# JampierDev · Bóveda — Contexto del proyecto

## ¿Qué es este proyecto?
Aplicación web de gestor de contraseñas personal (bóveda privada) llamada **JampierDev Bóveda**.
Es una SPA (Single Page Application) 100% del lado del cliente, sin backend, que cifra todas las credenciales con AES-GCM 256-bit usando la Web Crypto API del navegador.

## Stack técnico
- **HTML5** + **CSS3** + **JavaScript Vanilla (ES2020+)**
- **Web Crypto API**: PBKDF2 (250.000 iteraciones, SHA-256) → AES-GCM 256-bit
- **localStorage** para persistencia (fallback a memoria en entornos sandbox/CSP)
- Sin dependencias externas de JS (solo Google Fonts: Syne, Sora, JetBrains Mono)
- Desplegable en GitHub Pages como sitio estático

## Estructura de archivos
```
index.html          — HTML principal (gate de login + app interior)
css/styles.css      — Estilos completos (dark theme, responsive mobile-first)
js/app.js           — Toda la lógica: cripto, UI, estado, CRUD de cuentas
img/Seguridad.png   — Favicon / ícono de la app
CLAUDE.md           — Este archivo: contexto del proyecto para Claude
README.md           — Documentación pública del repositorio
```

## Funcionalidades actuales (última actualización: 2026-07-01)

### Gate (pantalla de acceso)
- **Setup (primera vez)**: Crear contraseña maestra con medidor de fuerza (muy débil → excelente)
- **Unlock**: Desbloqueo con contraseña maestra; verificación deliberada de ~5 segundos (frena brute-force)
- **Intentos fallidos**: Máx. 5 intentos → bloqueo de 5 minutos con cuenta regresiva
- **Auto-bloqueo**: 5 minutos de inactividad → bloquea automáticamente la bóveda

### App (bóveda interior)
- **CRUD de cuentas**: Agregar, editar y eliminar entradas
- **Categorías**: Correos, Redes sociales, Bancos, Streaming, Otros — con íconos SVG y colores propios
- **Campos por cuenta**: Título, Usuario/correo, Contraseña/PIN, Enlace, Notas
- **Búsqueda en tiempo real**: Filtra por título, usuario, URL, notas y categoría
- **Chips de filtro**: Por categoría con contador de entradas
- **Copiar al portapapeles**: Contraseñas se auto-borran del clipboard a los 30 segundos
- **Ver/Ocultar contraseña**: Toggle visual por cada tarjeta
- **Generador de contraseñas**: 18 caracteres (letras, números, símbolos, garantizando variedad)
- **Exportar respaldo**: Descarga un JSON cifrado con salt + vault (portátil y seguro)
- **Importar respaldo**: Carga un JSON de respaldo, reemplaza la bóveda actual
- **Cambiar contraseña maestra**: Re-cifra toda la bóveda con nueva clave y nuevo salt
- **Bloquear**: Botón en topbar y en menú; borra la clave de memoria (nunca persistida)

### UX / Diseño
- **Dark theme**: Fondo `#07060c`, orbs animados dorado/púrpura, grid sutil, ruido de textura
- **Glassmorphism**: Paneles con `backdrop-filter: blur`
- **Responsive**: Mobile-first con soporte de `safe-area-inset` para iOS
- **Animaciones**: Cards con `cardin`, modales con `modalin`, toasts con animación de entrada/salida
- **Toasts**: Mensajes de feedback (ok / err / info) que se auto-descartan a los 2.6 segundos
- **Modales**: Add/Edit de cuenta, confirmación de borrado, cambio de contraseña, importar respaldo

## Repositorio GitHub
`https://github.com/Jampier-Developer/Credenciales.git`
Branch principal: `main`

---

## Triggers / Comandos especiales para Claude

### Cuando el usuario escriba "continuemos"
1. Lee este `CLAUDE.md` para entender el estado actual del proyecto
2. Lee `index.html`, `css/styles.css` y `js/app.js` para ver la última versión del código
3. Continúa editando desde donde se dejó — NO pidas que se explique el proyecto desde cero
4. Si hay algo poco claro, pregunta solo lo que sea estrictamente necesario

### Cuando el usuario escriba "actualiza todo"
Ejecuta estos pasos EN ORDEN:
1. **Primero** — Actualiza `README.md` con el estado actual: features implementadas, stack, instrucciones de uso e instalación
2. **Segundo** — Actualiza este `CLAUDE.md`: edita la sección "Funcionalidades actuales" con los últimos cambios y actualiza la fecha
3. **Tercero** — Ejecuta:
   ```bash
   git add .
   git commit -m "chore: actualizar README y CLAUDE + últimos cambios"
   git push origin main
   ```
