'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, User, FileText, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import Image from 'next/image';
import './administracao.css';

export default function AdministracaoPage() {
  const [periodo, setPeriodo] = useState('Semana');

  // Dados mockados
  const estatisticas = [
    {
      titulo: 'Consultas',
      valor: '245',
      variacao: '+2',
      icone: '/card1.svg',
      cor: '#4F46E5'
    },
    {
      titulo: 'Pacientes cadastrados',
      valor: '1.250',
      variacao: '+25',
      icone: '/card2.svg',
      cor: '#10B981'
    },
    {
      titulo: 'Tempo médio de consulta',
      valor: '35:40 min',
      variacao: 'Aproximado: 34 min - Presencial: 38 min',
      icone: '/card3.svg',
      cor: '#F59E0B'
    },
    {
      titulo: 'Taxa de No-show',
      valor: '4,5%',
      variacao: 'Meta: -6%',
      variacao_positiva: false,
      icone: '/card4.svg',
      cor: '#EF4444'
    }
  ];

  const consultasProfissional = [
    { nome: 'Dra. Ana Silva', consultas: 8 },
    { nome: 'Dr Carlos Mendes', consultas: 7 },
    { nome: 'Dra. Teste', consultas: 6 },
    { nome: 'Dra. Teste', consultas: 7 },
    { nome: 'Dra. Teste', consultas: 4 },
    { nome: 'Dra. Teste', consultas: 4 }
  ];

  const consultasAtivas = [
    {
      medico: 'Dra. Ana Silva',
      tipo: 'Telemedicina',
      paciente: 'Lucas Pereira',
      inicio: '10:00',
      duracao: '58 min',
      sala: 'Sala virtual'
    },
    {
      medico: 'Dra. Ana Silva',
      tipo: 'Telemedicina',
      paciente: 'Lucas Pereira',
      inicio: '10:00',
      duracao: '58 min',
      sala: 'Sala virtual'
    },
    {
      medico: 'Dra. Ana Silva',
      tipo: 'Telemedicina',
      paciente: 'Lucas Pereira',
      inicio: '10:00',
      duracao: '58 min',
      sala: 'Sala virtual'
    },
    {
      medico: 'Dra. Ana Silva',
      tipo: 'Telemedicina',
      paciente: 'Lucas Pereira',
      inicio: '10:00',
      duracao: '58 min',
      sala: 'Sala virtual'
    }
  ];

  const proximasConsultas = [
    { paciente: 'Thiago Mendes', tipo: 'Retorno', horario: '16:30', iniciais: 'TM' },
    { paciente: 'Thiago Mendes', tipo: 'Retorno', horario: '16:30', iniciais: 'TM' },
    { paciente: 'Thiago Mendes', tipo: 'Retorno', horario: '16:30', iniciais: 'TM' },
    { paciente: 'Rafael Moreira', tipo: 'Retorno', horario: '18:00', iniciais: 'RM' },
    { paciente: 'Thiago Mendes', tipo: 'Retorno', horario: '11:30', iniciais: 'TM' },
    { paciente: 'Thiago Mendes', tipo: 'Primeira Consulta', horario: '16:30', iniciais: 'TM' },
    { paciente: 'Thiago Mendes', tipo: 'Retorno', horario: '16:30', iniciais: 'TM' },
    { paciente: 'Rafael Moreira', tipo: 'Retorno', horario: '18:00', iniciais: 'RM' },
    { paciente: 'Thiago Mendes', tipo: 'Retorno', horario: '11:30', iniciais: 'TM' },
    { paciente: 'Thiago Mendes', tipo: 'Primeira Consulta', horario: '16:30', iniciais: 'TM' }
  ];

  const diasMes = Array.from({ length: 31 }, (_, i) => i + 1);
  const primeiroDiaSemana = 6; // Domingo

  return (
    <div className="administracao-page">
      {/* Header */}
      <div className="admin-header">
        <div className="header-logo">
          <Image src="/logo-auton.png" alt="AUTON Health" width={300} height={60} />
        </div>
      </div>

      {/* Filtros e período em uma linha */}
      <div className="filters-row">
        <div className="period-filter">
          <button className={periodo === 'Hoje' ? 'active' : ''} onClick={() => setPeriodo('Hoje')}>Hoje</button>
          <button className={periodo === 'Semana' ? 'active' : ''} onClick={() => setPeriodo('Semana')}>Semana</button>
          <button className={periodo === 'Mês' ? 'active' : ''} onClick={() => setPeriodo('Mês')}>Mês</button>
          <button className={periodo === 'Personalizado' ? 'active' : ''} onClick={() => setPeriodo('Personalizado')}>Personalizado</button>
        </div>

        <div className="header-filters">
          <div className="clinic-filter">
            <label>Clínica / Unidade</label>
            <select>
              <option>Clínica Principal</option>
            </select>
          </div>
          
          <div className="professional-filter">
            <label>Profissional</label>
            <select>
              <option>Todos os Profissionais</option>
            </select>
          </div>
          
          <div className="type-filter">
            <label>Tipo de Consulta</label>
            <div className="type-buttons">
              <button className="active">Presencial</button>
              <button>Telemedicina</button>
              <button>Todas</button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="stats-grid">
        {estatisticas.map((stat, index) => (
          <div 
            key={index} 
            className="stat-card"
            style={{ backgroundImage: `url(${stat.icone})` }}
          >
            <div className="stat-content">
              <h3>{stat.titulo}</h3>
              <div className="stat-value-row">
                <span className="stat-value">{stat.valor}</span>
                {!stat.variacao.includes(':') && (
                  <span className={`stat-variation ${stat.variacao_positiva === false ? 'negative' : 'positive'}`}>
                    {stat.variacao}
                  </span>
                )}
              </div>
              {stat.variacao.includes(':') && !stat.variacao.includes('Meta') && (
                <p className="stat-subtitle">{stat.variacao}</p>
              )}
              {stat.variacao.includes('Meta') && (
                <p className="stat-subtitle meta-badge">{stat.variacao}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos principais */}
      <div className="charts-row">
        {/* Gráfico Presencial vs Telemedicina */}
        <div className="chart-card">
          <h3>Presencial vs Telemedicina</h3>
          <div className="line-chart">
            <svg viewBox="0 0 1400 450" className="chart-svg" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines horizontais */}
              <line x1="60" y1="60" x2="1350" y2="60" stroke="#F7F7F7" strokeWidth="1"/>
              <line x1="60" y1="120" x2="1350" y2="120" stroke="#F7F7F7" strokeWidth="1"/>
              <line x1="60" y1="180" x2="1350" y2="180" stroke="#F7F7F7" strokeWidth="1"/>
              <line x1="60" y1="240" x2="1350" y2="240" stroke="#F7F7F7" strokeWidth="1"/>
              <line x1="60" y1="300" x2="1350" y2="300" stroke="#F7F7F7" strokeWidth="1"/>
              <line x1="60" y1="360" x2="1350" y2="360" stroke="#F7F7F7" strokeWidth="1"/>
              
              {/* Linhas verticais */}
              <line x1="260" y1="60" x2="260" y2="360" stroke="#E5E7EB" strokeWidth="1"/>
              <line x1="700" y1="60" x2="700" y2="360" stroke="#E5E7EB" strokeWidth="1"/>
              <line x1="1220" y1="60" x2="1220" y2="360" stroke="#E5E7EB" strokeWidth="1"/>
              
              {/* Labels do eixo Y */}
              <text x="30" y="65" fill="#6B7280" fontSize="16" fontWeight="400">5</text>
              <text x="30" y="125" fill="#6B7280" fontSize="16" fontWeight="400">4</text>
              <text x="30" y="185" fill="#6B7280" fontSize="16" fontWeight="400">3</text>
              <text x="30" y="245" fill="#6B7280" fontSize="16" fontWeight="400">2</text>
              <text x="30" y="305" fill="#6B7280" fontSize="16" fontWeight="400">1</text>
              
              {/* Labels do eixo X */}
              <text x="210" y="395" fill="#9CA3AF" fontSize="14" opacity="1">09 de dez.</text>
              <text x="650" y="395" fill="#9CA3AF" fontSize="14" opacity="1">10 de dez.</text>
              <text x="1170" y="395" fill="#9CA3AF" fontSize="14" opacity="1">11 de dez.</text>
              
              {/* Linha Presencial (roxa/violeta) - horizontal na parte de baixo */}
              <line x1="260" y1="355" x2="1220" y2="355" stroke="#976EF6" strokeWidth="3"/>
              <circle cx="260" cy="355" r="4" fill="#976EF6" stroke="white" strokeWidth="1"/>
              <circle cx="700" cy="355" r="4" fill="#976EF6" stroke="white" strokeWidth="1"/>
              <circle cx="1220" cy="355" r="4" fill="#976EF6" stroke="white" strokeWidth="1"/>
              
              {/* Linha Telemedicina (azul) - ascendente com traço */}
              <polyline
                points="260,300 700,70 1220,65"
                fill="none"
                stroke="#4387F6"
                strokeWidth="3"
                strokeDasharray="8,5"
              />
              <circle cx="260" cy="300" r="4" fill="#4387F6" stroke="white" strokeWidth="1"/>
              <circle cx="700" cy="70" r="4" fill="#4387F6" stroke="white" strokeWidth="1"/>
              <circle cx="1220" cy="65" r="4" fill="#4387F6" stroke="white" strokeWidth="1"/>
              
              {/* Legenda no canto superior direito */}
              <line x1="1000" y1="30" x2="1040" y2="30" stroke="#976EF6" strokeWidth="3"/>
              <text x="1050" y="36" fill="#323232" fontSize="15" fontWeight="500">Presencial</text>
              
              <line x1="1150" y1="30" x2="1190" y2="30" stroke="#4387F6" strokeWidth="3" strokeDasharray="8,5"/>
              <text x="1200" y="36" fill="#323232" fontSize="15" fontWeight="500">Telemedicina</text>
            </svg>
          </div>
        </div>

        {/* Gráfico Consultas por profissional */}
        <div className="chart-card">
          <h3>Consultas por profissional</h3>
          <div className="bar-chart">
            {consultasProfissional.map((item, index) => (
              <div key={index} className="bar-item">
                <span className="bar-label">{item.nome}</span>
                <div className="bar-wrapper">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${(item.consultas / 8) * 100}%`,
                      background: '#1B4266'
                    }}
                  ></div>
                </div>
                <span className="bar-value">{item.consultas}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Consultas Ativas */}
      <div className="active-consultations">
        <div className="section-tabs">
          <button className="tab active">Neste momento</button>
          <button className="tab">Nome Médico</button>
          <button className="tab">Paciente</button>
          <button className="tab">Início</button>
          <button className="tab">Duração</button>
          <button className="tab">Sala</button>
        </div>
        
        <div className="consultations-list">
          {consultasAtivas.map((consulta, index) => (
            <div key={index} className="consultation-item">
              <div className="consultation-avatar">
                <span>AS</span>
              </div>
              <div className="consultation-info">
                <div className="medico-info">
                  <strong>{consulta.medico}</strong>
                  <span className="tipo-badge">{consulta.tipo}</span>
                </div>
              </div>
              <div className="consultation-patient">{consulta.paciente}</div>
              <div className="consultation-time">{consulta.inicio}</div>
              <div className="consultation-duration">{consulta.duracao}</div>
              <div className="consultation-room">{consulta.sala}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Seção inferior com gráficos e calendário */}
      <div className="bottom-section">
        {/* Coluna Esquerda - Gráficos de Status */}
        <div className="charts-left-column">
          {/* Status das consultas */}
          <div className="status-card">
            <h3>Status das consultas</h3>
            <div className="status-card-content">
              <div className="donut-chart">
                <svg viewBox="0 0 120 120" className="donut-svg">
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#3B82F6" strokeWidth="20" strokeDasharray="70 212" />
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" strokeWidth="20" strokeDasharray="50 212" strokeDashoffset="-70" />
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#F59E0B" strokeWidth="20" strokeDasharray="50 212" strokeDashoffset="-120" />
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#EF4444" strokeWidth="20" strokeDasharray="42 212" strokeDashoffset="-170" />
                  <text x="60" y="65" textAnchor="middle" fill="#1F2937" fontSize="24" fontWeight="bold">25</text>
                </svg>
              </div>
              <div className="legend">
                <div className="legend-item"><span className="dot blue"></span> Novos</div>
                <div className="legend-item"><span className="dot green"></span> Retorno</div>
                <div className="legend-item"><span className="dot yellow"></span> Cancelados</div>
                <div className="legend-item"><span className="dot red"></span> Cancelados</div>
              </div>
            </div>
          </div>

        {/* Situação da Consulta */}
        <div className="status-card">
          <h3>Situação da Consulta</h3>
          <div className="status-card-content">
            <div className="donut-chart">
              <svg viewBox="0 0 120 120" className="donut-svg">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#3B82F6" strokeWidth="20" strokeDasharray="95 282" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#9CA3AF" strokeWidth="20" strokeDasharray="60 282" strokeDashoffset="-95" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" strokeWidth="20" strokeDasharray="127 282" strokeDashoffset="-155" />
              </svg>
            </div>
            <div className="legend">
              <div className="legend-item"><span className="dot blue"></span> Agendada</div>
              <div className="legend-item"><span className="dot gray"></span> Aguardando</div>
              <div className="legend-item"><span className="dot green"></span> Finalizada</div>
            </div>
          </div>
        </div>
        </div>

        {/* Próximas Consultas */}
        <div className="upcoming-consultations">
          <div className="upcoming-header">
            <h3>Próximas Consultas</h3>
            <span className="info-icon">?</span>
          </div>
          <div className="upcoming-grid">
            {proximasConsultas.map((consulta, index) => (
              <div key={index} className="upcoming-item">
                <div className="upcoming-avatar" style={{ background: consulta.iniciais === 'RM' ? '#93C5FD' : '#BFDBFE' }}>
                  {consulta.iniciais}
                </div>
                <div className="upcoming-info">
                  <strong>{consulta.paciente}</strong>
                  <span>{consulta.tipo}</span>
                </div>
                <div className="upcoming-time">{consulta.horario}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendário */}
      <div className="calendar-section">
          <div className="calendar-header">
            <button className="calendar-nav">‹</button>
            <button className="calendar-nav">›</button>
            <button className="add-event-btn">Adicionar evento</button>
            <span className="calendar-month">Dezembro, 2025</span>
            <div className="calendar-view-buttons">
              <button className="view-btn active">Mês</button>
              <button className="view-btn">Semana</button>
              <button className="view-btn">Dia</button>
            </div>
          </div>
          
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                <div key={dia} className="weekday">{dia}</div>
              ))}
            </div>
            
            <div className="calendar-days">
              {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day empty"></div>
              ))}
              {diasMes.map((dia) => (
                <div key={dia} className="calendar-day">
                  <span className="day-number">{dia}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
    </div>
  );
}

