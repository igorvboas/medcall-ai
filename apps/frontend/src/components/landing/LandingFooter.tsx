'use client';

import Link from 'next/link';
import { motion } from "framer-motion";

export function LandingFooter() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <footer className="landing-footer">
      <div className="landing-footer-container">
        <motion.div 
          className="footer-content"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="footer-main-refined">
            <motion.div className="footer-brand-refined" variants={itemVariants}>
              <div className="footer-logo-refined">
                <img src="/logo-eva.png" alt="Eva Logo" className="footer-logo-image-refined" />
                <div className="footer-logo-text-refined">
                  <span className="footer-logo-title-refined">EVA</span>
                  <span className="footer-logo-beta-refined">AI</span>
                </div>
              </div>
              <p className="footer-description-refined">
                Revolucionando a prática médica com inteligência artificial avançada. 
                Mais tempo para cuidar, menos tempo para documentar.
              </p>
              <div className="footer-social-refined">
                <a href="#" className="social-link-refined" aria-label="LinkedIn">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="#" className="social-link-refined" aria-label="Twitter">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="#" className="social-link-refined" aria-label="Instagram">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </motion.div>

            <div className="footer-links-refined">
              <motion.div className="footer-column-refined" variants={itemVariants}>
                <h4 className="footer-column-title-refined">Produto</h4>
                <ul className="footer-link-list-refined">
                  <li><Link href="#features" className="footer-link-refined">Funcionalidades</Link></li>
                  <li><Link href="#pricing" className="footer-link-refined">Preços</Link></li>
                  <li><Link href="#demo" className="footer-link-refined">Demonstração</Link></li>
                  <li><Link href="/integrations" className="footer-link-refined">Integrações</Link></li>
                </ul>
              </motion.div>

              <motion.div className="footer-column-refined" variants={itemVariants}>
                <h4 className="footer-column-title-refined">Empresa</h4>
                <ul className="footer-link-list-refined">
                  <li><Link href="/about" className="footer-link-refined">Sobre Nós</Link></li>
                  <li><Link href="/careers" className="footer-link-refined">Carreiras</Link></li>
                  <li><Link href="/blog" className="footer-link-refined">Blog</Link></li>
                  <li><Link href="/press" className="footer-link-refined">Imprensa</Link></li>
                </ul>
              </motion.div>

              <motion.div className="footer-column-refined" variants={itemVariants}>
                <h4 className="footer-column-title-refined">Suporte</h4>
                <ul className="footer-link-list-refined">
                  <li><Link href="/help" className="footer-link-refined">Central de Ajuda</Link></li>
                  <li><Link href="/contact" className="footer-link-refined">Contato</Link></li>
                  <li><Link href="/status" className="footer-link-refined">Status do Sistema</Link></li>
                  <li><Link href="/security" className="footer-link-refined">Segurança</Link></li>
                </ul>
              </motion.div>

              <motion.div className="footer-column-refined" variants={itemVariants}>
                <h4 className="footer-column-title-refined">Legal</h4>
                <ul className="footer-link-list-refined">
                  <li><Link href="/privacy" className="footer-link-refined">Privacidade</Link></li>
                  <li><Link href="/terms" className="footer-link-refined">Termos de Uso</Link></li>
                  <li><Link href="/cookies" className="footer-link-refined">Política de Cookies</Link></li>
                  <li><Link href="/lgpd" className="footer-link-refined">LGPD</Link></li>
                </ul>
              </motion.div>
            </div>
          </div>

          <motion.div className="footer-cta-refined" variants={itemVariants}>
            <div className="footer-cta-content-refined">
              <h3 className="footer-cta-title-refined">Pronto para transformar sua prática médica?</h3>
              <p className="footer-cta-subtitle-refined">
                Junte-se a mais de 500 médicos que já economizam tempo e melhoram o atendimento com a EVA
              </p>
              <div className="footer-cta-buttons-refined">
                <Link href="/auth/signup" className="btn-primary-modern footer-btn">
                  Começar Teste Grátis
                </Link>
                <Link href="/contact" className="btn-secondary-modern footer-btn">
                  Falar com Vendas
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          className="footer-bottom-refined"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <div className="footer-bottom-content-refined">
            <p className="footer-copyright-refined">
              © 2024 EVA AI. Todos os direitos reservados.
            </p>
            <div className="footer-bottom-links-refined">
              <Link href="/privacy" className="footer-bottom-link-refined">Privacidade</Link>
              <Link href="/terms" className="footer-bottom-link-refined">Termos</Link>
              <Link href="/cookies" className="footer-bottom-link-refined">Cookies</Link>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
