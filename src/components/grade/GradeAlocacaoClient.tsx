"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  gerarNovaPropostaAutomaticaAction,
  atualizarAlocacaoManualAction,
  criarAlocacaoManualAction,
  removerAlocacaoAction,
} from "@/app/actions/grade-actions";

interface TurmaItem {
  id: string;
  codigo: string;
  turno: "MANHA" | "NOITE";
  qtdAlunos: number;
  curso: { codigo: string; nome: string };
  periodoCurricular: { numero: number; nome: string } | null;
}

interface SalaItem {
  id: string;
  codigo: string;
  bloco: string;
  andar: string;
  capacidade: number;
  emManutencao: boolean;
  disponibilidades: {
    id: string;
    diaSemana: string;
    horaInicio: string;
    horaFim: string;
    disponivel: boolean;
    motivo: string | null;
  }[];
}

interface AlocacaoItem {
  id: string;
  componenteId: string;
  salaId: string | null;
  diaSemana: "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA" | "SABADO";
  horaInicio: string;
  horaFim: string;
  status: string;
  sala: SalaItem | null;
  componente: {
    id: string;
    tipo: "PRESENCIAL" | "REMOTO";
    blocosSemanais: number;
    requerSalaFisica: boolean;
    oferta: {
      modalidade: string;
      turma: TurmaItem;
      disciplina: {
        id: string;
        codigo: string;
        nome: string;
      };
    };
  };
}

