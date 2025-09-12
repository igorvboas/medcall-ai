'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="layout">
      <Sidebar 
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
      />
      
      <div className={`main-content ${sidebarExpanded ? 'expanded' : ''}`}>
        <Header />
        
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}