# 🖥️ Aegis Shell - Architecture Manifesto

## 1. Visión General
**Aegis Shell** es la capa de presentación (Frontend) del ecosistema Aegis. De cara al usuario, el producto se denomina simplemente **"Aegis"**.
Su función es actuar como un **Thin Client (Cliente Ligero)**. La Shell NO tiene base de datos persistente propia, NO procesa lógica de Inteligencia Artificial y NO ejecuta comandos del sistema operativo host. Toda la carga cognitiva, ejecución y persistencia segura recae en el **Aegis Neural Kernel (ANK)** (que corre en el puerto `50051`).

## 2. Stack Tecnológico (The BFF Pattern)
La arquitectura sigue el patrón **Backend For Frontend (BFF)** para aislar la complejidad de gRPC y proteger la comunicación entre el navegador web y el Kernel en Rust.

*   **Frontend (UI):** React 18+ empaquetado con Vite.
*   **Estilos:** Tailwind CSS + Framer Motion (Animaciones fluidas y Glassmorphism).
*   **Gestión de Estado:** Zustand (Para manejar el stream asíncrono de mensajes sin re-renderizados costosos).
*   **BFF (Proxy Bridge):** Un micro-servidor en Python (FastAPI).
    *   *Rol del BFF:* Mantiene un WebSocket abierto con React. Cuando recibe una petición de React, la traduce a un comando gRPC inyectando las credenciales de Citadel (`tenant_id` y `session_key`), llama al Kernel (ANK), y hace un *stream* de la respuesta gRPC de vuelta al WebSocket en tiempo real.

## 3. Lenguaje de Diseño (Aegis Cyber-Minimalism)
La interfaz debe reflejar tecnología de punta y máxima fluidez:
*   **Tema:** Dark Mode puro (`#000000` a `#0d1117`).
*   **Acentos:** Cyan neón (`#00f2fe`) y Púrpura cuántico (`#bf00ff`).
*   **Tipografía:** Fuentes monoespaciadas (`JetBrains Mono` o `Fira Code`) para código y telemetría; tipografía limpia (`Inter`) para el texto general.
*   **Feedback Visual:** Cero latencia. Si el Kernel está evaluando en Ring 0 o buscando en LanceDB, la UI debe mostrar un indicador de estado en tiempo real.

## 4. Arquitectura Multi-Tenant (Protocolo Citadel)
Aegis es un sistema multi-usuario con privacidad estricta.
*   **Gestor de Identidades (BFF):** El backend en FastAPI gestiona el login.
*   **Derivación de Llaves:** Al iniciar sesión, se deriva una `session_key` a partir de la contraseña del usuario. Esta llave solo vive en la RAM del BFF.
*   **Comunicación Segura:** El BFF inyecta el `tenant_id` y la `session_key` en los metadatos gRPC (`x-aegis-tenant-id`) para autorizar la petición contra el Kernel de Rust, asegurando que el Kernel abra el enclave correcto.