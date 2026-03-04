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
*   **[SH-107] Production Readiness: BFF Static Serving**
    *   *Completado:* Soporte para servir el build de React (`dist`) desde FastAPI y enrutamiento SPA (catch-all).
*   **[SH-108] Security: Repository Protection (.gitignore)**
    *   *Completado:* Implementación de reglas de exclusión para proteger secretos, claves y artefactos de compilación.
*   **[SH-109] Identity & Access Management (Admin Dashboard)**
    *   *Completado:* Sistema de inicialización Zero-Knowledge, generador de enclaves (Tenants) por puerto y rotación forzada de contraseñas.

## 🟦 IN PROGRESS
*   (All current core tickets completed)

## 🟥 TO DO

### EPIC 3: Autenticación
*   (Completar EPIC 1 y 2 antes de añadir más tareas)
    