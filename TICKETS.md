# 🗺️ Aegis Shell Project Tracking (Kanban)

## 🟩 DONE
*   **[SH-100] Setup del Workspace (Vite + FastAPI)**
    *   *Completado:* Estructura de carpetas, dependencias base y UI entry screen.
*   **[SH-101] El Puente gRPC (FastAPI BFF)**
    *   *Completado:* Cliente gRPC asíncrono y WebSocket bridge funcionando.
*   **[SH-102] El Store Reactivo (Zustand & WebSockets)**
    *   *Completado:* Store global con soporte para streaming de alta frecuencia y orquestación de mensajes.
*   **[SH-103] Aegis Terminal (Main UI & Markdown)**
    *   *Completado:* Interfaz de chat con Markdown, Smart Scrolling y renderizado condicional de pensamientos.
*   **[SH-104] Telemetría y The Orb (System Status)**
    *   *Completado:* Implementación de The Orb, Telemetry Sidebar y desacoplamiento de métricas vía HTTP Polling.
*   **[SH-105] Citadel Auth (Login)**
    *   *Completado:* Sistema de autenticación de tres capas (React/SHA-256 -> FastAPI/Pydantic -> Rust/gRPC) con validación pre-flight.
*   **[SH-106] Hotfix: UI & BFF Stability**
    *   *Completado:* Corrección de errores de sintaxis en ChatTerminal, limpieza de imports y manejo de excepciones en AnkClient.
*   **[SH-121] Siren Protocol: WebSocket Bridge (Capacidad Auditiva)**
    *   *Completado:* Implementación de pasarela asíncrona bi-direccional gRPC/WebSocket con control de backpressure y cancelación SRE.
*   **[SH-122] Siren Event Handling & UI Orchestration**
    *   *Completado:* Orquestación de telemetría de voz (VAD_START, STT_DONE), inyección de transcripción al chat y enrutamiento del BFF para acciones `watch`.
*   **[SH-120] Siren Web API: Frontend Audio Capture (Capacidad Auditiva)**
    *   *Completado:* Captura de audio Raw PCM 16kHz en el navegador, conversión Float32 a Int16 y streaming vía WebSocket dedicado.
*   **[SH-107] Production Readiness: BFF Static Serving**
    *   *Completado:* Soporte para servir el build de React (`dist`) desde FastAPI y enrutamiento SPA (catch-all).
*   **[SH-108] Security: Repository Protection (.gitignore)**
    *   *Completado:* Implementación de reglas de exclusión para proteger secretos, claves y artefactos de compilación.
*   **[SH-109] Identity & Access Management (Admin Dashboard)**
    *   *Completado:* Sistema de inicialización Zero-Knowledge, generador de enclaves (Tenants) por puerto y rotación forzada de contraseñas.
*   **[SH-110] DevTools: Aegis Code Bundler (GitHub Actions)**
    *   *Completado:* Workflow de GitHub Actions para empaquetar el código fuente relevante en un único archivo de texto para análisis LLM.

## 🟦 IN PROGRESS
*   (All current core tickets completed)

## 🟥 TO DO

### EPIC 3: Autenticación
*   (Completar EPIC 1 y 2 antes de añadir más tareas)

### Notas Técnicas Cross-Repo
*   📝 **NOTA TÉCNICA (Siren)**: El contrato gRPC del `SirenService` ha sido desplegado y está operativo en el Kernel (ANK v1.2.0). Esto habilita oficialmente el inicio de los tickets **[SH-120]** y **[SH-121]** relacionados con la Capacidad Auditiva.
