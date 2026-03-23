'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Star, Pencil, Trash2, X,
  UtensilsCrossed, Dumbbell, Pill, UserPlus,
  Clock, Flame, Building2, Apple, Loader2
} from 'lucide-react';
import { PatientForm } from '@/components/patients/PatientForm';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { useAuth } from '@/hooks/useAuth';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import ClinicManagementPage from '@/app/clinica/gestao/page';
import './cadastro.css';

// Types
interface CadastroItem {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  favorito: boolean;
  created_at: string;
  tags: string[];
  // Alimento fields
  porcao?: string;
  calorias?: number;
  proteinas?: number;
  carboidratos?: number;
  gorduras?: number;
  fibras?: number;
  // Refeicao fields
  alimentos?: any[];
  // Treino fields
  grupo_muscular?: string;
  series?: number;
  repeticoes?: string;
  descanso?: string;
  equipamento?: string;
  // Suplemento fields
  tipo?: string;
  dosagem?: string;
  horario?: string;
  objetivo?: string;
}

type TabType = 'pacientes' | 'alimentos' | 'refeicoes' | 'treinos' | 'suplementos' | 'clinica';

const TABS: { key: TabType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: 'pacientes', label: 'Pacientes', icon: UserPlus },
  { key: 'alimentos', label: 'Alimentos', icon: Apple },
  { key: 'refeicoes', label: 'Refeicoes', icon: UtensilsCrossed },
  { key: 'treinos', label: 'Treinos', icon: Dumbbell },
  { key: 'suplementos', label: 'Suplementos', icon: Pill },
  { key: 'clinica', label: 'Gestao de Clinica', icon: Building2, adminOnly: true },
];

const SUPLEMENTO_TIPOS = [
  { value: 'suplemento', label: 'Suplemento' },
  { value: 'fitoterapico', label: 'Fitoterapico' },
  { value: 'homeopatia', label: 'Homeopatia' },
  { value: 'floral_bach', label: 'Floral de Bach' },
];

