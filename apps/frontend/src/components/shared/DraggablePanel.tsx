'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface DraggablePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export function DraggablePanel({
  isOpen,
  onClose,
  title,
  icon,
  children,
  defaultWidth = 420,
  defaultHeight = 500,
  minWidth = 300,
  minHeight = 300,
}: DraggablePanelProps) {
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Centralizar na primeira abertura
  useEffect(() => {
    if (isOpen && pos.x === -1) {
      setPos({
        x: Math.max(20, (window.innerWidth - size.w) / 2),
        y: Math.max(20, (window.innerHeight - size.h) / 2),
      });
    }
  }, [isOpen]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  // Resize handlers
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    dragOffset.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 100)),
          y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 50)),
        });
      }
      if (isResizing) {
        const dx = e.clientX - dragOffset.current.x;
        const dy = e.clientY - dragOffset.current.y;
        dragOffset.current = { x: e.clientX, y: e.clientY };
        setSize(prev => ({
          w: Math.max(minWidth, prev.w + dx),
          h: Math.max(minHeight, prev.h + dy),
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, minWidth, minHeight]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 99998,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
      }}
    >
      {/* Header - arrastável */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
          cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>}
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{title}</span>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      {/* Content - scrollável */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {children}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, cursor: 'nwse-resize',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: 'absolute', bottom: 4, right: 4, color: '#94A3B8' }}>
          <path d="M11 1v10H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M11 5v6H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}
