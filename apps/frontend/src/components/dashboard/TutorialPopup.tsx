'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GraduationCap } from 'lucide-react';

export interface TutorialStep {
  selector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  expandSidebar?: boolean;
}

interface TutorialPopupProps {
  steps: TutorialStep[];
  pageKey: string;
  showWelcome?: boolean;
}

type Phase = 'welcome' | 'tour' | 'hidden';

const TOOLTIP_WIDTH = 340;
const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const VIEWPORT_MARGIN = 10;
const SIDEBAR_ANIMATION_DELAY = 400;

const ALL_PAGE_KEYS = [
  'dashboard',
  'pacientes',
  'consultas',
  'agenda',
  'gestao',
  'configuracoes',
];

function getStorageKey(pageKey: string) {
  return `auton_tutorial_done_${pageKey}`;
}

function isPageDone(pageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(getStorageKey(pageKey)) === 'true';
}

function markPageDone(pageKey: string) {
  localStorage.setItem(getStorageKey(pageKey), 'true');
}

function isTutorialActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('auton_tutorial_active') === 'true';
}

function setTutorialActive(active: boolean) {
  if (active) {
    localStorage.setItem('auton_tutorial_active', 'true');
  } else {
    localStorage.removeItem('auton_tutorial_active');
  }
}

function checkAllPagesDone() {
  return ALL_PAGE_KEYS.every((key) => isPageDone(key));
}

function getElementRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

interface TooltipPos {
  top: number;
  left: number;
  actualPosition: 'top' | 'bottom' | 'left' | 'right';
}

function computeTooltipPosition(
  rect: DOMRect,
  preferred: 'top' | 'bottom' | 'left' | 'right'
): TooltipPos {
  const gap = 14;
  const positions: Array<'top' | 'bottom' | 'left' | 'right'> = [
    preferred,
    'bottom',
    'right',
    'left',
    'top',
  ];
  const seen = new Set<string>();
  const unique = positions.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  for (const pos of unique) {
    let top = 0;
    let left = 0;

    switch (pos) {
      case 'top':
        top = rect.top - gap - /* estimate height */ 160;
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - 80;
        left = rect.left - gap - TOOLTIP_WIDTH;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - 80;
        left = rect.right + gap;
        break;
    }

    // Clamp to viewport
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - 200));
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN)
    );

    const fitsVertically = top >= VIEWPORT_MARGIN && top < window.innerHeight - 100;
    const fitsHorizontally =
      left >= VIEWPORT_MARGIN &&
      left + TOOLTIP_WIDTH <= window.innerWidth - VIEWPORT_MARGIN;

    if (fitsVertically && fitsHorizontally) {
      return { top, left, actualPosition: pos };
    }
  }

  // Final fallback: bottom, clamped
  return {
    top: Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.bottom + gap, window.innerHeight - 200)
    ),
    left: Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
        window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN
      )
    ),
    actualPosition: 'bottom',
  };
}

