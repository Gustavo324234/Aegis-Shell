import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useAegisStore } from './store/useAegisStore';
import ChatTerminal from './components/ChatTerminal';
import LoginScreen from './components/LoginScreen';
import AdminSetupScreen from './components/AdminSetupScreen';
import AdminDashboard from './components/AdminDashboard';
import ForcePasswordChangeScreen from './components/ForcePasswordChangeScreen';

function App() {
    const { status, isAuthenticated, isAdmin, systemState, tenantId, sessionKey, connect, fetchSystemState } = useAegisStore();
    const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

    // Initial system state check
    useEffect(() => {
        fetchSystemState();
    }, [fetchSystemState]);

    // Handle connection once authenticated
    useEffect(() => {
        if (isAuthenticated && !isAdmin && !needsPasswordReset && tenantId && sessionKey && status === 'disconnected') {
            connect(tenantId, sessionKey);
        }
    }, [isAuthenticated, isAdmin, needsPasswordReset, tenantId, sessionKey, status, connect]);

    return (
        <div className="bg-black min-h-screen text-white overflow-hidden">
            <AnimatePresence mode="wait">
                {systemState === 'UNKNOWN' ? (
                    <motion.div key="loading_state" className="flex items-center justify-center h-screen">
                        <Shield className="w-10 h-10 text-white/20 animate-pulse" />
                    </motion.div>
                ) : systemState === 'STATE_INITIALIZING' ? (
                    <motion.div
                        key="admin_setup"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <AdminSetupScreen onSetupComplete={() => fetchSystemState()} />
                    </motion.div>
                ) : !isAuthenticated ? (
                    <motion.div
                        key="login"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <LoginScreen />
                    </motion.div>
                ) : isAdmin ? (
                    <motion.div
                        key="admin_dashboard"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <AdminDashboard />
                    </motion.div>
                ) : needsPasswordReset ? (
                    <motion.div key="force_reset">
                        <ForcePasswordChangeScreen onPasswordChanged={() => setNeedsPasswordReset(false)} />
                    </motion.div>
                ) : status === 'connecting' ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                        transition={{ duration: 0.8 }}
                        className="flex flex-col items-center justify-center min-h-screen p-4"
                    >
                        <div className="relative mb-8">
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.3, 0.6, 0.3]
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -inset-8 bg-aegis-cyan rounded-full blur-3xl"
                            />
                            <Shield className="w-20 h-20 text-aegis-cyan relative z-10" />
                        </div>

                        <div className="text-center">
                            <h1 className="text-4xl font-bold tracking-[0.3em] mb-2 uppercase text-white">
                                Aegis <span className="text-aegis-cyan">Shell</span>
                            </h1>
                            <p className="text-aegis-steel font-mono tracking-widest text-[10px] animate-pulse">
                                ESTABLISHING RING 0 NEURAL LINK...
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="terminal"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-screen w-full"
                    >
                        <ChatTerminal />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default App
