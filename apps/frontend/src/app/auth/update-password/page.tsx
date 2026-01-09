'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff } from 'lucide-react';
import './update-password.css';

export default function UpdatePasswordPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            // 1. Update Password in Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: password
            });

            if (authError) throw authError;

            // 2. Update Medicos profile (primeiro_acesso = false)
            if (user?.id) {
                const { error: dbError } = await supabase
                    .from('medicos')
                    .update({ primeiro_acesso: false })
                    .eq('user_auth', user.id);

                if (dbError) throw dbError;
            }

            // 3. Redirect
            router.replace('/dashboard');

        } catch (err: any) {
            console.error('Erro ao atualizar senha:', err);
            setError(err.message || 'Erro ao atualizar senha');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="update-password-page">
            <div className="update-password-container">
                <div className="update-password-header">
                    <h2 className="update-password-title">
                        Primeiro Acesso
                    </h2>
                    <p className="update-password-subtitle">
                        Para sua segurança, por favor defina uma nova senha para continuar.
                    </p>
                </div>

                <div className="update-password-card">
                    <form className="update-password-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nova Senha</label>
                            <div className="password-input-wrapper">
                                <div className="password-input-container">
                                    <Lock className="password-icon" size={20} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="form-input password-input"
                                        placeholder="Mínimo 6 caracteres"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="password-toggle-btn"
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirmar Senha</label>
                            <div className="password-input-wrapper">
                                <div className="password-input-container">
                                    <Lock className="password-icon" size={20} />
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="form-input password-input"
                                        placeholder="Digite a senha novamente"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="password-toggle-btn"
                                        aria-label={showConfirmPassword ? 'Ocultar senha de confirmação' : 'Mostrar senha de confirmação'}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="submit-button"
                        >
                            {loading ? 'Atualizando...' : 'Definir Senha e Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