export default function CadastroPage() {
  const [activeTab, setActiveTab] = useState<TabType>('alimentos');
  const [items, setItems] = useState<CadastroItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CadastroItem | null>(null);
  const [isClinicAdmin, setIsClinicAdmin] = useState(false);
  const [tipoSuplementoFilter, setTipoSuplementoFilter] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    nome: '', categoria: '', descricao: '', favorito: false,
    porcao: '', calorias: '', proteinas: '', carboidratos: '', gorduras: '', fibras: '',
    grupo_muscular: '', series: '', repeticoes: '', descanso: '', equipamento: '',
    tipo: 'suplemento', dosagem: '', horario: '', objetivo: '',
  });

  // Check clinic admin
  useEffect(() => {
    const check = async () => {
      if (!user?.id) { setIsClinicAdmin(false); return; }
      try {
        const { data } = await supabase
          .from('medicos')
          .select('admin, clinica_admin')
          .eq('user_auth', user.id)
          .maybeSingle();
        setIsClinicAdmin(data?.clinica_admin === true || data?.admin === true);
      } catch { setIsClinicAdmin(false); }
    };
    check();
  }, [user?.id]);

  // API type mapping
  const getApiType = useCallback((tab: TabType) => {
    if (tab === 'pacientes' || tab === 'clinica') return '';
    return tab;
  }, []);

  // Load items from API
  const loadItems = useCallback(async (tab?: TabType) => {
    const t = tab || activeTab;
    if (t === 'pacientes' || t === 'clinica') return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (showFavoritesOnly) params.set('favorito', 'true');
      if (t === 'suplementos' && tipoSuplementoFilter) {
        params.set('tipo_suplemento', tipoSuplementoFilter);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await gatewayClient.get(`/cadastro/${getApiType(t)}${qs}`);
      if (res.success) {
        setItems(res.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, showFavoritesOnly, tipoSuplementoFilter, getApiType]);

  // Load on tab change
  useEffect(() => {
    if (activeTab === 'pacientes' || activeTab === 'clinica') return;
    loadItems();
  }, [activeTab, showFavoritesOnly, tipoSuplementoFilter]);

  // Debounced search
  useEffect(() => {
    if (activeTab === 'pacientes' || activeTab === 'clinica') return;
    const timer = setTimeout(() => loadItems(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load counts for tabs
  useEffect(() => {
    const loadCounts = async () => {
      const types = ['alimentos', 'refeicoes', 'treinos', 'suplementos'] as const;
      const newCounts: Record<string, number> = {};
      for (const t of types) {
        try {
          const res = await gatewayClient.get(`/cadastro/${t}`);
          newCounts[t] = res.data?.length || 0;
        } catch { newCounts[t] = 0; }
      }
      setCounts(newCounts);
    };
    if (user?.id) loadCounts();
  }, [user?.id]);

  // Filter locally (search already handled server-side but filter favorites client-side for responsiveness)
  const filteredItems = items;

  // CRUD operations
  const handleSave = async () => {
    if (!formData.nome.trim()) {
      showError('Nome e obrigatorio');
      return;
    }

    setSaving(true);
    try {
      const apiType = getApiType(activeTab);
      const payload: any = {
        nome: formData.nome,
        categoria: formData.categoria,
        descricao: formData.descricao,
        favorito: formData.favorito,
      };

      if (activeTab === 'alimentos') {
        payload.porcao = formData.porcao;
        payload.calorias = formData.calorias ? parseInt(formData.calorias) : null;
        payload.proteinas = formData.proteinas ? parseFloat(formData.proteinas) : null;
        payload.carboidratos = formData.carboidratos ? parseFloat(formData.carboidratos) : null;
        payload.gorduras = formData.gorduras ? parseFloat(formData.gorduras) : null;
        payload.fibras = formData.fibras ? parseFloat(formData.fibras) : null;
      } else if (activeTab === 'treinos') {
        payload.grupo_muscular = formData.grupo_muscular;
        payload.series = formData.series ? parseInt(formData.series) : null;
        payload.repeticoes = formData.repeticoes;
        payload.descanso = formData.descanso;
        payload.equipamento = formData.equipamento;
      } else if (activeTab === 'suplementos') {
        payload.tipo = formData.tipo;
        payload.dosagem = formData.dosagem;
        payload.horario = formData.horario;
        payload.objetivo = formData.objetivo;
      }

      if (editingItem) {
        await gatewayClient.put(`/cadastro/${apiType}/${editingItem.id}`, payload);
        showSuccess('Item atualizado com sucesso');
      } else {
        await gatewayClient.post(`/cadastro/${apiType}`, payload);
        showSuccess('Item cadastrado com sucesso');
        setCounts(prev => ({ ...prev, [activeTab]: (prev[activeTab] || 0) + 1 }));
      }

      setShowModal(false);
      loadItems();
    } catch (err) {
      showError('Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = async (item: CadastroItem) => {
    try {
      await gatewayClient.patch(`/cadastro/${getApiType(activeTab)}/${item.id}/favorito`, {});
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, favorito: !i.favorito } : i));
    } catch {
      showError('Erro ao atualizar favorito');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await gatewayClient.delete(`/cadastro/${getApiType(activeTab)}/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      setCounts(prev => ({ ...prev, [activeTab]: Math.max((prev[activeTab] || 1) - 1, 0) }));
      showSuccess('Item removido com sucesso');
    } catch {
      showError('Erro ao remover item');
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      nome: '', categoria: '', descricao: '', favorito: false,
      porcao: '', calorias: '', proteinas: '', carboidratos: '', gorduras: '', fibras: '',
      grupo_muscular: '', series: '', repeticoes: '', descanso: '', equipamento: '',
      tipo: 'suplemento', dosagem: '', horario: '', objetivo: '',
    });
    setShowModal(true);
  };

  const openEditModal = (item: CadastroItem) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '', categoria: item.categoria || '', descricao: item.descricao || '',
      favorito: item.favorito || false,
      porcao: item.porcao || '', calorias: item.calorias?.toString() || '',
      proteinas: item.proteinas?.toString() || '', carboidratos: item.carboidratos?.toString() || '',
      gorduras: item.gorduras?.toString() || '', fibras: item.fibras?.toString() || '',
      grupo_muscular: item.grupo_muscular || '', series: item.series?.toString() || '',
      repeticoes: item.repeticoes || '', descanso: item.descanso || '', equipamento: item.equipamento || '',
      tipo: item.tipo || 'suplemento', dosagem: item.dosagem || '',
      horario: item.horario || '', objetivo: item.objetivo || '',
    });
    setShowModal(true);
  };

  const handleCreatePatient = async (patientData: any) => {
    try {
      await gatewayClient.post('/patients', patientData);
      showSuccess('Paciente cadastrado com sucesso');
      setShowPatientForm(false);
    } catch {
      showError('Erro ao cadastrar paciente');
    }
  };

  const getCategoryOptions = () => {
    switch (activeTab) {
      case 'alimentos':
        return ['Proteina', 'Carboidrato', 'Vegetal', 'Leguminosa', 'Gordura', 'Fruta', 'Lacteo', 'Outro'];
      case 'refeicoes':
        return ['Cafe da manha', 'Lanche da manha', 'Almoco', 'Lanche da tarde', 'Jantar', 'Ceia', 'Pre-treino', 'Pos-treino'];
      case 'treinos':
        return ['Peito', 'Costas', 'Ombros', 'Biceps', 'Triceps', 'Pernas', 'Gluteos', 'Abdomen', 'Cardio', 'Funcional'];
      case 'suplementos': {
        if (formData.tipo === 'fitoterapico') return ['Adaptogeno', 'Calmante', 'Anti-inflamatorio', 'Digestivo', 'Imunidade', 'Hormonal', 'Cognitivo'];
        if (formData.tipo === 'homeopatia') return ['Constitucional', 'Agudo', 'Cronico', 'Miasmatico'];
        if (formData.tipo === 'floral_bach') return ['Medo', 'Incerteza', 'Desinteresse', 'Solidao', 'Sensibilidade', 'Desanimo', 'Preocupacao'];
        return ['Proteina', 'Aminoacido', 'Vitamina', 'Mineral', 'Performance', 'Saude', 'Recuperacao'];
      }
      default: return [];
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'pacientes': return 'Pacientes';
      case 'alimentos': return 'Alimentos';
      case 'refeicoes': return 'Refeicoes';
      case 'treinos': return 'Exercicios';
      case 'suplementos': return 'Suplementos';
    }
  };

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'pacientes': return 'Gerencie seus pacientes cadastrados';
      case 'alimentos': return 'Cadastre alimentos individuais para montar refeicoes';
      case 'refeicoes': return 'Monte refeicoes completas com os alimentos cadastrados';
      case 'treinos': return 'Cadastre exercicios para montar protocolos de treino';
      case 'suplementos': return 'Cadastre suplementos, fitoterapicos, homeopatia e florais';
    }
  };

  const renderCardContent = (item: CadastroItem) => {
    if (activeTab === 'alimentos') {
      return (
        <div className="cadastro-card-info">
          {item.porcao && <span className="cadastro-card-tag highlight">{item.porcao}</span>}
          {item.calorias && <span className="cadastro-card-tag"><Flame size={12} /> {item.calorias} kcal</span>}
          {item.proteinas && <span className="cadastro-card-tag">P: {item.proteinas}g</span>}
          {item.carboidratos && <span className="cadastro-card-tag">C: {item.carboidratos}g</span>}
          {item.gorduras && <span className="cadastro-card-tag">G: {item.gorduras}g</span>}
        </div>
      );
    }
    if (activeTab === 'refeicoes') {
      return (
        <div className="cadastro-card-info">
          {item.alimentos && item.alimentos.length > 0 && (
            <span className="cadastro-card-tag highlight"><UtensilsCrossed size={12} /> {item.alimentos.length} alimentos</span>
          )}
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
    if (activeTab === 'suplementos') {
      const tipoLabel = SUPLEMENTO_TIPOS.find(t => t.value === item.tipo)?.label;
      return (
        <div className="cadastro-card-info">
          {tipoLabel && <span className="cadastro-card-tag highlight"><Pill size={12} /> {tipoLabel}</span>}
          {item.dosagem && <span className="cadastro-card-tag">{item.dosagem}</span>}
          {item.horario && <span className="cadastro-card-tag"><Clock size={12} /> {item.horario}</span>}
        </div>
      );
    }
    return null;
  };

  const renderFormFields = () => {
    if (activeTab === 'alimentos') {
      return (
        <>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Porcao</label>
            <input className="cadastro-form-input" placeholder="Ex: 150g, 1 unidade"
              value={formData.porcao} onChange={e => setFormData(p => ({ ...p, porcao: e.target.value }))} />
          </div>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Calorias (kcal)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 165"
                value={formData.calorias} onChange={e => setFormData(p => ({ ...p, calorias: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Proteinas (g)</label>
              <input type="number" step="0.1" className="cadastro-form-input" placeholder="Ex: 31"
                value={formData.proteinas} onChange={e => setFormData(p => ({ ...p, proteinas: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Carboidratos (g)</label>
              <input type="number" step="0.1" className="cadastro-form-input" placeholder="Ex: 0"
                value={formData.carboidratos} onChange={e => setFormData(p => ({ ...p, carboidratos: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Gorduras (g)</label>
              <input type="number" step="0.1" className="cadastro-form-input" placeholder="Ex: 3.6"
                value={formData.gorduras} onChange={e => setFormData(p => ({ ...p, gorduras: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Fibras (g)</label>
            <input type="number" step="0.1" className="cadastro-form-input" placeholder="Ex: 0"
              value={formData.fibras} onChange={e => setFormData(p => ({ ...p, fibras: e.target.value }))} />
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
    if (activeTab === 'suplementos') {
      return (
        <>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Tipo *</label>
            <select className="cadastro-form-select"
              value={formData.tipo} onChange={e => setFormData(p => ({ ...p, tipo: e.target.value, categoria: '' }))}>
              {SUPLEMENTO_TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
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
            <textarea className="cadastro-form-textarea" placeholder="Descreva o objetivo..."
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
              <p className="cadastro-subtitle">Gerencie alimentos, refeicoes, treinos e suplementos.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="cadastro-tabs">
          {TABS.filter(tab => !tab.adminOnly || isClinicAdmin).map(tab => {
            const Icon = tab.icon;
            const count = counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                className={`cadastro-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.key); setSearch(''); setShowFavoritesOnly(false); setTipoSuplementoFilter(''); }}
              >
                <Icon size={18} />
                {tab.label}
                {count > 0 && tab.key !== 'pacientes' && tab.key !== 'clinica' && (
                  <span className="cadastro-tab-count">{count}</span>
                )}
              </button>
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
                    <p className="cadastro-section-subtitle">Cadastre novos pacientes diretamente por aqui</p>
                  </div>
                  <button className="cadastro-btn-add" onClick={() => setShowPatientForm(true)}>
                    <Plus size={18} /> Novo Paciente
                  </button>
                </div>
                <div className="cadastro-empty">
                  <div className="cadastro-empty-icon"><UserPlus size={28} /></div>
                  <h3 className="cadastro-empty-title">Cadastre seus pacientes</h3>
                  <p className="cadastro-empty-text">Clique no botao acima para cadastrar um novo paciente.</p>
                  <button className="cadastro-empty-btn" onClick={() => setShowPatientForm(true)}>
                    <Plus size={16} /> Novo Paciente
                  </button>
                </div>
              </>
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
                <Plus size={18} /> Novo
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
                <Star size={16} /> Favoritos
              </button>
              {activeTab === 'suplementos' && (
                <select
                  className="cadastro-filter-select"
                  value={tipoSuplementoFilter}
                  onChange={e => setTipoSuplementoFilter(e.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  {SUPLEMENTO_TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Loading */}
            {loading ? (
              <div className="cadastro-empty">
                <Loader2 size={32} className="cadastro-spinner" />
                <p className="cadastro-empty-text">Carregando...</p>
              </div>
            ) : filteredItems.length > 0 ? (
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
                          onClick={() => toggleFavorite(item)}
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
                      {item.descricao && <p className="cadastro-card-description">{item.descricao}</p>}
                    </div>
                    <div className="cadastro-card-footer">
                      <span className="cadastro-card-date">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : ''}
                      </span>
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
                  {activeTab === 'alimentos' && <Apple size={28} />}
                  {activeTab === 'refeicoes' && <UtensilsCrossed size={28} />}
                  {activeTab === 'treinos' && <Dumbbell size={28} />}
                  {activeTab === 'suplementos' && <Pill size={28} />}
                </div>
                <h3 className="cadastro-empty-title">
                  {search ? 'Nenhum resultado encontrado' : `Nenhum cadastro de ${getTabTitle()?.toLowerCase()}`}
                </h3>
                <p className="cadastro-empty-text">
                  {search ? 'Tente buscar com outros termos.' : 'Comece cadastrando seu primeiro item.'}
                </p>
                {!search && (
                  <button className="cadastro-empty-btn" onClick={openAddModal}>
                    <Plus size={16} /> Cadastrar primeiro item
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
                {editingItem ? 'Editar' : 'Novo'} {getTabTitle()?.slice(0, -1) || 'Item'}
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

              {/* Tipo selector for suplementos (before category) */}
              {activeTab === 'suplementos' && renderFormFields()}

              {activeTab !== 'suplementos' && (
                <>
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
                </>
              )}

              {activeTab === 'suplementos' && (
                <>
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
                </>
              )}

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
              <button className="cadastro-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 size={16} className="cadastro-spinner" /> Salvando...</> : (editingItem ? 'Salvar alteracoes' : 'Cadastrar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
