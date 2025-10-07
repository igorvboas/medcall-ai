'use client';

import Link from 'next/link';
import { motion } from "framer-motion";
import Plasma from "@/components/ui/Plasma";

export function HeroSection() {
  return (
    <section className="hero-section relative overflow-hidden">
      {/* Plasma Background - Positioned absolutely behind everything */}
      <div 
        className="absolute inset-0 z-0" 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none'
        }}
      >
        <Plasma 
          color="#E6C3A8"
          speed={0.3}
          direction="forward"
          scale={1.2}
          opacity={0.15}
          mouseInteractive={false}
        />
      </div>
      
      <div className="hero-container relative z-10">
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0.0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
        >
          {/* Announcement Badge */}
          <div className="hero-announcement">
            <span className="announcement-text">Apresentando Suporte para Modelos de IA</span>
            <svg className="announcement-arrow" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </div>

          <h1 className="hero-title">
            Revolucione suas consultas médicas com{' '}
            <span className="hero-title-accent">Inteligência Artificial</span>
          </h1>
          
          <p className="hero-subtitle">
            Transcreva consultas em tempo real, obtenha sugestões clínicas inteligentes 
            e automatize a documentação médica. Economize tempo e melhore a qualidade do atendimento.
          </p>
          
          <div className="hero-cta">
            <Link href="/auth/signup" className="btn-primary-modern">
              Teste Grátis por 14 dias
            </Link>
            <Link href="#demo" className="btn-secondary-modern">
              Ver Demonstração
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

