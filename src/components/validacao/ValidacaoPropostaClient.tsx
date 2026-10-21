"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { atualizarStatusPropostaAction } from "@/app/actions/grade-actions";

interface PropostaItem {
  id: string;
  nome: string;
  status: "RASCUNHO" | "EM_ANALISE" | "CONFIRMADA";
  geradaAutomaticamente: boolean;
}

interface ConflitoItem {
  tipo: string;
  severidade: string;
  mensagem: string;
  alocacaoIds: string[];
}

interface PendenteItem {
  id: string;
  tipo: "PRESENCIAL" | "REMOTO";
  blocosSemanais: number;
  requerSalaFisica: boolean;
  oferta: {
    modalidade: string;
    turma: {
      codigo: string;
      turno: "MANHA" | "NOITE";
      qtdAlunos: number;
      curso: { codigo: string; nome: string };
    };
    disciplina: {
      codigo: string;
      nome: string;
    };
  };
}

export default function ValidacaoPropostaClient({
  propostaAtual,
  propostas,
  validacao,
  componentesNaoAlocados,
  totalSalasCapazesPorTurma,
}: {
  propostaAtual: PropostaItem | null;
  propostas: PropostaItem[];
  validacao: {
    propostaId: string;
    propostaNome: string;
    statusProposta: string;
    statusValidacao: "VALIDA_COMPLETA" | "VALIDA_PARCIAL" | "COM_CONFLITOS";
    valida: boolean;
    totalAlocacoes: number;
    totalComponentesSemestre: number;
    componentesPendentes: number;
    totalConflitos: number;
    conflitos: ConflitoItem[];
  } | null;
  componentesNaoAlocados: PendenteItem[];
  totalSalasCapazesPorTurma: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);

  const handleAlterarStatus = (
    novoStatus: "RASCUNHO" | "EM_ANALISE" | "CONFIRMADA"
  ) => {
    if (!propostaAtual) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await atualizarStatusPropostaAction({
        propostaId: propostaAtual.id,
        novoStatus,
      });
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Não foi possível alterar o status da proposta.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Status da proposta "${propostaAtual.nome}" atualizado para ${novoStatus}!`,
        });
        router.refresh();
      }
    });
  };

  if (!propostaAtual || !validacao) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Nenhuma proposta de grade encontrada para validação.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            feedback.tipo === "ok"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-red-50 border-red-300 text-red-800"
          }`}
        >
          <span>{feedback.msg}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800 font-black px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de Seleção de Proposta e Workflow de Aprovação (RF14 / RN14) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Proposta Auditada
            </label>
            <select
              value={propostaAtual.id}
              onChange={(e) =>
                router.push(`/validacao?proposta=${e.target.value}`)
              }
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-900"
            >
              {propostas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} [{p.status}]
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase ${
                propostaAtual.status === "CONFIRMADA"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : propostaAtual.status === "EM_ANALISE"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-slate-100 text-slate-700 border border-slate-300"
              }`}
            >
              Workflow: {propostaAtual.status}
            </span>
          </div>
        </div>

        {/* Botões de Transição de Status (RF14) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending || propostaAtual.status === "RASCUNHO"}
            onClick={() => handleAlterarStatus("RASCUNHO")}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-xs"
          >
            Voltar p/ Rascunho
          </button>
          <button
            type="button"
            disabled={isPending || propostaAtual.status === "EM_ANALISE"}
            onClick={() => handleAlterarStatus("EM_ANALISE")}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs"
          >
            Enviar p/ Em Análise
          </button>
          <button
            type="button"
            disabled={isPending || propostaAtual.status === "CONFIRMADA"}
            onClick={() => handleAlterarStatus("CONFIRMADA")}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs"
          >
            ✓ Confirmar e Oficializar Proposta (RN14)
          </button>
        </div>
      </section>

      {/* Banner de Diagnóstico Geral (Seção 6.3 do PDF) */}
      <section
        className={`rounded-2xl border p-6 shadow-xs ${
          validacao.statusValidacao === "VALIDA_COMPLETA"
            ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
            : validacao.statusValidacao === "VALIDA_PARCIAL"
            ? "bg-amber-50/90 border-amber-300 text-amber-950"
            : "bg-red-50/90 border-red-300 text-red-950"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest opacity-75">
              Resultado da Auditoria Automática (Seção 6.3 do Documento)
            </span>
            <h2 className="text-xl font-black mt-1">
              {validacao.statusValidacao === "VALIDA_COMPLETA" &&
                "✓ Proposta Válida e Completa"}
              {validacao.statusValidacao === "VALIDA_PARCIAL" &&
                "⚠ Proposta Válida Parcialmente (Sem Conflitos, mas Incompleta)"}
              {validacao.statusValidacao === "COM_CONFLITOS" &&
                "✕ Proposta com Conflitos de Restrições Obrigatórias"}
            </h2>
            <p className="text-xs mt-1 opacity-90">
              {validacao.statusValidacao === "VALIDA_COMPLETA" &&
                "Todas as atividades obrigatórias do semestre estão alocadas e nenhuma restrição (RN09 a RN15) foi violada. A proposta está pronta para confirmação final."}
              {validacao.statusValidacao === "VALIDA_PARCIAL" &&
                `Não há nenhum conflito de sala ou horário nas ${validacao.totalAlocacoes} aulas alocadas, porém ainda existem ${validacao.componentesPendentes} atividade(s) aguardando alocação.`}
              {validacao.statusValidacao === "COM_CONFLITOS" &&
                `Foram detectadas ${validacao.totalConflitos} violação(ões) de regras obrigatórias (choque de sala, choque de turma, capacidade insuficiente ou sala indisponível). De acordo com a RN14, corrija os conflitos antes de confirmar a proposta.`}
            </p>
          </div>

          <Link
            href={`/grade?proposta=${propostaAtual.id}`}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shrink-0"
          >
            Ir para Grade e Ajustar →
          </Link>
        </div>

        {/* Métricas de Auditoria */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-black/10">
          <div className="bg-white/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Total de Componentes
            </span>
            <div className="text-xl font-black text-slate-900">
              {validacao.totalComponentesSemestre}
            </div>
          </div>
          <div className="bg-white/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Alocados na Grade
            </span>
            <div className="text-xl font-black text-emerald-700">
              {validacao.totalAlocacoes}
            </div>
          </div>
          <div className="bg-white/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Pendentes (RF13)
            </span>
            <div className="text-xl font-black text-amber-700">
              {validacao.componentesPendentes}
            </div>
          </div>
          <div className="bg-white/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Conflitos (RF10)
            </span>
            <div className="text-xl font-black text-red-700">
              {validacao.totalConflitos}
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Auditoria: Conflitos Detectados (RF10) + Atividades Não Alocadas e Motivos (RF13) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Lista de Conflitos (RF10) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                1. Relatório de Conflitos de Restrições (RF10)
              </h3>
              <p className="text-xs text-slate-500">
                Verifica RN09 (Remoto), RN10 (Sala única), RN11 (Capacidade), RN12 (Manutenção/Janelas) e RN13
              </p>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                validacao.conflitos.length === 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {validacao.conflitos.length}
            </span>
          </div>

          {validacao.conflitos.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <div className="text-sm font-extrabold text-emerald-700">
                ✓ Zero conflitos detectados!
              </div>
              <p className="text-xs text-slate-500">
                Nenhuma sobreposição de sala, choque de horário de turma ou violação de capacidade física.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {validacao.conflitos.map((c, idx) => (
                <div key={idx} className="p-4 bg-red-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-black text-[10px] uppercase">
                      {c.tipo}
                    </span>
                    <span className="text-[10px] font-bold text-red-600 uppercase">
                      Violação Obrigatória (RN14)
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 leading-relaxed">
                    {c.mensagem}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lista de Atividades Não Alocadas e Diagnóstico de Impedimento (RF13) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                2. Atividades Não Alocadas e Diagnóstico (RF13)
              </h3>
              <p className="text-xs text-slate-500">
                Lista de componentes sem horário atribuído e análise de causa
              </p>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                componentesNaoAlocados.length === 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {componentesNaoAlocados.length}
            </span>
          </div>

          {componentesNaoAlocados.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <div className="text-sm font-extrabold text-emerald-700">
                ✓ 100% das atividades ofertadas foram alocadas!
              </div>
              <p className="text-xs text-slate-500">
                Todas as disciplinas presenciais, híbridas e remotas possuem horário definido na proposta.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {componentesNaoAlocados.map((comp) => {
                const salasCapazes =
                  totalSalasCapazesPorTurma[comp.oferta.turma.codigo] ?? 0;
                const motivoDiagnostico = !comp.requerSalaFisica
                  ? "Atividade remota/DOL aguardando execução do motor FET ou alocação no Sábado."
                  : salasCapazes === 0
                  ? `IMPEDIMENTO CRÍTICO (RN11): A turma possui ${comp.oferta.turma.qtdAlunos} alunos, mas não há nenhuma sala ativa com capacidade >= ${comp.oferta.turma.qtdAlunos} lugares.`
                  : `Oferta adicionada após a última geração ou desalocada manualmente (${salasCapazes} sala(s) ativa(s) comportam os ${comp.oferta.turma.qtdAlunos} alunos).`;

                return (
                  <div key={comp.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px]">
                          {comp.oferta.turma.codigo}
                        </span>
                        <span className="font-extrabold text-xs text-slate-900">
                          {comp.oferta.disciplina.nome}
                        </span>
                      </div>
                      <Link
                        href={`/grade?proposta=${propostaAtual.id}&turma=${comp.oferta.turma.codigo}`}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        Alocar na Grade →
                      </Link>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Modalidade: <strong>{comp.oferta.modalidade}</strong> •
                      Componente: <strong>{comp.tipo}</strong> (
                      {comp.blocosSemanais} blocos) • Alunos:{" "}
                      <strong>{comp.oferta.turma.qtdAlunos}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                      <strong>Diagnóstico RF13:</strong> {motivoDiagnostico}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
