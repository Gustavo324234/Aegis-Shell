import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Cloud, Server, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAegisStore } from '../store/useAegisStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const EngineSetupWizard: React.FC = () => {
    const { system_metrics, configureEngine, tenantId } = useAegisStore();
    const [selectedMode, setSelectedMode] = useState<'local' | 'cloud' | null>(null);
    const [apiUrl, setApiUrl] = useState('https://api.openai.com/v1/chat/completions');
    const [model, setModel] = useState('gpt-4o');
    const [apiKey, setApiKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const vramBytes = system_metrics?.vram_total_mb || 0;
    const hasLowVRAM = vramBytes < 8000;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (selectedMode === 'cloud' && !apiKey) {
            setError('Please enter an API Key.');
            return;
        }

        setIsSubmitting(true);
        const success = await configureEngine(apiUrl, model, apiKey);
        if (!success) {
            setIsSubmitting(false);
            setError('Failed to configure engine. Check your connection or Citadel logs.');
        }
        // If success, the App.tsx will automatically dismount this component based on isEngineConfigured
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white overflow-hidden relative">
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-[20%] w-[500px] h-[500px] bg-aegis-cyan rounded-full mix-blend-screen filter blur-[150px] animate-pulse"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl z-10 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
            >
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <Cpu className="w-8 h-8 text-aegis-cyan" />
                        <div>
                            <h2 className="text-2xl tracking-[0.2em] font-bold text-white uppercase">Engine Setup</h2>
                            <p className="text-xs font-mono text-aegis-cyan/60">Tenant ID: {tenantId}</p>
                        </div>
                    </div>

                    <p className="text-sm text-white/60 mb-8 leading-relaxed">
                        Aegis Neural Kernel requires a cognitive engine to process missions. Based on your hardware telemetry, please select your execution mode.
                    </p>

                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center text-xs font-mono border-b border-white/10 pb-2">
                            <span className="text-white/40">Total VRAM</span>
                            <span className={hasLowVRAM ? 'text-yellow-500' : 'text-green-500'}>
                                {vramBytes} MB
                            </span>
                        </div>
                    </div>

                    {hasLowVRAM && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3 mb-6"
                        >
                            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-yellow-500/90 leading-relaxed font-mono">
                                <strong>Hardware Limitado Detectado:</strong>
                                <br />VRAM inferior a 8GB. Se recomienda enfáticamente usar Inteligencia en la Nube para evitar degradación de rendimiento SRE o Kernel Panics (OOM).
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => setSelectedMode('local')}
                        className={cn(
                            "text-left p-6 rounded-xl border transition-all duration-300 relative overflow-hidden group hover:border-aegis-cyan",
                            selectedMode === 'local' ? "bg-aegis-cyan/10 border-aegis-cyan" : "bg-white/5 border-white/10"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <Server className={cn("w-6 h-6", selectedMode === 'local' ? "text-aegis-cyan" : "text-white/40 group-hover:text-white")} />
                            <div>
                                <h3 className="font-bold tracking-wider text-base">Local Inference</h3>
                                <p className="text-xs text-white/50 mt-1 uppercase tracking-widest">Llama.cpp / TensorRT</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('cloud')}
                        className={cn(
                            "text-left p-6 rounded-xl border transition-all duration-300 relative overflow-hidden group hover:border-aegis-purple",
                            selectedMode === 'cloud' ? "bg-aegis-purple/10 border-aegis-purple" : "bg-white/5 border-white/10"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <Cloud className={cn("w-6 h-6", selectedMode === 'cloud' ? "text-aegis-purple" : "text-white/40 group-hover:text-white")} />
                            <div>
                                <h3 className="font-bold tracking-wider text-base">Cloud Inference</h3>
                                <p className="text-xs text-white/50 mt-1 uppercase tracking-widest">OpenAI / Groq API</p>
                            </div>
                        </div>
                    </button>

                    <AnimatePresence>
                        {selectedMode === 'cloud' && (
                            <motion.form
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                onSubmit={handleSubmit}
                                className="space-y-4 mt-2 overflow-hidden"
                            >
                                <div>
                                    <label className="text-[10px] font-mono uppercase tracking-widest text-aegis-cyan mb-1 block">API URL</label>
                                    <input
                                        type="url"
                                        value={apiUrl}
                                        onChange={(e) => setApiUrl(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-aegis-cyan font-mono"
                                        placeholder="https://api.openai.com/v1/chat/completions"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-mono uppercase tracking-widest text-aegis-cyan mb-1 block">Model Name</label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-aegis-cyan font-mono"
                                        placeholder="gpt-4o"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-mono uppercase tracking-widest text-aegis-cyan mb-1 block">Secret API Key</label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-aegis-cyan font-mono tracking-widest"
                                        placeholder="sk-..."
                                        required
                                    />
                                </div>

                                {error && (
                                    <p className="text-xs text-red-500 font-mono mt-2">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full mt-4 flex items-center justify-center gap-2 bg-aegis-cyan hover:bg-aegis-cyan/80 text-black font-bold py-3 px-4 rounded-lg uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Configuring Ring 0...' : 'Deploy Engine'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-2 justify-center mt-3 text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Zero-Knowledge Encryption Enabled</span>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default EngineSetupWizard;
