"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  criarTurmaAction,
  atualizarTurmaAction,
  excluirTurmaAction,
  criarOfertaDisciplinaAction,
  importarOfertasDaMatrizAction,
  excluirOfertaDisciplinaAction,
} from "@/app/actions/grade-actions";

interface CursoOption {
  id: string;
  codigo: string;
  nome: string;
  matrizes: {
    id: string;
    versao: string;
    periodos: {
      id: string;
      numero: number;
      nome: string;
      disciplinas: {
        disciplina: { id: string; codigo: string; nome: string };
      }[];
    }[];
  }[];
}

interface DisciplinaOption {
  id: string;
  codigo: string;
  nome: string;
  cargaHorariaTotal: number;
}

interface TurmaCompleta {
  id: string;
  codigo: string;
  turno: "MANHA" | "NOITE";
  qtdAlunos: number;
  cursoId: string;
  periodoCurricularId: string | null;
  curso: { id: string; codigo: string; nome: string };
  periodoCurricular: {
    id: string;
    numero: number;
    nome: string;
    disciplinas: {
      disciplina: { id: string; codigo: string; nome: string };
    }[];
  } | null;
  ofertas: {
    id: string;
    modalidade: string;
    disciplina: {
      id: string;
      codigo: string;
      nome: string;
      cargaHorariaTotal: number;
    };
    componentes: {
      id: string;
      tipo: "PRESENCIAL" | "REMOTO";
      blocosSemanais: number;
      requerSalaFisica: boolean;
      alocacoes: {
        id: string;
        diaSemana: string;
        horaInicio: string;
        horaFim: string;
        sala: { codigo: string } | null;
      }[];
    }[];
  }[];
}

const MODALIDADES = [
  {
    value: "PRESENCIAL",
    label: "Presencial (100% em Sala Física Seg-Sex)",
  },
  {
    value: "HIBRIDA",
    label: "Híbrida (Parte Presencial em Sala + Parte Remota/Sábado)",
  },
  {
    value: "DOL",
    label: "DOL - Disciplina On-Line (100% Remota / Sábado sem sala)",
  },
  {
    value: "EAD",
    label: "EAD - Educação a Distância (Sem sala física)",
  },
  {
    value: "UBIQUA",
    label: "Ubíqua (Flexível / Remota)",
  },
  {
    value: "NOTAVEL_MESTRE",
    label: "Notável Mestre",
  },
] as const;

