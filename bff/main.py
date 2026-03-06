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
import siren_pb2

app = FastAPI(title="Aegis Shell BFF", version="0.1.0")


# Models
class AuthRequest(BaseModel):
    tenant_id: str
    session_key: str


class AdminSetupRequest(BaseModel):
    username: str
    passphrase: str


class TenantCreateRequest(BaseModel):
    admin_tenant_id: str
    admin_session_key: str
    username: str


class PasswordResetRequest(BaseModel):
    tenant_id: str
    admin_tenant_id: str
    admin_session_key: str
    new_passphrase: str


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
        print(
            f"DEBUG: Handshake failed for tenant '{auth.tenant_id}'. gRPC Code: {e.code()}, Details: {e.details()}"
        )
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


@app.post("/api/admin/setup")
async def setup_admin(req: AdminSetupRequest):
    client = AnkClient()
    try:
        response = await client.initialize_master_admin(req.username, req.passphrase)
        return response
    except grpc.RpcError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Admin Setup Error: {e.details()}",
        )


@app.post("/api/admin/tenant")
async def create_tenant(req: TenantCreateRequest):
    client = AnkClient()
    try:
        response = await client.create_tenant(
            req.username, req.admin_tenant_id, req.admin_session_key
        )
        return response
    except grpc.RpcError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Create Tenant Error: {e.details()}",
        )


@app.post("/api/admin/reset_password")
async def reset_password(req: PasswordResetRequest):
    client = AnkClient()
    try:
        await client.reset_tenant_password(
            req.tenant_id,
            req.new_passphrase,
            req.admin_tenant_id,
            req.admin_session_key,
        )
        return {"success": True, "message": "Password reset successful"}
    except grpc.RpcError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset Password Error: {e.details()}",
        )


@app.get("/api/system/state")
async def get_public_system_state():
    client = AnkClient()
    try:
        # Call without credentials to check if Kernel is initialized.
        status_data = await client.get_system_status()
        return {"state": status_data.get("state", "STATE_OPERATIONAL")}
    except grpc.RpcError as e:
        # If it returns UNAUTHENTICATED, it means it's OPERATIONAL and expects real creds.
        if e.code() == grpc.StatusCode.UNAUTHENTICATED:
            return {"state": "STATE_OPERATIONAL"}
        # Any other error suggests initializing or server issue.
        return {"state": "STATE_INITIALIZING", "error": str(e.details())}
    except Exception as e:
        return {"state": "STATE_OPERATIONAL", "error": str(e)}


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
            # Recibir mensaje del Frontend (ej. un prompt de usuario o un comando 'watch')
            data = await websocket.receive_json()
            action = data.get("action", "submit")

            if action == "watch":
                pid = data.get("pid")
                if not pid:
                    await websocket.send_json(
                        {"event": "error", "data": "Missing pid for watch action"}
                    )
                    continue

                await websocket.send_json(
                    {
                        "event": "status",
                        "data": f"Watching Task PID: {pid}",
                        "pid": pid,
                    }
                )

                try:
                    async for event in client.watch_task(pid, tenant_id, session_key):
                        await websocket.send_json(
                            {"event": "kernel_event", "data": event}
                        )

                        if "status_update" in event:
                            state = event["status_update"].get("state")
                            if state in ["STATE_COMPLETED", "STATE_TERMINATED"]:
                                break
                except Exception as e:
                    await websocket.send_json(
                        {
                            "event": "error",
                            "data": f"Kernel communication error: {str(e)}",
                        }
                    )

            else:
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
                        await websocket.send_json(
                            {"event": "kernel_event", "data": event}
                        )

                        if "status_update" in event:
                            state = event["status_update"].get("state")
                            if state in ["STATE_COMPLETED", "STATE_TERMINATED"]:
                                break

                except Exception as e:
                    await websocket.send_json(
                        {
                            "event": "error",
                            "data": f"Kernel communication error: {str(e)}",
                        }
                    )

    except WebSocketDisconnect:
        print(f"Client disconnected: {tenant_id}")
    except Exception as e:
        print(f"BFF Error: {e}")
    finally:
        pass


@app.websocket("/ws/siren/{tenant_id}")
async def websocket_siren_endpoint(
    websocket: WebSocket, tenant_id: str, session_key: str = Query(...)
):
    """
    Siren Protocol Bridge: Bi-directional Audio Streaming.
    Passthrough binary pipe from WS to gRPC.
    """
    await websocket.accept()
    client = AnkClient()

    # 1. Citadel Security Handshake
    try:
        await client.get_system_status(tenant_id, session_key)
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.UNAUTHENTICATED:
            await websocket.send_json({"event": "error", "data": "Siren Auth Failed"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # 2. Async Generator (WS -> gRPC)
    async def audio_chunk_generator():
        seq = 0
        try:
            while True:
                # El frontend envía chunks de audio binarios
                data = await websocket.receive_bytes()
                seq += 1
                yield siren_pb2.AudioChunk(
                    sequence_number=seq,
                    data=data,
                    format="pcm_16khz_16bit",  # Default standard para Aegis
                )
        except WebSocketDisconnect:
            # La desconexión del WS cerrará el generador y cancelará el gRPC
            print(f"Siren Stream: WebSocket closed for {tenant_id}")
        except Exception as e:
            print(f"Siren Generator Error: {e}")

    # 3. Stream Controller (Pipe execution)
    try:
        # Iniciamos el stream bi-direccional.
        # Python gRPC asincrónico consumirá audio_chunk_generator concurrentemente.
        async for event in client.siren_stream(
            tenant_id, session_key, audio_chunk_generator()
        ):
            # Retransmitimos eventos del Kernel al Frontend vía WS
            await websocket.send_json({"event": "siren_event", "data": event})

    except grpc.RpcError as e:
        # SRE Focus: Manejo de errores de gRPC (Ej: Kernel saturado o caído)
        print(f"Siren gRPC Error: {e.code()} - {e.details()}")
        if e.code() == grpc.StatusCode.RESOURCE_EXHAUSTED:
            await websocket.send_json({"error": "Kernel Overloaded"})
        else:
            await websocket.send_json({"error": f"Kernel Stream Error: {e.code()}"})
    except Exception as e:
        print(f"Siren Pipe Error: {e}")
    finally:
        # El generador y el stream gRPC se limpian automáticamente
        # al salir del bucle 'async for' o al cerrarse el WebSocket.
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close()


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
