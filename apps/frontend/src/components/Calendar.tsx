'use client';

import { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  highlightedDates?: Date[];
  className?: string;
}

export function Calendar({ 
  selectedDate = new Date(), 
  onDateSelect, 
  highlightedDates = [],
  className = '' 
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "MMM, yyyy";
  const dayFormat = "d";

  const header = () => {
    return (
      <div className="calendar-header-controls">
        <h2 className="calendar-month-title">
          {format(currentMonth, dateFormat, { locale: ptBR })}
        </h2>
      </div>
    );
  };

  const daysOfWeek = () => {
    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const days = [];

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className={`calendar-day-name ${i === 0 ? 'calendar-day-sunday' : ''}`}>
          {dayLabels[i]}
        </div>
      );
    }

    return <div className="calendar-days-header">{days}</div>;
  };

  const cells = () => {
    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isHighlighted = highlightedDates.some(date => isSameDay(day, date));
        const dayOfWeek = day.getDay(); // 0 = Domingo, 1 = Segunda, etc.
        const isSunday = dayOfWeek === 0; // Domingos têm borda vermelha

        days.push(
          <div
            key={day.toString()}
            className={`calendar-cell ${
              !isCurrentMonth ? 'calendar-cell-disabled' : ''
            } ${
              isSelected ? 'calendar-cell-selected' : ''
            } ${
              isHighlighted && !isSelected ? 'calendar-cell-highlighted' : ''
            } ${
              isSunday && isCurrentMonth && !isSelected ? 'calendar-cell-monday' : ''
            }`}
            onClick={() => {
              if (isCurrentMonth && onDateSelect) {
                onDateSelect(cloneDay);
              }
            }}
          >
            <span className="calendar-cell-number">
              {format(day, dayFormat)}
            </span>
          </div>
        );
        day = addDays(day, 1);
      }

      rows.push(
        <div key={day.toString()} className="calendar-week">
          {days}
        </div>
      );
      days = [];
    }

    return <div className="calendar-body">{rows}</div>;
  };

  return (
    <div className={`calendar-container ${className}`}>
      {header()}
      {daysOfWeek()}
      {cells()}
    </div>
  );
}


