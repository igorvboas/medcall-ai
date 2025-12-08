'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Video, Plus, LogIn } from 'lucide-react';
import './agenda.css';

interface ConsultationEvent {
  id: string;
  title: string;
  patient: string;
  patient_id: string;
  date: Date;
  time: string;
  type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'CREATED' | 'AGENDAMENTO' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  duration: number; // em minutos
}

// Sem dados mock – inicia vazio e carrega da API
const mockConsultations: ConsultationEvent[] = [];

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AgendaPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [consultations, setConsultations] = useState<ConsultationEvent[]>(mockConsultations);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Carregar consultas do mês atual
  useEffect(() => {
    const load = async () => {
      const year = currentYear;
      const month = currentMonth + 1; // 1-12
      const res = await fetch(`/api/agenda?year=${year}&month=${month}`);
      if (!res.ok) return;
      const json = await res.json();
      const items = (json.items || []) as Array<{
        id: string;
        patient: string;
        patient_id: string;
        consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
        status: string;
        duration: number | null;
        created_at: string;
        consulta_inicio: string | null;
      }>;

      const mapped: ConsultationEvent[] = items.map((c) => {
        // Usar consulta_inicio se disponível, senão created_at
        const d = c.consulta_inicio ? new Date(c.consulta_inicio) : new Date(c.created_at);
        const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return {
          id: c.id,
          title: 'Consulta',
          patient: c.patient,
          patient_id: c.patient_id,
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          time,
          type: c.consultation_type,
          status: c.status as ConsultationEvent['status'], // Status real do banco
          duration: c.duration ? Math.round(c.duration / 60) : 30
        };
      });
      setConsultations(mapped);
    };
    load();
  }, [currentMonth, currentYear]);

  // Navegação
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') newDate.setMonth(prev.getMonth() - 1);
      else newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      const delta = direction === 'prev' ? -7 : 7;
      newDate.setDate(prev.getDate() + delta);
      return newDate;
    });
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'prev' ? -1 : 1));
      setSelectedDate(newDate);
      return newDate;
    });
  };

  // Obter dias do mês
  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Dias do mês anterior (para preencher o início)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevMonthDay = new Date(currentYear, currentMonth, -i);
      days.push({
        date: prevMonthDay,
        isCurrentMonth: false,
        isToday: false,
        consultations: []
      });
    }

    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dayConsultations = consultations.filter(consultation => 
        consultation.date.toDateString() === date.toDateString()
      );
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        consultations: dayConsultations
      });
    }

    // Dias do próximo mês (para preencher o final)
    const remainingDays = 42 - days.length; // 6 semanas * 7 dias
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonthDay = new Date(currentYear, currentMonth + 1, day);
      days.push({
        date: nextMonthDay,
        isCurrentMonth: false,
        isToday: false,
        consultations: []
      });
    }

    return days;
  };

  // Obter dias da semana corrente (domingo-sábado)
  const getDaysInWeek = () => {
    const start = new Date(currentDate);
    start.setHours(0,0,0,0);
    const dayOfWeek = start.getDay(); // 0-6
    start.setDate(start.getDate() - dayOfWeek);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dayConsultations = consultations.filter(c => c.date.toDateString() === d.toDateString());
      days.push({
        date: d,
        isCurrentMonth: d.getMonth() === currentMonth && d.getFullYear() === currentYear,
        isToday: d.toDateString() === today.toDateString(),
        consultations: dayConsultations
      });
    }
    return days;
  };

  // Obter apenas o dia selecionado/atual
  const getDayView = () => {
    const d = selectedDate ? new Date(selectedDate) : new Date(currentDate);
    d.setHours(0,0,0,0);
    const dayConsultations = consultations.filter(c => c.date.toDateString() === d.toDateString());
    return [{
      date: d,
      isCurrentMonth: true,
      isToday: d.toDateString() === today.toDateString(),
      consultations: dayConsultations
    }];
  };

  // Obter consultas do dia selecionado
  const getSelectedDayConsultations = () => {
    if (!selectedDate) return [];
    return consultations.filter(consultation => 
      consultation.date.toDateString() === selectedDate.toDateString()
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'status-created';
      case 'AGENDAMENTO':
        return 'status-agendamento';
      case 'RECORDING':
        return 'status-recording';
      case 'PROCESSING':
        return 'status-processing';
      case 'VALIDATION':
        return 'status-validation';
      case 'VALID_ANAMNESE':
        return 'status-valid-anamnese';
      case 'VALID_DIAGNOSTICO':
        return 'status-valid-diagnostico';
      case 'VALID_SOLUCAO':
        return 'status-valid-solucao';
      case 'COMPLETED':
        return 'status-completed';
      case 'ERROR':
        return 'status-error';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return 'status-created';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'TELEMEDICINA' ? <Video className="event-type-icon" /> : <User className="event-type-icon" />;
  };

  // Função para entrar na consulta agendada
  const handleEnterConsultation = (consultation: ConsultationEvent) => {
    router.push(`/consulta/nova?agendamento_id=${consultation.id}&patient_id=${consultation.patient_id}&patient_name=${encodeURIComponent(consultation.patient)}&consultation_type=${consultation.type}`);
  };

  const days = viewMode === 'month' ? getDaysInMonth() : viewMode === 'week' ? getDaysInWeek() : getDayView();

  return (
    <div className="agenda-container">
      <div className="agenda-header">
        <div className="agenda-title-section">
          <h1 className="agenda-title">Agenda</h1>
          <p className="agenda-subtitle">Gerencie suas consultas e compromissos</p>
        </div>
        
        <div className="agenda-actions">
          <Link href="/consulta/nova" className="btn btn-primary">
            <Plus className="btn-icon" />
            Nova Consulta
          </Link>
        </div>
      </div>

      <div className="agenda-content">
        {/* Calendário */}
        <div className="calendar-section">
          <div className="calendar-header">
            <div className="calendar-navigation">
              <button 
                className="nav-button"
                onClick={() => (viewMode === 'month' ? navigateMonth('prev') : viewMode === 'week' ? navigateWeek('prev') : navigateDay('prev'))}
              >
                <ChevronLeft className="nav-icon" />
              </button>
              
              <h2 className="calendar-title">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              
              <button 
                className="nav-button"
                onClick={() => (viewMode === 'month' ? navigateMonth('next') : viewMode === 'week' ? navigateWeek('next') : navigateDay('next'))}
              >
                <ChevronRight className="nav-icon" />
              </button>
            </div>

            <div className="view-mode-selector">
              <button 
                className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Mês
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Semana
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => setViewMode('day')}
              >
                Dia
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {/* Cabeçalho dos dias da semana (esconde no modo Dia) */}
            {viewMode !== 'day' && (
              <div className="calendar-weekdays">
                {dayNames.map(day => (
                  <div key={day} className="weekday-header">
                    {day}
                  </div>
                ))}
              </div>
            )}

            {/* Dias do calendário */}
            <div className="calendar-days" style={{ gridTemplateColumns: viewMode === 'day' ? '1fr' : 'repeat(7, 1fr)' }}>
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`calendar-day ${
                    day.isCurrentMonth ? 'current-month' : 'other-month'
                  } ${day.isToday ? 'today' : ''} ${
                    selectedDate?.toDateString() === day.date.toDateString() ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="day-number">{day.date.getDate()}</span>
                  
                  {day.consultations.length > 0 && (
                    <div className="day-events">
                      {day.consultations.slice(0, 3).map((consultation: ConsultationEvent) => (
                        <div
                          key={consultation.id}
                          className={`day-event ${getStatusColor(consultation.status)}`}
                          title={`${consultation.time} - ${consultation.patient}`}
                        >
                          <span className="event-time">{consultation.time}</span>
                          <span className="event-patient">{consultation.patient}</span>
                        </div>
                      ))}
                      {day.consultations.length > 3 && (
                        <div className="more-events">
                          +{day.consultations.length - 3} mais
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Painel lateral com detalhes */}
        <div className="agenda-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">
              {selectedDate ? (
                <>
                  <Calendar className="sidebar-icon" />
                  {selectedDate.toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </>
              ) : (
                <>
                  <Calendar className="sidebar-icon" />
                  Selecione uma data
                </>
              )}
            </h3>

            {!selectedDate && (
              <div className="date-range-selector">
                <div className="date-input-group">
                  <label htmlFor="start-date" className="date-label">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="date-input"
                  />
                </div>
                
                <div className="date-input-group">
                  <label htmlFor="end-date" className="date-label">
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="date-input"
                  />
                </div>
                
                {(startDate || endDate) && (
                  <div className="date-range-info">
                    <p className="range-text">
                      {startDate && endDate 
                        ? `Período: ${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`
                        : startDate 
                        ? `A partir de: ${new Date(startDate).toLocaleDateString('pt-BR')}`
                        : `Até: ${new Date(endDate).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                    <button 
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedDate && (
              <div className="day-consultations">
                {getSelectedDayConsultations().length === 0 ? (
                  <div className="no-consultations">
                    <p>Nenhuma consulta agendada para este dia</p>
                  </div>
                ) : (
                  <div className="consultations-list">
                    {getSelectedDayConsultations()
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map(consultation => (
                        <div key={consultation.id} className="consultation-card">
                          <div className="consultation-header">
                            <div className="consultation-time">
                              <Clock className="time-icon" />
                              {consultation.time}
                            </div>
                            <div className={`consultation-status ${getStatusColor(consultation.status)}`}>
                              {consultation.status}
                            </div>
                          </div>
                          
                          <div className="consultation-details">
                            <h4 className="consultation-title">{consultation.title}</h4>
                            <div className="consultation-patient">
                              <User className="patient-icon" />
                              {consultation.patient}
                            </div>
                            <div className="consultation-type">
                              {getTypeIcon(consultation.type)}
                              {consultation.type}
                            </div>
                            <div className="consultation-duration">
                              Duração: {consultation.duration} min
                            </div>
                          </div>

                          {/* Botão Entrar na Consulta (apenas para consultas com status AGENDAMENTO) */}
                          {consultation.status === 'AGENDAMENTO' && (
                            <div className="consultation-actions">
                              <button
                                className="btn-enter-consultation"
                                onClick={() => handleEnterConsultation(consultation)}
                                title="Entrar na Consulta"
                              >
                                <LogIn className="btn-icon" />
                                Entrar na Consulta
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo do mês */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Calendar className="sidebar-icon" />
              Resumo do Mês
            </h3>
            
            <div className="month-summary">
              <div className="summary-item">
                <span className="summary-label">Total de Consultas</span>
                <span className="summary-value">{consultations.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Concluídas</span>
                <span className="summary-value">
                  {consultations.filter(c => c.status === 'CONCLUIDA').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Agendadas</span>
                <span className="summary-value">
                  {consultations.filter(c => c.status === 'AGENDADA').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Telemedicina</span>
                <span className="summary-value">
                  {consultations.filter(c => c.type === 'TELEMEDICINA').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Presencial</span>
                <span className="summary-value">
                  {consultations.filter(c => c.type === 'PRESENCIAL').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

