import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Terminal, Settings, AlertCircle, Cpu, Mic, MicOff } from 'lucide-react';
import { useAegisStore, Message } from '../store/useAegisStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import TelemetrySidebar from './TelemetrySidebar';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { color: string, label: string }> = {
        idle: { color: 'bg-green-500', label: 'Idle' },
        thinking: { color: 'bg-aegis-purple animate-pulse shadow-[0_0_8px_rgba(191,0,255,0.6)]', label: 'Processing' },
        executing_syscall: { color: 'bg-aegis-cyan animate-pulse', label: 'Syscall' },
        disconnected: { color: 'bg-red-500', label: 'Offline' },
        connecting: { color: 'bg-yellow-500 animate-bounce', label: 'Linking' },
        error: { color: 'bg-red-600 shadow-[0_0_10px_rgba(255,0,0,0.5)]', label: 'Kernel Panic' },
        listening: { color: 'bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]', label: 'Listening' },
        transcribing: { color: 'bg-pink-500 animate-pulse shadow-[0_0_10px_rgba(236,72,153,0.8)]', label: 'Transcribing' },
    };

    const current = config[status] || config.disconnected;

    return (
        <div className="flex items-center gap-2 group cursor-help">
            <div className={cn("w-2 h-2 rounded-full", current.color)} />
            <span className="text-[9px] font-bold font-mono text-white/50 uppercase tracking-tighter transition-all group-hover:text-white">
                {current.label}
            </span>
        </div>
    );
};

const MessageItem: React.FC<{ message: Message }> = ({ message }) => {
    const isAssistant = message.role === 'assistant';
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    return (
        <motion.div
            initial={{ opacity: 0, x: isUser ? 10 : -10, y: 5 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            className={cn(
                "flex w-full gap-4 px-2",
                isUser ? "justify-end" : "justify-start"
            )}
        >
            <div className={cn(
                "max-w-[85%] flex flex-col gap-1.5",
                isUser ? "items-end" : "items-start"
            )}>
                {/* Role Header */}
                <div className="flex items-center gap-2 px-1">
                    {isUser && <span className="text-[10px] font-mono text-white/40 uppercase">Operator</span>}
                    {isAssistant && <span className="text-[10px] font-mono text-aegis-cyan/60 uppercase">ANK Kernel</span>}
                    {isSystem && <span className="text-[10px] font-mono text-aegis-purple/60 uppercase">System log</span>}
                </div>

                {/* Message Content */}
                <div className={cn(
                    "rounded-2xl px-4 py-3 text-sm transition-all",
                    isUser && "bg-aegis-cyan/10 border border-aegis-cyan/20 text-white rounded-tr-none",
                    isAssistant && message.type === 'text' && "bg-white/5 border border-white/10 text-white/90 rounded-tl-none",
                    isAssistant && message.type === 'thought' && "bg-aegis-purple/5 border border-aegis-purple/10 text-aegis-purple/60 text-xs italic font-mono rounded-tl-none",
                    isSystem && "bg-black/50 border border-aegis-cyan/40 text-aegis-cyan flex items-center gap-3",
                    message.type === 'error' && "bg-red-500/10 border border-red-500/30 text-red-500 italic"
                )}>
                    {isSystem && <Settings className="w-4 h-4" />}
                    {message.type === 'error' && <AlertCircle className="w-4 h-4 inline-block mr-2" />}

                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-code:text-aegis-cyan prose-code:bg-aegis-cyan/5 prose-code:px-1 prose-code:rounded prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10">
                        {message.type === 'thought' ? (
                            <p>{message.content}</p>
                        ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                        )}
                    </div>
                </div>

                <span className="text-[9px] font-mono text-white/10 px-1 mt-0.5">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
            </div>
        </motion.div>
    );
};

const ChatTerminal: React.FC = () => {
    const { messages, sendMessage, status, isRecording, startSirenStream, stopSirenStream } = useAegisStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const isAtBottom = useRef(true);
    const [input, setInput] = useState('');
    const [voiceError, setVoiceError] = useState<string | null>(null);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior,
            });
        }
    };

    // Detect if user is near the bottom
    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            // Consider "at bottom" if within 100px of the edge
            isAtBottom.current = distanceToBottom < 100;
        }
    };

    // Auto-scroll when messages arrive (ONLY if already at bottom)
    useEffect(() => {
        if (isAtBottom.current) {
            scrollToBottom('smooth');
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        sendMessage(input);
        setInput('');
        // Al enviar, forzamos scroll al fondo independientemente de donde esté el usuario
        setTimeout(() => {
            isAtBottom.current = true;
            scrollToBottom('auto');
        }, 10);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleToggleMic = async () => {
        if (isRecording) {
            stopSirenStream();
        } else {
            try {
                setVoiceError(null);
                await startSirenStream();
            } catch (err: any) {
                console.error("🎤 Mic Toggle Error:", err);
                setVoiceError(err.name === 'NotAllowedError' ? 'Microphone access denied' : 'Hardware error');
                setTimeout(() => setVoiceError(null), 5000);
            }
        }
    };

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header / Telemetry Bar */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/50 backdrop-blur-sm z-20 overflow-visible">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-aegis-cyan" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-mono tracking-widest text-aegis-cyan font-bold uppercase">Aegis Shell v0.1.0</span>
                            <span className="text-[8px] font-mono text-white/20 uppercase">Ring 0 Secure Link</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end mr-2">
                            <StatusBadge status={status} />
                        </div>
                    </div>
                </div>

                {/* Message List */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-4 py-8 space-y-6 scrollbar-hide"
                >
                    <AnimatePresence initial={false}>
                        {messages.map((msg, index) => (
                            <MessageItem key={msg.id + index} message={msg} />
                        ))}
                    </AnimatePresence>

                    {status === 'thinking' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-aegis-purple/60 px-4"
                        >
                            <Cpu className="w-4 h-4 animate-pulse" />
                            <span className="text-xs font-mono italic">Kernel is processing...</span>
                        </motion.div>
                    )}
                </div>

                {/* Omnibox / Input Bar */}
                <div className="p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
                    {voiceError && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-4xl mx-auto mb-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-xs font-mono"
                        >
                            <AlertCircle className="w-3 h-3" />
                            <span>Siren Error: {voiceError}</span>
                        </motion.div>
                    )}
                    <div className="max-w-4xl mx-auto relative">
                        <div className="glass rounded-xl border border-white/10 flex items-end p-2 gap-2 focus-within:border-aegis-cyan/30 transition-all shadow-2xl">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Inject command to Ring 0..."
                                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 px-3 resize-none max-h-32 min-h-[40px] font-mono placeholder:text-white/20"
                                rows={1}
                            />

                            <button
                                onClick={handleToggleMic}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    isRecording
                                        ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"
                                        : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
                                )}
                                title={isRecording ? "Stop Listening" : "Start Voice Interaction"}
                            >
                                {isRecording ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </button>

                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || status === 'thinking'}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    input.trim() ? "bg-aegis-cyan text-black hover:scale-105" : "bg-white/5 text-white/20"
                                )}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mt-2 flex justify-center">
                            <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em]">Citadel Protocol Active</span>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Telemetry & The Orb */}
                <TelemetrySidebar />
            </div>
        </div>
    );
};



export default ChatTerminal;
