# CHANGELOG: Aegis Shell

### [SH-123] Gapless TTS Playback (Web Audio API) - 2026-03-06
- 🔊 **Voice Synthesis**: Creación de `TTSPlayer.ts`, una utilidad pura de Web Audio API para reproducción ininterrumpida de los buffers generados por el Kernel.
- 🧮 **Float32 Direct Memory**: Implementado decoding ultra-rápido en frontend (Base64 -> Uint8Array -> Int16Array -> Float32Array) para cumplir estigmas del Kernel.
- ⏱️ **Jitter Resilience**: Integrado el patrón de "*Mathematical Scheduling*" para re-sincronizar el reloj de reproducción `nextStartTime` cuando la red introduce latencia, añadiendo un safe-buffer de 50ms.
- 🔓 **Autoplay Unlocker**: Sistema automatizado dentro del store Zustand (`useAegisStore.ts`) para reactivar silenciosamente el `AudioContext` en el primer evento natural del usuario (enviar chat o activar micrófono), saltando los bloqueos silentes de los navegadores.

### [SH-122] Siren Event Handling & UI Orchestration - 2026-03-06
- 📡 **BFF Chat WebSocket**: Añadido soporte para comandos de acción específicos (`submit` y `watch`).
- 🤖 **Enrutamiento Asíncrono de Tareas**: La UI ahora puede suscribirse a un PID existente generado vía STT (Siren), integrando la voz de un extremo al otro como comando reactivo.
- 🎨 **Visual State (The Orb)**: Actualizado Zustand (`useAegisStore.ts`) para interpretar la telemetría de Siren (`VAD_START`, `STT_START`) y cambiar el estado del terminal (`listening`, `transcribing`).
- 📝 **STT Auto-Injection**: Al recibir `STT_DONE`, la terminal inyecta la transcripción de Whisper en el historial del usuario como si hubiera sido escrita y comienza la suscripción al PID resultante.

### [SH-120] Siren Web API: Frontend Audio Capture - 2026-03-05
- 🎤 Implementada captura de audio **Raw PCM (16kHz, 16-bit, Mono)** directamente desde el navegador.
- 🧪 Añadida lógica de conversión optimizada de `Float32` a `Int16` para cumplir con los requisitos del Kernel.
- 📡 Integración con **Zustand**: Nuevo estado `isRecording` y orquestación automática de WebSockets dedicados para audio.
- 🎨 UI mejorada: Botón de micrófono con feedback visual (animaciones de pulso) y manejo elegante de permisos de hardware.
- 🛡️ **SRE Resilience**: Captura de errores de `getUserMedia` y limpieza automática del `AudioContext` para prevenir fugas de memoria.

### [SH-121] Siren Protocol: BFF-Kernel Audio Bridge - 2026-03-05
- 📡 Implementado el **Tubo de Pasarela (Dumb Pipe)** para el protocolo Siren, permitiendo streaming de audio bidireccional de baja latencia (<5ms).
- 🔌 Creado el endpoint WebSocket `/ws/siren/{tenant_id}` para la ingesta de audio binario desde el navegador.
- 🏗️ Extendido `AnkClient` con soporte para el `SirenService` de gRPC, utilizando generadores asíncronos para el manejo eficiente del backpressure.
- 🛡️ **SRE Resilience**: Implementado sistema de cancelación cruzada (`call.cancel()`) para liberar recursos del Kernel ante desconexiones accidentales o cierres de pestaña.
- 📦 Generados bindings de Python para `siren.proto` y sincronizados con la definición oficial del Kernel (ANK v1.2.0).
- 🧪 Manejo robusto de excepciones gRPC, incluyendo retransmisión de estados de saturación (`RESOURCE_EXHAUSTED`) hacia la UI.

### [SH-110] DevTools: Aegis Code Bundler - 2026-03-05
- 📦 Creado workflow de **GitHub Actions** (`aegis-shell-code-bundler.yml`) para empaquetar el código fuente relevante.
- 📄 Salida automática a `AegisShellCode.txt` incluyendo lógica de **BFF**, componentes de **UI**, **Protocols** y documentación.
- 🛡️ Implementado filtrado inteligente para excluir archivos generados (`pb2.py`), binarios y dependencias (`node_modules`).
- 🚀 Soporte para ejecución manual (`workflow_dispatch`) y automática en `push` a `main`.


### [SH-109] Identity & Access Management - 2026-03-04
- 🛠️ Interfaz actualizada con pantalla de `AdminSetupScreen` para la configuración inicial del enclave (Zero-Knowledge mode).
- 🧑‍💻 Añadido el `AdminDashboard` para que el Master Admin pueda "Forjar nuevos Tenants" generando conexiones segregadas a puertos y contraseñas temporales.
- 🔐 Implementado el `ForcePasswordChangeScreen` para requerir el cambio de claves temporales obligando a una rotación de contraseñas de primer inicio.
- 📡 Backend modificado con endpoints para crear tenants, rotar claves, configurar la inicialización y recuperar el estado público del endpoint (`system_status`).


