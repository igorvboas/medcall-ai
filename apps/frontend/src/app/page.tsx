export default function HomePage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bem-vindo ao TRIA</h1>
        <p className="page-subtitle">
          Plataforma de consultas médicas com transcrição e análise em tempo real
        </p>
      </div>

      <div className="stats-grid">
        {/* Quick Stats Cards */}
        <div className="stat-card">
          <h3 className="stat-title">Consultas Hoje</h3>
          <p className="stat-value">0</p>
          <p className="stat-description">Nenhuma consulta agendada</p>
        </div>

        <div className="stat-card">
          <h3 className="stat-title">Pacientes Ativos</h3>
          <p className="stat-value">0</p>
          <p className="stat-description">Nenhum paciente cadastrado</p>
        </div>

        <div className="stat-card ai-status">
          <h3 className="stat-title">IA Disponível</h3>
          <p className="stat-value">✓</p>
          <p className="stat-description">Sistema funcionando</p>
        </div>
      </div>
    </div>
  );
}