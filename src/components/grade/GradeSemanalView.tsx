"use client";

import React, { useState, useTransition } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Layers,
  Info,
  ShieldCheck,
  Zap,
  Check,
  Loader2,
  Sparkles,
  Edit3,
  RotateCcw,
} from "lucide-react";
import { gerarGradeAutomaticaAction, confirmarGradeAction, atualizarAlocacaoAction } from "@/app/actions/grade-actions";
import { JANELAS_NOITE } from "@/lib/services/solver-service";

export interface AlocacaoGrade {
  id: string;
  diaSemana: string;
  horaInicio: string;
  horaFim: string;
  salaId: string | null;
  sala?: {
    id: string;
    codigo: string;
    predio: string | null;
    andar: number | null;
    capacidade: number;
  } | null;
  componenteAula: {
    id: string;
    tipo: "PRESENCIAL" | "REMOTO";
    qtdBlocos: number;
    oferta: {
      modalidade: string;
      turma: {
        id: string;
        codigo: string;
        qtdAlunos: number;
      };
      disciplina: {
        id: string;
        codigo: string;
        nome: string;
        chTotal: number;
      };
    };
  };
}

export interface PropsGradeView {
  turmaAtual: {
    id: string;
    codigo: string;
    qtdAlunos: number;
    curso: {
      nome: string;
      codigo: string;
    };
    periodoCurricular?: {
      numero: number;
    } | null;
  };
  todasTurmas: Array<{
    id: string;
    codigo: string;
    qtdAlunos: number;
    curso: { nome: string };
  }>;
  proposta: {
    id: string;
    nome: string;
    status: string;
    observacoes: string | null;
    periodoLetivoId: string;
    periodoLetivo: {
      id: string;
      codigo: string;
      nome: string;
    };
    alocacoes: AlocacaoGrade[];
  } | null;
  todasPropostas?: Array<{
    id: string;
    nome: string;
    status: string;
    createdAt: Date;
  }>;
  relatorioValidacao: {
    statusGrade: string;
    totalAlocacoes: number;
    totalComponentesOfertados: number;
    componentesNaoAlocados: any[];
    conflitos: Array<{
      tipo: string;
      gravidade: string;
      mensagem: string;
    }>;
  } | null;
  todasSalas: Array<{
    id: string;
    codigo: string;
    predio: string | null;
    capacidade: number;
    emManutencao: boolean;
  }>;
}

const DIAS = [
  { key: "SEGUNDA", label: "SEGUNDA" },
  { key: "TERCA", label: "TERÇA" },
  { key: "QUARTA", label: "QUARTA" },
  { key: "QUINTA", label: "QUINTA" },
  { key: "SEXTA", label: "SEXTA" },
  { key: "SABADO", label: "SÁBADO" },
];

const SLOTS_NOITE = [
  { id: 1, horaInicio: "18:30", horaFim: "19:20", label: "18:30 às 19:20" },
  { id: 2, horaInicio: "19:20", horaFim: "20:10", label: "19:20 às 20:10" },
  { id: 3, horaInicio: "20:10", horaFim: "21:00", label: "20:10 às 21:00" },
  { id: 4, horaInicio: "21:00", horaFim: "21:50", label: "21:00 às 21:50" },
];