export default function TurmasOfertasClient({
  turmas,
  cursos,
  disciplinas,
  turmaInicialId,
}: {
  turmas: TurmaCompleta[];
  cursos: CursoOption[];
  disciplinas: DisciplinaOption[];
  turmaInicialId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string>(
    turmaInicialId && turmas.some((t) => t.id === turmaInicialId)
      ? turmaInicialId
      : turmas[0]?.id ?? ""
  );
  const [filtroTurno, setFiltroTurno] = useState<"TODOS" | "MANHA" | "NOITE">(
    "TODOS"
  );
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);

  // Form Nova Turma (RF05)
  const [novoCodigoTurma, setNovoCodigoTurma] = useState("");
  const [novoCursoId, setNovoCursoId] = useState(cursos[0]?.id ?? "");
  const [novoPeriodoCurricularId, setNovoPeriodoCurricularId] = useState("");
  const [novoTurno, setNovoTurno] = useState<"MANHA" | "NOITE">("NOITE");
  const [novaQtdAlunos, setNovaQtdAlunos] = useState(40);

  // Form Nova Oferta (RF06)
  const [ofertaDiscId, setOfertaDiscId] = useState("");
  const [ofertaModalidade, setOfertaModalidade] = useState<
    "PRESENCIAL" | "HIBRIDA" | "DOL" | "EAD" | "UBIQUA" | "NOTAVEL_MESTRE"
  >("PRESENCIAL");
  const [blocosPresenciais, setBlocosPresenciais] = useState(2);
  const [blocosRemotos, setBlocosRemotos] = useState(2);

  // Edição rápida de alunos/turno da turma selecionada
  const turmaAtual =
    turmas.find((t) => t.id === turmaSelecionadaId) ?? turmas[0] ?? null;

  const [editQtdAlunos, setEditQtdAlunos] = useState<number>(
    turmaAtual?.qtdAlunos ?? 40
  );
  const [editTurno, setEditTurno] = useState<"MANHA" | "NOITE">(
    turmaAtual?.turno ?? "NOITE"
  );

  const handleSelecionarTurma = (t: TurmaCompleta) => {
    setTurmaSelecionadaId(t.id);
    setEditQtdAlunos(t.qtdAlunos);
    setEditTurno(t.turno);
  };

  const cursoFormSelecionado = cursos.find((c) => c.id === novoCursoId);
  const periodosDoCursoForm =
    cursoFormSelecionado?.matrizes[0]?.periodos ?? [];

  const turmasFiltradas = turmas.filter((t) =>
    filtroTurno === "TODOS" ? true : t.turno === filtroTurno
  );

  const handleCriarTurma = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await criarTurmaAction({
        codigo: novoCodigoTurma,
        cursoId: novoCursoId,
        periodoCurricularId: novoPeriodoCurricularId || undefined,
        turno: novoTurno,
        qtdAlunos: Number(novaQtdAlunos),
      });
      if (!res.sucesso) {
        setFeedback({ tipo: "erro", msg: res.erro || "Erro ao criar turma." });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Turma ${novoCodigoTurma.toUpperCase()} criada com sucesso!`,
        });
        setNovoCodigoTurma("");
        if (res.turmaId) setTurmaSelecionadaId(res.turmaId);
        router.refresh();
      }
    });
  };

  const handleSalvarDadosTurma = () => {
    if (!turmaAtual) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await atualizarTurmaAction({
        turmaId: turmaAtual.id,
        qtdAlunos: Number(editQtdAlunos),
        turno: editTurno,
      });
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao atualizar turma.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Turma ${turmaAtual.codigo} atualizada (${editQtdAlunos} alunos • Turno ${editTurno}).`,
        });
        router.refresh();
      }
    });
  };

  const handleExcluirTurma = (id: string, codigo: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await excluirTurmaAction(id);
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao excluir turma.",
        });
      } else {
        setFeedback({ tipo: "ok", msg: `Turma ${codigo} removida.` });
        router.refresh();
      }
    });
  };

  const handleImportarDaMatriz = () => {
    if (!turmaAtual) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await importarOfertasDaMatrizAction(turmaAtual.id);
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao importar disciplinas da matriz.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `${res.criadas} disciplina(s) importada(s) automaticamente da matriz curricular para ${turmaAtual.codigo}!`,
        });
        router.refresh();
      }
    });
  };

  const handleAdicionarOferta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaAtual || !ofertaDiscId) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await criarOfertaDisciplinaAction({
        turmaId: turmaAtual.id,
        disciplinaId: ofertaDiscId,
        modalidade: ofertaModalidade,
        blocosPresenciais: Number(blocosPresenciais),
        blocosRemotos: Number(blocosRemotos),
      });
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao ofertar disciplina.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Disciplina ofertada na modalidade ${ofertaModalidade} para a turma ${turmaAtual.codigo}!`,
        });
        setOfertaDiscId("");
        router.refresh();
      }
    });
  };

  const handleExcluirOferta = (ofertaId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await excluirOfertaDisciplinaAction(ofertaId);
      if (res.sucesso) {
        setFeedback({ tipo: "ok", msg: "Oferta removida da turma." });
        router.refresh();
      }
    });
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda (4 cols): Cadastro de Nova Turma + Lista de Todas as Turmas */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card: Cadastrar Nova Turma (RF05) */}
          <form
            onSubmit={handleCriarTurma}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">
                + Cadastrar Nova Turma
              </h2>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                2026.1
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Código da Turma
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CC-8NA"
                  value={novoCodigoTurma}
                  onChange={(e) => setNovoCodigoTurma(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Qtd. Estimada Alunos
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={200}
                  value={novaQtdAlunos}
                  onChange={(e) => setNovaQtdAlunos(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Curso
              </label>
              <select
                required
                value={novoCursoId}
                onChange={(e) => {
                  setNovoCursoId(e.target.value);
                  setNovoPeriodoCurricularId("");
                }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-800"
              >
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.codigo}] {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Período da Matriz
                </label>
                <select
                  value={novoPeriodoCurricularId}
                  onChange={(e) => setNovoPeriodoCurricularId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="">Sem vínculo fixo</option>
                  {periodosDoCursoForm.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero}º Período ({p.disciplinas.length} disc.)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Turno
                </label>
                <select
                  value={novoTurno}
                  onChange={(e) =>
                    setNovoTurno(e.target.value as "MANHA" | "NOITE")
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="MANHA">Manhã (07:30-10:50)</option>
                  <option value="NOITE">Noite (18:30-21:50)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs"
            >
              {isPending ? "Cadastrando..." : "Criar Turma no Semestre"}
            </button>
          </form>

          {/* Lista de Turmas Cadastradas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Turmas Cadastradas ({turmasFiltradas.length})
              </h3>
              <div className="flex items-center gap-1">
                {(["TODOS", "MANHA", "NOITE"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroTurno(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      filtroTurno === f
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {turmasFiltradas.map((t) => {
                const selecionada = t.id === turmaAtual?.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelecionarTurma(t)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selecionada
                        ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-xs">
                          {t.codigo}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.turno === "MANHA"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {t.turno}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {t.qtdAlunos} alunos
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs font-semibold text-slate-800">
                      {t.curso.nome}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>
                        {t.periodoCurricular
                          ? `${t.periodoCurricular.numero}º Período`
                          : "Período livre"}
                      </span>
                      <span className="font-bold text-blue-700">
                        {t.ofertas.length} disciplina(s) ofertada(s)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna Direita (8 cols): Detalhes da Turma Selecionada & Gestão de Ofertas por Modalidade (RF06) */}
        <div className="lg:col-span-8 space-y-5">
          {turmaAtual ? (
            <>
              {/* Cabeçalho e Edição da Turma Selecionada */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-black text-sm">
                        {turmaAtual.codigo}
                      </span>
                      <h2 className="text-lg font-black text-slate-900">
                        {turmaAtual.curso.nome}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {turmaAtual.periodoCurricular
                        ? `Vinculada ao ${turmaAtual.periodoCurricular.numero}º Período da Matriz (${turmaAtual.periodoCurricular.disciplinas.length} disciplinas previstas na matriz)`
                        : "Turma sem período curricular fixo vinculado"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/grade?turma=${turmaAtual.codigo}`}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs"
                    >
                      Abrir Grade Semanal de {turmaAtual.codigo} →
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        handleExcluirTurma(turmaAtual.id, turmaAtual.codigo)
                      }
                      className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs"
                    >
                      Excluir Turma
                    </button>
                  </div>
                </div>

                {/* Controles Rápidos: Alterar Qtd Alunos / Turno + Importar Disciplinas da Matriz */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Qtd. Estimada de Alunos
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={editQtdAlunos}
                        onChange={(e) =>
                          setEditQtdAlunos(Number(e.target.value))
                        }
                        className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Turno da Turma
                      </label>
                      <select
                        value={editTurno}
                        onChange={(e) =>
                          setEditTurno(e.target.value as "MANHA" | "NOITE")
                        }
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                      >
                        <option value="MANHA">Manhã (07:30-10:50)</option>
                        <option value="NOITE">Noite (18:30-21:50)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleSalvarDadosTurma}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                    >
                      Salvar Parâmetros
                    </button>
                  </div>

                  {turmaAtual.periodoCurricular && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleImportarDaMatriz}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs"
                    >
                      ⚡ Importar Disciplinas Previstas na Matriz
                    </button>
                  )}
                </div>
              </div>

              {/* Formulário: Ofertar Nova Disciplina por Modalidade (RF06 / RN03 / RN08 / RN09) */}
              <form
                onSubmit={handleAdicionarOferta}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
              >
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    + Adicionar Oferta de Disciplina na Turma {turmaAtual.codigo}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina a modalidade da oferta no semestre: Presencial (ocupa sala física Seg–Sex), Híbrida (gera componente presencial + componente remoto no Sábado) ou DOL/EAD/Ubíqua (alocada sem sala física).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Disciplina do Catálogo
                    </label>
                    <select
                      required
                      value={ofertaDiscId}
                      onChange={(e) => setOfertaDiscId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">Selecione a disciplina...</option>
                      {disciplinas.map((d) => (
                        <option key={d.id} value={d.id}>
                          [{d.codigo}] {d.nome} ({d.cargaHorariaTotal}h)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Modalidade no Semestre
                    </label>
                    <select
                      value={ofertaModalidade}
                      onChange={(e) =>
                        setOfertaModalidade(
                          e.target.value as typeof ofertaModalidade
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      {MODALIDADES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(ofertaModalidade === "PRESENCIAL" ||
                    ofertaModalidade === "NOTAVEL_MESTRE" ||
                    ofertaModalidade === "HIBRIDA") && (
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Blocos Pres.
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={blocosPresenciais}
                        onChange={(e) =>
                          setBlocosPresenciais(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold text-center"
                      />
                    </div>
                  )}

                  {(ofertaModalidade === "HIBRIDA" ||
                    ofertaModalidade === "DOL" ||
                    ofertaModalidade === "EAD" ||
                    ofertaModalidade === "UBIQUA") && (
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Blocos Rem.
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={blocosRemotos}
                        onChange={(e) =>
                          setBlocosRemotos(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold text-center"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                    >
                      + Ofertar
                    </button>
                  </div>
                </div>
              </form>

              {/* Tabela de Ofertas e Componentes Gerados da Turma */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Disciplinas Ofertadas em {turmaAtual.codigo} (
                    {turmaAtual.ofertas.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Cada componente gera uma atividade independente para o motor de ensalamento
                  </span>
                </div>

                {turmaAtual.ofertas.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhuma disciplina ofertada nesta turma ainda. Clique em{" "}
                    <strong>&ldquo;Importar Disciplinas Previstas na Matriz&rdquo;</strong>{" "}
                    acima ou adicione manualmente.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-3 px-4">Disciplina</th>
                          <th className="py-3 px-4">Modalidade</th>
                          <th className="py-3 px-4">Componentes de Aula</th>
                          <th className="py-3 px-4">Situação na Grade</th>
                          <th className="py-3 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {turmaAtual.ofertas.map((of) => (
                          <tr key={of.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-slate-900">
                                <span className="text-blue-700 mr-1.5">
                                  [{of.disciplina.codigo}]
                                </span>
                                {of.disciplina.nome}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Carga horária: {of.disciplina.cargaHorariaTotal}h
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                                  of.modalidade === "PRESENCIAL"
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : of.modalidade === "HIBRIDA"
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-teal-100 text-teal-800 border border-teal-200"
                                }`}
                              >
                                {of.modalidade}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 space-y-1">
                              {of.componentes.map((comp) => (
                                <div
                                  key={comp.id}
                                  className="flex items-center gap-1.5 text-[11px]"
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                      comp.requerSalaFisica
                                        ? "bg-slate-800 text-white"
                                        : "bg-teal-50 text-teal-800 border border-teal-200"
                                    }`}
                                  >
                                    {comp.tipo}
                                  </span>
                                  <span className="font-semibold text-slate-700">
                                    {comp.blocosSemanais} blocos (
                                    {comp.blocosSemanais * 50} min)
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500">
                                    {comp.requerSalaFisica
                                      ? "Exige Sala Física"
                                      : "Sem Sala (Sábado/Online)"}
                                  </span>
                                </div>
                              ))}
                            </td>
                            <td className="py-3.5 px-4 space-y-1">
                              {of.componentes.map((comp) => {
                                const aloc = comp.alocacoes[0];
                                return aloc ? (
                                  <div
                                    key={comp.id}
                                    className="text-[11px] font-bold text-emerald-700"
                                  >
                                    ✓ {aloc.diaSemana} ({aloc.horaInicio}-
                                    {aloc.horaFim}){" "}
                                    {aloc.sala
                                      ? `• Sala ${aloc.sala.codigo}`
                                      : "• Online/Remoto"}
                                  </div>
                                ) : (
                                  <div
                                    key={comp.id}
                                    className="text-[11px] font-bold text-amber-600"
                                  >
                                    ⏳ Pendente de alocação
                                  </div>
                                );
                              })}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleExcluirOferta(of.id)}
                                className="text-red-600 hover:underline font-bold text-[11px]"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Nenhuma turma selecionada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
