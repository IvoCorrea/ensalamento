"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  subtitle: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Painel Inicial",
    subtitle: "Visão executiva do período",
  },
  {
    href: "/cursos",
    label: "Cursos e Matrizes",
    subtitle: "Catálogo e estrutura curricular",
  },
  {
    href: "/turmas",
    label: "Turmas e Ofertas",
    subtitle: "Turmas, turnos e modalidades",
  },
  {
    href: "/salas",
    label: "Salas e Horários",
    subtitle: "Capacidades, turnos e restrições",
  },
  {
    href: "/grade",
    label: "Grade e Alocação",
    subtitle: "Ensalamento por turma e sala",
  },
  {
    href: "/validacao",
    label: "Validação da Proposta",
    subtitle: "Auditoria de conflitos e aprovação",
  },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Lateral Desktop + Topbar Mobile */}
      <aside className="w-full lg:w-72 bg-slate-900 text-slate-100 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between lg:block">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs shadow-sm">
                SOMA
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Gestão Acadêmica
              </span>
            </div>
            <h1 className="text-base font-extrabold tracking-tight text-white mt-1.5 leading-snug">
              Matrizes Acadêmicas & Alocação de Salas
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Período Letivo Ativo: <strong className="text-slate-200">2026.1</strong>
            </p>
          </div>
        </div>

        {/* Navegação Principal */}
        <nav className="p-3 space-y-1 flex-1 overflow-x-auto lg:overflow-visible flex lg:flex-col gap-1.5 lg:gap-1">
          <div className="hidden lg:block px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Módulos do Sistema
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex flex-col justify-center rounded-xl px-3.5 py-2.5 transition-all shrink-0 lg:shrink ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span className="text-xs font-bold tracking-tight">
                  {item.label}
                </span>
                <span
                  className={`hidden lg:block text-[11px] mt-0.5 ${
                    isActive ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {item.subtitle}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé institucional da Sidebar */}
        <div className="hidden lg:block p-4 m-3 rounded-xl bg-slate-800/70 border border-slate-700/70 text-[11px] text-slate-300 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">Alocação Inteligente</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Ativo
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Validação contínua de capacidade física de salas, sobreposições de horários e disponibilidades.
          </p>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
