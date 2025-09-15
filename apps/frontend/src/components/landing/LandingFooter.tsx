import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-container">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="footer-logo">
                <div className="footer-logo-icon">T</div>
                <div className="footer-logo-text">
                  <span className="footer-logo-title">TRIA</span>
                  <span className="footer-logo-beta">AI</span>
                </div>
              </div>
              <p className="footer-description">
                Revolucionando a prática médica com inteligência artificial. 
                Mais tempo para cuidar, menos tempo para documentar.
              </p>
              <div className="footer-social">
                <a href="#" className="social-link" aria-label="LinkedIn">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="#" className="social-link" aria-label="Twitter">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="#" className="social-link" aria-label="Instagram">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.807.875 1.297 2.026 1.297 3.323s-.49 2.448-1.297 3.323c-.875.807-2.026 1.297-3.323 1.297zm7.83-9.281c-.49 0-.98-.49-.98-.98s.49-.98.98-.98.98.49.98.98-.49.98-.98.98zm-7.83 1.297c-1.297 0-2.448 1.151-2.448 2.448s1.151 2.448 2.448 2.448 2.448-1.151 2.448-2.448-1.151-2.448-2.448-2.448z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div className="footer-links">
              <div className="footer-column">
                <h4 className="footer-column-title">Produto</h4>
                <ul className="footer-link-list">
                  <li><Link href="#features" className="footer-link">Funcionalidades</Link></li>
                  <li><Link href="#pricing" className="footer-link">Preços</Link></li>
                  <li><Link href="#demo" className="footer-link">Demonstração</Link></li>
                  <li><Link href="/integrations" className="footer-link">Integrações</Link></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-column-title">Empresa</h4>
                <ul className="footer-link-list">
                  <li><Link href="/about" className="footer-link">Sobre Nós</Link></li>
                  <li><Link href="/careers" className="footer-link">Carreiras</Link></li>
                  <li><Link href="/blog" className="footer-link">Blog</Link></li>
                  <li><Link href="/press" className="footer-link">Imprensa</Link></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-column-title">Suporte</h4>
                <ul className="footer-link-list">
                  <li><Link href="/help" className="footer-link">Central de Ajuda</Link></li>
                  <li><Link href="/contact" className="footer-link">Contato</Link></li>
                  <li><Link href="/status" className="footer-link">Status do Sistema</Link></li>
                  <li><Link href="/security" className="footer-link">Segurança</Link></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-column-title">Legal</h4>
                <ul className="footer-link-list">
                  <li><Link href="/privacy" className="footer-link">Privacidade</Link></li>
                  <li><Link href="/terms" className="footer-link">Termos de Uso</Link></li>
                  <li><Link href="/cookies" className="footer-link">Política de Cookies</Link></li>
                  <li><Link href="/lgpd" className="footer-link">LGPD</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-cta">
            <div className="footer-cta-content">
              <h3 className="footer-cta-title">Pronto para transformar sua prática médica?</h3>
              <p className="footer-cta-subtitle">
                Junte-se a mais de 500 médicos que já economizam tempo com o TRIA
              </p>
              <div className="footer-cta-buttons">
                <Link href="/auth/signup" className="btn btn-primary btn-large">
                  Começar Teste Grátis
                </Link>
                <Link href="/contact" className="btn btn-outline btn-large">
                  Falar com Vendas
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p className="footer-copyright">
              © 2024 TRIA AI. Todos os direitos reservados.
            </p>
            <div className="footer-bottom-links">
              <Link href="/privacy" className="footer-bottom-link">Privacidade</Link>
              <Link href="/terms" className="footer-bottom-link">Termos</Link>
              <Link href="/cookies" className="footer-bottom-link">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
