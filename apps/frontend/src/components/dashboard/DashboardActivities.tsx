'use client';

import Link from 'next/link';
import { Clock, Calendar, Eye, Stethoscope, Activity } from 'lucide-react';

interface DashboardActivitiesProps {
  ultimasConsultas: Array<{
    id: string;
    patient_name: string;
    consultation_type: string;
    status: string;
    duration?: number;
    created_at: string;
    patients?: {
      name: string;
      email?: string;
    };
  }>;
  proximasConsultas: Array<{
    id: string;
    patient_name: string;
    consultation_type: string;
    created_at: string;
    patients?: {
      name: string;
      email?: string;
    };
  }>;
}

export function DashboardActivities({ ultimasConsultas, proximasConsultas }: DashboardActivitiesProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'RECORDING': return 'status-recording';
      case 'PROCESSING': return 'status-processing';
      case 'ERROR': return 'status-error';
      case 'CANCELLED': return 'status-cancelled';
      default: return 'status-created';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return 'Criada';
      case 'RECORDING': return 'Gravando';
      case 'PROCESSING': return 'Processando';
      case 'COMPLETED': return 'Concluída';
      case 'ERROR': return 'Erro';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'PRESENCIAL' ? <Stethoscope className="w-4 h-4" /> : <Activity className="w-4 h-4" />;
  };

  const getTypeText = (type: string) => {
    return type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';
  };

  return (
    <div className="activities-grid">
      {/* Últimas Consultas */}
      <div className="activity-card">
        <div className="activity-header">
          <h3 className="activity-title">
            <Clock className="w-5 h-5" />
            Últimas Consultas
          </h3>
          <Link href="/consultas" className="activity-link">
            <Eye className="w-4 h-4" />
            Ver Todas
          </Link>
        </div>
        <div className="activity-list">
          {ultimasConsultas.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma consulta encontrada</p>
            </div>
          ) : (
            ultimasConsultas.map((consulta) => (
              <div key={consulta.id} className="activity-item">
                <div className="activity-item-content">
                  <div className="activity-patient">
                    {consulta.patients?.name || consulta.patient_name}
                  </div>
                  <div className="activity-meta">
                    <span className="activity-type">
                      {getTypeIcon(consulta.consultation_type)}
                      {getTypeText(consulta.consultation_type)}
                    </span>
                    <span className="activity-date">
                      {new Date(consulta.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <span className={`status-badge ${getStatusColor(consulta.status)}`}>
                  {getStatusText(consulta.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Próximas Consultas */}
      <div className="activity-card">
        <div className="activity-header">
          <h3 className="activity-title">
            <Calendar className="w-5 h-5" />
            Próximas Consultas
          </h3>
          <Link href="/consultas" className="activity-link">
            <Eye className="w-4 h-4" />
            Ver Todas
          </Link>
        </div>
        <div className="activity-list">
          {proximasConsultas.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma consulta agendada para hoje</p>
            </div>
          ) : (
            proximasConsultas.map((consulta) => (
              <div key={consulta.id} className="activity-item">
                <div className="activity-item-content">
                  <div className="activity-patient">
                    {consulta.patients?.name || consulta.patient_name}
                  </div>
                  <div className="activity-meta">
                    <span className="activity-type">
                      {getTypeIcon(consulta.consultation_type)}
                      {getTypeText(consulta.consultation_type)}
                    </span>
                    <span className="activity-time">
                      {new Date(consulta.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
