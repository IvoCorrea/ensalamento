import { getDadosGradeTurma } from "@/lib/services/grade-service";
import { GradeSemanalView } from "@/components/grade/GradeSemanalView";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dados = await getDadosGradeTurma();

  if (!dados || !dados.turmaAtual) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-lg">
          <Layers className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Nenhum dado encontrado</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Execute o comando de seed para carregar a grade inicial no banco de dados.
          </p>
          <pre className="mt-4 p-3 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs text-left font-mono text-slate-700 dark:text-zinc-300">
            npm run db:seed
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 dark:bg-zinc-950 text-slate-900 dark:text-zinc-50">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-lg shadow-md shadow-blue-500/20">
              E
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Ensalamento Acadêmico
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-400">
                • MVP de Alocação de Salas e Matrizes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-300">
              Semestre: <strong>{dados.proposta?.periodoLetivo.codigo || "2026.1"}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-xs font-bold text-blue-700 dark:text-blue-300">
              Turma: {dados.turmaAtual.codigo}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GradeSemanalView
          turmaAtual={dados.turmaAtual as any}
          todasTurmas={dados.todasTurmas as any}
          proposta={dados.proposta as any}
          todasPropostas={dados.todasPropostas as any}
          relatorioValidacao={dados.relatorioValidacao}
          todasSalas={dados.todasSalas}
        />
      </main>
    </div>
  );
}
