import { create } from 'zustand';
import { ttsPlayer } from '../audio/TTSPlayer';

export type MessageType = 'text' | 'thought' | 'system' | 'error';
export type SystemStatus = 'disconnected' | 'connecting' | 'idle' | 'thinking' | 'executing_syscall' | 'error' | 'listening' | 'transcribing';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    type: MessageType;
    timestamp: number;
}

export interface SystemMetrics {
    cpu_load: number;
    vram_allocated_mb: number;
    vram_total_mb: number;
    total_processes: number;
    active_workers: number;
}

interface AegisState {
    // State
    messages: Message[];
    status: SystemStatus;
    system_metrics: SystemMetrics;
    socket: WebSocket | null;
    activePid: string | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    systemState: 'STATE_INITIALIZING' | 'STATE_OPERATIONAL' | 'UNKNOWN';
    tenantId: string | null;
    sessionKey: string | null;
    isRecording: boolean;
    sirenSocket: WebSocket | null;

    // Actions
    connect: (tenantId: string, sessionKey: string) => void;
    disconnect: () => void;
    sendMessage: (prompt: string) => void;
    appendToken: (msgId: string, token: string, type: MessageType) => void;
    setStatus: (status: SystemStatus) => void;
    clearHistory: () => void;
    startTelemetryPolling: (tenantId: string) => void;
    fetchSystemState: () => Promise<void>;
    setAuth: (tenantId: string, sessionKey: string) => void;
    authenticate: (tenantId: string, passphrase: string) => Promise<boolean>;
    logout: () => void;
    startSirenStream: () => Promise<void>;
    stopSirenStream: () => void;
}

let telemetryInterval: number | null = null;

