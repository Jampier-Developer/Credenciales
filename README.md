# JampierDev · Bóveda

Gestor de contraseñas privado, local y cifrado. Sin backend, sin cuentas, sin servidores. Todo ocurre en tu navegador.

## Características

- Cifrado AES-GCM 256-bit con PBKDF2 (250.000 iteraciones)
- La contraseña maestra nunca se guarda en ningún lado
- Bloqueo automático por inactividad (5 min)
- Límite de intentos fallidos con cooldown de 5 minutos
- Categorías: Correos, Redes, Bancos, Streaming, Otros
- Generador de contraseñas seguras de 18 caracteres
- Copiar contraseñas al portapapeles (auto-borra a los 30s)
- Exportar e importar respaldo cifrado (JSON)
- Cambiar contraseña maestra sin perder datos
- Diseño responsive — funciona en móvil, tablet y desktop
- 100% offline — funciona sin conexión a internet

## Tecnologías

- HTML5 + CSS3 + JavaScript Vanilla
- Web Crypto API (nativa del navegador)
- localStorage para persistencia local

## Cómo usar

1. Abre `index.html` en tu navegador **o** visita la versión en GitHub Pages
2. La primera vez: crea tu contraseña maestra (mínimo 8 caracteres)
3. Agrega tus cuentas con el botón `+`
4. Tus datos quedan cifrados en tu dispositivo — nadie más puede acceder

## Seguridad

- Los datos se cifran con AES-GCM 256-bit antes de guardarse en localStorage
- La clave se deriva con PBKDF2 usando un salt aleatorio distinto por bóveda
- La contraseña maestra vive solo en memoria mientras la sesión está activa
- Al bloquear o cerrar la sesión, la clave se elimina de memoria

## Instalación local

```bash
git clone https://github.com/Jampier-Developer/Credenciales.git
cd Credenciales
# Abre index.html en tu navegador — no necesita servidor
```

## Autor

Jampier — [GitHub](https://github.com/Jampier-Developer)
