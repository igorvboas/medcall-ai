'use client';

interface DashboardStatsProps {
  stats: {
    totalPacientes: number;
    consultasHoje: number;
    consultasConcluidasMes: number;
    duracaoMediaSegundos: number;
    taxaSucesso: number;
  };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <div className="stat-content">
          <h3 className="stat-value">{stats.totalPacientes}</h3>
          <p className="stat-label">Total de Pacientes</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="stat-content">
          <h3 className="stat-value">{stats.consultasHoje}</h3>
          <p className="stat-label">Consultas Hoje</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="stat-content">
          <h3 className="stat-value">{stats.consultasConcluidasMes}</h3>
          <p className="stat-label">Concluídas este Mês</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="stat-content">
          <h3 className="stat-value">{formatDuration(stats.duracaoMediaSegundos)}</h3>
          <p className="stat-label">Duração Média</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div className="stat-content">
          <h3 className="stat-value">{stats.taxaSucesso}%</h3>
          <p className="stat-label">Taxa de Sucesso</p>
        </div>
      </div>
    </div>
  );
}
