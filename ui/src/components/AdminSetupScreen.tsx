import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Terminal, ChevronRight } from 'lucide-react';

const AdminSetupScreen: React.FC<{ onSetupComplete: () => void }> = ({ onSetupComplete }) => {
    const [username, setUsername] = useState('root');
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !passphrase) return;
        if (passphrase !== confirmPassphrase) {
            setError('Las frases de acceso no coinciden.');
            return;
        }

        setIsInitializing(true);
        setError(null);

        try {
            // Citadel Protocol: Hash the passphrase locally before sending to BFF
            const encoder = new TextEncoder();
            const data = encoder.encode(passphrase);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const derivedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const response = await fetch('/api/admin/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, passphrase: derivedKey })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    onSetupComplete();
                } else {
                    setError(data.message || 'Error en la inicialización.');
                }
            } else {
                setError('Fallo de conexión con Ring 0.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden relative">
            {/* Background Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 rounded-full blur-[120px]" />
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-900/5 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-md z-10"
            >
                <div className="glass p-8 rounded-2xl border border-red-500/20 shadow-2xl relative overflow-hidden">
                    {/* Scanline Effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/5 to-transparent h-24 w-full -translate-y-full animate-[scan_4s_linear_infinity] pointer-events-none" />

                    <div className="flex flex-col items-center mb-8">
                        <div className="relative mb-6">
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="absolute -inset-4 border border-dashed border-red-500/30 rounded-full"
                            />
                            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/30 relative">
                                <Shield className="w-10 h-10 text-red-500" />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold tracking-[0.2em] text-white uppercase mb-1 text-center">
                            INICIALIZACIÓN <span className="text-red-500">ZERO-TRUST</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <div className="h-[1px] w-4 bg-red-500/40" />
                            <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest text-center">
                                SECURE ENCLAVE INITIALIZATION
                            </p>
                            <div className="h-[1px] w-4 bg-red-500/40" />
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg flex items-start gap-3 mb-6">
                        <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-mono text-amber-400/90 leading-relaxed text-left">
                            <strong className="text-amber-500">Sistema limpio detectado.</strong> Por directiva de seguridad militar, Aegis OS no posee contraseñas por defecto. Forja tu credencial de Master Admin ahora.
                        </p>
                    </div>

                    <form onSubmit={handleSetup} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-white/40 uppercase ml-1 tracking-widest block text-left">Crear ID de Administrador (ej. root)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="root"
                                className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-sm font-mono focus:border-red-500/50 focus:ring-0 transition-all placeholder:text-white/10"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-white/40 uppercase ml-1 tracking-widest block text-left">Nueva Contraseña Maestra</label>
                            <input
                                type="password"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-sm font-mono focus:border-red-500/50 focus:ring-0 transition-all placeholder:text-white/10"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-white/40 uppercase ml-1 tracking-widest block text-left">Repetir Contraseña</label>
                            <input
                                type="password"
                                value={confirmPassphrase}
                                onChange={(e) => setConfirmPassphrase(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-sm font-mono focus:border-red-500/50 focus:ring-0 transition-all placeholder:text-white/10"
                                required
                            />
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-3"
                            >
                                <Terminal className="w-4 h-4 text-red-500" />
                                <span className="text-[10px] font-mono text-red-400 leading-tight">
                                    {error}
                                </span>
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isInitializing}
                            className={`w-full group relative overflow-hidden rounded-lg py-4 transition-all duration-500 ${isInitializing
                                ? "bg-red-500/20 cursor-wait"
                                : "bg-red-500/10 hover:bg-red-500/20 border border-red-500/30"
                                }`}
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                {isInitializing ? (
                                    <>
                                        <Terminal className="w-4 h-4 animate-pulse text-red-500" />
                                        <span className="text-xs font-mono font-bold tracking-widest uppercase text-red-500">Creating Enclave...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase text-red-100">Forjar Llaves y Bloquear Sistema</span>
                                        <ChevronRight className="w-4 h-4 text-red-100 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-red-500/40 uppercase tracking-tighter">
                        <span>Ring 0 Initialization</span>
                        <span>Zero-Knowledge Mode</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminSetupScreen;
