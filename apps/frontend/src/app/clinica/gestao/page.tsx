'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { UserPlus, Mail, User, Edit2, Trash2, X, RotateCcw } from 'lucide-react';

interface Doctor {
    id: string;
    name: string;
    email: string;
    medico_deletado: boolean;
    clinica_id: string;
    user_auth: string;
}

export default function ClinicManagementPage() {
    const { session, user } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Lista de Médicos
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [currentClinicId, setCurrentClinicId] = useState<string | null>(null);

    // Modais
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

    // Estados de Edição
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState(''); // Email geralmente não se edita tão simples no Auth, mas podemos editar o registro medico

    // Função para buscar dados iniciais (ID da clínica e lista de médicos)
    useEffect(() => {
        if (!user || currentClinicId) return;

        const fetchClinicData = async () => {
            try {
                // 1. Buscar ID da clínica do admin logado
                const { data: adminMedico, error: adminError } = await supabase
                    .from('medicos')
                    .select('id, clinica_id')
                    .eq('user_auth', user.id)
                    .single();

                if (adminError || !adminMedico) throw new Error('Erro ao buscar dados do administrador');

                setCurrentClinicId(adminMedico.clinica_id);
            } catch (err) {
                console.error('Erro inicial:', err);
            }
        };

        fetchClinicData();
    }, [user, currentClinicId]);

    // Buscar médicos quando tiver o ID da clínica
    useEffect(() => {
        if (!currentClinicId) return;
        fetchDoctors();
    }, [currentClinicId]);

    const fetchDoctors = async () => {
        setLoadingDoctors(true);
        try {
            const { data, error } = await supabase
                .from('medicos')
                .select('*')
                .eq('clinica_id', currentClinicId)
                .eq('is_doctor', true) // Apenas médicos
                .neq('user_auth', user?.id) // Excluir o próprio admin da lista (opcional)
                .or('medico_deletado.is.null,medico_deletado.is.false') // Filtrar deletados (ou mostrar todos se quiser)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDoctors(data || []);
        } catch (err) {
            console.error('Erro ao buscar médicos:', err);
        } finally {
            setLoadingDoctors(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            let gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
            // Correct protocol for HTTP fetch if it comes as WS
            gatewayUrl = gatewayUrl.replace('wss://', 'https://').replace('ws://', 'http://');

            const response = await fetch(`${gatewayUrl}/api/clinic/registry-doctor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao cadastrar médico');
            }

            setMessage({ type: 'success', text: `Médico ${data.doctor.name} cadastrado com sucesso! Senha: meuprimeiroacesso_123456789` });
            setName('');
            setEmail('');
            fetchDoctors(); // Atualizar lista

        } catch (error: any) {
            console.error('Erro:', error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    // === Ações de Edição ===
    const openEditModal = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setEditName(doctor.name);
        setEditEmail(doctor.email);
        setShowEditModal(true);
    };

    const handleUpdateDoctor = async () => {
        if (!selectedDoctor) return;

        try {
            const { error } = await supabase
                .from('medicos')
                .update({ name: editName }) // Atualizando apenas nome por enquanto
                .eq('id', selectedDoctor.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
            setShowEditModal(false);
            fetchDoctors();
        } catch (err: any) {
            console.error('Erro ao atualizar:', err);
            setMessage({ type: 'error', text: 'Erro ao atualizar médico' });
        }
    };

    // === Ações de Exclusão (Bloqueio) ===
    const openDeleteModal = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setShowDeleteModal(true);
    };

    const handleDeleteDoctor = async () => {
        if (!selectedDoctor) return;

        try {
            const { error } = await supabase
                .from('medicos')
                .update({ medico_deletado: true })
                .eq('id', selectedDoctor.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Acesso do médico bloqueado com sucesso!' });
            setShowDeleteModal(false);
            fetchDoctors();
        } catch (err: any) {
            console.error('Erro ao bloquear:', err);
            setMessage({ type: 'error', text: 'Erro ao bloquear médico' });
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestão da Clínica - Equipe</h1>
                <p className="text-gray-600">Gerencie o acesso e cadastro dos seus médicos.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Coluna da Esquerda: Cadastro */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-8">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <UserPlus size={20} className="text-blue-600" />
                                Cadastrar Novo
                            </h2>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Dr. João Silva"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Profissional</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="medico@clinica.com"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? 'Cadastrando...' : 'Cadastrar Médico'}
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    Senha padrão: <strong>meuprimeiroacesso_123456789</strong>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Coluna da Direita: Lista */}
                <div className="lg:col-span-2">
                    {message && (
                        <div className={`mb-6 p-4 rounded-lg text-sm flex items-center justify-between ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            <span>{message.text}</span>
                            <button onClick={() => setMessage(null)}><X size={16} /></button>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-800">Médicos Cadastrados</h2>
                            <button onClick={fetchDoctors} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                <RotateCcw size={18} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="p-4 font-medium">Nome</th>
                                        <th className="p-4 font-medium">Email</th>
                                        <th className="p-4 font-medium text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loadingDoctors ? (
                                        <tr><td colSpan={3} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                                    ) : doctors.length === 0 ? (
                                        <tr><td colSpan={3} className="p-8 text-center text-gray-500">Nenhum médico cadastrado.</td></tr>
                                    ) : (
                                        doctors.map((doctor) => (
                                            <tr key={doctor.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 text-gray-900 font-medium">{doctor.name}</td>
                                                <td className="p-4 text-gray-600 font-light">{doctor.email}</td>
                                                <td className="p-4 flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => openEditModal(doctor)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(doctor)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Bloquear Acesso"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Editar */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Editar Médico</h3>
                            <button onClick={() => setShowEditModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                            </div>
                            {/* Email disabled for now as it's complex to change in Auth */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    className="w-full border border-gray-200 bg-gray-50 rounded-lg p-2 text-gray-500 cursor-not-allowed"
                                    value={editEmail}
                                    disabled
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowEditModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                                <button onClick={handleUpdateDoctor} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Deletar (Bloquear) */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Bloquear Acesso?</h3>
                            <p className="text-gray-600 text-sm">
                                Tem certeza que deseja bloquear o acesso de <strong>{selectedDoctor?.name}</strong>?
                                Ele não poderá mais acessar a plataforma.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                                <button onClick={handleDeleteDoctor} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Bloquear</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
