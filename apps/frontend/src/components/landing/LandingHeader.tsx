'use client';

import { useState } from 'react';
import Link from 'next/link';

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="landing-header">
      <div className="landing-header-container">
        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-icon">T</div>
          <div className="landing-logo-text">
            <span className="landing-logo-title">TRIA</span>
            <span className="landing-logo-beta">AI</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="landing-nav-desktop">
          <Link href="#features" className="landing-nav-link">
            Funcionalidades
          </Link>
          <Link href="#pricing" className="landing-nav-link">
            Preços
          </Link>
          <Link href="#testimonials" className="landing-nav-link">
            Depoimentos
          </Link>
          <Link href="#faq" className="landing-nav-link">
            FAQ
          </Link>
        </nav>

        {/* Auth Buttons */}
        <div className="landing-auth-buttons">
          <Link href="/auth/signin" className="btn btn-outline">
            Entrar
          </Link>
          <Link href="/auth/signup" className="btn btn-primary">
            Começar Grátis
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="landing-mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="landing-menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="landing-mobile-menu">
          <nav className="landing-nav-mobile">
            <Link href="#features" className="landing-nav-link-mobile" onClick={() => setIsMenuOpen(false)}>
              Funcionalidades
            </Link>
            <Link href="#pricing" className="landing-nav-link-mobile" onClick={() => setIsMenuOpen(false)}>
              Preços
            </Link>
            <Link href="#testimonials" className="landing-nav-link-mobile" onClick={() => setIsMenuOpen(false)}>
              Depoimentos
            </Link>
            <Link href="#faq" className="landing-nav-link-mobile" onClick={() => setIsMenuOpen(false)}>
              FAQ
            </Link>
          </nav>
          <div className="landing-auth-buttons-mobile">
            <Link href="/auth/signin" className="btn btn-outline" onClick={() => setIsMenuOpen(false)}>
              Entrar
            </Link>
            <Link href="/auth/signup" className="btn btn-primary" onClick={() => setIsMenuOpen(false)}>
              Começar Grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
