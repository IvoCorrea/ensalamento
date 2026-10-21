"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  criarCursoAction,
  excluirCursoAction,
  criarMatrizCurricularAction,
  criarDisciplinaAction,
  vincularDisciplinaMatrizAction,
  desvincularDisciplinaMatrizAction,
} from "@/app/actions/grade-actions";

interface CursoItem {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  _count: { turmas: number };
  matrizes: {
    id: string;
    nome: string;
    versao: string;
    ativa: boolean;
    periodos: {
      id: string;
      numero: number;
      nome: string;
      disciplinas: {
        id: string;
        obrigatoria: boolean;
        disciplina: {
          id: string;
          codigo: string;
          nome: string;
          cargaHorariaTotal: number;
        };
      }[];
    }[];
  }[];
}

interface DisciplinaCatalogoItem {
  id: string;
  codigo: string;
  nome: string;
  cargaHorariaTotal: number;
  matrizes: {
    id: string;
    periodoCurricular: {
      numero: number;
      matriz: {
        versao: string;
        curso: { codigo: string; nome: string };
      };
    };
  }[];
}

export default function CursosMatrizesClient({
  cursos,
  disciplinas,
}: {
  cursos: CursoItem[];
  disciplinas: DisciplinaCatalogoItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [cursoSelecionadoId, setCursoSelecionadoId] = useState<string>(
    cursos[0]?.id ?? ""
  );
  const [abaAtiva, setAbaAtiva] = useState<"MATRIZ" | "CATALOGO">("MATRIZ");
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);

  // Forms Curso
  const [novoCursoCodigo, setNovoCursoCodigo] = useState("");
  const [novoCursoNome, setNovoCursoNome] = useState("");

  // Form Matriz
  const [novaMatrizNome, setNovaMatrizNome] = useState("");
  const [novaMatrizVersao, setNovaMatrizVersao] = useState("2026.1");
  const [novaMatrizPeriodos, setNovaMatrizPeriodos] = useState(8);

  // Form Disciplina
  const [discCodigo, setDiscCodigo] = useState("");
  const [discNome, setDiscNome] = useState("");
  const [discCH, setDiscCH] = useState(80);

  // Form Vínculo Disciplina -> Período da Matriz
  const [periodoAlvoId, setPeriodoAlvoId] = useState("");
  const [disciplinaAlvoId, setDisciplinaAlvoId] = useState("");

  const cursoAtual =
    cursos.find((c) => c.id === cursoSelecionadoId) ?? cursos[0] ?? null;
  const matrizAtual = cursoAtual?.matrizes[0] ?? null;

  const handleCriarCurso = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await criarCursoAction({
        codigo: novoCursoCodigo,
        nome: novoCursoNome,
      });
      if (!res.sucesso) {
        setFeedback({ tipo: "erro", msg: res.erro || "Erro ao criar curso." });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Curso ${novoCursoCodigo.toUpperCase()} cadastrado com sucesso!`,
        });
        setNovoCursoCodigo("");
        setNovoCursoNome("");
        if (res.cursoId) setCursoSelecionadoId(res.cursoId);
        router.refresh();
      }
    });
  };

  const handleCriarMatriz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoAtual) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await criarMatrizCurricularAction({
        cursoId: cursoAtual.id,
        nome: novaMatrizNome || `Matriz ${cursoAtual.nome}`,
        versao: novaMatrizVersao,
        qtdPeriodos: Number(novaMatrizPeriodos),
      });
      if (!res.sucesso) {
        setFeedback({ tipo: "erro", msg: res.erro || "Erro ao criar matriz." });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Matriz versão ${novaMatrizVersao} criada com ${novaMatrizPeriodos} períodos!`,
        });
        setNovaMatrizNome("");
        router.refresh();
      }
    });
  };

  const handleCriarDisciplina = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await criarDisciplinaAction({
        codigo: discCodigo,
        nome: discNome,
        cargaHorariaTotal: Number(discCH),
      });
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao criar disciplina.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Disciplina "${discNome}" adicionada ao catálogo institucional!`,
        });
        setDiscCodigo("");
        setDiscNome("");
        router.refresh();
      }
    });
  };

  const handleVincularDisciplina = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodoAlvoId || !disciplinaAlvoId) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await vincularDisciplinaMatrizAction({
        periodoCurricularId: periodoAlvoId,
        disciplinaId: disciplinaAlvoId,
        obrigatoria: true,
      });
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao vincular disciplina.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: "Disciplina vinculada ao período curricular!",
        });
        router.refresh();
      }
    });
  };

  const handleDesvincular = (vinculoId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await desvincularDisciplinaMatrizAction(vinculoId);
      if (res.sucesso) {
        setFeedback({ tipo: "ok", msg: "Vínculo removido da matriz." });
        router.refresh();
      }
    });
  };

  const handleExcluirCurso = (cursoId: string, nome: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await excluirCursoAction(cursoId);
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || `Não foi possível excluir ${nome}.`,
        });
      } else {
        setFeedback({ tipo: "ok", msg: `Curso ${nome} removido.` });
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

      {/* Alternador entre Estrutura de Cursos/Matrizes e Catálogo Compartilhado de Disciplinas */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbaAtiva("MATRIZ")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              abaAtiva === "MATRIZ"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            1. Cursos, Matrizes e Períodos (RF01-RF03)
          </button>
          <button
            onClick={() => setAbaAtiva("CATALOGO")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              abaAtiva === "CATALOGO"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            2. Catálogo Geral de Disciplinas & Reaproveitamento ({disciplinas.length}) (RF04 / RN05)
          </button>
        </div>

        <div className="text-xs text-slate-500">
          <strong>RN05:</strong> Uma disciplina pode pertencer a múltiplos cursos e períodos curriculares.
        </div>
      </div>

      {abaAtiva === "MATRIZ" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda (4 cols): Lista de Cursos + Cadastro de Curso + Cadastro de Matriz */}
          <div className="lg:col-span-4 space-y-5">
            {/* Lista de Cursos */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">
                Cursos Cadastrados ({cursos.length})
              </h2>
              <div className="space-y-2">
                {cursos.map((c) => {
                  const ativo = c.id === cursoAtual?.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setCursoSelecionadoId(c.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        ativo
                          ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px]">
                            {c.codigo}
                          </span>
                          <span className="font-extrabold text-xs text-slate-900">
                            {c.nome}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {c.matrizes.length} matriz(es) • {c._count.turmas} turma(s)
                        </div>
                      </div>
                      {c._count.turmas === 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExcluirCurso(c.id, c.nome);
                          }}
                          className="text-[11px] text-red-600 hover:underline font-bold"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Novo Curso */}
            <form
              onSubmit={handleCriarCurso}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3"
            >
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                + Cadastrar Novo Curso (RF01)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Sigla
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: SI"
                    value={novoCursoCodigo}
                    onChange={(e) => setNovoCursoCodigo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nome do Curso
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sistemas de Informação"
                    value={novoCursoNome}
                    onChange={(e) => setNovoCursoNome(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                {isPending ? "Salvando..." : "Criar Curso"}
              </button>
            </form>

            {/* Nova Matriz Curricular para o Curso Selecionado */}
            {cursoAtual && (
              <form
                onSubmit={handleCriarMatriz}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3"
              >
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  + Nova Matriz em {cursoAtual.codigo} (RF02 / RF03)
                </h3>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nome da Matriz
                  </label>
                  <input
                    type="text"
                    placeholder={`Matriz ${cursoAtual.nome}`}
                    value={novaMatrizNome}
                    onChange={(e) => setNovaMatrizNome(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Versão
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 2026.2"
                      value={novaMatrizVersao}
                      onChange={(e) => setNovaMatrizVersao(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Qtd. Períodos
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={novaMatrizPeriodos}
                      onChange={(e) =>
                        setNovaMatrizPeriodos(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Gerar Matriz e Períodos
                </button>
              </form>
            )}
          </div>

          {/* Coluna Direita (8 cols): Matriz Curricular e Vínculo de Disciplinas aos Períodos */}
          <div className="lg:col-span-8 space-y-5">
            {cursoAtual && matrizAtual ? (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-black text-xs">
                        {cursoAtual.codigo}
                      </span>
                      <h2 className="text-lg font-black text-slate-900">
                        {matrizAtual.nome} • Versão {matrizAtual.versao}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Estrutura dividida em {matrizAtual.periodos.length} períodos curriculares. Vincule disciplinas abaixo para permitir importação automática nas turmas.
                    </p>
                  </div>
                </div>

                {/* Barra de Vínculo Rápido de Disciplina ao Período */}
                <form
                  onSubmit={handleVincularDisciplina}
                  className="bg-blue-50/70 rounded-2xl border border-blue-200 p-4 flex flex-col sm:flex-row items-end gap-3"
                >
                  <div className="w-full sm:w-48">
                    <label className="block text-[11px] font-bold text-blue-900 mb-1">
                      Período da Matriz
                    </label>
                    <select
                      required
                      value={periodoAlvoId}
                      onChange={(e) => setPeriodoAlvoId(e.target.value)}
                      className="w-full rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">Selecione o período...</option>
                      {matrizAtual.periodos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.numero}º Período ({p.nome})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-bold text-blue-900 mb-1">
                      Disciplina do Catálogo Institucional (RN05)
                    </label>
                    <select
                      required
                      value={disciplinaAlvoId}
                      onChange={(e) => setDisciplinaAlvoId(e.target.value)}
                      className="w-full rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">Selecione uma disciplina...</option>
                      {disciplinas.map((d) => (
                        <option key={d.id} value={d.id}>
                          [{d.codigo}] {d.nome} ({d.cargaHorariaTotal}h)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0"
                  >
                    + Vincular ao Período
                  </button>
                </form>

                {/* Lista de Períodos da Matriz */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matrizAtual.periodos.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                          <span className="font-extrabold text-xs text-slate-900">
                            {p.numero}º Período • {p.nome}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                            {p.disciplinas.length} disciplina(s)
                          </span>
                        </div>

                        {p.disciplinas.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-4 text-center">
                            Nenhuma disciplina vinculada a este período.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {p.disciplinas.map((dm) => (
                              <li
                                key={dm.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                              >
                                <div>
                                  <span className="font-black text-blue-700 mr-1.5">
                                    [{dm.disciplina.codigo}]
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {dm.disciplina.nome}
                                  </span>
                                  <span className="text-[10px] text-slate-500 ml-1.5">
                                    ({dm.disciplina.cargaHorariaTotal}h)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDesvincular(dm.id)}
                                  className="text-[10px] text-red-600 hover:underline font-bold shrink-0"
                                >
                                  Remover
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                Selecione um curso à esquerda ou crie uma matriz curricular para visualizar seus períodos.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ABA 2: CATÁLOGO COMPARTILHADO DE DISCIPLINAS */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCriarDisciplina}
            className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3"
          >
            <h3 className="text-sm font-extrabold text-slate-900">
              + Nova Disciplina no Catálogo (RF04)
            </h3>
            <p className="text-xs text-slate-500">
              Disciplinas cadastradas aqui ficam disponíveis para vínculo nas matrizes de qualquer curso (RN05).
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Código Único
              </label>
              <input
                type="text"
                required
                placeholder="Ex: COMP-IA01"
                value={discCodigo}
                onChange={(e) => setDiscCodigo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nome da Disciplina
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Aprendizado de Máquina"
                value={discNome}
                onChange={(e) => setDiscNome(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Carga Horária Semestral (horas)
              </label>
              <input
                type="number"
                required
                min={20}
                max={200}
                value={discCH}
                onChange={(e) => setDiscCH(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
            >
              Cadastrar Disciplina no Catálogo
            </button>
          </form>

          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900">
                Catálogo Institucional de Disciplinas ({disciplinas.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Disciplina</th>
                    <th className="py-3 px-4">CH Total</th>
                    <th className="py-3 px-4">Matrizes Onde é Utilizada (RN05)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {disciplinas.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-blue-700">
                        {d.codigo}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {d.nome}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">
                        {d.cargaHorariaTotal}h
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {d.matrizes.length === 0 ? (
                            <span className="text-slate-400 italic">
                              Não vinculada
                            </span>
                          ) : (
                            d.matrizes.map((m) => (
                              <span
                                key={m.id}
                                className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px]"
                              >
                                {m.periodoCurricular.matriz.curso.codigo} •{" "}
                                {m.periodoCurricular.numero}º Per.
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
