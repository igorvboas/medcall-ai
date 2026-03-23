'use client';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Search, Plus, Star, Pencil, Trash2, X,
  UtensilsCrossed, Dumbbell, Pill, Leaf, UserPlus,
  Clock, Flame, Building2, Phone, Mail, Calendar, Loader2, Eye, Edit
} from 'lucide-react';
import { PatientForm } from '@/components/patients/PatientForm';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { useAuth } from '@/hooks/useAuth';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import ClinicManagementPage from '@/app/clinica/gestao/page';
import '../cadastro.css';

// Types
interface CadastroItem {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  favorito: boolean;
  created_at: string;
  tags: string[];
  // Refeicao fields
  calorias?: number;
  proteinas?: number;
  carboidratos?: number;
  gorduras?: number;
  tempo_preparo?: string;
  // Treino fields
  grupo_muscular?: string;
  series?: number;
  repeticoes?: string;
  descanso?: string;
  equipamento?: string;
  // Suplemento/Fitoterapico fields
  dosagem?: string;
  horario?: string;
  objetivo?: string;
}

interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  profile_pic?: string;
  anamnese?: { status: 'pendente' | 'preenchida' };
}

interface PatientsResponse {
  patients: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Refeicao {
  id: string;
  doctor_id: string;
  nome: string;
  categoria?: string;
  descricao?: string;
  favorito: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  alimentos?: RefeicaoAlimento[];
}

interface RefeicaoAlimento {
  id: string;
  refeicao_id: string;
  alimento_id: string;
  porcao_customizada?: string;
  ordem: number;
  observacao?: string;
  cadastro_alimentos?: {
    id: string;
    nome: string;
    [key: string]: any;
  };
}

interface AlimentoNutricional {
  table_id: number;
  nome: string;
  categoria?: string;
  energia_kcal?: string;
  proteina_g?: string;
  lipideos_g?: string;
  carboidrato_g?: string;
  fibra_alimentar_g?: string;
}

interface Alimento {
  id: string;
  doctor_id: string;
  nome: string;
  categoria?: string;
  descricao?: string;
  porcao?: string;
  calorias?: number;
  proteinas?: number;
  carboidratos?: number;
  gorduras?: number;
  fibras?: number;
  favorito: boolean;
  tags: string[];
}

interface RefeicaoResponse {
  refeicoes: Refeicao[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Exercicio {
  id: string;
  doctor_id: string;
  nome: string;
  grupo_muscular?: string;
  descricao?: string;
  url_tutorial?: string;
  equipamento?: string;
  favorito: boolean;
  tags: string[];
}

interface TreinoExercicio {
  id: string;
  treino_id: string;
  exercicio_id: string;
  series?: number;
  repeticoes?: string;
  descanso?: string;
  observacao?: string;
  ordem: number;
  cadastro_exercicios?: Exercicio;
}

interface Treino {
  id: string;
  doctor_id: string;
  nome: string;
  categoria?: string;
  descricao?: string;
  favorito: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  exercicios?: TreinoExercicio[];
}

interface TreinoResponse {
  treinos: Treino[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type TabType = 'pacientes' | 'refeicoes' | 'treinos' | 'suplementos' | 'fitoterapicos' | 'clinica';

const VALID_TABS: TabType[] = ['pacientes', 'refeicoes', 'treinos', 'suplementos', 'fitoterapicos', 'clinica'];

const TABS: { key: TabType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: 'pacientes', label: 'Pacientes', icon: UserPlus },
  { key: 'refeicoes', label: 'Refeicoes', icon: UtensilsCrossed },
  { key: 'treinos', label: 'Treinos', icon: Dumbbell },
  { key: 'suplementos', label: 'Suplementos', icon: Pill },
  { key: 'fitoterapicos', label: 'Fitoterapicos', icon: Leaf },
  { key: 'clinica', label: 'Gestao de Clinica', icon: Building2, adminOnly: true },
];

// Mock data for demo - will be replaced by API calls
const INITIAL_DATA: Record<TabType, CadastroItem[]> = {
  clinica: [],
  pacientes: [],
  refeicoes: [
    {
      id: '1', nome: 'Frango grelhado com batata doce', categoria: 'Almoco',
      descricao: 'Peito de frango grelhado com temperos naturais, acompanhado de batata doce assada e salada verde.',
      favorito: true, created_at: '2026-03-15', tags: ['Alta proteina', 'Low carb'],
      calorias: 420, proteinas: 45, carboidratos: 35, gorduras: 10, tempo_preparo: '30 min'
    },
    {
      id: '2', nome: 'Omelete de claras com aveia', categoria: 'Cafe da manha',
      descricao: 'Omelete feito com claras de ovo, aveia e espinafre. Rico em proteinas e fibras.',
      favorito: false, created_at: '2026-03-14', tags: ['Cafe da manha', 'Proteico'],
      calorias: 280, proteinas: 28, carboidratos: 22, gorduras: 8, tempo_preparo: '15 min'
    },
    {
      id: '3', nome: 'Bowl de acai com granola', categoria: 'Lanche',
      descricao: 'Acai puro batido com banana, coberto com granola caseira e frutas frescas.',
      favorito: true, created_at: '2026-03-13', tags: ['Energia', 'Pre-treino'],
      calorias: 350, proteinas: 8, carboidratos: 55, gorduras: 12, tempo_preparo: '10 min'
    },
  ],
  treinos: [
    {
      id: '1', nome: 'Supino reto com halter', categoria: 'Peito',
      descricao: 'Manter escapulas estabilizadas, amplitude total, controle na descida.',
      favorito: true, created_at: '2026-03-15', tags: ['Intermediario', 'Hipertrofia'],
      grupo_muscular: 'Peitoral', series: 4, repeticoes: '8-12', descanso: '90s', equipamento: 'Halter'
    },
    {
      id: '2', nome: 'Agachamento livre', categoria: 'Pernas',
      descricao: 'Descer ate paralelo ou abaixo, joelhos alinhados com os pes, tronco ereto.',
      favorito: true, created_at: '2026-03-14', tags: ['Avancado', 'Forca'],
      grupo_muscular: 'Quadriceps', series: 4, repeticoes: '6-10', descanso: '120s', equipamento: 'Barra'
    },
    {
      id: '3', nome: 'Remada curvada', categoria: 'Costas',
      descricao: 'Puxar a barra ate o abdomen, manter as costas retas, contrair escapulas.',
      favorito: false, created_at: '2026-03-13', tags: ['Intermediario', 'Hipertrofia'],
      grupo_muscular: 'Dorsal', series: 3, repeticoes: '10-12', descanso: '90s', equipamento: 'Barra'
    },
  ],
  suplementos: [
    {
      id: '1', nome: 'Creatina Monohidratada', categoria: 'Performance',
      descricao: 'Melhora a performance em exercicios de alta intensidade e auxilia no ganho de massa muscular.',
      favorito: true, created_at: '2026-03-15', tags: ['Essencial', 'Diario'],
      dosagem: '5g/dia', horario: 'Pos-treino', objetivo: 'Ganho de forca e massa muscular'
    },
    {
      id: '2', nome: 'Whey Protein Isolado', categoria: 'Proteina',
      descricao: 'Proteina de rapida absorcao para recuperacao muscular pos-treino.',
      favorito: true, created_at: '2026-03-14', tags: ['Pos-treino', 'Proteico'],
      dosagem: '30g', horario: 'Pos-treino imediato', objetivo: 'Recuperacao muscular'
    },
    {
      id: '3', nome: 'Vitamina D3', categoria: 'Vitamina',
      descricao: 'Fundamental para a saude ossea, imunidade e regulacao hormonal.',
      favorito: false, created_at: '2026-03-13', tags: ['Saude', 'Imunidade'],
      dosagem: '2000 UI/dia', horario: 'Com o cafe', objetivo: 'Saude geral e imunidade'
    },
  ],
  fitoterapicos: [
    {
      id: '1', nome: 'Ashwagandha KSM-66', categoria: 'Adaptogeno',
      descricao: 'Reducao do estresse cronico, suporte adaptogenico, melhora do padrao de exaustao.',
      favorito: true, created_at: '2026-03-15', tags: ['Estresse', 'Adaptogeno'],
      dosagem: '600mg/dia (2x 300mg)', horario: '08:00 e 15:00, com alimento', objetivo: 'Reducao de estresse e fadiga'
    },
    {
      id: '2', nome: 'Rhodiola Rosea', categoria: 'Adaptogeno',
      descricao: 'Apoio a resiliencia psiquica, melhora cognitiva e reducao de sintomas depressivos.',
      favorito: false, created_at: '2026-03-14', tags: ['Cognitivo', 'Energia'],
      dosagem: '200mg/dia', horario: '09:00-10:00, longe de cafe', objetivo: 'Resiliencia e foco mental'
    },
    {
      id: '3', nome: 'Valeriana', categoria: 'Calmante',
      descricao: 'Auxilia na qualidade do sono e reducao da ansiedade leve a moderada.',
      favorito: true, created_at: '2026-03-13', tags: ['Sono', 'Relaxante'],
      dosagem: '300-600mg', horario: '1h antes de dormir', objetivo: 'Melhora do sono'
    },
  ],
};

export default function CadastroTabContent() {
  const params = useParams();
  const activeTab = params.tab as string;

  // Validate tab parameter
  if (!VALID_TABS.includes(activeTab as TabType)) {
    notFound();
  }

  const [data, setData] = useState<Record<TabType, CadastroItem[]>>(INITIAL_DATA);
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CadastroItem | null>(null);
  const [isClinicAdmin, setIsClinicAdmin] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientsPagination, setPatientsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([]);
  const [refeicaoLoading, setRefeicaoLoading] = useState(false);
  const [refeicaoSearch, setRefeicaoSearch] = useState('');
  const [refeicaoPagination, setRefeicaoPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [selectedRefeicao, setSelectedRefeicao] = useState<Refeicao | null>(null);
  const [refeicaoDetailLoading, setRefeicaoDetailLoading] = useState(false);
  const [showRefeicaoModal, setShowRefeicaoModal] = useState(false);
  const [editingRefeicao, setEditingRefeicao] = useState<Refeicao | null>(null);
  const [refeicaoFormData, setRefeicaoFormData] = useState({ nome: '', categoria: '', descricao: '', tags: [] as string[] });
  const [tagInput, setTagInput] = useState('');
  const [editingAlimentoId, setEditingAlimentoId] = useState<string | null>(null);
  const [alimentoFormData, setAlimentoFormData] = useState({ porcao_customizada: '', observacao: '' });
  const [alimentoSearch, setAlimentoSearch] = useState('');
  const [alimentoResults, setAlimentoResults] = useState<AlimentoNutricional[]>([]);
  const [alimentoSearchLoading, setAlimentoSearchLoading] = useState(false);
  const [showAlimentoSearch, setShowAlimentoSearch] = useState(false);
  const [showCreateAlimento, setShowCreateAlimento] = useState(false);
  const [newAlimentoForm, setNewAlimentoForm] = useState({ nome: '', categoria: '', porcao: '', calorias: '', proteinas: '', carboidratos: '', gorduras: '', fibras: '' });
  // Treinos state
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [treinoLoading, setTreinoLoading] = useState(false);
  const [treinoSearch, setTreinoSearch] = useState('');
  const [treinoPagination, setTreinoPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [selectedTreino, setSelectedTreino] = useState<Treino | null>(null);
  const [showTreinoModal, setShowTreinoModal] = useState(false);
  const [editingTreino, setEditingTreino] = useState<Treino | null>(null);
  const [treinoFormData, setTreinoFormData] = useState({ nome: '', categoria: '', descricao: '', tags: [] as string[] });
  const [treinoTagInput, setTreinoTagInput] = useState('');
  // Exercício search/edit state
  const [exercicioSearch, setExercicioSearch] = useState('');
  const [exercicioResults, setExercicioResults] = useState<Exercicio[]>([]);
  const [exercicioSearchLoading, setExercicioSearchLoading] = useState(false);
  const [showExercicioSearch, setShowExercicioSearch] = useState(false);
  const [showCreateExercicio, setShowCreateExercicio] = useState(false);
  const [newExercicioForm, setNewExercicioForm] = useState({ nome: '', grupo_muscular: '', equipamento: '', descricao: '', url_tutorial: '' });
  const [editingExercicioId, setEditingExercicioId] = useState<string | null>(null);
  const [exercicioFormData, setExercicioFormData] = useState({ series: '', repeticoes: '', descanso: '', observacao: '' });
  const [alimentoGrams, setAlimentoGrams] = useState<Record<string, string>>({});
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();

  // Check clinic admin permission
  useEffect(() => {
    const checkClinicAdmin = async () => {
      if (!user?.id) { setIsClinicAdmin(false); return; }
      try {
        const { data, error } = await supabase
          .from('medicos')
          .select('admin, clinica_admin')
          .eq('user_auth', user.id)
          .maybeSingle();
        if (error) { setIsClinicAdmin(false); return; }
        setIsClinicAdmin(data?.clinica_admin === true || data?.admin === true);
      } catch { setIsClinicAdmin(false); }
    };
    checkClinicAdmin();
  }, [user?.id]);

  // Inicializar gramatura dos alimentos (valores da TACO são por 100g)
  useEffect(() => {
    const alimentos = editingRefeicao?.alimentos || selectedRefeicao?.alimentos || [];
    const grams: Record<string, string> = {};
    alimentos.forEach(a => {
      grams[a.id] = a.porcao_customizada || '100';
    });
    setAlimentoGrams(prev => {
      // Merge: keep existing edits, add new ones
      const merged = { ...prev };
      alimentos.forEach(a => {
        if (!(a.id in merged)) {
          merged[a.id] = a.porcao_customizada || '100';
        }
      });
      return merged;
    });
  }, [editingRefeicao?.alimentos, selectedRefeicao?.alimentos]);

  // Calcular valor nutricional baseado na gramatura (referência é por 100g)
  const calcNutri = (baseValue: number | null | undefined, grams: string) => {
    const g = parseFloat(grams);
    if (baseValue == null || isNaN(g) || g <= 0) return null;
    return Math.round((baseValue / 100) * g * 10) / 10;
  };

  // Salvar gramatura ao sair do campo
  const handleGramBlur = async (refeicaoId: string, alimentoId: string) => {
    const grams = alimentoGrams[alimentoId];
    const alimentos = editingRefeicao?.alimentos || selectedRefeicao?.alimentos || [];
    const current = alimentos.find(a => a.id === alimentoId);
    if (current && current.porcao_customizada !== grams) {
      await handleUpdateAlimento(refeicaoId, alimentoId, { porcao_customizada: grams });
    }
  };

  // ==================== TREINOS ====================
  const fetchTreinos = async (page = 1, searchVal = '') => {
    try {
      setTreinoLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: treinoPagination.limit.toString() });
      if (searchVal) params.append('search', searchVal);
      if (showFavoritesOnly) params.append('favoritos', 'true');
      const data = await gatewayClient.get<TreinoResponse>(`/cadastro-treinos?${params}`);
      if (data.success) {
        setTreinos(data.treinos);
        setTreinoPagination(data.pagination);
      }
    } catch (err) {
      console.error('Erro ao buscar treinos:', err);
    } finally {
      setTreinoLoading(false);
    }
  };

  const fetchTreinoDetail = async (id: string) => {
    try {
      const data = await gatewayClient.get<{ treino: Treino }>(`/cadastro-treinos/${id}`);
      if (data.success) {
        setSelectedTreino(data.treino);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes do treino:', err);
    }
  };

  const handleSaveTreino = async () => {
    if (!treinoFormData.nome.trim()) { showError('Nome é obrigatório'); return; }
    try {
      if (editingTreino) {
        const resp = await gatewayClient.put(`/cadastro-treinos/${editingTreino.id}`, treinoFormData);
        if (!resp.success) throw new Error(resp.error);
        showSuccess('Treino atualizado com sucesso');
        setShowTreinoModal(false);
        setEditingTreino(null);
      } else {
        const resp = await gatewayClient.post('/cadastro-treinos', treinoFormData);
        if (!resp.success) throw new Error(resp.error);
        showSuccess('Treino criado! Agora adicione os exercícios.');
        const detail = await gatewayClient.get<{ treino: Treino }>(`/cadastro-treinos/${resp.treino.id}`);
        if (detail.success) {
          setEditingTreino(detail.treino);
          setTreinoFormData({ nome: detail.treino.nome, categoria: detail.treino.categoria || '', descricao: detail.treino.descricao || '', tags: detail.treino.tags || [] });
        }
      }
      fetchTreinos(1, treinoSearch);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao salvar treino');
    }
  };

  const handleDeleteTreino = async (id: string) => {
    try {
      const resp = await gatewayClient.delete(`/cadastro-treinos/${id}`);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Treino removido com sucesso');
      setSelectedTreino(null);
      fetchTreinos(1, treinoSearch);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao remover treino');
    }
  };

  const handleToggleFavoritoTreino = async (id: string) => {
    try {
      await gatewayClient.patch(`/cadastro-treinos/${id}/favorito`, {});
      fetchTreinos(treinoPagination.page, treinoSearch);
    } catch (err) {
      showError('Erro ao atualizar favorito');
    }
  };

  // Buscar exercícios do catálogo
  const searchExercicios = async (searchVal: string) => {
    if (!searchVal.trim()) { setExercicioResults([]); return; }
    try {
      setExercicioSearchLoading(true);
      const params = new URLSearchParams({ search: searchVal, limit: '15' });
      const data = await gatewayClient.get<{ exercicios: Exercicio[] }>(`/cadastro-exercicios?${params}`);
      if (data.success) setExercicioResults(data.exercicios || []);
    } catch (err) {
      console.error('Erro ao buscar exercícios:', err);
    } finally {
      setExercicioSearchLoading(false);
    }
  };

  // Debounce busca de exercícios
  useEffect(() => {
    if (!showExercicioSearch) return;
    const timeoutId = setTimeout(() => { searchExercicios(exercicioSearch); }, 400);
    return () => clearTimeout(timeoutId);
  }, [exercicioSearch, showExercicioSearch]);

  const handleAddExercicioToTreino = async (treinoId: string, exercicioId: string) => {
    try {
      const resp = await gatewayClient.post(`/cadastro-treinos/${treinoId}/exercicios`, { exercicio_id: exercicioId });
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Exercício adicionado ao treino');
      setExercicioSearch('');
      setExercicioResults([]);
      const detail = await gatewayClient.get<{ treino: Treino }>(`/cadastro-treinos/${treinoId}`);
      if (detail.success) {
        if (selectedTreino?.id === treinoId) setSelectedTreino(detail.treino);
        if (editingTreino?.id === treinoId) setEditingTreino(detail.treino);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao adicionar exercício');
    }
  };

  const handleCreateAndAddExercicio = async (treinoId: string) => {
    if (!newExercicioForm.nome.trim()) { showError('Nome do exercício é obrigatório'); return; }
    try {
      const createResp = await gatewayClient.post('/cadastro-exercicios', {
        nome: newExercicioForm.nome.trim(),
        grupo_muscular: newExercicioForm.grupo_muscular || null,
        equipamento: newExercicioForm.equipamento || null,
        descricao: newExercicioForm.descricao || null,
        url_tutorial: newExercicioForm.url_tutorial || null,
      });
      if (!createResp.success) throw new Error(createResp.error);
      await handleAddExercicioToTreino(treinoId, createResp.exercicio.id);
      setShowCreateExercicio(false);
      setNewExercicioForm({ nome: '', grupo_muscular: '', equipamento: '', descricao: '', url_tutorial: '' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar exercício');
    }
  };

  const handleUpdateTreinoExercicio = async (treinoId: string, itemId: string, data: any) => {
    try {
      const resp = await gatewayClient.put(`/cadastro-treinos/${treinoId}/exercicios/${itemId}`, data);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Exercício atualizado');
      setEditingExercicioId(null);
      const detail = await gatewayClient.get<{ treino: Treino }>(`/cadastro-treinos/${treinoId}`);
      if (detail.success) {
        if (selectedTreino?.id === treinoId) setSelectedTreino(detail.treino);
        if (editingTreino?.id === treinoId) setEditingTreino(detail.treino);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar exercício');
    }
  };

  const handleDeleteTreinoExercicio = async (treinoId: string, itemId: string) => {
    try {
      const resp = await gatewayClient.delete(`/cadastro-treinos/${treinoId}/exercicios/${itemId}`);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Exercício removido do treino');
      const detail = await gatewayClient.get<{ treino: Treino }>(`/cadastro-treinos/${treinoId}`);
      if (detail.success) {
        if (selectedTreino?.id === treinoId) setSelectedTreino(detail.treino);
        if (editingTreino?.id === treinoId) setEditingTreino(detail.treino);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao remover exercício');
    }
  };

  // Carregar treinos quando na aba treinos
  useEffect(() => {
    if (activeTab === 'treinos') fetchTreinos(1, '');
  }, [activeTab]);

  // Debounce busca de treinos
  useEffect(() => {
    if (activeTab !== 'treinos') return;
    const timeoutId = setTimeout(() => { fetchTreinos(1, treinoSearch); }, 500);
    return () => clearTimeout(timeoutId);
  }, [treinoSearch, showFavoritesOnly]);

  // Buscar pacientes da API
  const fetchPatients = async (page = 1, searchVal = '') => {
    try {
      setPatientsLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: patientsPagination.limit.toString() });
      if (searchVal) params.append('search', searchVal);
      const data = await gatewayClient.get<PatientsResponse>(`/patients?${params}`);
      if (data.success) {
        setPatients(data.patients);
        setPatientsPagination(data.pagination);
      }
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err);
    } finally {
      setPatientsLoading(false);
    }
  };

  // Carregar pacientes quando na aba pacientes
  useEffect(() => {
    if (activeTab === 'pacientes') {
      fetchPatients(1, '');
    }
  }, [activeTab]);

  // Debounce busca de pacientes
  useEffect(() => {
    if (activeTab !== 'pacientes') return;
    const timeoutId = setTimeout(() => {
      fetchPatients(1, patientSearch);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [patientSearch]);

  // Buscar refeições da API
  const fetchRefeicoes = async (page = 1, searchVal = '') => {
    try {
      setRefeicaoLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: refeicaoPagination.limit.toString() });
      if (searchVal) params.append('search', searchVal);
      if (showFavoritesOnly) params.append('favoritos', 'true');
      const data = await gatewayClient.get<RefeicaoResponse>(`/cadastro-refeicoes?${params}`);
      if (data.success) {
        setRefeicoes(data.refeicoes);
        setRefeicaoPagination(data.pagination);
      }
    } catch (err) {
      console.error('Erro ao buscar refeições:', err);
    } finally {
      setRefeicaoLoading(false);
    }
  };

  // Buscar detalhes de uma refeição (com alimentos)
  const fetchRefeicaoDetail = async (id: string) => {
    try {
      setRefeicaoDetailLoading(true);
      const data = await gatewayClient.get<{ refeicao: Refeicao }>(`/cadastro-refeicoes/${id}`);
      if (data.success) {
        setSelectedRefeicao(data.refeicao);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da refeição:', err);
    } finally {
      setRefeicaoDetailLoading(false);
    }
  };

  // Carregar refeições quando na aba refeicoes
  useEffect(() => {
    if (activeTab === 'refeicoes') {
      fetchRefeicoes(1, '');
    }
  }, [activeTab]);

  // Debounce busca de refeições
  useEffect(() => {
    if (activeTab !== 'refeicoes') return;
    const timeoutId = setTimeout(() => {
      fetchRefeicoes(1, refeicaoSearch);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [refeicaoSearch, showFavoritesOnly]);

  // Criar/atualizar refeição
  const handleSaveRefeicao = async () => {
    if (!refeicaoFormData.nome.trim()) {
      showError('Nome é obrigatório');
      return;
    }
    try {
      if (editingRefeicao) {
        const resp = await gatewayClient.put(`/cadastro-refeicoes/${editingRefeicao.id}`, refeicaoFormData);
        if (!resp.success) throw new Error(resp.error);
        showSuccess('Refeição atualizada com sucesso');
        setShowRefeicaoModal(false);
        setEditingRefeicao(null);
      } else {
        // Criar e entrar em modo de edição para adicionar alimentos
        const resp = await gatewayClient.post('/cadastro-refeicoes', refeicaoFormData);
        if (!resp.success) throw new Error(resp.error);
        showSuccess('Refeição criada! Agora adicione os alimentos.');
        // Buscar a refeição criada com detalhes completos
        const detail = await gatewayClient.get<{ refeicao: Refeicao }>(`/cadastro-refeicoes/${resp.refeicao.id}`);
        if (detail.success) {
          setEditingRefeicao(detail.refeicao);
          setRefeicaoFormData({
            nome: detail.refeicao.nome,
            categoria: detail.refeicao.categoria || '',
            descricao: detail.refeicao.descricao || '',
            tags: detail.refeicao.tags || [],
          });
        }
      }
      fetchRefeicoes(1, refeicaoSearch);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao salvar refeição');
    }
  };

  // Deletar refeição
  const handleDeleteRefeicao = async (id: string) => {
    try {
      const resp = await gatewayClient.delete(`/cadastro-refeicoes/${id}`);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Refeição removida com sucesso');
      setSelectedRefeicao(null);
      fetchRefeicoes(1, refeicaoSearch);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao remover refeição');
    }
  };

  // Toggle favorito refeição
  const handleToggleFavoritoRefeicao = async (id: string) => {
    try {
      await gatewayClient.patch(`/cadastro-refeicoes/${id}/favorito`, {});
      fetchRefeicoes(refeicaoPagination.page, refeicaoSearch);
    } catch (err) {
      showError('Erro ao atualizar favorito');
    }
  };

  // Atualizar alimento da refeição (porção, observação)
  const handleUpdateAlimento = async (refeicaoId: string, alimentoId: string, data: { porcao_customizada?: string; observacao?: string }) => {
    try {
      const resp = await gatewayClient.put(`/cadastro-refeicoes/${refeicaoId}/alimentos/${alimentoId}`, data);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Alimento atualizado');
      setEditingAlimentoId(null);
      // Refresh detail
      const detail = await gatewayClient.get<{ refeicao: Refeicao }>(`/cadastro-refeicoes/${refeicaoId}`);
      if (detail.success) {
        if (selectedRefeicao?.id === refeicaoId) setSelectedRefeicao(detail.refeicao);
        if (editingRefeicao?.id === refeicaoId) setEditingRefeicao(detail.refeicao);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar alimento');
    }
  };

  // Remover alimento da refeição
  const handleDeleteAlimento = async (refeicaoId: string, alimentoId: string) => {
    try {
      const resp = await gatewayClient.delete(`/cadastro-refeicoes/${refeicaoId}/alimentos/${alimentoId}`);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Alimento removido da refeição');
      // Refresh detail
      const detail = await gatewayClient.get<{ refeicao: Refeicao }>(`/cadastro-refeicoes/${refeicaoId}`);
      if (detail.success) {
        if (selectedRefeicao?.id === refeicaoId) setSelectedRefeicao(detail.refeicao);
        if (editingRefeicao?.id === refeicaoId) setEditingRefeicao(detail.refeicao);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao remover alimento');
    }
  };

  // Buscar alimentos da tabela nutricional (referência)
  const searchAlimentos = async (searchVal: string) => {
    if (!searchVal.trim()) { setAlimentoResults([]); return; }
    try {
      setAlimentoSearchLoading(true);
      const params = new URLSearchParams({ search: searchVal, limit: '15' });
      const data = await gatewayClient.get<{ alimentos: AlimentoNutricional[] }>(`/alimentos-nutricionais?${params}`);
      if (data.success) {
        setAlimentoResults(data.alimentos);
      }
    } catch (err) {
      console.error('Erro ao buscar alimentos:', err);
    } finally {
      setAlimentoSearchLoading(false);
    }
  };

  // Debounce busca de alimentos
  useEffect(() => {
    if (!showAlimentoSearch) return;
    const timeoutId = setTimeout(() => {
      searchAlimentos(alimentoSearch);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [alimentoSearch, showAlimentoSearch]);

  // Adicionar alimento nutricional à refeição (cria cadastro_alimentos a partir dos dados nutricionais)
  const handleAddAlimentoNutricionalToRefeicao = async (refeicaoId: string, alNutri: AlimentoNutricional) => {
    try {
      // Criar um cadastro_alimentos a partir dos dados nutricionais
      const createResp = await gatewayClient.post('/cadastro-alimentos', {
        nome: alNutri.nome,
        categoria: alNutri.categoria || null,
        calorias: alNutri.energia_kcal ? parseFloat(alNutri.energia_kcal) : null,
        proteinas: alNutri.proteina_g ? parseFloat(alNutri.proteina_g) : null,
        carboidratos: alNutri.carboidrato_g ? parseFloat(alNutri.carboidrato_g) : null,
        gorduras: alNutri.lipideos_g ? parseFloat(alNutri.lipideos_g) : null,
        fibras: alNutri.fibra_alimentar_g ? parseFloat(alNutri.fibra_alimentar_g) : null,
      });
      if (!createResp.success) throw new Error(createResp.error);

      // Adicionar à refeição
      const resp = await gatewayClient.post(`/cadastro-refeicoes/${refeicaoId}/alimentos`, { alimento_id: createResp.alimento.id });
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Alimento adicionado à refeição');
      setAlimentoSearch('');
      setAlimentoResults([]);
      // Refresh detail
      const detail = await gatewayClient.get<{ refeicao: Refeicao }>(`/cadastro-refeicoes/${refeicaoId}`);
      if (detail.success) {
        if (selectedRefeicao?.id === refeicaoId) setSelectedRefeicao(detail.refeicao);
        if (editingRefeicao?.id === refeicaoId) setEditingRefeicao(detail.refeicao);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao adicionar alimento');
    }
  };

  // Criar novo alimento e adicioná-lo à refeição
  const handleCreateAndAddAlimento = async (refeicaoId: string) => {
    if (!newAlimentoForm.nome.trim()) {
      showError('Nome do alimento é obrigatório');
      return;
    }
    try {
      const createResp = await gatewayClient.post('/cadastro-alimentos', {
        nome: newAlimentoForm.nome.trim(),
        categoria: newAlimentoForm.categoria || null,
        porcao: newAlimentoForm.porcao || null,
        calorias: newAlimentoForm.calorias ? parseInt(newAlimentoForm.calorias) : null,
        proteinas: newAlimentoForm.proteinas ? parseFloat(newAlimentoForm.proteinas) : null,
        carboidratos: newAlimentoForm.carboidratos ? parseFloat(newAlimentoForm.carboidratos) : null,
        gorduras: newAlimentoForm.gorduras ? parseFloat(newAlimentoForm.gorduras) : null,
        fibras: newAlimentoForm.fibras ? parseFloat(newAlimentoForm.fibras) : null,
      });
      if (!createResp.success) throw new Error(createResp.error);

      // Adicionar à refeição
      await handleAddAlimentoToRefeicao(refeicaoId, createResp.alimento.id);
      setShowCreateAlimento(false);
      setNewAlimentoForm({ nome: '', categoria: '', porcao: '', calorias: '', proteinas: '', carboidratos: '', gorduras: '', fibras: '' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar alimento');
    }
  };

  const calculateAge = (dateString?: string) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  // Persist data to localStorage so FavoritesPanel in consultas can read it
  useEffect(() => {
    try {
      localStorage.setItem('cadastro_data', JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar cadastro no localStorage:', e);
    }
  }, [data]);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cadastro_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Erro ao carregar cadastro do localStorage:', e);
    }
  }, []);

  // Reset search/filters when tab changes
  useEffect(() => {
    setSearch('');
    setShowFavoritesOnly(false);
  }, [activeTab]);

  // Form state
  const [formData, setFormData] = useState({
    nome: '', categoria: '', descricao: '', favorito: false,
    calorias: '', proteinas: '', carboidratos: '', gorduras: '', tempo_preparo: '',
    grupo_muscular: '', series: '', repeticoes: '', descanso: '', equipamento: '',
    dosagem: '', horario: '', objetivo: '',
  });

  const items = data[activeTab as TabType] || [];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.descricao.toLowerCase().includes(search.toLowerCase()) ||
      item.categoria.toLowerCase().includes(search.toLowerCase());
    const matchesFavorite = showFavoritesOnly ? item.favorito : true;
    return matchesSearch && matchesFavorite;
  });

  const toggleFavorite = (id: string) => {
    setData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab as TabType].map(item =>
        item.id === id ? { ...item, favorito: !item.favorito } : item
      )
    }));
  };

  const deleteItem = (id: string) => {
    setData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab as TabType].filter(item => item.id !== id)
    }));
    showSuccess('Item removido com sucesso');
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      nome: '', categoria: '', descricao: '', favorito: false,
      calorias: '', proteinas: '', carboidratos: '', gorduras: '', tempo_preparo: '',
      grupo_muscular: '', series: '', repeticoes: '', descanso: '', equipamento: '',
      dosagem: '', horario: '', objetivo: '',
    });
    setShowModal(true);
  };

  const openEditModal = (item: CadastroItem) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome, categoria: item.categoria, descricao: item.descricao, favorito: item.favorito,
      calorias: item.calorias?.toString() || '', proteinas: item.proteinas?.toString() || '',
      carboidratos: item.carboidratos?.toString() || '', gorduras: item.gorduras?.toString() || '',
      tempo_preparo: item.tempo_preparo || '',
      grupo_muscular: item.grupo_muscular || '', series: item.series?.toString() || '',
      repeticoes: item.repeticoes || '', descanso: item.descanso || '', equipamento: item.equipamento || '',
      dosagem: item.dosagem || '', horario: item.horario || '', objetivo: item.objetivo || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.nome.trim()) {
      showError('Nome e obrigatorio');
      return;
    }

    const newItem: CadastroItem = {
      id: editingItem?.id || Date.now().toString(),
      nome: formData.nome,
      categoria: formData.categoria,
      descricao: formData.descricao,
      favorito: formData.favorito,
      created_at: editingItem?.created_at || new Date().toISOString().split('T')[0],
      tags: formData.categoria ? [formData.categoria] : [],
      ...(activeTab === 'refeicoes' && {
        calorias: formData.calorias ? parseInt(formData.calorias) : undefined,
        proteinas: formData.proteinas ? parseInt(formData.proteinas) : undefined,
        carboidratos: formData.carboidratos ? parseInt(formData.carboidratos) : undefined,
        gorduras: formData.gorduras ? parseInt(formData.gorduras) : undefined,
        tempo_preparo: formData.tempo_preparo,
      }),
      ...(activeTab === 'treinos' && {
        grupo_muscular: formData.grupo_muscular,
        series: formData.series ? parseInt(formData.series) : undefined,
        repeticoes: formData.repeticoes,
        descanso: formData.descanso,
        equipamento: formData.equipamento,
      }),
      ...((activeTab === 'suplementos' || activeTab === 'fitoterapicos') && {
        dosagem: formData.dosagem,
        horario: formData.horario,
        objetivo: formData.objetivo,
      }),
    };

    setData(prev => ({
      ...prev,
      [activeTab]: editingItem
        ? prev[activeTab as TabType].map(item => item.id === editingItem.id ? newItem : item)
        : [...prev[activeTab as TabType], newItem]
    }));

    setShowModal(false);
    showSuccess(editingItem ? 'Item atualizado com sucesso' : 'Item cadastrado com sucesso');
  };

  const handleCreatePatient = async (patientData: any) => {
    try {
      const response = await gatewayClient.post('/patients', patientData);
      if (!response.success) throw new Error(response.error || 'Erro ao cadastrar paciente');
      showSuccess('Paciente cadastrado com sucesso');
      setShowPatientForm(false);
      fetchPatients(1, patientSearch);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao cadastrar paciente');
      throw err;
    }
  };

  const getCategoryOptions = () => {
    switch (activeTab) {
      case 'refeicoes':
        return ['Cafe da manha', 'Lanche da manha', 'Almoco', 'Lanche da tarde', 'Jantar', 'Ceia', 'Pre-treino', 'Pos-treino'];
      case 'treinos':
        return ['Peito', 'Costas', 'Ombros', 'Biceps', 'Triceps', 'Pernas', 'Gluteos', 'Abdomen', 'Cardio', 'Funcional'];
      case 'suplementos':
        return ['Proteina', 'Aminoacido', 'Vitamina', 'Mineral', 'Performance', 'Saude', 'Recuperacao'];
      case 'fitoterapicos':
        return ['Adaptogeno', 'Calmante', 'Anti-inflamatorio', 'Digestivo', 'Imunidade', 'Hormonal', 'Cognitivo'];
      default:
        return [];
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'pacientes': return 'Pacientes';
      case 'refeicoes': return 'Refeicoes';
      case 'treinos': return 'Exercicios';
      case 'suplementos': return 'Suplementos';
      case 'fitoterapicos': return 'Fitoterapicos';
    }
  };

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'pacientes': return 'Gerencie seus pacientes cadastrados';
      case 'refeicoes': return 'Cadastre refeicoes para usar nos planos alimentares';
      case 'treinos': return 'Cadastre exercicios para montar protocolos de treino';
      case 'suplementos': return 'Cadastre suplementos para protocolos de suplementacao';
      case 'fitoterapicos': return 'Cadastre fitoterapicos para protocolos naturais';
    }
  };

  const renderCardContent = (item: CadastroItem) => {
    if (activeTab === 'refeicoes') {
      return (
        <div className="cadastro-card-info">
          {item.calorias && <span className="cadastro-card-tag highlight"><Flame size={12} /> {item.calorias} kcal</span>}
          {item.proteinas && <span className="cadastro-card-tag">P: {item.proteinas}g</span>}
          {item.carboidratos && <span className="cadastro-card-tag">C: {item.carboidratos}g</span>}
          {item.gorduras && <span className="cadastro-card-tag">G: {item.gorduras}g</span>}
          {item.tempo_preparo && <span className="cadastro-card-tag"><Clock size={12} /> {item.tempo_preparo}</span>}
        </div>
      );
    }
    if (activeTab === 'treinos') {
      return (
        <div className="cadastro-card-info">
          {item.grupo_muscular && <span className="cadastro-card-tag highlight"><Dumbbell size={12} /> {item.grupo_muscular}</span>}
          {item.series && <span className="cadastro-card-tag">{item.series} series</span>}
          {item.repeticoes && <span className="cadastro-card-tag">{item.repeticoes} reps</span>}
          {item.descanso && <span className="cadastro-card-tag"><Clock size={12} /> {item.descanso}</span>}
          {item.equipamento && <span className="cadastro-card-tag">{item.equipamento}</span>}
        </div>
      );
    }
    if (activeTab === 'suplementos' || activeTab === 'fitoterapicos') {
      return (
        <div className="cadastro-card-info">
          {item.dosagem && <span className="cadastro-card-tag highlight"><Pill size={12} /> {item.dosagem}</span>}
          {item.horario && <span className="cadastro-card-tag"><Clock size={12} /> {item.horario}</span>}
          {item.objetivo && <span className="cadastro-card-tag">{item.objetivo}</span>}
        </div>
      );
    }
    return null;
  };

  const renderFormFields = () => {
    if (activeTab === 'refeicoes') {
      return (
        <>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Calorias (kcal)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 420"
                value={formData.calorias} onChange={e => setFormData(p => ({ ...p, calorias: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Tempo de preparo</label>
              <input className="cadastro-form-input" placeholder="Ex: 30 min"
                value={formData.tempo_preparo} onChange={e => setFormData(p => ({ ...p, tempo_preparo: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Proteinas (g)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 45"
                value={formData.proteinas} onChange={e => setFormData(p => ({ ...p, proteinas: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Carboidratos (g)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 35"
                value={formData.carboidratos} onChange={e => setFormData(p => ({ ...p, carboidratos: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Gorduras (g)</label>
            <input type="number" className="cadastro-form-input" placeholder="Ex: 10"
              value={formData.gorduras} onChange={e => setFormData(p => ({ ...p, gorduras: e.target.value }))} />
          </div>
        </>
      );
    }
    if (activeTab === 'treinos') {
      return (
        <>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Grupo muscular</label>
              <input className="cadastro-form-input" placeholder="Ex: Peitoral"
                value={formData.grupo_muscular} onChange={e => setFormData(p => ({ ...p, grupo_muscular: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Equipamento</label>
              <input className="cadastro-form-input" placeholder="Ex: Halter, Barra"
                value={formData.equipamento} onChange={e => setFormData(p => ({ ...p, equipamento: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Series</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 4"
                value={formData.series} onChange={e => setFormData(p => ({ ...p, series: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Repeticoes</label>
              <input className="cadastro-form-input" placeholder="Ex: 8-12"
                value={formData.repeticoes} onChange={e => setFormData(p => ({ ...p, repeticoes: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Descanso</label>
            <input className="cadastro-form-input" placeholder="Ex: 90s"
              value={formData.descanso} onChange={e => setFormData(p => ({ ...p, descanso: e.target.value }))} />
          </div>
        </>
      );
    }
    if (activeTab === 'suplementos' || activeTab === 'fitoterapicos') {
      return (
        <>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Dosagem</label>
            <input className="cadastro-form-input" placeholder="Ex: 5g/dia, 600mg 2x ao dia"
              value={formData.dosagem} onChange={e => setFormData(p => ({ ...p, dosagem: e.target.value }))} />
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Horario</label>
            <input className="cadastro-form-input" placeholder="Ex: Pos-treino, 08:00 com alimento"
              value={formData.horario} onChange={e => setFormData(p => ({ ...p, horario: e.target.value }))} />
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Objetivo</label>
            <textarea className="cadastro-form-textarea" placeholder="Descreva o objetivo deste item..."
              value={formData.objetivo} onChange={e => setFormData(p => ({ ...p, objetivo: e.target.value }))} />
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="cadastro-page">
      <div className="cadastro-container">
        {/* Header */}
        <div className="cadastro-header">
          <div className="cadastro-header-content">
            <div>
              <h1 className="cadastro-title">Cadastro</h1>
              <p className="cadastro-subtitle">Gerencie seus cadastros de pacientes, refeicoes, treinos, suplementos e fitoterapicos.</p>
            </div>
          </div>
        </div>

        {/* Tabs - now using Link for URL-based navigation */}
        <div className="cadastro-tabs">
          {TABS.filter(tab => !tab.adminOnly || isClinicAdmin).map(tab => {
            const Icon = tab.icon;
            const count = tab.key === 'pacientes' ? patientsPagination.total : tab.key === 'refeicoes' ? refeicaoPagination.total : tab.key === 'treinos' ? treinoPagination.total : tab.key === 'clinica' ? 0 : (data[tab.key]?.length || 0);
            return (
              <Link
                key={tab.key}
                href={`/cadastro/${tab.key}`}
                className={`cadastro-tab ${activeTab === tab.key ? 'active' : ''}`}
              >
                <Icon size={18} />
                {tab.label}
                {count > 0 && <span className="cadastro-tab-count">{count}</span>}
              </Link>
            );
          })}
        </div>

        {/* Clinica Tab */}
        {activeTab === 'clinica' ? (
          <ClinicManagementPage />
        ) : activeTab === 'pacientes' ? (
          <div>
            {showPatientForm ? (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
                <PatientForm
                  onSubmit={handleCreatePatient}
                  onCancel={() => setShowPatientForm(false)}
                  title="Novo Paciente"
                />
              </div>
            ) : (
              <>
                <div className="cadastro-section-header">
                  <div>
                    <h2 className="cadastro-section-title">Pacientes</h2>
                    <p className="cadastro-section-subtitle">Gerencie seus pacientes cadastrados</p>
                  </div>
                  <button className="cadastro-btn-add" onClick={() => setShowPatientForm(true)}>
                    <Plus size={18} />
                    Novo Paciente
                  </button>
                </div>

                {/* Busca de pacientes */}
                <div className="cadastro-filters">
                  <div className="cadastro-search">
                    <Search />
                    <input
                      placeholder="Buscar pacientes..."
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                    />
                  </div>
                </div>

                {patientsLoading ? (
                  <div className="cadastro-empty">
                    <Loader2 size={28} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <p className="cadastro-empty-text">Carregando pacientes...</p>
                  </div>
                ) : patients.length === 0 ? (
                  <div className="cadastro-empty">
                    <div className="cadastro-empty-icon">
                      <UserPlus size={28} />
                    </div>
                    <h3 className="cadastro-empty-title">
                      {patientSearch ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
                    </h3>
                    <p className="cadastro-empty-text">
                      {patientSearch ? 'Tente buscar com outros termos.' : 'Clique no botao acima para cadastrar um novo paciente.'}
                    </p>
                    {!patientSearch && (
                      <button className="cadastro-empty-btn" onClick={() => setShowPatientForm(true)}>
                        <Plus size={16} />
                        Novo Paciente
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cadastro-grid">
                    {patients.map(patient => {
                      const age = calculateAge(patient.birth_date);
                      return (
                        <div key={patient.id} className="cadastro-card">
                          <div className="cadastro-card-header">
                            <div>
                              <h3 className="cadastro-card-title">{patient.name}</h3>
                              <span className="cadastro-card-category">
                                {patient.status === 'active' ? 'Ativo' : patient.status === 'inactive' ? 'Inativo' : 'Arquivado'}
                              </span>
                            </div>
                            <div className="cadastro-card-actions">
                              <Link href={`/pacientes/detalhes?id=${patient.id}`} title="Ver detalhes">
                                <button className="cadastro-card-btn">
                                  <Eye size={16} />
                                </button>
                              </Link>
                            </div>
                          </div>
                          <div className="cadastro-card-body">
                            <div className="cadastro-card-info">
                              {patient.email && (
                                <span className="cadastro-card-tag"><Mail size={12} /> {patient.email}</span>
                              )}
                              {patient.phone && (
                                <span className="cadastro-card-tag"><Phone size={12} /> {patient.phone}</span>
                              )}
                              {age !== null && (
                                <span className="cadastro-card-tag"><Calendar size={12} /> {age} anos</span>
                              )}
                              {patient.city && patient.state && (
                                <span className="cadastro-card-tag">{patient.city}/{patient.state}</span>
                              )}
                            </div>
                          </div>
                          <div className="cadastro-card-footer">
                            <span className="cadastro-card-date">
                              Cadastrado em {new Date(patient.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            {patient.anamnese && (
                              <span className="cadastro-card-badge-fav" style={{
                                background: patient.anamnese.status === 'preenchida' ? '#ECFDF5' : '#FEF3C7',
                                color: patient.anamnese.status === 'preenchida' ? '#059669' : '#D97706'
                              }}>
                                {patient.anamnese.status === 'preenchida' ? 'Anamnese preenchida' : 'Anamnese pendente'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Paginacao */}
                {patientsPagination.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                    {Array.from({ length: patientsPagination.totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => fetchPatients(page, patientSearch)}
                        className={`cadastro-card-btn ${page === patientsPagination.page ? 'favorite' : ''}`}
                        style={{ minWidth: '36px', padding: '6px 10px', borderRadius: '8px' }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'refeicoes' ? (
          <div>
            {/* Detalhe da refeição selecionada */}
            {selectedRefeicao ? (
              <div>
                {/* Back button */}
                <button
                  onClick={() => setSelectedRefeicao(null)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '14px', color: '#64748B', padding: '0', marginBottom: '16px',
                    fontFamily: 'inherit', fontWeight: 500,
                  }}
                >
                  ← Voltar para lista
                </button>

                {/* Refeição detail card */}
                <div className="cadastro-card" style={{ marginBottom: '20px', cursor: 'default' }}>
                  <div className="cadastro-card-header">
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                        {selectedRefeicao.nome}
                      </h2>
                      {selectedRefeicao.categoria && (
                        <span className="cadastro-card-category">{selectedRefeicao.categoria}</span>
                      )}
                    </div>
                    <div className="cadastro-card-actions">
                      <button className="cadastro-card-btn" onClick={() => {
                        setEditingRefeicao(selectedRefeicao);
                        setRefeicaoFormData({
                          nome: selectedRefeicao.nome,
                          categoria: selectedRefeicao.categoria || '',
                          descricao: selectedRefeicao.descricao || '',
                          tags: selectedRefeicao.tags || [],
                        });
                        setTagInput('');
                        setShowRefeicaoModal(true);
                      }} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button
                        className={`cadastro-card-btn ${selectedRefeicao.favorito ? 'favorite' : ''}`}
                        onClick={() => handleToggleFavoritoRefeicao(selectedRefeicao.id)}
                        title={selectedRefeicao.favorito ? 'Remover favorito' : 'Adicionar favorito'}
                      >
                        <Star size={16} fill={selectedRefeicao.favorito ? 'currentColor' : 'none'} />
                      </button>
                      <button className="cadastro-card-btn" onClick={() => {
                        if (confirm('Tem certeza que deseja remover esta refeição?')) {
                          handleDeleteRefeicao(selectedRefeicao.id);
                        }
                      }} title="Excluir" style={{ color: '#EF4444', borderColor: '#FECACA' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {selectedRefeicao.descricao && (
                    <div style={{ padding: '0', marginBottom: '12px' }}>
                      <p style={{ color: '#4B5563', lineHeight: '1.6', fontSize: '14px' }}>{selectedRefeicao.descricao}</p>
                    </div>
                  )}

                  {selectedRefeicao.tags && selectedRefeicao.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {selectedRefeicao.tags.map((tag, i) => (
                        <span key={i} className="cadastro-card-tag highlight">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="cadastro-card-footer">
                    <span className="cadastro-card-date">
                      Criado em {new Date(selectedRefeicao.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    {selectedRefeicao.favorito && (
                      <span className="cadastro-card-badge-fav">
                        <Star size={12} fill="currentColor" /> Favorito
                      </span>
                    )}
                  </div>
                </div>

                {/* Alimentos section */}
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                    Alimentos da refeição
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B' }}>
                    {selectedRefeicao.alimentos?.length || 0} alimento(s) cadastrado(s)
                  </p>
                </div>

                {refeicaoDetailLoading ? (
                  <div className="cadastro-empty">
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <p className="cadastro-empty-text">Carregando alimentos...</p>
                  </div>
                ) : selectedRefeicao.alimentos && selectedRefeicao.alimentos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedRefeicao.alimentos.map((item, idx) => {
                      const al = item.cadastro_alimentos;
                      const grams = alimentoGrams[item.id] || '100';
                      const isEditingObs = editingAlimentoId === item.id;
                      return (
                        <div key={item.id} className="cadastro-card" style={{ cursor: 'default' }}>
                          <div className="cadastro-card-header" style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                width: '28px', height: '28px', borderRadius: '8px',
                                background: '#F1F5F9', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '13px', fontWeight: 700,
                                color: '#1A3D61', flexShrink: 0,
                              }}>
                                {idx + 1}
                              </span>
                              <div style={{ flex: 1 }}>
                                <h3 className="cadastro-card-title" style={{ marginBottom: '2px' }}>
                                  {al?.nome || 'Alimento'}
                                </h3>
                                {al?.categoria && <span className="cadastro-card-category">{al.categoria}</span>}
                              </div>
                            </div>
                            <div className="cadastro-card-actions">
                              <button className="cadastro-card-btn" onClick={() => {
                                if (isEditingObs) {
                                  setEditingAlimentoId(null);
                                } else {
                                  setEditingAlimentoId(item.id);
                                  setAlimentoFormData({ porcao_customizada: grams, observacao: item.observacao || '' });
                                }
                              }} title="Observação">
                                {isEditingObs ? <X size={16} /> : <Pencil size={16} />}
                              </button>
                              <button className="cadastro-card-btn" onClick={() => {
                                if (confirm('Remover este alimento da refeição?')) {
                                  handleDeleteAlimento(selectedRefeicao.id, item.id);
                                }
                              }} title="Remover" style={{ color: '#EF4444', borderColor: '#FECACA' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="cadastro-card-body" style={{ marginBottom: '0' }}>
                            {/* Gramatura inline */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>Gramatura:</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  value={grams}
                                  onChange={e => setAlimentoGrams(p => ({ ...p, [item.id]: e.target.value }))}
                                  onBlur={() => handleGramBlur(selectedRefeicao.id, item.id)}
                                  style={{
                                    width: '70px', padding: '4px 8px', fontSize: '13px',
                                    border: '1px solid #CBD5E1', borderRadius: '6px',
                                    textAlign: 'center', fontWeight: 600, color: '#1A3D61',
                                  }}
                                  min="0"
                                />
                                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>g</span>
                              </div>
                            </div>
                            {/* Valores nutricionais recalculados */}
                            <div className="cadastro-card-info">
                              {al?.calorias != null && (
                                <span className="cadastro-card-tag highlight"><Flame size={12} /> {calcNutri(al.calorias, grams) ?? al.calorias} kcal</span>
                              )}
                              {al?.proteinas != null && (
                                <span className="cadastro-card-tag">P: {calcNutri(al.proteinas, grams) ?? al.proteinas}g</span>
                              )}
                              {al?.carboidratos != null && (
                                <span className="cadastro-card-tag">C: {calcNutri(al.carboidratos, grams) ?? al.carboidratos}g</span>
                              )}
                              {al?.gorduras != null && (
                                <span className="cadastro-card-tag">G: {calcNutri(al.gorduras, grams) ?? al.gorduras}g</span>
                              )}
                              {al?.fibras != null && (
                                <span className="cadastro-card-tag">Fibra: {calcNutri(al.fibras, grams) ?? al.fibras}g</span>
                              )}
                            </div>
                            {item.observacao && (
                              <p style={{ marginTop: '8px', fontSize: '13px', color: '#6B7280', lineHeight: '1.5' }}>
                                <strong>Obs:</strong> {item.observacao}
                              </p>
                            )}
                            {isEditingObs && (
                              <div style={{ marginTop: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <div className="cadastro-form-group" style={{ marginBottom: '10px' }}>
                                  <label className="cadastro-form-label">Observação</label>
                                  <input className="cadastro-form-input" placeholder="Ex: Sem sal, com tempero"
                                    value={alimentoFormData.observacao}
                                    onChange={e => setAlimentoFormData(p => ({ ...p, observacao: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button className="cadastro-btn-cancel" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px' }}
                                    onClick={() => setEditingAlimentoId(null)}>Cancelar</button>
                                  <button className="cadastro-btn-save" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px' }}
                                    onClick={() => handleUpdateAlimento(selectedRefeicao.id, item.id, { observacao: alimentoFormData.observacao })}>Salvar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="cadastro-empty">
                    <div className="cadastro-empty-icon">
                      <UtensilsCrossed size={28} />
                    </div>
                    <h3 className="cadastro-empty-title">Nenhum alimento cadastrado</h3>
                    <p className="cadastro-empty-text">Esta refeição ainda não tem alimentos associados.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="cadastro-section-header">
                  <div>
                    <h2 className="cadastro-section-title">Refeições</h2>
                    <p className="cadastro-section-subtitle">Cadastre refeições para usar nos planos alimentares</p>
                  </div>
                  <button className="cadastro-btn-add" onClick={() => {
                    setEditingRefeicao(null);
                    setRefeicaoFormData({ nome: '', categoria: '', descricao: '', tags: [] });
                    setShowRefeicaoModal(true);
                  }}>
                    <Plus size={18} />
                    Nova Refeição
                  </button>
                </div>

                {/* Filtros */}
                <div className="cadastro-filters">
                  <div className="cadastro-search">
                    <Search />
                    <input
                      placeholder="Buscar refeições..."
                      value={refeicaoSearch}
                      onChange={e => setRefeicaoSearch(e.target.value)}
                    />
                  </div>
                  <button
                    className={`cadastro-filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  >
                    <Star size={16} />
                    Favoritos
                  </button>
                </div>

                {refeicaoLoading ? (
                  <div className="cadastro-empty">
                    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                    <p className="cadastro-empty-text">Carregando refeições...</p>
                  </div>
                ) : refeicoes.length === 0 ? (
                  <div className="cadastro-empty">
                    <div className="cadastro-empty-icon">
                      <UtensilsCrossed size={28} />
                    </div>
                    <h3 className="cadastro-empty-title">
                      {refeicaoSearch ? 'Nenhuma refeição encontrada' : 'Nenhuma refeição cadastrada'}
                    </h3>
                    <p className="cadastro-empty-text">
                      {refeicaoSearch ? 'Tente buscar com outros termos.' : 'Comece cadastrando suas refeições.'}
                    </p>
                    {!refeicaoSearch && (
                      <button className="cadastro-empty-btn" onClick={() => {
                        setEditingRefeicao(null);
                        setRefeicaoFormData({ nome: '', categoria: '', descricao: '', tags: [] });
                        setShowRefeicaoModal(true);
                      }}>
                        <Plus size={16} />
                        Cadastrar primeira refeição
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cadastro-grid">
                    {refeicoes.map(refeicao => (
                      <div key={refeicao.id} className="cadastro-card" style={{ cursor: 'pointer' }} onClick={() => fetchRefeicaoDetail(refeicao.id)}>
                        <div className="cadastro-card-header">
                          <div>
                            <h3 className="cadastro-card-title">{refeicao.nome}</h3>
                            {refeicao.categoria && <span className="cadastro-card-category">{refeicao.categoria}</span>}
                          </div>
                          <div className="cadastro-card-actions" onClick={e => e.stopPropagation()}>
                            <button
                              className={`cadastro-card-btn ${refeicao.favorito ? 'favorite' : ''}`}
                              onClick={() => handleToggleFavoritoRefeicao(refeicao.id)}
                              title={refeicao.favorito ? 'Remover favorito' : 'Adicionar favorito'}
                            >
                              <Star size={16} fill={refeicao.favorito ? 'currentColor' : 'none'} />
                            </button>
                            <button className="cadastro-card-btn" onClick={async () => {
                              setRefeicaoFormData({
                                nome: refeicao.nome,
                                categoria: refeicao.categoria || '',
                                descricao: refeicao.descricao || '',
                                tags: refeicao.tags || [],
                              });
                              setTagInput('');
                              setShowRefeicaoModal(true);
                              // Fetch full detail with alimentos
                              try {
                                const data = await gatewayClient.get<{ refeicao: Refeicao }>(`/cadastro-refeicoes/${refeicao.id}`);
                                if (data.success) {
                                  setEditingRefeicao(data.refeicao);
                                } else {
                                  setEditingRefeicao(refeicao);
                                }
                              } catch {
                                setEditingRefeicao(refeicao);
                              }
                            }} title="Editar">
                              <Pencil size={16} />
                            </button>
                            <button className="cadastro-card-btn" onClick={() => {
                              if (confirm('Tem certeza que deseja remover esta refeição?')) {
                                handleDeleteRefeicao(refeicao.id);
                              }
                            }} title="Excluir">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="cadastro-card-body">
                          {refeicao.descricao && (
                            <p className="cadastro-card-description">{refeicao.descricao}</p>
                          )}
                          {refeicao.tags && refeicao.tags.length > 0 && (
                            <div className="cadastro-card-info">
                              {refeicao.tags.map((tag, i) => (
                                <span key={i} className="cadastro-card-tag">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="cadastro-card-footer">
                          <span className="cadastro-card-date">
                            Criado em {new Date(refeicao.created_at).toLocaleDateString('pt-BR')}
                          </span>
                          {refeicao.favorito && (
                            <span className="cadastro-card-badge-fav">
                              <Star size={12} fill="currentColor" /> Favorito
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paginação */}
                {refeicaoPagination.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                    {Array.from({ length: refeicaoPagination.totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => fetchRefeicoes(page, refeicaoSearch)}
                        className={`cadastro-card-btn ${page === refeicaoPagination.page ? 'favorite' : ''}`}
                        style={{ minWidth: '36px', padding: '6px 10px', borderRadius: '8px' }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Modal criar/editar refeição */}
            {showRefeicaoModal && (
              <div className="cadastro-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowRefeicaoModal(false); setEditingRefeicao(null); } }}>
                <div className="cadastro-modal" style={{ maxWidth: editingRefeicao ? '680px' : '560px' }}>
                  <div className="cadastro-modal-header">
                    <h3 className="cadastro-modal-title">
                      {editingRefeicao ? 'Editar Refeição' : 'Nova Refeição'}
                    </h3>
                    <button className="cadastro-modal-close" onClick={() => { setShowRefeicaoModal(false); setEditingRefeicao(null); setShowAlimentoSearch(false); setShowCreateAlimento(false); }}>
                      <X size={18} />
                    </button>
                  </div>
                  {!editingRefeicao && (
                    <p style={{ fontSize: '13px', color: '#64748B', padding: '0 24px', marginTop: '-8px', marginBottom: '8px' }}>
                      Preencha os dados e clique em "Cadastrar" para depois adicionar os alimentos.
                    </p>
                  )}
                  <div className="cadastro-modal-body">
                    <div className="cadastro-form-group">
                      <label className="cadastro-form-label">Nome *</label>
                      <input className="cadastro-form-input" placeholder="Nome da refeição"
                        value={refeicaoFormData.nome} onChange={e => setRefeicaoFormData(p => ({ ...p, nome: e.target.value }))} />
                    </div>
                    <div className="cadastro-form-row">
                      <div className="cadastro-form-group">
                        <label className="cadastro-form-label">Categoria</label>
                        <select className="cadastro-form-select"
                          value={refeicaoFormData.categoria} onChange={e => setRefeicaoFormData(p => ({ ...p, categoria: e.target.value }))}>
                          <option value="">Selecione uma categoria</option>
                          {['Cafe da manha', 'Lanche da manha', 'Almoco', 'Lanche da tarde', 'Jantar', 'Ceia', 'Pre-treino', 'Pos-treino'].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="cadastro-form-group">
                        <label className="cadastro-form-label">Favorito</label>
                        <div
                          className={`cadastro-form-toggle ${editingRefeicao?.favorito ? 'active' : ''}`}
                          onClick={() => {
                            if (editingRefeicao) {
                              handleToggleFavoritoRefeicao(editingRefeicao.id);
                              setEditingRefeicao({ ...editingRefeicao, favorito: !editingRefeicao.favorito });
                            }
                          }}
                          style={{ height: '42px', cursor: editingRefeicao ? 'pointer' : 'default' }}
                        >
                          <Star size={16} className="cadastro-form-toggle-star" fill={editingRefeicao?.favorito ? 'currentColor' : 'none'} />
                          <span className="cadastro-form-toggle-text" style={{ fontSize: '13px' }}>
                            {editingRefeicao?.favorito ? 'Favorito' : 'Não favorito'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="cadastro-form-group">
                      <label className="cadastro-form-label">Descrição</label>
                      <textarea className="cadastro-form-textarea" placeholder="Descreva a refeição..."
                        value={refeicaoFormData.descricao} onChange={e => setRefeicaoFormData(p => ({ ...p, descricao: e.target.value }))} />
                    </div>

                    {/* Tags */}
                    <div className="cadastro-form-group">
                      <label className="cadastro-form-label">Tags</label>
                      {refeicaoFormData.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {refeicaoFormData.tags.map((tag, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '20px', fontSize: '12px',
                              fontWeight: 500, background: '#EFF6FF', color: '#1A3D61',
                              border: '1px solid #BFDBFE',
                            }}>
                              {tag}
                              <button type="button" onClick={() => setRefeicaoFormData(p => ({ ...p, tags: p.tags.filter((_, idx) => idx !== i) }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: '#64748B' }}>
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input className="cadastro-form-input" placeholder="Ex: Alta proteina, Low carb"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && tagInput.trim()) {
                              e.preventDefault();
                              if (!refeicaoFormData.tags.includes(tagInput.trim())) {
                                setRefeicaoFormData(p => ({ ...p, tags: [...p.tags, tagInput.trim()] }));
                              }
                              setTagInput('');
                            }
                          }}
                          style={{ flex: 1 }}
                        />
                        <button type="button" onClick={() => {
                          if (tagInput.trim() && !refeicaoFormData.tags.includes(tagInput.trim())) {
                            setRefeicaoFormData(p => ({ ...p, tags: [...p.tags, tagInput.trim()] }));
                            setTagInput('');
                          }
                        }}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1',
                            background: '#F8FAFC', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                            color: '#1A3D61', fontFamily: 'inherit',
                          }}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>

                    {/* Alimentos associados (somente no edit) */}
                    {editingRefeicao && (
                      <div style={{ marginTop: '8px' }}>
                        <label className="cadastro-form-label" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UtensilsCrossed size={14} />
                            Alimentos ({editingRefeicao.alimentos?.length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={() => { setShowAlimentoSearch(!showAlimentoSearch); setShowCreateAlimento(false); setAlimentoSearch(''); setAlimentoResults([]); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              background: '#1A3D61', color: '#fff', border: 'none',
                              borderRadius: '6px', padding: '4px 10px', fontSize: '12px',
                              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <Plus size={14} /> Adicionar
                          </button>
                        </label>

                        {/* Search/add alimento */}
                        {showAlimentoSearch && (
                          <div style={{ marginBottom: '12px', padding: '12px', background: '#F1F5F9', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div className="cadastro-search" style={{ maxWidth: '100%', marginBottom: '8px' }}>
                              <Search />
                              <input
                                placeholder="Buscar alimento pelo nome..."
                                value={alimentoSearch}
                                onChange={e => setAlimentoSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                            {alimentoSearchLoading && (
                              <div style={{ textAlign: 'center', padding: '8px' }}>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                              </div>
                            )}
                            {alimentoResults.length > 0 && (
                              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {alimentoResults.map(al => {
                                  const alreadyAdded = editingRefeicao.alimentos?.some(a => a.cadastro_alimentos?.nome === al.nome);
                                  return (
                                    <div key={al.table_id} style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      padding: '8px 10px', borderRadius: '8px', background: '#fff',
                                      border: '1px solid #E2E8F0', cursor: alreadyAdded ? 'default' : 'pointer',
                                      opacity: alreadyAdded ? 0.5 : 1,
                                    }}
                                      onClick={() => !alreadyAdded && handleAddAlimentoNutricionalToRefeicao(editingRefeicao.id, al)}
                                    >
                                      <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{al.nome}</div>
                                        <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '6px' }}>
                                          {al.categoria && <span>{al.categoria}</span>}
                                          {al.energia_kcal && <span>{al.energia_kcal} kcal</span>}
                                          {al.proteina_g && <span>P: {al.proteina_g}g</span>}
                                          {al.carboidrato_g && <span>C: {al.carboidrato_g}g</span>}
                                        </div>
                                      </div>
                                      {alreadyAdded ? (
                                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>Já adicionado</span>
                                      ) : (
                                        <Plus size={16} style={{ color: '#1A3D61', flexShrink: 0 }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {alimentoSearch.trim() && !alimentoSearchLoading && alimentoResults.length === 0 && (
                              <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '8px 0' }}>
                                Nenhum alimento encontrado.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => { setShowCreateAlimento(!showCreateAlimento); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px', width: '100%',
                                justifyContent: 'center', marginTop: '8px',
                                background: 'transparent', border: '1px dashed #94A3B8',
                                borderRadius: '8px', padding: '8px', fontSize: '12px',
                                color: '#64748B', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                              }}
                            >
                              <Plus size={14} /> Criar novo alimento
                            </button>

                            {/* Create new alimento inline */}
                            {showCreateAlimento && (
                              <div style={{ marginTop: '10px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <div className="cadastro-form-group" style={{ marginBottom: '8px' }}>
                                  <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Nome *</label>
                                  <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                    placeholder="Nome do alimento" value={newAlimentoForm.nome}
                                    onChange={e => setNewAlimentoForm(p => ({ ...p, nome: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Categoria</label>
                                    <select className="cadastro-form-select" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      value={newAlimentoForm.categoria} onChange={e => setNewAlimentoForm(p => ({ ...p, categoria: e.target.value }))}>
                                      <option value="">Selecione</option>
                                      {['Proteinas', 'Carboidratos', 'Gorduras', 'Frutas', 'Verduras', 'Legumes', 'Laticinios', 'Graos', 'Bebidas', 'Temperos', 'Outros'].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Porção</label>
                                    <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      placeholder="Ex: 100g, 1 unidade" value={newAlimentoForm.porcao}
                                      onChange={e => setNewAlimentoForm(p => ({ ...p, porcao: e.target.value }))} />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Kcal</label>
                                    <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      placeholder="0" value={newAlimentoForm.calorias}
                                      onChange={e => setNewAlimentoForm(p => ({ ...p, calorias: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Prot(g)</label>
                                    <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      placeholder="0" value={newAlimentoForm.proteinas}
                                      onChange={e => setNewAlimentoForm(p => ({ ...p, proteinas: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Carb(g)</label>
                                    <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      placeholder="0" value={newAlimentoForm.carboidratos}
                                      onChange={e => setNewAlimentoForm(p => ({ ...p, carboidratos: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Gord(g)</label>
                                    <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      placeholder="0" value={newAlimentoForm.gorduras}
                                      onChange={e => setNewAlimentoForm(p => ({ ...p, gorduras: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Fibra(g)</label>
                                    <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                      placeholder="0" value={newAlimentoForm.fibras}
                                      onChange={e => setNewAlimentoForm(p => ({ ...p, fibras: e.target.value }))} />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button className="cadastro-btn-cancel" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }}
                                    onClick={() => setShowCreateAlimento(false)}>Cancelar</button>
                                  <button className="cadastro-btn-save" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }}
                                    onClick={() => handleCreateAndAddAlimento(editingRefeicao.id)}>Criar e adicionar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {editingRefeicao.alimentos && editingRefeicao.alimentos.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingRefeicao.alimentos.map((item, idx) => {
                            const al = item.cadastro_alimentos;
                            const grams = alimentoGrams[item.id] || '100';
                            const isEditingObs = editingAlimentoId === item.id;
                            return (
                              <div key={item.id} style={{
                                padding: '10px 14px', borderRadius: '10px',
                                background: '#F8FAFC', border: '1px solid #E2E8F0',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{
                                    width: '24px', height: '24px', borderRadius: '6px',
                                    background: '#1A3D61', color: '#fff', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700, flexShrink: 0,
                                  }}>
                                    {idx + 1}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                                      {al?.nome || 'Alimento'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="number"
                                          value={grams}
                                          onChange={e => setAlimentoGrams(p => ({ ...p, [item.id]: e.target.value }))}
                                          onBlur={() => handleGramBlur(editingRefeicao.id, item.id)}
                                          style={{
                                            width: '60px', padding: '3px 6px', fontSize: '12px',
                                            border: '1px solid #CBD5E1', borderRadius: '6px',
                                            textAlign: 'center', fontWeight: 600, color: '#1A3D61',
                                          }}
                                          min="0"
                                        />
                                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>g</span>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      {al?.calorias != null && (
                                        <span style={{ fontSize: '11px', color: '#1A3D61', fontWeight: 600 }}>
                                          {calcNutri(al.calorias, grams) ?? al.calorias} kcal
                                        </span>
                                      )}
                                      {al?.proteinas != null && (
                                        <span style={{ fontSize: '11px', color: '#64748B' }}>P: {calcNutri(al.proteinas, grams) ?? al.proteinas}g</span>
                                      )}
                                      {al?.carboidratos != null && (
                                        <span style={{ fontSize: '11px', color: '#64748B' }}>C: {calcNutri(al.carboidratos, grams) ?? al.carboidratos}g</span>
                                      )}
                                      {al?.gorduras != null && (
                                        <span style={{ fontSize: '11px', color: '#64748B' }}>G: {calcNutri(al.gorduras, grams) ?? al.gorduras}g</span>
                                      )}
                                      {al?.fibras != null && (
                                        <span style={{ fontSize: '11px', color: '#64748B' }}>Fibra: {calcNutri(al.fibras, grams) ?? al.fibras}g</span>
                                      )}
                                    </div>
                                    {item.observacao && (
                                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                                        Obs: {item.observacao}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button className="cadastro-card-btn" style={{ width: '28px', height: '28px' }} onClick={() => {
                                      if (isEditingObs) {
                                        setEditingAlimentoId(null);
                                      } else {
                                        setEditingAlimentoId(item.id);
                                        setAlimentoFormData({ porcao_customizada: grams, observacao: item.observacao || '' });
                                      }
                                    }} title="Observação">
                                      {isEditingObs ? <X size={14} /> : <Pencil size={14} />}
                                    </button>
                                    <button className="cadastro-card-btn" style={{ width: '28px', height: '28px', color: '#EF4444', borderColor: '#FECACA' }} onClick={() => {
                                      if (confirm('Remover este alimento da refeição?')) {
                                        handleDeleteAlimento(editingRefeicao.id, item.id);
                                      }
                                    }} title="Remover">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                {isEditingObs && (
                                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                                    <div style={{ marginBottom: '8px' }}>
                                      <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Observação</label>
                                      <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }}
                                        placeholder="Ex: Sem sal, com tempero"
                                        value={alimentoFormData.observacao}
                                        onChange={e => setAlimentoFormData(p => ({ ...p, observacao: e.target.value }))} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button className="cadastro-btn-cancel" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }}
                                        onClick={() => setEditingAlimentoId(null)}>Cancelar</button>
                                      <button className="cadastro-btn-save" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }}
                                        onClick={() => handleUpdateAlimento(editingRefeicao.id, item.id, { observacao: alimentoFormData.observacao })}>Salvar</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="cadastro-modal-footer">
                    <button className="cadastro-btn-cancel" onClick={() => { setShowRefeicaoModal(false); setEditingRefeicao(null); setShowAlimentoSearch(false); setShowCreateAlimento(false); }}>
                      {editingRefeicao ? 'Fechar' : 'Cancelar'}
                    </button>
                    <button className="cadastro-btn-save" onClick={handleSaveRefeicao}>
                      {editingRefeicao ? 'Salvar alterações' : 'Cadastrar e adicionar alimentos'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'treinos' ? (
          <div>
            {/* Detalhe do treino selecionado */}
            {selectedTreino ? (
              <div>
                <button onClick={() => setSelectedTreino(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#64748B', padding: '0', marginBottom: '16px', fontFamily: 'inherit', fontWeight: 500 }}>
                  ← Voltar para lista
                </button>
                <div className="cadastro-card" style={{ marginBottom: '20px', cursor: 'default' }}>
                  <div className="cadastro-card-header">
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{selectedTreino.nome}</h2>
                      {selectedTreino.categoria && <span className="cadastro-card-category">{selectedTreino.categoria}</span>}
                    </div>
                    <div className="cadastro-card-actions">
                      <button className="cadastro-card-btn" onClick={() => {
                        setEditingTreino(selectedTreino);
                        setTreinoFormData({ nome: selectedTreino.nome, categoria: selectedTreino.categoria || '', descricao: selectedTreino.descricao || '', tags: selectedTreino.tags || [] });
                        setTreinoTagInput('');
                        setShowTreinoModal(true);
                      }} title="Editar"><Pencil size={16} /></button>
                      <button className={`cadastro-card-btn ${selectedTreino.favorito ? 'favorite' : ''}`} onClick={() => handleToggleFavoritoTreino(selectedTreino.id)}>
                        <Star size={16} fill={selectedTreino.favorito ? 'currentColor' : 'none'} />
                      </button>
                      <button className="cadastro-card-btn" onClick={() => { if (confirm('Remover este treino?')) handleDeleteTreino(selectedTreino.id); }} style={{ color: '#EF4444', borderColor: '#FECACA' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  {selectedTreino.descricao && <p style={{ color: '#4B5563', lineHeight: '1.6', fontSize: '14px' }}>{selectedTreino.descricao}</p>}
                  {selectedTreino.tags && selectedTreino.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {selectedTreino.tags.map((tag, i) => <span key={i} className="cadastro-card-tag highlight">{tag}</span>)}
                    </div>
                  )}
                  <div className="cadastro-card-footer">
                    <span className="cadastro-card-date">Criado em {new Date(selectedTreino.created_at).toLocaleDateString('pt-BR')}</span>
                    {selectedTreino.favorito && <span className="cadastro-card-badge-fav"><Star size={12} fill="currentColor" /> Favorito</span>}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Exercícios do treino</h3>
                  <p style={{ fontSize: '13px', color: '#64748B' }}>{selectedTreino.exercicios?.length || 0} exercício(s)</p>
                </div>

                {selectedTreino.exercicios && selectedTreino.exercicios.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedTreino.exercicios.map((item, idx) => {
                      const ex = item.cadastro_exercicios;
                      const isEditingEx = editingExercicioId === item.id;
                      return (
                        <div key={item.id} className="cadastro-card" style={{ cursor: 'default' }}>
                          <div className="cadastro-card-header" style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#1A3D61', flexShrink: 0 }}>{idx + 1}</span>
                              <div>
                                <h3 className="cadastro-card-title" style={{ marginBottom: '2px' }}>{ex?.nome || 'Exercício'}</h3>
                                {ex?.grupo_muscular && <span className="cadastro-card-category">{ex.grupo_muscular}</span>}
                              </div>
                            </div>
                            <div className="cadastro-card-actions">
                              <button className="cadastro-card-btn" onClick={() => {
                                if (isEditingEx) { setEditingExercicioId(null); } else {
                                  setEditingExercicioId(item.id);
                                  setExercicioFormData({ series: item.series?.toString() || '', repeticoes: item.repeticoes || '', descanso: item.descanso || '', observacao: item.observacao || '' });
                                }
                              }}>{isEditingEx ? <X size={16} /> : <Pencil size={16} />}</button>
                              <button className="cadastro-card-btn" onClick={() => { if (confirm('Remover este exercício?')) handleDeleteTreinoExercicio(selectedTreino.id, item.id); }} style={{ color: '#EF4444', borderColor: '#FECACA' }}><Trash2 size={16} /></button>
                            </div>
                          </div>
                          <div className="cadastro-card-body" style={{ marginBottom: 0 }}>
                            <div className="cadastro-card-info">
                              {item.series && <span className="cadastro-card-tag highlight"><Dumbbell size={12} /> {item.series} séries</span>}
                              {item.repeticoes && <span className="cadastro-card-tag">{item.repeticoes} reps</span>}
                              {item.descanso && <span className="cadastro-card-tag"><Clock size={12} /> {item.descanso}</span>}
                              {ex?.equipamento && <span className="cadastro-card-tag">{ex.equipamento}</span>}
                            </div>
                            {item.observacao && <p style={{ marginTop: '8px', fontSize: '13px', color: '#6B7280' }}><strong>Obs:</strong> {item.observacao}</p>}
                            {isEditingEx && (
                              <div style={{ marginTop: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Séries</label>
                                    <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Ex: 4" value={exercicioFormData.series} onChange={e => setExercicioFormData(p => ({ ...p, series: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Repetições</label>
                                    <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Ex: 8-12" value={exercicioFormData.repeticoes} onChange={e => setExercicioFormData(p => ({ ...p, repeticoes: e.target.value }))} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Descanso</label>
                                    <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Ex: 90s" value={exercicioFormData.descanso} onChange={e => setExercicioFormData(p => ({ ...p, descanso: e.target.value }))} />
                                  </div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Observação</label>
                                  <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Ex: Manter costas retas" value={exercicioFormData.observacao} onChange={e => setExercicioFormData(p => ({ ...p, observacao: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button className="cadastro-btn-cancel" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px' }} onClick={() => setEditingExercicioId(null)}>Cancelar</button>
                                  <button className="cadastro-btn-save" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px' }} onClick={() => handleUpdateTreinoExercicio(selectedTreino.id, item.id, { series: exercicioFormData.series ? parseInt(exercicioFormData.series) : null, repeticoes: exercicioFormData.repeticoes || null, descanso: exercicioFormData.descanso || null, observacao: exercicioFormData.observacao || null })}>Salvar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="cadastro-empty">
                    <div className="cadastro-empty-icon"><Dumbbell size={28} /></div>
                    <h3 className="cadastro-empty-title">Nenhum exercício</h3>
                    <p className="cadastro-empty-text">Edite o treino para adicionar exercícios.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="cadastro-section-header">
                  <div>
                    <h2 className="cadastro-section-title">Treinos</h2>
                    <p className="cadastro-section-subtitle">Cadastre treinos para montar protocolos</p>
                  </div>
                  <button className="cadastro-btn-add" onClick={() => {
                    setEditingTreino(null);
                    setTreinoFormData({ nome: '', categoria: '', descricao: '', tags: [] });
                    setTreinoTagInput('');
                    setShowTreinoModal(true);
                  }}>
                    <Plus size={18} /> Novo Treino
                  </button>
                </div>

                <div className="cadastro-filters">
                  <div className="cadastro-search">
                    <Search />
                    <input placeholder="Buscar treinos..." value={treinoSearch} onChange={e => setTreinoSearch(e.target.value)} />
                  </div>
                  <button className={`cadastro-filter-btn ${showFavoritesOnly ? 'active' : ''}`} onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
                    <Star size={16} /> Favoritos
                  </button>
                </div>

                {treinoLoading ? (
                  <div className="cadastro-empty">
                    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                    <p className="cadastro-empty-text">Carregando treinos...</p>
                  </div>
                ) : treinos.length === 0 ? (
                  <div className="cadastro-empty">
                    <div className="cadastro-empty-icon"><Dumbbell size={28} /></div>
                    <h3 className="cadastro-empty-title">{treinoSearch ? 'Nenhum treino encontrado' : 'Nenhum treino cadastrado'}</h3>
                    <p className="cadastro-empty-text">{treinoSearch ? 'Tente buscar com outros termos.' : 'Comece cadastrando seus treinos.'}</p>
                    {!treinoSearch && (
                      <button className="cadastro-empty-btn" onClick={() => { setEditingTreino(null); setTreinoFormData({ nome: '', categoria: '', descricao: '', tags: [] }); setShowTreinoModal(true); }}>
                        <Plus size={16} /> Cadastrar primeiro treino
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cadastro-grid">
                    {treinos.map(treino => (
                      <div key={treino.id} className="cadastro-card" style={{ cursor: 'pointer' }} onClick={() => fetchTreinoDetail(treino.id)}>
                        <div className="cadastro-card-header">
                          <div>
                            <h3 className="cadastro-card-title">{treino.nome}</h3>
                            {treino.categoria && <span className="cadastro-card-category">{treino.categoria}</span>}
                          </div>
                          <div className="cadastro-card-actions" onClick={e => e.stopPropagation()}>
                            <button className={`cadastro-card-btn ${treino.favorito ? 'favorite' : ''}`} onClick={() => handleToggleFavoritoTreino(treino.id)}>
                              <Star size={16} fill={treino.favorito ? 'currentColor' : 'none'} />
                            </button>
                            <button className="cadastro-card-btn" onClick={async () => {
                              setTreinoFormData({ nome: treino.nome, categoria: treino.categoria || '', descricao: treino.descricao || '', tags: treino.tags || [] });
                              setTreinoTagInput('');
                              setShowTreinoModal(true);
                              try {
                                const data = await gatewayClient.get<{ treino: Treino }>(`/cadastro-treinos/${treino.id}`);
                                if (data.success) setEditingTreino(data.treino);
                                else setEditingTreino(treino);
                              } catch { setEditingTreino(treino); }
                            }}><Pencil size={16} /></button>
                            <button className="cadastro-card-btn" onClick={() => { if (confirm('Remover este treino?')) handleDeleteTreino(treino.id); }}><Trash2 size={16} /></button>
                          </div>
                        </div>
                        <div className="cadastro-card-body">
                          {treino.descricao && <p className="cadastro-card-description">{treino.descricao}</p>}
                          {treino.tags && treino.tags.length > 0 && (
                            <div className="cadastro-card-info">
                              {treino.tags.map((tag, i) => <span key={i} className="cadastro-card-tag">{tag}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="cadastro-card-footer">
                          <span className="cadastro-card-date">Criado em {new Date(treino.created_at).toLocaleDateString('pt-BR')}</span>
                          {treino.favorito && <span className="cadastro-card-badge-fav"><Star size={12} fill="currentColor" /> Favorito</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {treinoPagination.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                    {Array.from({ length: treinoPagination.totalPages }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => fetchTreinos(page, treinoSearch)} className={`cadastro-card-btn ${page === treinoPagination.page ? 'favorite' : ''}`} style={{ minWidth: '36px', padding: '6px 10px', borderRadius: '8px' }}>{page}</button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Modal criar/editar treino */}
            {showTreinoModal && (
              <div className="cadastro-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowTreinoModal(false); setEditingTreino(null); } }}>
                <div className="cadastro-modal" style={{ maxWidth: editingTreino ? '680px' : '560px' }}>
                  <div className="cadastro-modal-header">
                    <h3 className="cadastro-modal-title">{editingTreino ? 'Editar Treino' : 'Novo Treino'}</h3>
                    <button className="cadastro-modal-close" onClick={() => { setShowTreinoModal(false); setEditingTreino(null); setShowExercicioSearch(false); setShowCreateExercicio(false); }}><X size={18} /></button>
                  </div>
                  {!editingTreino && (
                    <p style={{ fontSize: '13px', color: '#64748B', padding: '0 24px', marginTop: '-8px', marginBottom: '8px' }}>
                      Preencha os dados e clique em "Cadastrar" para depois adicionar os exercícios.
                    </p>
                  )}
                  <div className="cadastro-modal-body">
                    <div className="cadastro-form-group">
                      <label className="cadastro-form-label">Nome *</label>
                      <input className="cadastro-form-input" placeholder="Nome do treino (ex: Treino A - Peito e Tríceps)" value={treinoFormData.nome} onChange={e => setTreinoFormData(p => ({ ...p, nome: e.target.value }))} />
                    </div>
                    <div className="cadastro-form-row">
                      <div className="cadastro-form-group">
                        <label className="cadastro-form-label">Categoria</label>
                        <select className="cadastro-form-select" value={treinoFormData.categoria} onChange={e => setTreinoFormData(p => ({ ...p, categoria: e.target.value }))}>
                          <option value="">Selecione</option>
                          {['Musculação', 'Funcional', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Alongamento', 'Reabilitação'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div className="cadastro-form-group">
                        <label className="cadastro-form-label">Favorito</label>
                        <div className={`cadastro-form-toggle ${editingTreino?.favorito ? 'active' : ''}`}
                          onClick={() => { if (editingTreino) { handleToggleFavoritoTreino(editingTreino.id); setEditingTreino({ ...editingTreino, favorito: !editingTreino.favorito }); } }}
                          style={{ height: '42px', cursor: editingTreino ? 'pointer' : 'default' }}>
                          <Star size={16} className="cadastro-form-toggle-star" fill={editingTreino?.favorito ? 'currentColor' : 'none'} />
                          <span className="cadastro-form-toggle-text" style={{ fontSize: '13px' }}>{editingTreino?.favorito ? 'Favorito' : 'Não favorito'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="cadastro-form-group">
                      <label className="cadastro-form-label">Descrição</label>
                      <textarea className="cadastro-form-textarea" placeholder="Descreva o treino..." value={treinoFormData.descricao} onChange={e => setTreinoFormData(p => ({ ...p, descricao: e.target.value }))} />
                    </div>

                    {/* Tags */}
                    <div className="cadastro-form-group">
                      <label className="cadastro-form-label">Tags</label>
                      {treinoFormData.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {treinoFormData.tags.map((tag, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: '#EFF6FF', color: '#1A3D61', border: '1px solid #BFDBFE' }}>
                              {tag}
                              <button type="button" onClick={() => setTreinoFormData(p => ({ ...p, tags: p.tags.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: '#64748B' }}><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input className="cadastro-form-input" placeholder="Ex: Hipertrofia, Avançado" value={treinoTagInput} onChange={e => setTreinoTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && treinoTagInput.trim()) { e.preventDefault(); if (!treinoFormData.tags.includes(treinoTagInput.trim())) setTreinoFormData(p => ({ ...p, tags: [...p.tags, treinoTagInput.trim()] })); setTreinoTagInput(''); } }}
                          style={{ flex: 1 }} />
                        <button type="button" onClick={() => { if (treinoTagInput.trim() && !treinoFormData.tags.includes(treinoTagInput.trim())) { setTreinoFormData(p => ({ ...p, tags: [...p.tags, treinoTagInput.trim()] })); setTreinoTagInput(''); } }}
                          style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#1A3D61', fontFamily: 'inherit' }}>Adicionar</button>
                      </div>
                    </div>

                    {/* Exercícios (somente no edit) */}
                    {editingTreino && (
                      <div style={{ marginTop: '8px' }}>
                        <label className="cadastro-form-label" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Dumbbell size={14} /> Exercícios ({editingTreino.exercicios?.length || 0})</span>
                          <button type="button" onClick={() => { setShowExercicioSearch(!showExercicioSearch); setShowCreateExercicio(false); setExercicioSearch(''); setExercicioResults([]); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1A3D61', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Plus size={14} /> Adicionar
                          </button>
                        </label>

                        {/* Search exercício */}
                        {showExercicioSearch && (
                          <div style={{ marginBottom: '12px', padding: '12px', background: '#F1F5F9', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div className="cadastro-search" style={{ maxWidth: '100%', marginBottom: '8px' }}>
                              <Search />
                              <input placeholder="Buscar exercício pelo nome..." value={exercicioSearch} onChange={e => setExercicioSearch(e.target.value)} autoFocus />
                            </div>
                            {exercicioSearchLoading && <div style={{ textAlign: 'center', padding: '8px' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></div>}
                            {exercicioResults.length > 0 && (
                              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {exercicioResults.map(ex => {
                                  const alreadyAdded = editingTreino.exercicios?.some(e => e.exercicio_id === ex.id);
                                  return (
                                    <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: '#fff', border: '1px solid #E2E8F0', cursor: alreadyAdded ? 'default' : 'pointer', opacity: alreadyAdded ? 0.5 : 1 }}
                                      onClick={() => !alreadyAdded && handleAddExercicioToTreino(editingTreino.id, ex.id)}>
                                      <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{ex.nome}</div>
                                        <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '6px' }}>
                                          {ex.grupo_muscular && <span>{ex.grupo_muscular}</span>}
                                          {ex.equipamento && <span>{ex.equipamento}</span>}
                                        </div>
                                      </div>
                                      {alreadyAdded ? <span style={{ fontSize: '11px', color: '#94A3B8' }}>Já adicionado</span> : <Plus size={16} style={{ color: '#1A3D61', flexShrink: 0 }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {exercicioSearch.trim() && !exercicioSearchLoading && exercicioResults.length === 0 && (
                              <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '8px 0' }}>Nenhum exercício encontrado.</p>
                            )}
                            <button type="button" onClick={() => setShowCreateExercicio(!showCreateExercicio)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center', marginTop: '8px', background: 'transparent', border: '1px dashed #94A3B8', borderRadius: '8px', padding: '8px', fontSize: '12px', color: '#64748B', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                              <Plus size={14} /> Criar novo exercício
                            </button>

                            {showCreateExercicio && (
                              <div style={{ marginTop: '10px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <div className="cadastro-form-group" style={{ marginBottom: '8px' }}>
                                  <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Nome *</label>
                                  <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Nome do exercício" value={newExercicioForm.nome} onChange={e => setNewExercicioForm(p => ({ ...p, nome: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Grupo muscular</label>
                                    <select className="cadastro-form-select" style={{ padding: '6px 10px', fontSize: '13px' }} value={newExercicioForm.grupo_muscular} onChange={e => setNewExercicioForm(p => ({ ...p, grupo_muscular: e.target.value }))}>
                                      <option value="">Selecione</option>
                                      {['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Abdômen', 'Core', 'Full body'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Equipamento</label>
                                    <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Ex: Halter, Barra" value={newExercicioForm.equipamento} onChange={e => setNewExercicioForm(p => ({ ...p, equipamento: e.target.value }))} />
                                  </div>
                                </div>
                                <div className="cadastro-form-group" style={{ marginBottom: '8px' }}>
                                  <label className="cadastro-form-label" style={{ fontSize: '11px' }}>URL Tutorial (YouTube)</label>
                                  <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="https://youtube.com/..." value={newExercicioForm.url_tutorial} onChange={e => setNewExercicioForm(p => ({ ...p, url_tutorial: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button className="cadastro-btn-cancel" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }} onClick={() => setShowCreateExercicio(false)}>Cancelar</button>
                                  <button className="cadastro-btn-save" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }} onClick={() => handleCreateAndAddExercicio(editingTreino.id)}>Criar e adicionar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Lista de exercícios do treino */}
                        {editingTreino.exercicios && editingTreino.exercicios.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {editingTreino.exercicios.map((item, idx) => {
                              const ex = item.cadastro_exercicios;
                              const isEditingThis = editingExercicioId === item.id;
                              return (
                                <div key={item.id} style={{ padding: '10px 14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1A3D61', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>{ex?.nome || 'Exercício'}</div>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {ex?.grupo_muscular && <span style={{ fontSize: '11px', color: '#64748B' }}>{ex.grupo_muscular}</span>}
                                        {item.series && <span style={{ fontSize: '11px', color: '#1A3D61', fontWeight: 600 }}>{item.series} séries</span>}
                                        {item.repeticoes && <span style={{ fontSize: '11px', color: '#64748B' }}>{item.repeticoes} reps</span>}
                                        {item.descanso && <span style={{ fontSize: '11px', color: '#64748B' }}>{item.descanso}</span>}
                                      </div>
                                      {item.observacao && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Obs: {item.observacao}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                      <button className="cadastro-card-btn" style={{ width: '28px', height: '28px' }} onClick={() => {
                                        if (isEditingThis) { setEditingExercicioId(null); } else {
                                          setEditingExercicioId(item.id);
                                          setExercicioFormData({ series: item.series?.toString() || '', repeticoes: item.repeticoes || '', descanso: item.descanso || '', observacao: item.observacao || '' });
                                        }
                                      }}>{isEditingThis ? <X size={14} /> : <Pencil size={14} />}</button>
                                      <button className="cadastro-card-btn" style={{ width: '28px', height: '28px', color: '#EF4444', borderColor: '#FECACA' }} onClick={() => { if (confirm('Remover este exercício?')) handleDeleteTreinoExercicio(editingTreino.id, item.id); }}><Trash2 size={14} /></button>
                                    </div>
                                  </div>
                                  {isEditingThis && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Séries</label>
                                          <input type="number" className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="4" value={exercicioFormData.series} onChange={e => setExercicioFormData(p => ({ ...p, series: e.target.value }))} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Repetições</label>
                                          <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="8-12" value={exercicioFormData.repeticoes} onChange={e => setExercicioFormData(p => ({ ...p, repeticoes: e.target.value }))} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Descanso</label>
                                          <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="90s" value={exercicioFormData.descanso} onChange={e => setExercicioFormData(p => ({ ...p, descanso: e.target.value }))} />
                                        </div>
                                      </div>
                                      <div style={{ marginBottom: '8px' }}>
                                        <label className="cadastro-form-label" style={{ fontSize: '11px' }}>Observação</label>
                                        <input className="cadastro-form-input" style={{ padding: '6px 10px', fontSize: '13px' }} placeholder="Ex: Manter costas retas" value={exercicioFormData.observacao} onChange={e => setExercicioFormData(p => ({ ...p, observacao: e.target.value }))} />
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button className="cadastro-btn-cancel" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }} onClick={() => setEditingExercicioId(null)}>Cancelar</button>
                                        <button className="cadastro-btn-save" style={{ flex: 'none', padding: '4px 12px', fontSize: '12px' }} onClick={() => handleUpdateTreinoExercicio(editingTreino.id, item.id, { series: exercicioFormData.series ? parseInt(exercicioFormData.series) : null, repeticoes: exercicioFormData.repeticoes || null, descanso: exercicioFormData.descanso || null, observacao: exercicioFormData.observacao || null })}>Salvar</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="cadastro-modal-footer">
                    <button className="cadastro-btn-cancel" onClick={() => { setShowTreinoModal(false); setEditingTreino(null); setShowExercicioSearch(false); setShowCreateExercicio(false); }}>
                      {editingTreino ? 'Fechar' : 'Cancelar'}
                    </button>
                    <button className="cadastro-btn-save" onClick={handleSaveTreino}>
                      {editingTreino ? 'Salvar alterações' : 'Cadastrar e adicionar exercícios'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Section Header */}
            <div className="cadastro-section-header">
              <div>
                <h2 className="cadastro-section-title">{getTabTitle()}</h2>
                <p className="cadastro-section-subtitle">{getTabSubtitle()}</p>
              </div>
              <button className="cadastro-btn-add" onClick={openAddModal}>
                <Plus size={18} />
                Novo {getTabTitle()?.slice(0, -1)}
              </button>
            </div>

            {/* Filters */}
            <div className="cadastro-filters">
              <div className="cadastro-search">
                <Search />
                <input
                  placeholder={`Buscar ${getTabTitle()?.toLowerCase()}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                className={`cadastro-filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Star size={16} />
                Favoritos
              </button>
            </div>

            {/* Grid */}
            {filteredItems.length > 0 ? (
              <div className="cadastro-grid">
                {filteredItems.map(item => (
                  <div key={item.id} className="cadastro-card">
                    <div className="cadastro-card-header">
                      <div>
                        <h3 className="cadastro-card-title">{item.nome}</h3>
                        <span className="cadastro-card-category">{item.categoria}</span>
                      </div>
                      <div className="cadastro-card-actions">
                        <button
                          className={`cadastro-card-btn ${item.favorito ? 'favorite' : ''}`}
                          onClick={() => toggleFavorite(item.id)}
                          title={item.favorito ? 'Remover favorito' : 'Adicionar favorito'}
                        >
                          <Star size={16} fill={item.favorito ? 'currentColor' : 'none'} />
                        </button>
                        <button className="cadastro-card-btn" onClick={() => openEditModal(item)} title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button className="cadastro-card-btn" onClick={() => deleteItem(item.id)} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="cadastro-card-body">
                      {renderCardContent(item)}
                      <p className="cadastro-card-description">{item.descricao}</p>
                    </div>
                    <div className="cadastro-card-footer">
                      <span className="cadastro-card-date">Criado em {item.created_at}</span>
                      {item.favorito && (
                        <span className="cadastro-card-badge-fav">
                          <Star size={12} fill="currentColor" /> Favorito
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cadastro-empty">
                <div className="cadastro-empty-icon">
                  {activeTab === 'refeicoes' && <UtensilsCrossed size={28} />}
                  {activeTab === 'treinos' && <Dumbbell size={28} />}
                  {activeTab === 'suplementos' && <Pill size={28} />}
                  {activeTab === 'fitoterapicos' && <Leaf size={28} />}
                </div>
                <h3 className="cadastro-empty-title">
                  {search ? 'Nenhum resultado encontrado' : `Nenhum cadastro de ${getTabTitle()?.toLowerCase()}`}
                </h3>
                <p className="cadastro-empty-text">
                  {search
                    ? 'Tente buscar com outros termos.'
                    : `Comece cadastrando ${activeTab === 'refeicoes' ? 'suas refeicoes' : activeTab === 'treinos' ? 'seus exercicios' : activeTab === 'suplementos' ? 'seus suplementos' : 'seus fitoterapicos'}.`
                  }
                </p>
                {!search && (
                  <button className="cadastro-empty-btn" onClick={openAddModal}>
                    <Plus size={16} />
                    Cadastrar primeiro item
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="cadastro-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="cadastro-modal">
            <div className="cadastro-modal-header">
              <h3 className="cadastro-modal-title">
                {editingItem ? `Editar ${getTabTitle()?.slice(0, -1)}` : `Novo ${getTabTitle()?.slice(0, -1)}`}
              </h3>
              <button className="cadastro-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="cadastro-modal-body">
              <div className="cadastro-form-group">
                <label className="cadastro-form-label">Nome *</label>
                <input className="cadastro-form-input" placeholder="Nome do item"
                  value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="cadastro-form-group">
                <label className="cadastro-form-label">Categoria</label>
                <select className="cadastro-form-select"
                  value={formData.categoria} onChange={e => setFormData(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="">Selecione uma categoria</option>
                  {getCategoryOptions().map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="cadastro-form-group">
                <label className="cadastro-form-label">Descricao</label>
                <textarea className="cadastro-form-textarea" placeholder="Descreva o item..."
                  value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} />
              </div>

              {renderFormFields()}

              <div className="cadastro-form-group">
                <div
                  className={`cadastro-form-toggle ${formData.favorito ? 'active' : ''}`}
                  onClick={() => setFormData(p => ({ ...p, favorito: !p.favorito }))}
                >
                  <Star size={20} className="cadastro-form-toggle-star" fill={formData.favorito ? 'currentColor' : 'none'} />
                  <div>
                    <div className="cadastro-form-toggle-text">Marcar como favorito</div>
                    <div className="cadastro-form-toggle-hint">Itens favoritos aparecem em destaque nos protocolos</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="cadastro-modal-footer">
              <button className="cadastro-btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="cadastro-btn-save" onClick={handleSave}>
                {editingItem ? 'Salvar alteracoes' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
