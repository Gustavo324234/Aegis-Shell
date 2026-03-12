import { useState } from 'react';
import AegisFullLogo from '@/assets/branding/aegis_logo.svg?react';
import AegisIconLogo from '@/assets/branding/logo_icon.svg?react';

export interface AegisLogoProps {
    variant?: 'full' | 'icon';
    className?: string;
}

export function AegisLogo({ variant = 'icon', className = '' }: AegisLogoProps) {
    const [hasError] = useState(false);

    // Si hubo error al cargar o si no están disponibles los componentes, fallback a Zero-Panic
    if (hasError) {
        return (
            <span className={`font-mono font-bold tracking-wider ${className}`}>
                AEGIS
            </span>
        );
    }

    try {
        if (variant === 'full') {
            return (
                <div className={`flex items-center justify-center ${className}`}>
                    <AegisFullLogo
                        width="100%"
                        height="100%"
                        className="w-full h-full object-contain"
                    />
                </div>
            );
        } else {
            return (
                <div className={`flex items-center justify-center ${className}`}>
                    <AegisIconLogo
                        width="100%"
                        height="100%"
                        className="w-full h-full object-contain"
                    />
                </div>
            );
        }
    } catch (e) {
        // Fallback preventivo
        return (
            <span className={`font-mono font-bold tracking-wider ${className}`}>
                AEGIS
            </span>
        );
    }
}