interface ComponentePendenteItem {
  id: string;
  tipo: "PRESENCIAL" | "REMOTO";
  blocosSemanais: number;
  requerSalaFisica: boolean;
  oferta: {
    modalidade: string;
    turma: {
      id: string;
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

interface SlotTempo {
  inicio: string;
  fim: string;
  label: string;
}

const DIAS_SEMANA = [
  { key: "SEGUNDA", label: "Segunda-feira", curto: "Seg" },
  { key: "TERCA", label: "Terça-feira", curto: "Ter" },
  { key: "QUARTA", label: "Quarta-feira", curto: "Qua" },
  { key: "QUINTA", label: "Quinta-feira", curto: "Qui" },
  { key: "SEXTA", label: "Sexta-feira", curto: "Sex" },
] as const;

function paraMinutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

function cobreSlot(
  alocInicio: string,
  alocFim: string,
  slotInicio: string,
  slotFim: string
): boolean {
  return (
    paraMinutos(alocInicio) <= paraMinutos(slotInicio) &&
    paraMinutos(alocFim) >= paraMinutos(slotFim)
  );
}

export default function GradeAlocacaoClient({
  propostaAtual,
  propostas,
  turmas,
  salas,
  alocacoes,
  componentesNaoAlocados,
  validacao,
  slotsManha,
  slotsNoite,
  turmaInicialCodigo,
  modoInicial,
  salaInicialId,
}: {
  propostaAtual: { id: string; nome: string; status: string } | null;
  propostas: { id: string; nome: string; status: string }[];
  turmas: TurmaItem[];
  salas: SalaItem[];
  alocacoes: AlocacaoItem[];
  componentesNaoAlocados: ComponentePendenteItem[];
  validacao: {
    statusValidacao: string;
    totalConflitos: number;
    conflitos: {
      tipo: string;
      mensagem: string;
      alocacaoIds: string[];
    }[];
  } | null;
  slotsManha: SlotTempo[];
  slotsNoite: SlotTempo[];
  turmaInicialCodigo?: string;
  modoInicial?: string;
  salaInicialId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [modoVisao, setModoVisao] = useState<"TURMA" | "SALA" | "MAPA">(
    modoInicial === "sala" ? "SALA" : modoInicial === "mapa" ? "MAPA" : "TURMA"
  );

  const turmaDefault =
    turmas.find((t) => t.codigo === turmaInicialCodigo) ?? turmas[0] ?? null;
  const [turmaSelecionadaCodigo, setTurmaSelecionadaCodigo] = useState<string>(
    turmaDefault?.codigo ?? ""
  );

  const [salaSelecionadaId, setSalaSelecionadaId] = useState<string>(
    salaInicialId && salas.some((s) => s.id === salaInicialId)
      ? salaInicialId
      : salas[0]?.id ?? ""
  );
  const [turnoSalaVisao, setTurnoSalaVisao] = useState<"MANHA" | "NOITE">(
    "NOITE"
  );
  const [diaMapaVisao, setDiaMapaVisao] = useState<
    "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA"
  >("SEGUNDA");

  const [mostrarOutrasTurmas, setMostrarOutrasTurmas] = useState(true);
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);

  // Modal de Edição de Alocação Existente
  const [alocacaoEditando, setAlocacaoEditando] =
    useState<AlocacaoItem | null>(null);
  const [editDia, setEditDia] = useState<AlocacaoItem["diaSemana"]>("SEGUNDA");
  const [editHoraInicio, setEditHoraInicio] = useState("18:30");
  const [editHoraFim, setEditHoraFim] = useState("20:10");
  const [editSalaId, setEditSalaId] = useState<string>("");
  const [forcarConflito, setForcarConflito] = useState(false);

  // Modal de Nova Alocação Manual para Componente Pendente
  const [componenteAlocando, setComponenteAlocando] =
    useState<ComponentePendenteItem | null>(null);
  const [novoDia, setNovoDia] =
    useState<AlocacaoItem["diaSemana"]>("SEGUNDA");
  const [novoInicio, setNovoInicio] = useState("18:30");
  const [novoFim, setNovoFim] = useState("20:10");
  const [novaSalaId, setNovaSalaId] = useState<string>("");

  const turmaAtual =
    turmas.find((t) => t.codigo === turmaSelecionadaCodigo) ??
    turmas[0] ??
    null;

  const salaAtual =
    salas.find((s) => s.id === salaSelecionadaId) ?? salas[0] ?? null;

  const slotsAtivosTurma =
    turmaAtual?.turno === "MANHA" ? slotsManha : slotsNoite;

  const slotsAtivosSala =
    turnoSalaVisao === "MANHA" ? slotsManha : slotsNoite;

  const idsComConflito = new Set<string>();
  validacao?.conflitos.forEach((c) =>
    c.alocacaoIds.forEach((id) => idsComConflito.add(id))
  );

  const abrirModalEdicao = (aloc: AlocacaoItem) => {
    setAlocacaoEditando(aloc);
    setEditDia(aloc.diaSemana);
    setEditHoraInicio(aloc.horaInicio);
    setEditHoraFim(aloc.horaFim);
    setEditSalaId(aloc.salaId ?? "");
    setForcarConflito(false);
  };

  const abrirModalAlocarPendente = (comp: ComponentePendenteItem) => {
    setComponenteAlocando(comp);
    if (!comp.requerSalaFisica) {
      setNovoDia("SABADO");
      setNovoInicio("08:00");
      setNovoFim("11:20");
      setNovaSalaId("");
    } else {
      setNovoDia("SEXTA");
      if (comp.oferta.turma.turno === "MANHA") {
        setNovoInicio("07:30");
        setNovoFim(comp.blocosSemanais === 3 ? "10:00" : "09:10");
      } else {
        setNovoInicio("18:30");
        setNovoFim(comp.blocosSemanais === 3 ? "21:00" : "20:10");
      }
      const salaCapaz = salas.find(
        (s) => !s.emManutencao && s.capacidade >= comp.oferta.turma.qtdAlunos
      );
      setNovaSalaId(salaCapaz?.id ?? salas[0]?.id ?? "");
    }
  };

  const handleGerarPropostaAutomatica = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await gerarNovaPropostaAutomaticaAction();
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao gerar proposta automática.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Nova proposta gerada com sucesso: ${res.totalAlocados} alocações realizadas (${res.totalConflitos} conflitos).`,
        });
        if (res.propostaId) {
          router.push(`/grade?proposta=${res.propostaId}&turma=${turmaSelecionadaCodigo}`);
        }
        router.refresh();
      }
    });
  };

  const handleSalvarEdicaoAlocacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alocacaoEditando) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await atualizarAlocacaoManualAction({
        alocacaoId: alocacaoEditando.id,
        diaSemana: editDia,
        horaInicio: editHoraInicio,
        horaFim: editHoraFim,
        salaId:
          editDia === "SABADO" || !alocacaoEditando.componente.requerSalaFisica
            ? null
            : editSalaId || null,
        forcarMesmoComConflito: forcarConflito,
      });

      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Conflito detectado ao atualizar alocação.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Alocação de "${alocacaoEditando.componente.oferta.disciplina.nome}" atualizada com sucesso!`,
        });
        setAlocacaoEditando(null);
        router.refresh();
      }
    });
  };

  const handleRemoverAlocacao = (alocacaoId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await removerAlocacaoAction(alocacaoId);
      if (res.sucesso) {
        setFeedback({
          tipo: "ok",
          msg: "Alocação removida (atividade voltou para a fila de pendentes).",
        });
        setAlocacaoEditando(null);
        router.refresh();
      }
    });
  };

  const handleSalvarNovaAlocacaoManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!componenteAlocando || !propostaAtual) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await criarAlocacaoManualAction({
        propostaId: propostaAtual.id,
        componenteId: componenteAlocando.id,
        diaSemana: novoDia,
        horaInicio: novoInicio,
        horaFim: novoFim,
        salaId:
          novoDia === "SABADO" || !componenteAlocando.requerSalaFisica
            ? null
            : novaSalaId || null,
        forcarMesmoComConflito: forcarConflito,
      });

      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Conflito detectado na alocação manual.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Componente de "${componenteAlocando.oferta.disciplina.nome}" alocado manualmente!`,
        });
        setComponenteAlocando(null);
        router.refresh();
      }
    });
  };

  const pendentesDaTurmaAtual = componentesNaoAlocados.filter(
    (c) => c.oferta.turma.codigo === turmaAtual?.codigo
  );

  // Alocações de Sábado (DOL / Remoto) da turma selecionada
  const alocacoesSabadoTurma = alocacoes.filter(
    (a) =>
      a.diaSemana === "SABADO" &&
      a.componente.oferta.turma.codigo === turmaAtual?.codigo
  );

  return (
    <div className="space-y-6">
      {/* Barra Superior de Proposta + Alternador de Perspectiva */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Proposta de Grade Ativa
              </label>
              <select
                value={propostaAtual?.id ?? ""}
                onChange={(e) =>
                  router.push(
                    `/grade?proposta=${e.target.value}&turma=${turmaSelecionadaCodigo}`
                  )
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

            {validacao && (
              <div className="pt-4">
                <Link
                  href={`/validacao?proposta=${propostaAtual?.id ?? ""}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${
                    validacao.statusValidacao === "VALIDA_COMPLETA"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : validacao.statusValidacao === "VALIDA_PARCIAL"
                      ? "bg-amber-50 border-amber-300 text-amber-800"
                      : "bg-red-50 border-red-300 text-red-800"
                  }`}
                >
                  <span>
                    {validacao.statusValidacao === "VALIDA_COMPLETA"
                      ? "✓ Proposta Válida (0 Conflitos)"
                      : validacao.statusValidacao === "VALIDA_PARCIAL"
                      ? `⚠ Parcial (${componentesNaoAlocados.length} não alocados)`
                      : `✕ ${validacao.totalConflitos} Conflito(s) Detectado(s)`}
                  </span>
                  <span className="underline ml-1">Auditar →</span>
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isPending}
              onClick={handleGerarPropostaAutomatica}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              {isPending
                ? "Gerando Proposta Automática..."
                : "⚡ Gerar Nova Proposta Automática"}
            </button>
          </div>
        </div>

        {/* Alternador das 3 Perspectivas */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModoVisao("TURMA")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                modoVisao === "TURMA"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              🎓 Visão por Turma ({turmas.length} turmas)
            </button>
            <button
              type="button"
              onClick={() => setModoVisao("SALA")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                modoVisao === "SALA"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              🏛️ Visão por Sala Física ({salas.length} salas)
            </button>
            <button
              type="button"
              onClick={() => setModoVisao("MAPA")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                modoVisao === "MAPA"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              🗺️ Mapa Geral Diário (Salas × Horários)
            </button>
          </div>

          {/* Seletor Rápido de Turmas em Pílulas quando na Visão por Turma */}
          {modoVisao === "TURMA" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 mr-1">
                Selecionar Turma:
              </span>
              {turmas.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTurmaSelecionadaCodigo(t.codigo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    t.codigo === turmaAtual?.codigo
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {t.codigo}{" "}
                  <span className="text-[10px] font-normal opacity-80">
                    ({t.turno === "MANHA" ? "M" : "N"})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

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

      {/* Alerta de Componentes Pendentes de Alocação com botão para Alocar Manualmente */}
      {componentesNaoAlocados.length > 0 && (
        <section className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                ⏳ Atividades Aguardando Alocação na Grade ({componentesNaoAlocados.length} no semestre • {pendentesDaTurmaAtual.length} na turma {turmaAtual?.codigo})
              </h3>
              <p className="text-xs text-amber-800">
                Clique em qualquer atividade abaixo para alocar manualmente em uma sala/horário ou use o botão de geração automática acima.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {componentesNaoAlocados.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-xl border border-amber-300 shadow-2xs text-xs"
              >
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px]">
                  {comp.oferta.turma.codigo}
                </span>
                <div>
                  <div className="font-bold text-slate-900">
                    {comp.oferta.disciplina.nome}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {comp.tipo} • {comp.blocosSemanais} blocos (
                    {comp.blocosSemanais * 50}m) •{" "}
                    {comp.requerSalaFisica
                      ? `Exige sala >= ${comp.oferta.turma.qtdAlunos} lug.`
                      : "Remoto/Sábado"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => abrirModalAlocarPendente(comp)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                >
                  Alocar →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODO 1: VISÃO POR TURMA (Multi-Turma + Sua Turma vs Outras Turmas)     */}
      {/* ===================================================================== */}
      {modoVisao === "TURMA" && turmaAtual && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-black text-sm">
                  Turma {turmaAtual.codigo}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-slate-800 text-blue-300 font-bold text-xs">
                  {turmaAtual.turno === "MANHA"
                    ? "Turno Manhã (07:30 - 10:50)"
                    : "Turno Noite (18:30 - 21:50)"}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-xs">
                  {turmaAtual.qtdAlunos} alunos estimados
                </span>
              </div>
              <h2 className="text-lg font-extrabold mt-2">
                {turmaAtual.curso.nome}{" "}
                {turmaAtual.periodoCurricular
                  ? `• ${turmaAtual.periodoCurricular.numero}º Período`
                  : ""}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  checked={mostrarOutrasTurmas}
                  onChange={(e) => setMostrarOutrasTurmas(e.target.checked)}
                  className="rounded"
                />
                Exibir &ldquo;Outras Turmas&rdquo; no mesmo horário
              </label>

              <Link
                href={`/turmas?turma=${turmaAtual.id}`}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
              >
                Gerenciar Ofertas da Turma →
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed min-w-[1100px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-extrabold">
                  <th className="w-32 py-3.5 px-3 text-center border-r border-slate-200">
                    Horários ({turmaAtual.turno})
                  </th>
                  {DIAS_SEMANA.map((d) => (
                    <th
                      key={d.key}
                      className="py-3.5 px-3 text-center border-r border-slate-200"
                    >
                      {d.label}
                    </th>
                  ))}
                  <th className="w-56 py-3.5 px-3 text-center bg-teal-50 text-teal-900">
                    Sábado (Online / DOL)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {slotsAtivosTurma.map((slot, slotIdx) => (
                  <tr key={slot.inicio} className="align-top">
                    {/* Coluna do Bloco de 50m */}
                    <td className="py-4 px-3 border-r border-slate-200 bg-slate-50 text-center align-middle">
                      <div className="font-black text-slate-900 text-xs">
                        {slot.inicio} - {slot.fim}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                        {slotIdx + 1}º Bloco (50m)
                      </div>
                    </td>

                    {/* Segunda a Sexta */}
                    {DIAS_SEMANA.map((dia) => {
                      const alocsSlot = alocacoes.filter(
                        (a) =>
                          a.diaSemana === dia.key &&
                          cobreSlot(
                            a.horaInicio,
                            a.horaFim,
                            slot.inicio,
                            slot.fim
                          )
                      );

                      const suaTurmaAlocs = alocsSlot.filter(
                        (a) =>
                          a.componente.oferta.turma.codigo ===
                          turmaAtual.codigo
                      );
                      const outrasTurmasAlocs = alocsSlot.filter(
                        (a) =>
                          a.componente.oferta.turma.codigo !==
                          turmaAtual.codigo
                      );

                      return (
                        <td
                          key={dia.key}
                          className="p-2.5 border-r border-slate-200 space-y-2.5 bg-white"
                        >
                          {/* Bloco SUA TURMA */}
                          <div>
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                              Sua Turma ({turmaAtual.codigo})
                            </div>
                            {suaTurmaAlocs.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-[11px] text-slate-400">
                                Horário Livre
                              </div>
                            ) : (
                              suaTurmaAlocs.map((aloc) => {
                                const temConflito = idsComConflito.has(aloc.id);
                                return (
                                  <div
                                    key={aloc.id}
                                    onClick={() => abrirModalEdicao(aloc)}
                                    className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-2xs ${
                                      temConflito
                                        ? "bg-red-50 border-red-400 ring-2 ring-red-400/30"
                                        : "bg-blue-50/90 border-blue-300 hover:border-blue-500"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="px-1.5 py-0.5 rounded bg-blue-700 text-white font-black text-[10px]">
                                        {aloc.sala
                                          ? `Sala ${aloc.sala.codigo}`
                                          : "Sem Sala"}
                                      </span>
                                      <span className="text-[10px] font-bold text-blue-900">
                                        {aloc.horaInicio}-{aloc.horaFim}
                                      </span>
                                    </div>
                                    <div className="font-extrabold text-slate-900 mt-1.5 leading-snug">
                                      {aloc.componente.oferta.disciplina.nome}
                                    </div>
                                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-600">
                                      <span>
                                        {aloc.sala
                                          ? `${aloc.sala.bloco} • ${aloc.sala.andar}`
                                          : "Remoto"}
                                      </span>
                                      {aloc.sala && (
                                        <span className="font-bold">
                                          {turmaAtual.qtdAlunos}/
                                          {aloc.sala.capacidade} lug.
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-[9px] font-bold text-blue-700 underline">
                                      Clique para trocar sala/horário
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Bloco OUTRAS TURMAS */}
                          {mostrarOutrasTurmas &&
                            outrasTurmasAlocs.length > 0 && (
                              <div className="pt-2 border-t border-slate-100">
                                <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                                  Outras Turmas ({outrasTurmasAlocs.length})
                                </div>
                                <div className="space-y-1">
                                  {outrasTurmasAlocs.map((ot) => (
                                    <div
                                      key={ot.id}
                                      onClick={() => abrirModalEdicao(ot)}
                                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer text-[10px]"
                                    >
                                      <div className="flex items-center justify-between font-bold text-slate-700">
                                        <span>
                                          {ot.componente.oferta.turma.codigo}
                                        </span>
                                        <span className="text-blue-700">
                                          {ot.sala
                                            ? `Sala ${ot.sala.codigo}`
                                            : "Online"}
                                        </span>
                                      </div>
                                      <div className="truncate text-slate-500">
                                        {ot.componente.oferta.disciplina.nome}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </td>
                      );
                    })}

                    {/* Coluna de Sábado (Renderizada apenas na primeira linha com rowSpan=4) */}
                    {slotIdx === 0 && (
                      <td
                        rowSpan={slotsAtivosTurma.length}
                        className="p-3 bg-teal-50/40 align-top space-y-3"
                      >
                        <div className="p-2.5 rounded-xl bg-teal-100/80 border border-teal-300 text-teal-950">
                          <div className="font-black text-[11px] uppercase">
                            Sábado • Atividades Online / Remotas
                          </div>
                          <p className="text-[10px] text-teal-800 mt-0.5">
                            Sem uso de sala física no campus.
                          </p>
                        </div>

                        {alocacoesSabadoTurma.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-teal-300 text-center text-xs text-teal-700">
                            Nenhuma disciplina DOL ou componente Híbrido Remoto para {turmaAtual.codigo}.
                          </div>
                        ) : (
                          alocacoesSabadoTurma.map((aloc) => (
                            <div
                              key={aloc.id}
                              onClick={() => abrirModalEdicao(aloc)}
                              className="p-3 rounded-xl bg-white border border-teal-300 shadow-2xs space-y-1.5 cursor-pointer hover:border-teal-500"
                            >
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded bg-teal-700 text-white font-black text-[10px]">
                                  {aloc.componente.oferta.modalidade} (
                                  {aloc.componente.tipo})
                                </span>
                                <span className="text-[10px] font-bold text-teal-800">
                                  {aloc.horaInicio}-{aloc.horaFim}
                                </span>
                              </div>
                              <div className="font-extrabold text-slate-900">
                                {aloc.componente.oferta.disciplina.nome}
                              </div>
                              <div className="text-[10px] font-semibold text-teal-700">
                                💻 Ambiente Virtual • Sem Sala Física
                              </div>
                            </div>
                          ))
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODO 2: VISÃO POR SALA FÍSICA (Ocupação Semanal da Sala) */}
      {/* ===================================================================== */}
      {modoVisao === "SALA" && salaAtual && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Selecionar Sala Física
                </label>
                <select
                  value={salaAtual.id}
                  onChange={(e) => setSalaSelecionadaId(e.target.value)}
                  className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-extrabold text-white"
                >
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sala {s.codigo} • {s.bloco} ({s.capacidade} lug.)
                      {s.emManutencao ? " [MANUTENÇÃO]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Turno Exibido
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTurnoSalaVisao("MANHA")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold ${
                      turnoSalaVisao === "MANHA"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Manhã (07:30-10:50)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTurnoSalaVisao("NOITE")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold ${
                      turnoSalaVisao === "NOITE"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Noite (18:30-21:50)
                  </button>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-black">
                Sala {salaAtual.codigo} • Capacidade: {salaAtual.capacidade}{" "}
                lugares
              </div>
              <div className="text-xs text-slate-400">
                {salaAtual.bloco} • {salaAtual.andar}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed min-w-[950px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-extrabold">
                  <th className="w-32 py-3.5 px-3 text-center border-r border-slate-200">
                    Horário ({turnoSalaVisao})
                  </th>
                  {DIAS_SEMANA.map((d) => (
                    <th
                      key={d.key}
                      className="py-3.5 px-3 text-center border-r border-slate-200"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {slotsAtivosSala.map((slot) => (
                  <tr key={slot.inicio}>
                    <td className="py-4 px-3 border-r border-slate-200 bg-slate-50 text-center font-black text-slate-800">
                      {slot.inicio} - {slot.fim}
                    </td>
                    {DIAS_SEMANA.map((dia) => {
                      const alocsSala = alocacoes.filter(
                        (a) =>
                          a.salaId === salaAtual.id &&
                          a.diaSemana === dia.key &&
                          cobreSlot(
                            a.horaInicio,
                            a.horaFim,
                            slot.inicio,
                            slot.fim
                          )
                      );

                      const restricao = salaAtual.disponibilidades.find(
                        (r) =>
                          !r.disponivel &&
                          r.diaSemana === dia.key &&
                          cobreSlot(
                            r.horaInicio,
                            r.horaFim,
                            slot.inicio,
                            slot.fim
                          )
                      );

                      return (
                        <td
                          key={dia.key}
                          className="p-2.5 border-r border-slate-200 align-top"
                        >
                          {salaAtual.emManutencao && (
                            <div className="p-2 rounded-lg bg-red-100 text-red-800 font-bold text-[10px] mb-1">
                              ⚠ Sala em Manutenção Geral
                            </div>
                          )}
                          {restricao && (
                            <div className="p-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px] mb-1">
                              🔒 Bloqueada: {restricao.motivo}
                            </div>
                          )}
                          {alocsSala.length === 0 ? (
                            <div className="p-3 rounded-lg border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                              Sala Livre
                            </div>
                          ) : (
                            alocsSala.map((aloc) => (
                              <div
                                key={aloc.id}
                                onClick={() => abrirModalEdicao(aloc)}
                                className="p-2.5 rounded-xl bg-blue-50 border border-blue-300 cursor-pointer hover:border-blue-500 space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px]">
                                    Turma {aloc.componente.oferta.turma.codigo}
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-800">
                                    {aloc.componente.oferta.turma.qtdAlunos}/
                                    {salaAtual.capacidade} lug.
                                  </span>
                                </div>
                                <div className="font-extrabold text-slate-900">
                                  {aloc.componente.oferta.disciplina.nome}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {aloc.horaInicio} às {aloc.horaFim}
                                </div>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODO 3: MAPA GERAL DIÁRIO (Todas as Salas × Blocos de Horário)         */}
      {/* ===================================================================== */}
      {modoVisao === "MAPA" && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Dia da Semana
                </label>
                <div className="flex items-center gap-1">
                  {DIAS_SEMANA.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDiaMapaVisao(d.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        diaMapaVisao === d.key
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Turno
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTurnoSalaVisao("MANHA")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      turnoSalaVisao === "MANHA"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Manhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setTurnoSalaVisao("NOITE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      turnoSalaVisao === "NOITE"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Noite
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold">
                  <th className="py-3 px-4 text-left border-r border-slate-200">
                    Sala Física / Capacidade
                  </th>
                  {slotsAtivosSala.map((s) => (
                    <th
                      key={s.inicio}
                      className="py-3 px-4 text-center border-r border-slate-200"
                    >
                      {s.inicio} - {s.fim}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {salas.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 border-r border-slate-200 bg-slate-50">
                      <div className="font-black text-slate-900">
                        Sala {s.codigo}{" "}
                        {s.emManutencao && (
                          <span className="text-[10px] text-red-600">
                            (Manutenção)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {s.bloco} • {s.capacidade} lugares
                      </div>
                    </td>
                    {slotsAtivosSala.map((slot) => {
                      const aloc = alocacoes.find(
                        (a) =>
                          a.salaId === s.id &&
                          a.diaSemana === diaMapaVisao &&
                          cobreSlot(
                            a.horaInicio,
                            a.horaFim,
                            slot.inicio,
                            slot.fim
                          )
                      );
                      return (
                        <td
                          key={slot.inicio}
                          className="p-2 border-r border-slate-200 text-center"
                        >
                          {aloc ? (
                            <div
                              onClick={() => abrirModalEdicao(aloc)}
                              className="p-2 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:border-blue-400"
                            >
                              <div className="font-black text-blue-900">
                                {aloc.componente.oferta.turma.codigo}
                              </div>
                              <div className="text-[11px] font-semibold text-slate-800 truncate">
                                {aloc.componente.oferta.disciplina.nome}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300">
                              Livre
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: EDITAR ALOCAÇÃO EXISTENTE (Troca Manual de Sala/Dia/Horário) */}
      {/* ===================================================================== */}
      {alocacaoEditando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSalvarEdicaoAlocacao}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-black text-[10px]">
                  Turma {alocacaoEditando.componente.oferta.turma.codigo} •{" "}
                  {alocacaoEditando.componente.oferta.turma.qtdAlunos} alunos
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Ajuste Manual: {alocacaoEditando.componente.oferta.disciplina.nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAlocacaoEditando(null)}
                className="text-slate-400 hover:text-slate-700 font-black"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Dia da Semana
                </label>
                <select
                  value={editDia}
                  onChange={(e) =>
                    setEditDia(e.target.value as AlocacaoItem["diaSemana"])
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                >
                  <option value="SEGUNDA">Segunda-feira</option>
                  <option value="TERCA">Terça-feira</option>
                  <option value="QUARTA">Quarta-feira</option>
                  <option value="QUINTA">Quinta-feira</option>
                  <option value="SEXTA">Sexta-feira</option>
                  <option value="SABADO">Sábado (Online/DOL)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Hora Início
                </label>
                <input
                  type="text"
                  value={editHoraInicio}
                  onChange={(e) => setEditHoraInicio(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Hora Fim
                </label>
                <input
                  type="text"
                  value={editHoraFim}
                  onChange={(e) => setEditHoraFim(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>

            {editDia !== "SABADO" &&
              alocacaoEditando.componente.requerSalaFisica && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Sala Física (Capacidade recomendada: mín.{" "}
                    {alocacaoEditando.componente.oferta.turma.qtdAlunos} lugares)
                  </label>
                  <select
                    value={editSalaId}
                    onChange={(e) => setEditSalaId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="">Sem sala física</option>
                    {salas.map((s) => (
                      <option key={s.id} value={s.id}>
                        Sala {s.codigo} ({s.bloco}) — Cap: {s.capacidade} lug.
                        {s.capacidade <
                        alocacaoEditando.componente.oferta.turma.qtdAlunos
                          ? " [CAPACIDADE INSUFICIENTE]"
                          : ""}
                        {s.emManutencao ? " [EM MANUTENÇÃO]" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={forcarConflito}
                onChange={(e) => setForcarConflito(e.target.checked)}
              />
              Permitir salvar mesmo com conflitos detectados para revisão posterior
            </label>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleRemoverAlocacao(alocacaoEditando.id)}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs"
              >
                Desalocar Atividade
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAlocacaoEditando(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  Salvar Alteração
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: ALOCAR COMPONENTE PENDENTE MANUALMENTE                       */}
      {/* ===================================================================== */}
      {componenteAlocando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSalvarNovaAlocacaoManual}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[10px]">
                  Turma {componenteAlocando.oferta.turma.codigo} •{" "}
                  {componenteAlocando.oferta.turma.qtdAlunos} alunos
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Alocar Manualmente: {componenteAlocando.oferta.disciplina.nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setComponenteAlocando(null)}
                className="text-slate-400 hover:text-slate-700 font-black"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Dia da Semana
                </label>
                <select
                  value={novoDia}
                  onChange={(e) =>
                    setNovoDia(e.target.value as AlocacaoItem["diaSemana"])
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                >
                  <option value="SEGUNDA">Segunda-feira</option>
                  <option value="TERCA">Terça-feira</option>
                  <option value="QUARTA">Quarta-feira</option>
                  <option value="QUINTA">Quinta-feira</option>
                  <option value="SEXTA">Sexta-feira</option>
                  <option value="SABADO">Sábado (Online/DOL)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Hora Início
                </label>
                <input
                  type="text"
                  value={novoInicio}
                  onChange={(e) => setNovoInicio(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Hora Fim
                </label>
                <input
                  type="text"
                  value={novoFim}
                  onChange={(e) => setNovoFim(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>

            {novoDia !== "SABADO" && componenteAlocando.requerSalaFisica && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Sala Física
                </label>
                <select
                  value={novaSalaId}
                  onChange={(e) => setNovaSalaId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold"
                >
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sala {s.codigo} ({s.bloco}) — Cap: {s.capacidade} lug.
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setComponenteAlocando(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
              >
                Confirmar Alocação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