export const useAegisStore = create<AegisState>((set, get) => ({
    messages: [],
    status: 'disconnected',
    system_metrics: {
        cpu_load: 0,
        vram_allocated_mb: 0,
        vram_total_mb: 0,
        total_processes: 0,
        active_workers: 0,
    },
    socket: null,
    activePid: null,
    isAuthenticated: false,
    isAdmin: false,
    systemState: 'UNKNOWN',
    tenantId: null,
    sessionKey: null,
    isRecording: false,
    sirenSocket: null,

    startTelemetryPolling: (tenantId: string) => {
        if (telemetryInterval) clearInterval(telemetryInterval);

        const poll = async () => {
            try {
                // Fetch out-of-band telemetry via HTTP to keep WebSocket clean
                const sessionKey = get().socket?.url.split('session_key=')[1];
                const response = await fetch(`/api/status?tenant_id=${tenantId}&session_key=${sessionKey}`);
                if (response.ok) {
                    const metrics = await response.json();
                    set({ system_metrics: metrics });
                }
            } catch (error) {
                console.error('🛰️ Telemetry Polling Error:', error);
            }
        };

        poll(); // Initial immediate call
        telemetryInterval = window.setInterval(poll, 3000); // Decoupled polling every 3s
    },

    fetchSystemState: async () => {
        try {
            const response = await fetch('/api/system/state');
            if (response.ok) {
                const data = await response.json();
                set({ systemState: data.state });
            }
        } catch (error) {
            console.error('Failed to fetch system state:', error);
            set({ systemState: 'UNKNOWN' });
        }
    },

    connect: (tenantId, sessionKey) => {
        const wsUrl = `ws://${window.location.hostname}:8000/ws/chat/${tenantId}?session_key=${sessionKey}`;

        // Close existing socket if any
        const currentSocket = get().socket;
        if (currentSocket) currentSocket.close();

        set({ status: 'connecting' });

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            set({ socket, status: 'idle' });
            get().startTelemetryPolling(tenantId);
            console.log('🛡️ Aegis Shell: Connected to BFF & Telemetry started');
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            const { event: type, data, pid } = msg;

            switch (type) {
                case 'syslog':
                    set((state) => ({
                        messages: [...state.messages, {
                            id: `sys-${Date.now()}`,
                            role: 'system',
                            content: data,
                            type: 'system',
                            timestamp: Date.now()
                        }]
                    }));
                    break;

                case 'status':
                    set({ status: 'thinking' });
                    if (pid) set({ activePid: pid });
                    break;

                case 'kernel_event':
                    const payload = data;

                    if (payload.thought) {
                        get().appendToken(payload.pid, payload.thought, 'thought');
                        set({ status: 'thinking' });
                    }
                    else if (payload.output) {
                        get().appendToken(payload.pid, payload.output, 'text');
                        set({ status: 'thinking' });
                    }
                    else if (payload.error) {
                        get().appendToken(payload.pid, payload.error, 'error');
                        set({ status: 'error' });
                    }
                    else if (payload.status_update) {
                        const state = payload.status_update.state;
                        if (state === 'STATE_COMPLETED') set({ status: 'idle', activePid: null });
                    }
                    break;

                case 'error':
                    set({ status: 'error' });
                    console.error('BFF Error:', data);
                    break;
            }
        };

        socket.onclose = () => {
            set({ socket: null, status: 'disconnected' });
            console.log('🛡️ Aegis Shell: Disconnected');
        };

        socket.onerror = () => {
            set({ status: 'error' });
        };
    },

    disconnect: () => {
        get().socket?.close();
    },

    sendMessage: (prompt) => {
        const { socket, messages } = get();
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        // Initialize TTS to bypass Autoplay Policy on user interaction
        ttsPlayer.initialize();

        // Add user message to UI immediately
        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: prompt,
            type: 'text',
            timestamp: Date.now()
        };

        set({ messages: [...messages, userMsg] });

        // Send to BFF
        socket.send(JSON.stringify({ prompt }));
    },

    appendToken: (pid, token, type) => {
        set((state) => {
            const lastMessage = state.messages[state.messages.length - 1];

            // Optimization: If the last message belongs to the assistant and is the same type, append.
            // We use PID as a reference for the message session.
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.type === type && lastMessage.id === pid) {
                const updatedMessages = [...state.messages];
                updatedMessages[updatedMessages.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + token
                };
                return { messages: updatedMessages };
            }

            // Otherwise, create a new message for this PID/type
            const newMessage: Message = {
                id: pid,
                role: 'assistant',
                content: token,
                type: type,
                timestamp: Date.now()
            };

            return { messages: [...state.messages, newMessage] };
        });
    },

    setStatus: (status) => set({ status }),

    clearHistory: () => set({ messages: [] }),

    setAuth: (tenantId, sessionKey) => set({
        tenantId,
        sessionKey,
        isAuthenticated: true
    }),

    authenticate: async (tenantId, passphrase) => {
        try {
            // 1. Derivar la llave usando SHA-256 (Protocolo Citadel Frontend)
            const encoder = new TextEncoder();
            const data = encoder.encode(passphrase);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const derivedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 2. Verificar contra el BFF
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId, session_key: derivedKey })
            });

            if (response.ok) {
                set({
                    tenantId,
                    sessionKey: derivedKey,
                    isAuthenticated: true,
                    // Simple logic for now: if tenant ID is root or admin it's admin.
                    isAdmin: tenantId.toLowerCase() === 'root' || tenantId.toLowerCase() === 'admin'
                });
                // Autoconnect se maneja en el useEffect de App.tsx al cambiar isAuthenticated
                return true;
            }
            return false;
        } catch (error) {
            console.error('🛡️ Citadel Auth Error:', error);
            return false;
        }
    },

    logout: () => {
        get().disconnect();
        set({
            isAuthenticated: false,
            isAdmin: false,
            tenantId: null,
            sessionKey: null,
            messages: []
        });
        if (telemetryInterval) clearInterval(telemetryInterval);
    },

    startSirenStream: async () => {
        const { tenantId, sessionKey, isRecording } = get();
        if (isRecording || !tenantId || !sessionKey) return;

        try {
            // Initialize TTS to bypass Autoplay Policy
            await ttsPlayer.initialize();

            // 1. Iniciar Microfono
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            // 2. Setup Audio Context (Force 16kHz for Kernel)
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx({ sampleRate: 16000 });
            const source = ctx.createMediaStreamSource(stream);
            const scriptNode = ctx.createScriptProcessor(4096, 1, 1);

            // 3. Setup Dedicated WebSocket
            const wsUrl = `ws://${window.location.hostname}:8000/ws/siren/${tenantId}?session_key=${sessionKey}`;
            const sirenWs = new WebSocket(wsUrl);
            sirenWs.binaryType = 'arraybuffer';

            sirenWs.onopen = () => {
                console.log('📡 Siren Stream: Pipe established');
                set({ isRecording: true, sirenSocket: sirenWs });
            };

            sirenWs.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.event === 'siren_event') {
                    const sirenEvent = msg.data;
                    console.log(`🎙️ Siren Event [${sirenEvent.event_type}]:`, sirenEvent.message);

                    if (sirenEvent.tts_audio_chunk) {
                        try {
                            ttsPlayer.playChunk(sirenEvent.tts_audio_chunk, sirenEvent.sample_rate || 22050);
                        } catch (e) {
                            console.error("TTS Playback error:", e);
                        }
                    }

                    if (sirenEvent.event_type === 'VAD_START') {
                        set({ status: 'listening' });
                    } else if (sirenEvent.event_type === 'STT_START') {
                        set({ status: 'transcribing' });
                    } else if (sirenEvent.event_type === 'STT_DONE') {
                        try {
                            const payload = JSON.parse(sirenEvent.message);
                            const transcript = payload.transcript;
                            const pid = payload.pid;

                            // 1. Add transcript to history
                            const userMsg: Message = {
                                id: `voice-${Date.now()}`,
                                role: 'user',
                                content: transcript,
                                type: 'text',
                                timestamp: Date.now()
                            };

                            set((state) => ({
                                messages: [...state.messages, userMsg],
                                activePid: pid,
                                status: 'thinking'
                            }));

                            // 2. Send 'watch' command to main chat websocket
                            const chatSocket = get().socket;
                            if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                                chatSocket.send(JSON.stringify({ action: "watch", pid: pid }));
                            }
                        } catch (e) {
                            console.error("Failed to parse STT_DONE payload", e);
                            set({ status: 'idle' });
                        }
                    } else if (sirenEvent.event_type === 'STT_ERROR') {
                        set({ status: 'error' });
                    }
                }
                else if (msg.error) {
                    console.error('❌ Siren Kernel Error:', msg.error);
                    get().stopSirenStream();
                }
            };

            sirenWs.onclose = () => {
                console.log('📡 Siren Stream: Pipe closed');
                get().stopSirenStream();
            };

            // 4. Processing Loop (Float32 -> Int16 PCM)
            scriptNode.onaudioprocess = (audioEvent) => {
                if (sirenWs.readyState !== WebSocket.OPEN) return;

                const inputData = audioEvent.inputBuffer.getChannelData(0);
                const pcmBuffer = new Int16Array(inputData.length);

                // Conversion optimizada: SRE Focus
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                sirenWs.send(pcmBuffer.buffer);
            };

            source.connect(scriptNode);
            scriptNode.connect(ctx.destination);

            // Guardar referencias para limpieza manual (fuera del state para evitar re-renders masivos)
            (window as any)._aegis_audio_stream = stream;
            (window as any)._aegis_audio_ctx = ctx;
            (window as any)._aegis_audio_node = scriptNode;

        } catch (error) {
            console.error('🎤 Siren Capture Error:', error);
            set({ isRecording: false });
            throw error; // Let the UI handle the error (toast/alert)
        }
    },

    stopSirenStream: () => {
        const { sirenSocket } = get();

        // 1. Close Socket
        if (sirenSocket) {
            sirenSocket.close();
            set({ sirenSocket: null });
        }

        // 2. Stop Audio Pipeline
        const stream = (window as any)._aegis_audio_stream as MediaStream;
        const ctx = (window as any)._aegis_audio_ctx as AudioContext;
        const node = (window as any)._aegis_audio_node as ScriptProcessorNode;

        if (stream) stream.getTracks().forEach(track => track.stop());
        if (node) node.disconnect();
        if (ctx) ctx.close();

        set({ isRecording: false });
    }
}));