export function TutorialPopup({
  steps,
  pageKey,
  showWelcome = false,
}: TutorialPopupProps) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [currentStep, setCurrentStep] = useState(0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const blockingRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Scroll blocking ---
  const blockScroll = useCallback(() => {
    if (blockingRef.current) return;
    blockingRef.current = true;

    document.body.classList.add('tutorial-active');
    document.documentElement.classList.add('tutorial-active');

    const preventWheel = (e: WheelEvent) => e.preventDefault();
    const preventTouch = (e: TouchEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      const blocked = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'PageUp',
        'PageDown',
        'Home',
        'End',
        ' ',
      ];
      if (blocked.includes(e.key)) e.preventDefault();
    };

    window.addEventListener('wheel', preventWheel, { passive: false });
    window.addEventListener('touchmove', preventTouch, { passive: false });
    window.addEventListener('keydown', preventKeys, { passive: false });

    (window as any).__tutorialCleanupScroll = () => {
      window.removeEventListener('wheel', preventWheel);
      window.removeEventListener('touchmove', preventTouch);
      window.removeEventListener('keydown', preventKeys);
      document.body.classList.remove('tutorial-active');
      document.documentElement.classList.remove('tutorial-active');
      blockingRef.current = false;
    };
  }, []);

  const unblockScroll = useCallback(() => {
    const cleanup = (window as any).__tutorialCleanupScroll;
    if (cleanup) {
      cleanup();
      delete (window as any).__tutorialCleanupScroll;
    }
  }, []);

  // --- Sidebar expansion ---
  const expandSidebar = useCallback((expand: boolean) => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    if (expand) {
      sidebar.classList.add('expanded');
    } else {
      sidebar.classList.remove('expanded');
    }
  }, []);

  // --- Position calculation ---
  const updatePosition = useCallback(
    (stepIndex: number) => {
      if (stepIndex < 0 || stepIndex >= steps.length) return;
      const step = steps[stepIndex];
      const rect = getElementRect(step.selector);
      if (!rect) {
        setTargetRect(null);
        setTooltipPos(null);
        return;
      }
      setTargetRect(rect);
      setTooltipPos(computeTooltipPosition(rect, step.position));
    },
    [steps]
  );

  // --- Navigate to step ---
  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      const step = steps[index];

      if (step.expandSidebar) {
        expandSidebar(true);
      } else {
        expandSidebar(false);
      }

      const delay = step.expandSidebar ? SIDEBAR_ANIMATION_DELAY : 0;
      setTimeout(() => {
        const el = document.querySelector(step.selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
          setCurrentStep(index);
          updatePosition(index);
        }, 100);
      }, delay);
    },
    [steps, expandSidebar, updatePosition]
  );

  // --- Complete tutorial ---
  const completeTutorial = useCallback(() => {
    unblockScroll();
    expandSidebar(false);
    markPageDone(pageKey);
    if (checkAllPagesDone()) {
      setTutorialActive(false);
    }
    setPhase('hidden');
  }, [pageKey, unblockScroll, expandSidebar]);

  // --- Skip tutorial ---
  const skipTutorial = useCallback(() => {
    unblockScroll();
    expandSidebar(false);
    setTutorialActive(false);
    ALL_PAGE_KEYS.forEach((key) => markPageDone(key));
    setPhase('hidden');
  }, [unblockScroll, expandSidebar]);

  // --- Start tour ---
  const startTour = useCallback(() => {
    setPhase('tour');
    setCurrentStep(0);
    setShowSkipConfirm(false);
    blockScroll();
    setTimeout(() => {
      goToStep(0);
    }, 50);
  }, [blockScroll, goToStep]);

  // --- Restart handler ---
  const restart = useCallback(() => {
    localStorage.removeItem(getStorageKey(pageKey));
    setTutorialActive(true);
    setCurrentStep(0);
    setShowSkipConfirm(false);
    if (showWelcome) {
      setPhase('welcome');
    } else {
      startTour();
    }
  }, [pageKey, showWelcome, startTour]);

  // --- Mount logic ---
  useEffect(() => {
    if (showWelcome && !isTutorialActive() && !isPageDone(pageKey)) {
      setPhase('welcome');
    } else if (isTutorialActive() && !isPageDone(pageKey)) {
      startTour();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Listen for restart event ---
  useEffect(() => {
    const handler = () => restart();
    window.addEventListener('tutorial-restart', handler);
    return () => window.removeEventListener('tutorial-restart', handler);
  }, [restart]);

  // --- Resize handler ---
  useEffect(() => {
    if (phase !== 'tour') return;
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        updatePosition(currentStep);
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [phase, currentStep, updatePosition]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      unblockScroll();
    };
  }, [unblockScroll]);

  // --- Navigation ---
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  // --- Render: hidden ---
  if (phase === 'hidden') return null;

  // --- Render: welcome ---
  if (phase === 'welcome') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.65)',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: '40px 36px',
            maxWidth: 440,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative',
          }}
        >
          {!showSkipConfirm ? (
            <>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1B4266, #2a6a9e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <GraduationCap size={32} color="#fff" />
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#1B4266',
                  margin: '0 0 12px',
                }}
              >
                Bem-vindo ao Auton Health!
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: '#555',
                  lineHeight: 1.6,
                  margin: '0 0 28px',
                }}
              >
                Vamos fazer um tour r&aacute;pido pela plataforma para que
                voc&ecirc; conhe&ccedil;a todas as funcionalidades dispon&iacute;veis.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                <button
                  onClick={() => {
                    setTutorialActive(true);
                    startTour();
                  }}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1B4266, #2a6a9e)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    boxShadow: '0 4px 14px rgba(27, 66, 102, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  Iniciar Tutorial
                </button>
                <button
                  onClick={() => setShowSkipConfirm(true)}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 10,
                    border: '2px solid #EF4444',
                    background: 'transparent',
                    color: '#EF4444',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = '#FEF2F2';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'transparent';
                  }}
                >
                  Pular Tutorial
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: 28,
                }}
              >
                <span style={{ color: '#D97706' }}>&#9888;</span>
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#1B4266',
                  margin: '0 0 10px',
                }}
              >
                Tem certeza?
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: '#666',
                  lineHeight: 1.5,
                  margin: '0 0 24px',
                }}
              >
                Voc&ecirc; pode reiniciar o tutorial a qualquer momento nas
                configura&ccedil;&otilde;es.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: '2px solid #1B4266',
                    background: 'transparent',
                    color: '#1B4266',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Voltar
                </button>
                <button
                  onClick={skipTutorial}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Sim, Pular
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Render: tour ---
  if (phase !== 'tour' || !targetRect || !tooltipPos) return null;

  const step = steps[currentStep];
  const spotX = targetRect.left - SPOTLIGHT_PADDING;
  const spotY = targetRect.top - SPOTLIGHT_PADDING;
  const spotW = targetRect.width + SPOTLIGHT_PADDING * 2;
  const spotH = targetRect.height + SPOTLIGHT_PADDING * 2;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* SVG overlay with spotlight mask */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
        }}
        onClick={handleNext}
      >
        <defs>
          <mask id="tutorial-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotX}
              y={spotY}
              width={spotW}
              height={spotH}
              rx={SPOTLIGHT_RADIUS}
              ry={SPOTLIGHT_RADIUS}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tutorial-spotlight-mask)"
        />
        {/* Spotlight border */}
        <rect
          x={spotX}
          y={spotY}
          width={spotW}
          height={spotH}
          rx={SPOTLIGHT_RADIUS}
          ry={SPOTLIGHT_RADIUS}
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth={2}
        />
      </svg>

      {/* Tooltip */}
      <div
        style={{
          position: 'absolute',
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: `${TOOLTIP_WIDTH}px`,
          maxWidth: `${TOOLTIP_WIDTH}px !important`,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          padding: '20px',
          pointerEvents: 'auto',
          zIndex: 100000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step badge */}
        <div
          style={{
            display: 'inline-block',
            background: '#EBF3F6',
            color: '#1B4266',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {currentStep + 1} / {steps.length}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1B4266',
            margin: '0 0 8px',
          }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: '#555',
            lineHeight: 1.55,
            margin: '0 0 18px',
          }}
        >
          {step.description}
        </p>

        {/* Navigation dots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            marginBottom: 16,
          }}
        >
          {steps.map((_, i) => {
            const isActive = i === currentStep;
            const isCompleted = i < currentStep;
            return (
              <div
                key={i}
                style={{
                  width: isActive ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: isActive
                    ? '#1B4266'
                    : isCompleted
                      ? '#93b5cf'
                      : '#ddd',
                  transition: 'all 0.25s ease',
                }}
              />
            );
          })}
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: '2px solid #1B4266',
              background: 'transparent',
              color: '#1B4266',
              fontSize: 14,
              fontWeight: 600,
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.4 : 1,
              transition: 'background 0.15s',
            }}
          >
            Anterior
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #1B4266, #2a6a9e)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(27, 66, 102, 0.25)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {currentStep === steps.length - 1 ? 'Concluir' : 'Pr\u00f3ximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
