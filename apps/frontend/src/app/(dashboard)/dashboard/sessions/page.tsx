export default function SessionsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Histórico de Sessões</h1>
        <p className="page-subtitle">
          Visualize todas as consultas e sessões realizadas
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3 className="stat-title">Total de Sessões</h3>
          <p className="stat-value">0</p>
          <p className="stat-description">Nenhuma sessão registrada</p>
        </div>

        <div className="stat-card">
          <h3 className="stat-title">Tempo Total</h3>
          <p className="stat-value">0h</p>
          <p className="stat-description">Tempo de consultas</p>
        </div>

        <div className="stat-card">
          <h3 className="stat-title">Última Sessão</h3>
          <p className="stat-value">-</p>
          <p className="stat-description">Nenhuma sessão recente</p>
        </div>
      </div>
    </div>
  );
}
