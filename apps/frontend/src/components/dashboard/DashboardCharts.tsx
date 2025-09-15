'use client';

import { BarChart3, PieChart, TrendingUp } from 'lucide-react';

interface DashboardChartsProps {
  consultasPorDia: Array<{
    date: string;
    total: number;
    presencial: number;
    telemedicina: number;
    concluidas: number;
  }>;
  distribuicoes: {
    porStatus: Record<string, number>;
    porTipo: Record<string, number>;
  };
}

export function DashboardCharts({ consultasPorDia, distribuicoes }: DashboardChartsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getMaxValue = () => {
    const maxTotal = Math.max(...consultasPorDia.map(d => d.total));
    return Math.max(maxTotal, 10); // Mínimo de 10 para visualização
  };

  const maxValue = getMaxValue();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#22c55e';
      case 'RECORDING': return '#3b82f6';
      case 'PROCESSING': return '#a855f7';
      case 'ERROR': return '#ef4444';
      case 'CANCELLED': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return 'Criadas';
      case 'RECORDING': return 'Gravando';
      case 'PROCESSING': return 'Processando';
      case 'COMPLETED': return 'Concluídas';
      case 'ERROR': return 'Erro';
      case 'CANCELLED': return 'Canceladas';
      default: return status;
    }
  };

  return (
    <div className="charts-grid">
      {/* Gráfico de Consultas por Dia */}
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">
            <BarChart3 className="w-5 h-5" />
            Consultas dos Últimos 30 Dias
          </h3>
        </div>
        <div className="chart-content">
          {consultasPorDia.length === 0 ? (
            <div className="empty-chart">
              <p>Nenhum dado disponível para o período</p>
            </div>
          ) : (
            <div className="bar-chart">
              {consultasPorDia.slice(-14).map((day, index) => (
                <div key={day.date} className="bar-group">
                  <div className="bar-container">
                    <div 
                      className="bar presencial" 
                      style={{ 
                        height: `${(day.presencial / maxValue) * 100}%`,
                        minHeight: day.presencial > 0 ? '4px' : '0'
                      }}
                      title={`Presencial: ${day.presencial}`}
                    />
                    <div 
                      className="bar telemedicina" 
                      style={{ 
                        height: `${(day.telemedicina / maxValue) * 100}%`,
                        minHeight: day.telemedicina > 0 ? '4px' : '0'
                      }}
                      title={`Telemedicina: ${day.telemedicina}`}
                    />
                  </div>
                  <div className="bar-label">
                    {formatDate(day.date)}
                  </div>
                  <div className="bar-value">
                    {day.total}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color presencial"></div>
              <span>Presencial</span>
            </div>
            <div className="legend-item">
              <div className="legend-color telemedicina"></div>
              <span>Telemedicina</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Distribuição por Status */}
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">
            <PieChart className="w-5 h-5" />
            Status das Consultas
          </h3>
        </div>
        <div className="chart-content">
          {Object.keys(distribuicoes.porStatus).length === 0 ? (
            <div className="empty-chart">
              <p>Nenhuma consulta encontrada</p>
            </div>
          ) : (
            <>
              <div className="pie-chart">
                <div className="pie-chart-center">
                  <div className="pie-total">
                    {Object.values(distribuicoes.porStatus).reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="pie-label">Total</div>
                </div>
                <div className="pie-segments">
                  {Object.entries(distribuicoes.porStatus).map(([status, count], index) => {
                    const total = Object.values(distribuicoes.porStatus).reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const rotation = Object.entries(distribuicoes.porStatus)
                      .slice(0, index)
                      .reduce((acc, [, prevCount]) => acc + (prevCount / total) * 360, 0);
                    
                    return (
                      <div
                        key={status}
                        className="pie-segment"
                        style={{
                          '--percentage': `${percentage}%`,
                          '--rotation': `${rotation}deg`,
                          '--color': getStatusColor(status)
                        } as React.CSSProperties}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="chart-legend">
                {Object.entries(distribuicoes.porStatus).map(([status, count]) => (
                  <div key={status} className="legend-item">
                    <div 
                      className="legend-color" 
                      style={{ backgroundColor: getStatusColor(status) }}
                    />
                    <span>{getStatusText(status)}: {count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gráfico de Distribuição por Tipo */}
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">
            <TrendingUp className="w-5 h-5" />
            Tipo de Consulta
          </h3>
        </div>
        <div className="chart-content">
          {Object.keys(distribuicoes.porTipo).length === 0 ? (
            <div className="empty-chart">
              <p>Nenhuma consulta encontrada</p>
            </div>
          ) : (
            <>
              <div className="horizontal-bar-chart">
                {Object.entries(distribuicoes.porTipo).map(([tipo, count]) => {
                  const total = Object.values(distribuicoes.porTipo).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  const isPresencial = tipo === 'PRESENCIAL';
                  
                  return (
                    <div key={tipo} className="horizontal-bar-group">
                      <div className="horizontal-bar-label">
                        {isPresencial ? 'Presencial' : 'Telemedicina'}
                      </div>
                      <div className="horizontal-bar-container">
                        <div 
                          className={`horizontal-bar ${isPresencial ? 'presencial' : 'telemedicina'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="horizontal-bar-value">
                        {count} ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
