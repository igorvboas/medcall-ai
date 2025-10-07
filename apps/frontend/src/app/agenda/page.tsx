'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Video, Plus } from 'lucide-react';
import './agenda.css';

interface ConsultationEvent {
  id: string;
  title: string;
  patient: string;
  date: Date;
  time: string;
  type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'AGENDADA' | 'CONCLUIDA' | 'CANCELADA';
  duration: number; // em minutos
}

// Dados mockados de consultas
const mockConsultations: ConsultationEvent[] = [
  {
    id: '1',
    title: 'Consulta de Rotina',
    patient: 'Kristin Watson',
    date: new Date(2024, 11, 15), // 15 de dezembro de 2024
    time: '09:00',
    type: 'TELEMEDICINA',
    status: 'AGENDADA',
    duration: 30
  },
  {
    id: '2',
    title: 'Consulta de Acompanhamento',
    patient: 'Jacob Jones',
    date: new Date(2024, 11, 18), // 18 de dezembro de 2024
    time: '14:30',
    type: 'PRESENCIAL',
    status: 'AGENDADA',
    duration: 45
  },
  {
    id: '3',
    title: 'Consulta Concluída',
    patient: 'Leslie Alexander',
    date: new Date(2024, 11, 10), // 10 de dezembro de 2024
    time: '10:15',
    type: 'PRESENCIAL',
    status: 'CONCLUIDA',
    duration: 30
  },
  {
    id: '4',
    title: 'Consulta de Emergência',
    patient: 'Arlene McCoy',
    date: new Date(2024, 11, 20), // 20 de dezembro de 2024
    time: '16:00',
    type: 'TELEMEDICINA',
    status: 'AGENDADA',
    duration: 60
  },
  {
    id: '5',
    title: 'Consulta Concluída',
    patient: 'Darrell Steward',
    date: new Date(2024, 11, 8), // 8 de dezembro de 2024
    time: '11:30',
    type: 'TELEMEDICINA',
    status: 'CONCLUIDA',
    duration: 30
  },
  {
    id: '6',
    title: 'Consulta Agendada',
    patient: 'Albert Flores',
    date: new Date(2024, 11, 22), // 22 de dezembro de 2024
    time: '08:00',
    type: 'PRESENCIAL',
    status: 'AGENDADA',
    duration: 45
  }
];

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [consultations, setConsultations] = useState<ConsultationEvent[]>(mockConsultations);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Navegar entre meses
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
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

  // Obter consultas do dia selecionado
  const getSelectedDayConsultations = () => {
    if (!selectedDate) return [];
    return consultations.filter(consultation => 
      consultation.date.toDateString() === selectedDate.toDateString()
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AGENDADA':
        return 'status-scheduled';
      case 'CONCLUIDA':
        return 'status-completed';
      case 'CANCELADA':
        return 'status-cancelled';
      default:
        return 'status-scheduled';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'TELEMEDICINA' ? <Video className="event-type-icon" /> : <User className="event-type-icon" />;
  };

  const days = getDaysInMonth();

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
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="nav-icon" />
              </button>
              
              <h2 className="calendar-title">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              
              <button 
                className="nav-button"
                onClick={() => navigateMonth('next')}
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
            {/* Cabeçalho dos dias da semana */}
            <div className="calendar-weekdays">
              {dayNames.map(day => (
                <div key={day} className="weekday-header">
                  {day}
                </div>
              ))}
            </div>

            {/* Dias do calendário */}
            <div className="calendar-days">
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
                      {day.consultations.slice(0, 3).map(consultation => (
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