function horaParaMin(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

export function GradeSemanalView({
  turmaAtual,
  todasTurmas,
  proposta,
  todasPropostas = [],
  relatorioValidacao,
  todasSalas,
}: PropsGradeView) {
  const [alocacaoSelecionada, setAlocacaoSelecionada] = useState<AlocacaoGrade | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"grade" | "salas" | "conflitos">("grade");
  const [modalGeracaoAberto, setModalGeracaoAberto] = useState(false);
  const [nomeNovaProposta, setNomeNovaProposta] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estados de Ajuste Manual (Passo 5)
  const [modoEdicao, setModoEdicao] = useState(false);
  const [editSalaId, setEditSalaId] = useState<string | null>(null);
  const [editDiaSemana, setEditDiaSemana] = useState<string>("SEGUNDA");
  const [editJanelaIdx, setEditJanelaIdx] = useState<number>(0);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const alocacoes = proposta?.alocacoes || [];

  const abrirDetalhesAlocacao = (aloc: AlocacaoGrade) => {
    setAlocacaoSelecionada(aloc);
    setModoEdicao(false);
    setErroEdicao(null);
    setEditSalaId(aloc.salaId);
    setEditDiaSemana(aloc.diaSemana);

    // Identificar a janela de horário atual
    const janelas = JANELAS_NOITE[aloc.componenteAula.qtdBlocos] || JANELAS_NOITE[2];
    const idx = janelas.findIndex(
      (j) => j.horaInicio === aloc.horaInicio && j.horaFim === aloc.horaFim
    );
    setEditJanelaIdx(idx >= 0 ? idx : 0);
  };

  const handleSalvarEdicao = () => {
    if (!alocacaoSelecionada) return;

    const janelas = JANELAS_NOITE[alocacaoSelecionada.componenteAula.qtdBlocos] || JANELAS_NOITE[2];
    const janela = janelas[editJanelaIdx] || janelas[0];

    setErroEdicao(null);
    startTransition(async () => {
      const res = await atualizarAlocacaoAction({
        alocacaoId: alocacaoSelecionada.id,
        diaSemana: editDiaSemana as any,
        horaInicio: janela.horaInicio,
        horaFim: janela.horaFim,
        salaId: editSalaId,
      });

      if (res.success) {
        setMensagemSucesso("Alocação ajustada com sucesso! Sem choques.");
        setAlocacaoSelecionada(null);
        setModoEdicao(false);
      } else {
        setErroEdicao(res.error || "Ajuste rejeitado por violar regras de alocação.");
      }
    });
  };

  const handleGerarAutomaticamente = () => {
    if (!proposta?.periodoLetivoId) return;

    setMensagemErro(null);
    setMensagemSucesso(null);

    startTransition(async () => {
      const res = await gerarGradeAutomaticaAction(
        proposta.periodoLetivoId,
        nomeNovaProposta.trim() || undefined
      );

      if (res.success && res.data) {
        setMensagemSucesso(
          `Nova grade "${res.data.propostaNome}" gerada com sucesso! ${res.data.totalAlocadas} atividades alocadas sem conflitos.`
        );
        setModalGeracaoAberto(false);
        setNomeNovaProposta("");
      } else {
        setMensagemErro(res.error || "Erro ao processar algoritmo de ensalamento.");
      }
    });
  };

  const handleConfirmarGrade = () => {
    if (!proposta?.id) return;

    startTransition(async () => {
      const res = await confirmarGradeAction(proposta.id);
      if (res.success) {
        setMensagemSucesso("Proposta oficializada com sucesso pela coordenação!");
      } else {
        setMensagemErro(res.error || "Erro ao confirmar proposta.");
      }
    });
  };

  // Mapear alocações por dia
  const renderColunaDia = (diaKey: string) => {
    // Caso especial: Sábado (Aulas Online / DOL informativas)
    if (diaKey === "SABADO") {
      const alocacoesSabado = alocacoes.filter((a) => a.diaSemana === "SABADO");

      return (
        <div className="flex flex-col h-full space-y-3">
          {alocacoesSabado.length > 0 ? (
            alocacoesSabado.map((aloc) => (
              <div
                key={aloc.id}
                onClick={() => abrirDetalhesAlocacao(aloc)}
                className="group relative cursor-pointer rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 p-4 transition-all duration-200 hover:shadow-md hover:border-indigo-400"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <Laptop className="w-3.5 h-3.5" />
                    ONLINE / DOL
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Sem sala física
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100 leading-snug group-hover:text-indigo-600 transition-colors">
                  {aloc.componenteAula.oferta.disciplina.nome}
                </h4>

                <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Carga Semanal: {aloc.componenteAula.qtdBlocos * 50} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 text-[11px]">
                    <Info className="w-3 h-3" />
                    <span>Visível para o aluno • Sem choque de sala</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[380px] rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 p-4 text-center text-xs text-slate-400">
              <Laptop className="w-6 h-6 mb-1 text-slate-300 dark:text-zinc-600" />
              <span>Sem atividades DOL cadastradas no sábado</span>
            </div>
          )}
        </div>
      );
    }

    // Dias úteis: Segunda a Sexta
    const alocsDia = alocacoes.filter((a) => a.diaSemana === diaKey);

    const slotsRenderizados: React.ReactNode[] = [];
    let i = 0;

    while (i < SLOTS_NOITE.length) {
      const slot = SLOTS_NOITE[i];
      const slotMinInicio = horaParaMin(slot.horaInicio);
      const slotMinFim = horaParaMin(slot.horaFim);

      const aloc = alocsDia.find((a) => {
        const alocInicio = horaParaMin(a.horaInicio);
        const alocFim = horaParaMin(a.horaFim);
        return Math.max(slotMinInicio, alocInicio) < Math.min(slotMinFim, alocFim);
      });

      if (!aloc) {
        slotsRenderizados.push(
          <div
            key={`empty-${slot.id}`}
            className="flex flex-col justify-between h-[96px] rounded-md border border-slate-100 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-900/20 p-2.5 text-slate-400 dark:text-zinc-500 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40"
          >
            <span className="text-[11px] font-medium text-slate-400">{slot.label}</span>
            <span className="text-xs italic text-slate-400/80">Horário livre</span>
          </div>
        );
        i++;
      } else {
        const alocInicio = horaParaMin(aloc.horaInicio);
        const alocFim = horaParaMin(aloc.horaFim);

        if (alocInicio < slotMinInicio) {
          i++;
          continue;
        }

        let slotsSpan = 1;
        for (let next = i + 1; next < SLOTS_NOITE.length; next++) {
          const nextSlot = SLOTS_NOITE[next];
          const nextSlotInicio = horaParaMin(nextSlot.horaInicio);
          if (nextSlotInicio < alocFim) {
            slotsSpan++;
          } else {
            break;
          }
        }

        const altura = slotsSpan * 96 + (slotsSpan - 1) * 8;

        slotsRenderizados.push(
          <div
            key={aloc.id}
            onClick={() => abrirDetalhesAlocacao(aloc)}
            style={{ minHeight: `${altura}px` }}
            className="group relative cursor-pointer flex flex-col justify-between rounded-lg bg-blue-600 hover:bg-blue-700 text-white p-3.5 shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between text-blue-100 text-[11px] font-medium mb-1">
                <span>{aloc.horaInicio} às {aloc.horaFim}</span>
                <span className="bg-blue-500/80 text-white px-2 py-0.5 rounded text-[10px] font-semibold">
                  {slotsSpan === 3 ? "3 Aulas" : slotsSpan === 2 ? "2 Aulas" : "1 Aula"}
                </span>
              </div>

              <h4 className="text-sm font-semibold leading-tight tracking-tight mt-1 group-hover:underline">
                {aloc.componenteAula.oferta.disciplina.nome}
              </h4>
            </div>

            <div className="mt-3 pt-2.5 border-t border-blue-500/50 flex flex-wrap items-center justify-between gap-1 text-[11px] text-blue-100">
              <div className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-blue-200" />
                <span>{aloc.sala ? aloc.sala.codigo : "Sem sala definida"}</span>
              </div>

              {aloc.sala && (
                <span className="bg-blue-800/80 text-blue-100 px-1.5 py-0.5 rounded text-[10px]">
                  Cap: {aloc.sala.capacidade}
                </span>
              )}
            </div>
          </div>
        );

        i += slotsSpan;
      }
    }

    return <div className="flex flex-col space-y-2">{slotsRenderizados}</div>;
  };

  return (
    <div className="space-y-6">
      {/* Banners de Mensagens de Sucesso ou Erro */}
      {mensagemSucesso && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-sm text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button
            onClick={() => setMensagemSucesso(null)}
            className="text-xs text-emerald-700 dark:text-emerald-300 font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {mensagemErro && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-sm text-red-900 dark:text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
          <button
            onClick={() => setMensagemErro(null)}
            className="text-xs text-red-700 dark:text-red-300 font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cabeçalho de Controle e Seleção */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-inner">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                Grade Semanal de Ensalamento
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border flex items-center gap-1 ${
                  proposta?.status === "CONFIRMADA"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {proposta?.status || "RASCUNHO"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {turmaAtual.curso.nome} • {turmaAtual.periodoCurricular?.numero}º Período • Turma{" "}
              <strong className="text-slate-700 dark:text-zinc-200">{turmaAtual.codigo}</strong> (
              {turmaAtual.qtdAlunos} alunos)
            </p>
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Geração Automática */}
          <button
            onClick={() => setModalGeracaoAberto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Gerar Grade Automática</span>
          </button>

          {/* Botão de Oficializar (quando status for RASCUNHO) */}
          {proposta?.status === "RASCUNHO" && (
            <button
              onClick={handleConfirmarGrade}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Oficializar Grade</span>
            </button>
          )}

          {/* Abas */}
          <div className="flex items-center rounded-lg bg-slate-100 dark:bg-zinc-800 p-1 text-xs font-medium">
            <button
              onClick={() => setAbaAtiva("grade")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                abaAtiva === "grade"
                  ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              Grade
            </button>
            <button
              onClick={() => setAbaAtiva("salas")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                abaAtiva === "salas"
                  ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              Salas ({todasSalas.length})
            </button>
            <button
              onClick={() => setAbaAtiva("conflitos")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                abaAtiva === "conflitos"
                  ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              <span>Validações</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  (relatorioValidacao?.conflitos.length || 0) === 0
                    ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                }`}
              >
                {relatorioValidacao?.conflitos.length || 0}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {abaAtiva === "grade" && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
          {/* Barra de Status e Indicadores */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-slate-500 font-medium">
                Proposta Ativa: <strong className="text-slate-800 dark:text-zinc-100">{proposta?.nome}</strong>
              </span>
              <span className="text-slate-500 font-medium">Turno: <strong>Noturno (18:30 às 21:50)</strong></span>
              <span className="text-slate-500">
                Alocações: <strong className="text-slate-700 dark:text-zinc-200">{alocacoes.length} ativas</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sem choques de sala ou capacidade
              </span>
            </div>
          </div>

          {/* Grade de 6 Colunas: Segunda a Sábado */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {DIAS.map((dia) => (
              <div key={dia.key} className="flex flex-col space-y-2">
                {/* Cabeçalho do Dia */}
                <div
                  className={`text-center py-2 px-1 rounded-md text-xs font-bold tracking-wider ${
                    dia.key === "SABADO"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  }`}
                >
                  {dia.label}
                </div>

                {/* Linhas de Slots ou Card Informativo */}
                {renderColunaDia(dia.key)}
              </div>
            ))}
          </div>

          {/* Legenda Estilo Grade Oficial */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600"></span>
              <span className="font-medium text-slate-800 dark:text-zinc-200">SUA TURMA (Aulas Presenciais no Campus)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-indigo-500"></span>
              <span className="font-medium text-slate-800 dark:text-zinc-200">DOL / COMPONENTE REMOTO (Sábado sem Sala Física)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded border border-dashed border-slate-400"></span>
              <span>HORÁRIO LIVRE</span>
            </div>
          </div>
        </div>
      )}

      {/* Aba de Salas Físicas */}
      {abaAtiva === "salas" && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Salas Físicas Cadastradas para Ensalamento
            </h3>
            <span className="text-xs text-slate-500">{todasSalas.length} salas registradas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {todasSalas.map((sala) => (
              <div
                key={sala.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">{sala.codigo}</h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sala.emManutencao
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {sala.emManutencao ? "EM MANUTENÇÃO" : "DISPONÍVEL"}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <p>Prédio: <strong>{sala.predio || "Principal"}</strong></p>
                  <p className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Capacidade Máxima: <strong>{sala.capacidade} alunos</strong>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba de Validações e Auditoria */}
      {abaAtiva === "conflitos" && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Auditoria de Conflitos e Regras de Negócio (RN09 - RN15)
            </h3>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                relatorioValidacao?.statusGrade === "VALIDA_COMPLETA"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              Status: {relatorioValidacao?.statusGrade}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Verificações automáticas do motor FET:
            </div>
            <ul className="list-disc list-inside space-y-1 ml-2 text-emerald-800 dark:text-emerald-300">
              <li><strong>RN09 / RN13:</strong> Aulas presenciais possuem sala física atribuída de Segunda a Sexta.</li>
              <li><strong>RN10:</strong> Nenhuma sala possui duas turmas no mesmo horário.</li>
              <li><strong>RN11:</strong> Capacidade das salas atende a quantidade de alunos matriculados.</li>
              <li><strong>RN12:</strong> Salas interditadas ou inativas são ignoradas pelo solucionador.</li>
              <li><strong>Regra do Sábado:</strong> Disciplinas online / DOL ficam concentradas no sábado sem uso de sala física.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal de Detalhes e Ajuste Manual da Alocação (Passo 5) */}
      {alocacaoSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => !isPending && setAlocacaoSelecionada(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {modoEdicao ? "Ajuste Manual de Alocação" : "Detalhes da Alocação"}
                </span>
              </div>
              <button
                onClick={() => setAlocacaoSelecionada(null)}
                disabled={isPending}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none p-1 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Mensagem de Erro de Validação Pré-Voo (RN14 / RN15) */}
            {erroEdicao && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Ajuste Bloqueado pelo Validador de Conflitos:</span>
                </div>
                <p className="ml-5 text-[11px] leading-relaxed text-red-800 dark:text-red-200">
                  {erroEdicao}
                </p>
              </div>
            )}

            {!modoEdicao ? (
              // MODO VISUALIZAÇÃO
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Disciplina:</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">
                    {alocacaoSelecionada.componenteAula.oferta.disciplina.nome}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Código: {alocacaoSelecionada.componenteAula.oferta.disciplina.codigo} • Carga Horária:{" "}
                    {alocacaoSelecionada.componenteAula.oferta.disciplina.chTotal}h •{" "}
                    {alocacaoSelecionada.componenteAula.qtdBlocos} blocos de 50min
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                    <span className="text-[11px] text-slate-400 font-medium">Dia & Horário</span>
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">
                      {alocacaoSelecionada.diaSemana}
                    </p>
                    <p className="text-xs text-slate-500">
                      {alocacaoSelecionada.horaInicio} às {alocacaoSelecionada.horaFim}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                    <span className="text-[11px] text-slate-400 font-medium">Espaço Físico</span>
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">
                      {alocacaoSelecionada.sala ? alocacaoSelecionada.sala.codigo : "Online (Sem sala física)"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {alocacaoSelecionada.sala
                        ? `Capacidade: ${alocacaoSelecionada.sala.capacidade} alunos`
                        : "Remoto / DOL"}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
                  <p>
                    <strong>Turma:</strong> {alocacaoSelecionada.componenteAula.oferta.turma.codigo} (
                    {alocacaoSelecionada.componenteAula.oferta.turma.qtdAlunos} alunos matriculados)
                  </p>
                  <p className="mt-1">
                    <strong>Modalidade de Ensino:</strong> {alocacaoSelecionada.componenteAula.oferta.modalidade}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-zinc-800">
                  <button
                    onClick={() => setAlocacaoSelecionada(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-colors"
                  >
                    Fechar
                  </button>

                  {alocacaoSelecionada.componenteAula.tipo === "PRESENCIAL" && (
                    <button
                      onClick={() => setModoEdicao(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ajustar Sala / Horário</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // MODO EDIÇÃO MANUAL (Passo 5)
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                    {alocacaoSelecionada.componenteAula.oferta.disciplina.nome}
                  </h4>
                  <p className="text-slate-500">
                    Turma: {alocacaoSelecionada.componenteAula.oferta.turma.codigo} (
                    {alocacaoSelecionada.componenteAula.oferta.turma.qtdAlunos} alunos)
                  </p>
                </div>

                {/* Seleção de Sala */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-zinc-300">
                    Sala Física Destino:
                  </label>
                  <select
                    value={editSalaId || ""}
                    onChange={(e) => setEditSalaId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {todasSalas.map((s) => {
                      const insuficiente = s.capacidade < alocacaoSelecionada.componenteAula.oferta.turma.qtdAlunos;
                      return (
                        <option key={s.id} value={s.id}>
                          {s.codigo} ({s.capacidade} lugares) {insuficiente ? "⚠️ [CAPACIDADE INSUFICIENTE]" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-[11px] text-slate-500">
                    O sistema impedirá a alocação se a capacidade for menor que{" "}
                    {alocacaoSelecionada.componenteAula.oferta.turma.qtdAlunos} alunos.
                  </span>
                </div>

                {/* Seleção de Dia da Semana */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-zinc-300">
                    Dia da Semana:
                  </label>
                  <select
                    value={editDiaSemana}
                    onChange={(e) => setEditDiaSemana(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SEGUNDA">Segunda-feira</option>
                    <option value="TERCA">Terça-feira</option>
                    <option value="QUARTA">Quarta-feira</option>
                    <option value="QUINTA">Quinta-feira</option>
                    <option value="SEXTA">Sexta-feira</option>
                  </select>
                </div>

                {/* Seleção de Janela de Horário */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-zinc-300">
                    Horário da Aula ({alocacaoSelecionada.componenteAula.qtdBlocos} blocos):
                  </label>
                  <select
                    value={editJanelaIdx}
                    onChange={(e) => setEditJanelaIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(JANELAS_NOITE[alocacaoSelecionada.componenteAula.qtdBlocos] || JANELAS_NOITE[2]).map(
                      (j, idx) => (
                        <option key={idx} value={idx}>
                          {j.horaInicio} às {j.horaFim}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setModoEdicao(false);
                      setErroEdicao(null);
                    }}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-semibold text-slate-700 dark:text-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSalvarEdicao}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Validando Regras...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar Alteração</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Disparo da Geração Automática */}
      {modalGeracaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => !isPending && setModalGeracaoAberto(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
                  Gerar Grade Automática
                </h3>
                <p className="text-xs text-slate-500">
                  Motor heurístico inspirado no FET Timetabling
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              O algoritmo irá varrer todas as ofertas de disciplinas da turma{" "}
              <strong>{turmaAtual.codigo}</strong> ({turmaAtual.qtdAlunos} alunos) no semestre{" "}
              <strong>{proposta?.periodoLetivo.codigo}</strong>, priorizando atividades com mais blocos,
              alocando salas com melhor aproveitamento de capacidade e destinando os sábados para
              atividades DOL/Online sem ocupar salas físicas.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Nome da Nova Proposta (opcional)
              </label>
              <input
                type="text"
                placeholder={`Ex: Proposta Otimizada V${todasPropostas.length + 1}`}
                value={nomeNovaProposta}
                onChange={(e) => setNomeNovaProposta(e.target.value)}
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Garantias do Motor de Otimização:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-300 ml-1">
                <li>Zero choques de horário na mesma sala ou turma</li>
                <li>Salas respeitam a capacidade mínima de {turmaAtual.qtdAlunos} alunos</li>
                <li>Salas interditadas ou em manutenção são descartadas</li>
                <li>Sábados reservados para DOL / Remoto sem uso de salas físicas</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalGeracaoAberto(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGerarAutomaticamente}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Calculando Combinações...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Executar Motor de Alocação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