### [SH-108] Security: Repository Protection - 2026-03-04
- 🛡️ Creado `.gitignore` robusto para prevenir la subida accidental de datos sensibles.
- 🔐 Excluidos archivos de entorno (`.env*`), claves privadas (`.key`, `.pem`) y bases de datos locales.
- 🧹 Filtrado de artefactos de compilación para **Vite/React** (`node_modules`, `dist`) y **FastAPI/Python** (`__pycache__`, `venv`).
- 📂 Protegidos directorios de configuración de IDEs y logs de sistema.

### [SH-107] Production Readiness: BFF Static Serving - 2026-03-04
- 🏭 Configurado el servidor **FastAPI** para servir archivos estáticos desde `../ui/dist` en la raíz `/`.
- ⚓ Implementado **SPA Catch-all routing** para redirigir rutas no definidas (ej. `/login`, `/dashboard`) al `index.html` de React.
- ⚡ Añadido montaje optimizado de `/assets` vía `StaticFiles` para mejorar el rendimiento de entrega.
- 🚀 Desactivado `reload=True` de Uvicorn por defecto para mejorar la estabilidad en producción.
- 🛡️ Protegido el flujo de API/WS: El catch-all no intercepta rutas `/api` o `/ws` inexistentes (devuelve 404 real).

### [SH-106] Hotfix: UI & BFF Stability - 2026-03-04
- 🛠️ Corregidos errores críticos de sintaxis JSX en **ChatTerminal.tsx** (unclosed div).
- 🧩 Reorganizado **ChatTerminal.tsx**: componentes internos movidos al top para corregir errores de scoping (used before defined).
- 🛡️ Añadido bloque `except` faltante en `AnkClient.watch_task` para prevenir crashes silenciosos.
- 🧹 Limpieza de imports no utilizados en `main.py` y componentes UI.
- 🚀 Mejorada la consistencia de tipos en el frontend para evitar errores de parseo en tiempo de compilación.

### [SH-105] Citadel Auth (Login) - 2026-03-02
- 🔐 Implementado sistema de autenticación de **Zero-Knowledge** usando SHA-256 en el frontend.
- 🔑 Creada **LoginScreen** con diseño Glassmorphism y animaciones de "Desbloqueo".
- 🛡️ Implementado **Identity Provider** en el BFF con validación gRPC pre-flight contra el Kernel.
- 🔄 Integración total: El hash de la passphrase se usa para desbloquear el Kernel (citadel_key).

### [SH-104] Telemetría y The Orb - 2026-03-02
- 🔮 Implementado **"The Orb"**, interfaz de estado reactiva con animaciones de Framer Motion.
- 📊 Creada **TelemetrySidebar** con monitoreo de CPU, VRAM y nodos activos.
- 📡 Implementada arquitectura de **HTTP Polling (3s)** para desacoplar métricas del WebSocket.
- 🔌 Añadido endpoint `/api/status` en el BFF y soporte gRPC en el cliente.

### [SH-103] Aegis Terminal (Main UI) - 2026-03-02
- 🖥️ Construida interfaz de Chat con soporte para Markdown y renderizado condicional.
- 📜 Implementada lógica de **Smart Auto-Scroll** para mejorar la UX durante el streaming.
- 🎨 Diseño Cyber-Minimalism con soporte para pensamientos (CoT) y logs de sistema.

### [SH-102] El Store Reactivo (Zustand) - 2026-03-02
- 🧠 Implementado `useAegisStore` para gestión de estado global y WebSockets.
- ⚡ Optimización de `appendToken` para streaming de alta frecuencia (SRE Level).
- 🔄 Orquestación automática de estados del Kernel (Idle, Thinking, Error).

### [SH-101] El Puente gRPC (BFF) - 2026-03-02
- 🛰️ Implementado `AnkClient` asíncrono (`grpc.aio`) para comunicación con el Kernel.
- 🔌 Creado endpoint WebSocket `/ws/chat/{tenant_id}` para streaming bidireccional en tiempo real.
- 🛡️ Soporte nativo para metadatos del Protocolo Citadel (`tenant_id`, `session_key`).
- ⚡ Orquestación completa: Recepción de prompt -> `SubmitTask` -> `WatchTask` -> Forwarding a UI.
- 📄 Importado `kernel.proto` desde el repositorio del Kernel.

### [SH-100] Setup del Workspace - 2026-03-02
- ✨ Inicializada estructura monorepo: `ui/` (React/Vite) y `bff/` (FastAPI).
- 🛠️ Configurado `package.json` con React 18, Zustand, Framer Motion, Tailwind CSS y Lucide Icons.
- 🎨 Implementado sistema de diseño "Cyber-Minimalism" en `tailwind.config.ts`.
- 🌉 Configurado `requirements.txt` en el BFF con gRPC y FastAPI.
- 🚀 Creado punto de entrada `App.tsx` con estética Glassmorphism y animaciones fluidas.
- 📡 Configurado Proxy en Vite para redirección al BFF en `localhost:8000`.
