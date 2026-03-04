import os
from pydantic import BaseModel
from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
    status,
)
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from ank_client import AnkClient
import uvicorn
import grpc

app = FastAPI(title="Aegis Shell BFF", version="0.1.0")


# Models
class AuthRequest(BaseModel):
    tenant_id: str
    session_key: str


# Configurar CORS para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "Aegis BFF Online", "version": "0.1.0"}


@app.post("/api/auth/login")
async def login(auth: AuthRequest):
    """
    Identity Provider: Validates credentials by performing a pre-flight
    gRPC call to the Aegis Neural Kernel.
    """
    client = AnkClient()
    try:
        # Intentamos obtener el status del sistema usando las credenciales.
        # Si el Kernel (Rust) las rechaza, lanzará un error de gRPC.
        await client.get_system_status(auth.tenant_id, auth.session_key)

        return {"message": "Citadel Handshake Successful", "status": "authenticated"}

    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.UNAUTHENTICATED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Citadel Protocol: Access Denied. Invalid tenant or session key.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kernel Handshake Error: {str(e.details())}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BFF Auth Error: {str(e)}",
        )


@app.get("/api/status")
async def get_system_status(tenant_id: str, session_key: str = Query(...)):
    """
    HTTP Poll endpoint for system telemetry.
    Decoupled from chat WebSocket to prevent congestion.
    """
    client = AnkClient()
    try:
        status_data = await client.get_system_status(tenant_id, session_key)
        return status_data
    except Exception as e:
        return {
            "error": str(e),
            "cpu_load": 0,
            "vram_allocated_mb": 0,
            "vram_total_mb": 100,
        }


@app.websocket("/ws/chat/{tenant_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket, tenant_id: str, session_key: str = Query(...)
):
    """
    Main WebSocket endpoint for Aegis Shell communication.
    Translates browser JSON messages to gRPC calls to the Kernel.
    """
    await websocket.accept()

    client = AnkClient()

    # 0. Pre-Handshake: Validate with the Kernel during connection
    try:
        await client.get_system_status(tenant_id, session_key)
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.UNAUTHENTICATED:
            await websocket.send_json(
                {"event": "error", "data": "Citadel AUTH_FAILURE: Access Denied."}
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # Notificar conexión exitosa al frontend
    await websocket.send_json(
        {
            "event": "syslog",
            "data": f"Aegis Shell established secure bridge for tenant: {tenant_id}",
        }
    )

    try:
        while True:
            # Recibir mensaje del Frontend (ej. un prompt de usuario)
            data = await websocket.receive_json()
            prompt = data.get("prompt")

            if not prompt:
                await websocket.send_json(
                    {"event": "error", "data": "Empty prompt received"}
                )
                continue

            # 1. Enviar el TaskRequest al Kernel (ANK)
            await websocket.send_json(
                {"event": "status", "data": "Submitting task to ANK..."}
            )

            try:
                pid = await client.submit_task(prompt, tenant_id, session_key)
                await websocket.send_json(
                    {
                        "event": "status",
                        "data": f"Task accepted. PID: {pid}",
                        "pid": pid,
                    }
                )

                # 2. Suscribirse al stream de eventos del proceso
                async for event in client.watch_task(pid, tenant_id, session_key):
                    # Retransmitir cada evento del Kernel (Thought, Output, Syscall) al UI
                    await websocket.send_json({"event": "kernel_event", "data": event})

                    # Si el evento indica que el proceso terminó, salimos del loop de watch
                    # Nota: El objeto 'event' procesado por AnkClient es el dict de TaskEvent
                    if "status_update" in event:
                        state = event["status_update"].get("state")
                        if state in ["STATE_COMPLETED", "STATE_TERMINATED"]:
                            break

            except Exception as e:
                await websocket.send_json(
                    {"event": "error", "data": f"Kernel communication error: {str(e)}"}
                )

    except WebSocketDisconnect:
        print(f"Client disconnected: {tenant_id}")
    except Exception as e:
        print(f"BFF Error: {e}")
    finally:
        pass


# --- SPA Serving Logic (Production) ---
UI_DIST_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "ui", "dist")
)

# Montar carpeta de assets para optimización si existe
assets_path = os.path.join(UI_DIST_PATH, "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Catch-all para servir la aplicación React.
    Prioriza archivos físicos si existen, de lo contrario sirve index.html.
    """
    # No interceptar llamadas a API o WS que no fueron capturadas arriba (daría 404 real)
    if full_path.startswith("api") or full_path.startswith("ws"):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": f"Aegis BFF: Endpoint '{full_path}' not found."},
        )

    # Intentar servir archivo estático (ej. favicon.ico, manifest.json)
    file_path = os.path.join(UI_DIST_PATH, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # Fallback a index.html para que el Router de React tome el control
    index_html = os.path.join(UI_DIST_PATH, "index.html")
    if os.path.exists(index_html):
        return FileResponse(index_html)

    # Si ni siquiera el index existe, avisar que falta el build
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "UI Distribution not found. Run 'npm run build' in the /ui directory first."
        },
    )


if __name__ == "__main__":
    # Nota: reload=False para producción
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
