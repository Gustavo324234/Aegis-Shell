import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Key, Terminal, LogOut, Check } from 'lucide-react';
import { useAegisStore } from '../store/useAegisStore';

interface NewTenant {
    tenant_id: string;
    temporary_passphrase: string;
    network_port: number;
}

const AdminDashboard: React.FC = () => {
    const { tenantId, sessionKey, logout } = useAegisStore();
    const [newUsername, setNewUsername] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createdTenant, setCreatedTenant] = useState<NewTenant | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCreateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername) return;

        setIsCreating(true);
        setError(null);
        setCreatedTenant(null);

        try {
            const response = await fetch('/api/admin/tenant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_tenant_id: tenantId,
                    admin_session_key: sessionKey,
                    username: newUsername
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCreatedTenant({
                        tenant_id: data.tenant_id,
                        temporary_passphrase: data.temporary_passphrase,
                        network_port: data.network_port
                    });
                    setNewUsername('');
                } else {
                    setError(data.message || 'Error al crear tenant.');
                }
            } else {
                setError('Fallo de conexión con Ring 0.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 overflow-hidden relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-4xl mx-auto z-10 relative">
                <header className="flex justify-between items-center mb-12 border-b border-red-500/20 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                            <Shield className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-[0.2em] uppercase text-white">
                                Master <span className="text-red-500">Dashboard</span>
                            </h1>
                            <p className="text-sm font-mono text-red-500/60 uppercase tracking-widest">
                                Citadel Authorization Level: MAXIMUM
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-mono text-xs uppercase"
                    >
                        <LogOut className="w-4 h-4" /> Disconnect
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Panel de Creación */}
                    <div className="glass p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <Plus className="w-5 h-5 text-aegis-cyan" />
                            <h2 className="text-lg font-bold tracking-widest uppercase">Forge New Tenant</h2>
                        </div>

                        <form onSubmit={handleCreateTenant} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono text-white/40 uppercase ml-1 tracking-widest">Identificador / Nombre</label>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Operador_Alfa"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-sm font-mono focus:border-aegis-cyan/50 focus:ring-0 transition-all placeholder:text-white/10"
                                    required
                                />
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
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
                                disabled={isCreating}
                                className={`w-full group relative overflow-hidden rounded-lg py-4 transition-all duration-500 ${isCreating
                                    ? "bg-aegis-cyan/20 cursor-wait"
                                    : "bg-aegis-cyan/10 hover:bg-aegis-cyan/20 border border-aegis-cyan/30"
                                    }`}
                            >
                                <div className="relative z-10 flex items-center justify-center gap-3">
                                    <span className="text-xs font-mono font-bold tracking-[0.3em] uppercase text-aegis-cyan">
                                        {isCreating ? "Derivando..." : "Crear Enclave"}
                                    </span>
                                </div>
                            </button>
                        </form>
                    </div>

                    {/* Resultados de la Creación */}
                    <AnimatePresence>
                        {createdTenant ? (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass p-6 rounded-2xl border border-green-500/30 bg-green-500/5 shadow-2xl"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <Check className="w-5 h-5 text-green-500" />
                                    <h2 className="text-lg font-bold tracking-widest uppercase text-green-400">Enclave Operativo</h2>
                                </div>

                                <div className="space-y-4 font-mono text-sm">
                                    <div className="bg-black/50 p-4 rounded-lg border border-white/5">
                                        <p className="text-white/40 text-[10px] uppercase mb-1">Identificador</p>
                                        <p className="text-white font-bold">{createdTenant.tenant_id}</p>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-lg border border-green-500/20">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-green-500/60 text-[10px] uppercase">Contraseña Temporal</p>
                                            <Key className="w-3 h-3 text-green-500/60" />
                                        </div>
                                        <p className="text-green-400 font-bold tracking-widest">{createdTenant.temporary_passphrase}</p>
                                        <p className="text-[9px] text-green-500/40 mt-2">DURACIÓN: 1 USO (REQUERIRÁ CAMBIO)</p>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-lg border border-aegis-cyan/20">
                                        <p className="text-aegis-cyan/60 text-[10px] uppercase mb-1">Puerto de Acceso</p>
                                        <p className="text-aegis-cyan font-bold tracking-widest">{createdTenant.network_port}</p>
                                        <p className="text-[10px] text-white/40 mt-2">http://[IP]:{createdTenant.network_port}</p>
                                    </div>
                                </div>
                                <p className="text-[10px] font-mono text-white/30 text-center mt-6">
                                    Entrega estas credenciales al operador por un canal seguro.
                                </p>
                            </motion.div>
                        ) : (
                            <div className="flex items-center justify-center p-6 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                <p className="text-xs font-mono text-white/30 uppercase tracking-widesttext-center">
                                    Esperando comandos de forja...
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
