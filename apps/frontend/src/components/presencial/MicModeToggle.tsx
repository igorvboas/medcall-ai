'use client';

import { useEffect } from 'react';
import * as Switch from '@radix-ui/react-switch';

interface MicModeToggleProps {
    mode: 'single' | 'dual';
    onModeChange: (mode: 'single' | 'dual') => void;
    disabled?: boolean;
}

const STORAGE_KEY = 'presencial-mic-mode';

export function MicModeToggle({
    mode,
    onModeChange,
    disabled = false
}: MicModeToggleProps) {
    // On mount: read localStorage and sync if differs from current mode
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'single' || stored === 'dual') {
            if (stored !== mode) {
                onModeChange(stored);
            }
        }
        // Default to 'dual' if nothing stored
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (checked: boolean) => {
        const newMode = checked ? 'single' : 'dual';
        localStorage.setItem(STORAGE_KEY, newMode);
        onModeChange(newMode);
    };

    return (
        <div className={`mic-mode-toggle ${disabled ? 'disabled' : ''}`}>
            <span className={`mode-label ${mode === 'dual' ? 'active' : ''}`}>
                Modo Dual-Mic
            </span>
            <Switch.Root
                className="switch-root"
                checked={mode === 'single'}
                onCheckedChange={handleChange}
                disabled={disabled}
            >
                <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
            <span className={`mode-label ${mode === 'single' ? 'active' : ''}`}>
                Modo Single-Mic
            </span>

            <style jsx>{`
                .mic-mode-toggle {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #E5E7EB;
                }

                .mic-mode-toggle.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .mode-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #9CA3AF;
                    transition: color 0.2s ease;
                    user-select: none;
                }

                .mode-label.active {
                    color: #1B4266;
                    font-weight: 600;
                }

                .mic-mode-toggle :global(.switch-root) {
                    width: 42px;
                    height: 24px;
                    background: #9CA3AF;
                    border-radius: 12px;
                    position: relative;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s ease;
                    flex-shrink: 0;
                    padding: 0;
                }

                .mic-mode-toggle :global(.switch-root:disabled) {
                    cursor: not-allowed;
                }

                .mic-mode-toggle :global(.switch-root[data-state='checked']) {
                    background: #1B4266;
                }

                .mic-mode-toggle :global(.switch-thumb) {
                    display: block;
                    width: 20px;
                    height: 20px;
                    background: white;
                    border-radius: 50%;
                    transition: transform 0.2s ease;
                    transform: translateX(2px);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                }

                .mic-mode-toggle :global(.switch-thumb[data-state='checked']) {
                    transform: translateX(20px);
                }
            `}</style>
        </div>
    );
}
