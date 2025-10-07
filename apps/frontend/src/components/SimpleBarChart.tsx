'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SimpleBarChartProps {
  data: {
    labels: string[];
    values: number[];
    colors: string[];
  };
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data }) => {
  // Converter dados para formato do Recharts
  const chartData = data.labels.map((label, index) => ({
    name: label,
    value: data.values[index],
    color: data.colors[index]
  }));

  return (
    <div className="simple-bar-chart">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{
            top: 10,
            right: 20,
            left: 10,
            bottom: 10,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#aaa', fontSize: 14 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#aaa', fontSize: 14 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: any) => [value, 'Atendimentos']}
            labelStyle={{ color: '#fff' }}
          />
          <Bar 
            dataKey="value" 
            radius={[2, 2, 0, 0]}
            fill="#8884d8"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleBarChart;
