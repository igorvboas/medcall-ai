'use client';

import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Play, 
  Pause,
  Calendar,
  FileText,
  Loader
} from 'lucide-react';
import './StatusBadge.css';

export type StatusType = 
  | 'confirmed' | 'pending' | 'cancelled' | 'completed' 
  | 'in-progress' | 'scheduled' | 'waiting' | 'recording' 
  | 'processing' | 'error' | 'created' | 'rescheduled'
  | 'validation';

interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  variant?: 'default' | 'minimal' | 'outlined';
  className?: string;
}

const statusConfig = {
  // Estados de consulta
  confirmed: {
    icon: CheckCircle,
    label: 'Confirmada',
    color: 'success',
    bgColor: '#d1fae5',
    textColor: '#065f46',
    borderColor: '#10b981'
  },
  pending: {
    icon: Clock,
    label: 'Pendente',
    color: 'warning',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    borderColor: '#f59e0b'
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelada',
    color: 'danger',
    bgColor: '#fee2e2',
    textColor: '#991b1b',
    borderColor: '#ef4444'
  },
  completed: {
    icon: CheckCircle,
    label: 'Concluída',
    color: 'success',
    bgColor: '#d1fae5',
    textColor: '#065f46',
    borderColor: '#10b981'
  },
  'in-progress': {
    icon: Play,
    label: 'Em Andamento',
    color: 'info',
    bgColor: '#dbeafe',
    textColor: '#1e40af',
    borderColor: '#3b82f6'
  },
  scheduled: {
    icon: Calendar,
    label: 'Agendada',
    color: 'info',
    bgColor: '#e0e7ff',
    textColor: '#3730a3',
    borderColor: '#6366f1'
  },
  waiting: {
    icon: Pause,
    label: 'Aguardando',
    color: 'neutral',
    bgColor: '#f3f4f6',
    textColor: '#374151',
    borderColor: '#6b7280'
  },
  recording: {
    icon: FileText,
    label: 'Gravando',
    color: 'recording',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    borderColor: '#f59e0b'
  },
  processing: {
    icon: Loader,
    label: 'Processando',
    color: 'processing',
    bgColor: '#e0e7ff',
    textColor: '#3730a3',
    borderColor: '#6366f1'
  },
  error: {
    icon: AlertCircle,
    label: 'Erro',
    color: 'danger',
    bgColor: '#fee2e2',
    textColor: '#991b1b',
    borderColor: '#ef4444'
  },
  created: {
    icon: FileText,
    label: 'Criada',
    color: 'neutral',
    bgColor: '#f3f4f6',
    textColor: '#374151',
    borderColor: '#6b7280'
  },
  rescheduled: {
    icon: Calendar,
    label: 'Reagendada',
    color: 'warning',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    borderColor: '#f59e0b'
  },
  validation: {
    icon: FileText,
    label: 'Validação',
    color: 'warning',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    borderColor: '#f59e0b'
  }
};

export function StatusBadge({ 
  status, 
  text, 
  size = 'md', 
  showIcon = true, 
  variant = 'default',
  className = '' 
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const displayText = text || config.label;

  const sizeClasses = {
    sm: 'status-badge-sm',
    md: 'status-badge-md',
    lg: 'status-badge-lg'
  };

  const variantClasses = {
    default: 'status-badge-default',
    minimal: 'status-badge-minimal',
    outlined: 'status-badge-outlined'
  };

  return (
    <span 
      className={`
        status-badge 
        status-${config.color} 
        ${sizeClasses[size]} 
        ${variantClasses[variant]}
        ${className}
      `}
      style={{
        '--status-bg': config.bgColor,
        '--status-text': config.textColor,
        '--status-border': config.borderColor
      } as React.CSSProperties}
    >
      {showIcon && (
        <Icon 
          className={`status-icon ${status === 'processing' ? 'status-icon-spin' : ''}`} 
          size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} 
        />
      )}
      <span className="status-text">{displayText}</span>
    </span>
  );
}

// Hook para obter configuração de status
export function useStatusConfig(status: StatusType) {
  return statusConfig[status];
}

// Função utilitária para mapear status do backend
export function mapBackendStatus(backendStatus: string): StatusType {
  const statusMap: Record<string, StatusType> = {
    'CREATED': 'created',
    'RECORDING': 'recording',
    'PROCESSING': 'processing',
    'VALIDATION': 'validation',
    'ERROR': 'error',
    'CANCELLED': 'cancelled',
    'COMPLETED': 'completed',
    // Mapeamentos adicionais
    'CONFIRMED': 'confirmed',
    'PENDING': 'pending',
    'IN_PROGRESS': 'in-progress',
    'SCHEDULED': 'scheduled',
    'WAITING': 'waiting',
    'RESCHEDULED': 'rescheduled',
    'Confirmed': 'confirmed',
    'Pending': 'pending',
    'Cancelled': 'cancelled'
  };

  return statusMap[backendStatus] || 'pending';
}


