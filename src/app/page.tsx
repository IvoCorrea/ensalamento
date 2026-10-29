import Link from "next/link";
import { getDadosDashboard } from "@/lib/services/grade-service";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const data = await getDadosDashboard();

  const statusValidacaoBadge = () => {
    if (!data.validacaoAtual) return null;
    const st = data.validacaoAtual.statusValidacao;
    if (st === "VALIDA_COMPLETA") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Válida e Completa
        </span>
      );
    }
    if (st === "VALIDA_PARCIAL") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Válida Parcialmente ({data.resumo.componentesPendentes} pendentes)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        Com Conflitos ({data.resumo.totalConflitos})
      </span>
    );
  };

  const percentualAlocado =
    data.resumo.totalComponentes > 0
      ? Math.round(
          (data.resumo.componentesAlocados / data.resumo.totalComponentes) * 100
        )
      : 0;

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-[1500px] w-full mx-auto">
      {/* Cabeçalho Executivo */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wide">
              Período Letivo {data.periodoLetivo?.codigo ?? "2026.1"}
            </span>
            {statusValidacaoBadge()}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
            Painel Inicial • Organização Acadêmica e Ensalamento
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão consolidada de cursos, matrizes curriculares, turmas de manhã e noite, disponibilidade física de salas e propostas de grade horária.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/turmas"
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs"
          >
            + Nova Turma / Oferta
          </Link>
          <Link
            href="/grade"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            Abrir Grade Semanal →
          </Link>
        </div>
      </header>

      {/* Cards de Indicadores do Semestre */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Link
          href="/cursos"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-all group"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
            Cursos & Matrizes
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {data.resumo.totalCursos}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data.resumo.totalMatrizes} matrizes • {data.resumo.totalDisciplinas} disciplinas
          </p>
        </Link>

        <Link
          href="/turmas"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-all group"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
            Turmas Ativas
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {data.resumo.totalTurmas}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data.resumo.turmasManha} Manhã • {data.resumo.turmasNoite} Noite
          </p>
        </Link>

        <Link
          href="/salas"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-all group"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
            Salas Físicas
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {data.resumo.salasAtivas}{" "}
            <span className="text-sm font-normal text-slate-400">
              / {data.resumo.totalSalas}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data.resumo.salasManutencao > 0
              ? `${data.resumo.salasManutencao} em manutenção`
              : "Todas operacionais"}
          </p>
        </Link>

        <Link
          href="/grade"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-all group"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
            Componentes Alocados
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {data.resumo.componentesAlocados}{" "}
            <span className="text-sm font-normal text-slate-400">
              / {data.resumo.totalComponentes}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${percentualAlocado}%` }}
            />
          </div>
        </Link>

        <Link
          href="/validacao"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-all group"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
            Atividades Pendentes
          </span>
          <div
            className={`text-2xl font-black mt-1 ${
              data.resumo.componentesPendentes > 0
                ? "text-amber-600"
                : "text-slate-900"
            }`}
          >
            {data.resumo.componentesPendentes}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data.resumo.componentesPendentes === 0
              ? "100% das aulas alocadas"
              : "Aguardando horário/sala"}
          </p>
        </Link>

        <Link
          href="/validacao"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-all group"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
            Conflitos de Horário
          </span>
          <div
            className={`text-2xl font-black mt-1 ${
              data.resumo.totalConflitos > 0
                ? "text-red-600"
                : "text-emerald-700"
            }`}
          >
            {data.resumo.totalConflitos}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data.resumo.totalConflitos === 0
              ? "Zero choques de sala/turma"
              : "Requer revisão na grade"}
          </p>
        </Link>
      </section>

      {/* Tabela Central: Todas as Turmas do Semestre e Acesso Rápido à Grade de Cada Turma */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Turmas do Período Letivo ({data.turmas.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione qualquer turma abaixo para inspecionar sua grade semanal individual, gerenciar disciplinas ofertadas ou alocar salas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/turmas"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Gerenciar Todas as Turmas & Ofertas
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Turma</th>
                <th className="py-3 px-4">Curso / Período</th>
                <th className="py-3 px-4">Turno</th>
                <th className="py-3 px-4">Alunos</th>
                <th className="py-3 px-4">Disciplinas Ofertadas</th>
                <th className="py-3 px-4">Progresso de Alocação</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {data.turmas.map((t) => {
                const pct =
                  t.totalComponentes > 0
                    ? Math.round(
                        (t.componentesAlocados / t.totalComponentes) * 100
                      )
                    : 0;
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-black">
                          {t.codigo}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">
                        {t.cursoNome} ({t.cursoCodigo})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t.periodoNumero
                          ? `${t.periodoNumero}º Período (${t.periodoNome})`
                          : "Sem período vinculado"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                          t.turno === "MANHA"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                        }`}
                      >
                        {t.turno === "MANHA"
                          ? "Manhã (07:30-10:50)"
                          : "Noite (18:30-21:50)"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {t.qtdAlunos} alunos
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800">
                        {t.totalOfertas}
                      </span>{" "}
                      <span className="text-slate-500">
                        disciplinas ({t.totalComponentes} comp.)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct === 100
                                ? "bg-emerald-500"
                                : pct > 0
                                ? "bg-blue-500"
                                : "bg-slate-300"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">
                          {t.componentesAlocados}/{t.totalComponentes} ({pct}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/turmas?turma=${t.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-colors"
                        >
                          Ofertas
                        </Link>
                        <Link
                          href={`/grade?turma=${t.codigo}`}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors shadow-2xs"
                        >
                          Ver Grade da Turma →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Grid Inferior: Cursos Cadastrados & Propostas de Grade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cursos e Matrizes */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Cursos e Matrizes Curriculares
              </h3>
              <p className="text-xs text-slate-500">
                Estrutura acadêmica com disciplinas compartilhadas entre cursos
              </p>
            </div>
            <Link
              href="/cursos"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Abrir Cursos e Matrizes →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data.cursos.map((c) => (
              <div
                key={c.id}
                className="py-3 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-black text-slate-900 mr-2">
                    [{c.codigo}]
                  </span>
                  <span className="font-bold text-slate-800">{c.nome}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span>{c.matrizes.length} matriz(es)</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-700">
                    {c.turmas.length} turma(s)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Propostas de Grade em Andamento */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Propostas de Grade Horária
              </h3>
              <p className="text-xs text-slate-500">
                Histórico de versões geradas automaticamente ou ajustadas manualmente
              </p>
            </div>
            <Link
              href="/validacao"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Auditar e Validar →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data.propostas.map((p) => (
              <div
                key={p.id}
                className="py-3 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800">{p.nome}</div>
                  <div className="text-[11px] text-slate-400">
                    {p._count.alocacoes} alocações registradas
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === "CONFIRMADA"
                        ? "bg-emerald-100 text-emerald-800"
                        : p.status === "EM_ANALISE"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {p.status}
                  </span>
                  <Link
                    href={`/grade?proposta=${p.id}`}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                  >
                    Abrir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
