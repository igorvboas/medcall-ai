'use client';

import { motion } from "framer-motion";

export function StatsSection() {
  return (
    <section className="stats-section">
      <div className="stats-container">
        <motion.div 
          className="stats-grid"
          initial={{ opacity: 0.0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
        >
          <div className="stat-item">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3 className="stat-number">38 horas</h3>
              <p className="stat-description">a menos por mês gastos em registros clínicos</p>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3 className="stat-number">41.2 mil médicos</h3>
              <p className="stat-description">que amam e utilizam a Eva em suas consultas</p>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3 className="stat-number">122.7 mil consultas</h3>
              <p className="stat-description">realizadas em média por mês através da Eva</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
