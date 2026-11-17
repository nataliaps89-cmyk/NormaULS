import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type AppView = 'consultar' | 'documentos' | 'guia' | 'admin';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onResetQuery: () => void;
}

export function TopBar({ activeView, onNavigate, onResetQuery }: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ id: AppView; label: string }> = [
    { id: 'consultar', label: 'Consultar' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'guia', label: 'Guía de uso' },
    { id: 'admin', label: 'Administración' },
  ];

  const handleNavClick = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#DDE3EC]">
      {/* Subtle institutional burgundy hairline bar */}
      <div className="h-[3px] w-full bg-[#8B1838]" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('consultar')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003A80] rounded-md py-1"
        >
          <img
            src="/assets/aistudio/OIP_3eb5edab.webp"
            alt="Logo Universidad de La Serena"
            className="w-10 h-10 object-contain shrink-0 rounded-full"
          />
          <span className="font-serif text-lg font-semibold tracking-tight text-[#003A80] whitespace-nowrap">
            NormaULS
          </span>
        </button>

        {/* Zone 2: 4 single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Navegación principal">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003A80] ${
                  active
                    ? 'text-[#003A80] border-[#8B1838] font-semibold'
                    : 'text-slate-600 border-transparent hover:text-[#003A80] hover:border-[#DDE3EC]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Menu Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onResetQuery();
              onNavigate('consultar');
              setMobileOpen(false);
            }}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#003A80] hover:bg-[#002B60] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#003A80]"
          >
            Nueva consulta
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#003A80] hover:bg-[#F3F5F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003A80]"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#DDE3EC] bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#F3F5F8] text-[#003A80] font-semibold'
                    : 'text-slate-700 hover:bg-[#F3F5F8]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-[#DDE3EC]">
            <button
              type="button"
              onClick={() => {
                onResetQuery();
                handleNavClick('consultar');
              }}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#003A80] hover:bg-[#002B60] rounded-lg"
            >
              Nueva consulta
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
