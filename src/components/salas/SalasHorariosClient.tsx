"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  criarSalaAction,
  alternarManutencaoSalaAction,
  excluirSalaAction,
  adicionarRestricaoSalaAction,
  removerRestricaoSalaAction,
} from "@/app/actions/grade-actions";

interface SalaItem {
  id: string;
  codigo: string;
  bloco: string;
  andar: string;
  capacidade: number;
  ativa: boolean;
  emManutencao: boolean;
  disponibilidades: {
    id: string;
    diaSemana: "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA" | "SABADO";
    horaInicio: string;
    horaFim: string;
    disponivel: boolean;
    motivo: string | null;
  }[];
  alocacoes: {
    id: string;
    diaSemana: string;
    horaInicio: string;
    horaFim: string;
    componente: {
      oferta: {
        turma: { codigo: string };
        disciplina: { nome: string };
      };
    };
  }[];
}

export default function SalasHorariosClient({
  salas,
  slotsManha,
  slotsNoite,
}: {
  salas: SalaItem[];
  slotsManha: { inicio: string; fim: string; label: string }[];
  slotsNoite: { inicio: string; fim: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [salaSelecionadaId, setSalaSelecionadaId] = useState<string>(
    salas[0]?.id ?? ""
  );
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);

  // Form Nova Sala (RF07)
  const [codigo, setCodigo] = useState("");
  const [bloco, setBloco] = useState("Bloco A");
  const [andar, setAndar] = useState("1º Andar");
  const [capacidade, setCapacidade] = useState(50);
  const [emManutencao, setEmManutencao] = useState(false);

  // Form Restrição de Horário (RN12)
  const [restDia, setRestDia] = useState<
    "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA"
  >("SEXTA");
  const [restInicio, setRestInicio] = useState("18:30");
  const [restFim, setRestFim] = useState("21:50");
  const [restMotivo, setRestMotivo] = useState("");

  const salaAtual =
    salas.find((s) => s.id === salaSelecionadaId) ?? salas[0] ?? null;

  const handleCriarSala = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await criarSalaAction({
        codigo,
        bloco,
        andar,
        capacidade: Number(capacidade),
        emManutencao,
      });
      if (!res.sucesso) {
        setFeedback({ tipo: "erro", msg: res.erro || "Erro ao criar sala." });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Sala ${codigo.toUpperCase()} cadastrada com sucesso!`,
        });
        setCodigo("");
        router.refresh();
      }
    });
  };

  const handleAlternarManutencao = (sala: SalaItem) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await alternarManutencaoSalaAction(
        sala.id,
        !sala.emManutencao
      );
      if (res.sucesso) {
        setFeedback({
          tipo: "ok",
          msg: !sala.emManutencao
            ? `Sala ${sala.codigo} colocada em MANUTENÇÃO (RN12).`
            : `Sala ${sala.codigo} liberada para uso normal.`,
        });
        router.refresh();
      }
    });
  };

  const handleExcluirSala = (sala: SalaItem) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await excluirSalaAction(sala.id);
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Não foi possível excluir a sala.",
        });
      } else {
        setFeedback({ tipo: "ok", msg: `Sala ${sala.codigo} removida.` });
        router.refresh();
      }
    });
  };

  const handleAdicionarRestricao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaAtual) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await adicionarRestricaoSalaAction({
        salaId: salaAtual.id,
        diaSemana: restDia,
        horaInicio: restInicio,
        horaFim: restFim,
        motivo: restMotivo || "Bloqueio de horário / limpeza / manutenção",
      });
      if (!res.sucesso) {
        setFeedback({
          tipo: "erro",
          msg: res.erro || "Erro ao registrar restrição.",
        });
      } else {
        setFeedback({
          tipo: "ok",
          msg: `Bloqueio de horário adicionado na sala ${salaAtual.codigo} (${restDia} ${restInicio}-${restFim}).`,
        });
        setRestMotivo("");
        router.refresh();
      }
    });
  };

  const handleRemoverRestricao = (id: string) => {
    setFeedback(null);
    startTransition(async () => {
      await removerRestricaoSalaAction(id);
      setFeedback({ tipo: "ok", msg: "Restrição de horário removida." });
      router.refresh();
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

      {/* Seção Superior: Configuração de Turnos e Faixas de Horário (RF08) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[10px] uppercase">
              Turno Manhã (RF08)
            </span>
            <span className="text-xs font-bold text-slate-600">
              Segunda a Sexta
            </span>
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">
            07:30 às 10:50 (4 Blocos de 50 min)
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {slotsManha.map((s) => (
              <span
                key={s.inicio}
                className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]"
              >
                {s.inicio} - {s.fim}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-black text-[10px] uppercase">
              Turno Noite (RF08)
            </span>
            <span className="text-xs font-bold text-slate-600">
              Segunda a Sexta
            </span>
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">
            18:30 às 21:50 (4 Blocos de 50 min)
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {slotsNoite.map((s) => (
              <span
                key={s.inicio}
                className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]"
              >
                {s.inicio} - {s.fim}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-teal-50/70 rounded-2xl border border-teal-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded bg-teal-200 text-teal-900 font-black text-[10px] uppercase">
              Sábado • Online / DOL (RN09)
            </span>
            <span className="text-xs font-bold text-teal-800">
              Zero Salas Físicas
            </span>
          </div>
          <h3 className="text-sm font-extrabold text-teal-950">
            Reservado para Componentes Remotos & DOL
          </h3>
          <p className="text-xs text-teal-800 mt-1.5 leading-relaxed">
            Não há aulas presenciais no campus aos sábados. O motor FET aloca automaticamente disciplinas DOL e a parte remota de disciplinas Híbridas no sábado sem consumir salas físicas.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda (4 cols): Cadastrar Sala + Lista de Salas */}
        <div className="lg:col-span-4 space-y-5">
          <form
            onSubmit={handleCriarSala}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3"
          >
            <h2 className="text-sm font-extrabold text-slate-900">
              + Cadastrar Nova Sala Física (RF07)
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Código da Sala
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: A201"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Capacidade Máx. (RN11)
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  max={300}
                  value={capacidade}
                  onChange={(e) => setCapacidade(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Bloco / Prédio
                </label>
                <input
                  type="text"
                  required
                  value={bloco}
                  onChange={(e) => setBloco(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Andar
                </label>
                <input
                  type="text"
                  required
                  value={andar}
                  onChange={(e) => setAndar(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={emManutencao}
                onChange={(e) => setEmManutencao(e.target.checked)}
                className="rounded border-slate-300"
              />
              Cadastrar inicialmente em manutenção (RN12)
            </label>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
            >
              Cadastrar Sala Física
            </button>
          </form>

          {/* Lista de Salas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              Salas do Campus ({salas.length})
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {salas.map((s) => {
                const selecionada = s.id === salaAtual?.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSalaSelecionadaId(s.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selecionada
                        ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-black text-xs">
                          Sala {s.codigo}
                        </span>
                        {s.emManutencao ? (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] uppercase">
                            Em Manutenção
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                            Disponível
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">
                        {s.capacidade} lug.
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
                      <span>
                        {s.bloco} • {s.andar}
                      </span>
                      <span>
                        {s.alocacoes.length} aula(s) •{" "}
                        {s.disponibilidades.length} restrição(ões)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna Direita (8 cols): Detalhes da Sala, Status de Manutenção, Restrições de Horário e Ocupação */}
        <div className="lg:col-span-8 space-y-5">
          {salaAtual ? (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-black text-sm">
                      Sala {salaAtual.codigo}
                    </span>
                    <h2 className="text-lg font-black text-slate-900">
                      {salaAtual.bloco} • {salaAtual.andar} (Capacidade:{" "}
                      {salaAtual.capacidade} lugares)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Gerencie bloqueios por horário (RN12), status de manutenção e visualize todas as turmas alocadas nesta sala.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAlternarManutencao(salaAtual)}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-colors ${
                      salaAtual.emManutencao
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}
                  >
                    {salaAtual.emManutencao
                      ? "✓ Liberar Sala da Manutenção"
                      : "⚠ Colocar em Manutenção (RN12)"}
                  </button>

                  <Link
                    href={`/grade?modo=sala&sala=${salaAtual.id}`}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    Ver Grade da Sala →
                  </Link>

                  {salaAtual.alocacoes.length === 0 && (
                    <button
                      type="button"
                      onClick={() => handleExcluirSala(salaAtual)}
                      className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>

              {/* Bloqueios de Horário da Sala (DisponibilidadeSala - RN12) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Janelas de Indisponibilidade / Restrições de Horário (RN12)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Caso a sala esteja reservada para limpeza técnica, evento ou manutenção parcial em determinado dia/horário, adicione a restrição abaixo. O motor FET e o validador bloquearão alocações nesse intervalo.
                  </p>
                </div>

                <form
                  onSubmit={handleAdicionarRestricao}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-3.5 rounded-xl border border-slate-200"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Dia da Semana
                    </label>
                    <select
                      value={restDia}
                      onChange={(e) =>
                        setRestDia(e.target.value as typeof restDia)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="SEGUNDA">Segunda-feira</option>
                      <option value="TERCA">Terça-feira</option>
                      <option value="QUARTA">Quarta-feira</option>
                      <option value="QUINTA">Quinta-feira</option>
                      <option value="SEXTA">Sexta-feira</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Início
                    </label>
                    <input
                      type="text"
                      value={restInicio}
                      onChange={(e) => setRestInicio(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Fim
                    </label>
                    <input
                      type="text"
                      value={restFim}
                      onChange={(e) => setRestFim(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Motivo da Indisponibilidade
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Manutenção Lab"
                      value={restMotivo}
                      onChange={(e) => setRestMotivo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                    >
                      + Bloquear
                    </button>
                  </div>
                </form>

                {salaAtual.disponibilidades.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhuma restrição de horário cadastrada para a Sala{" "}
                    {salaAtual.codigo}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {salaAtual.disponibilidades.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs"
                      >
                        <div>
                          <span className="font-black text-amber-900 mr-2">
                            {d.diaSemana} ({d.horaInicio} - {d.horaFim})
                          </span>
                          <span className="text-amber-800 font-semibold">
                            {d.motivo ?? "Indisponível"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoverRestricao(d.id)}
                          className="text-red-700 hover:underline font-bold text-[11px]"
                        >
                          Remover Bloqueio
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Aulas Alocadas nesta Sala */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Aulas Atualmente Alocadas na Sala {salaAtual.codigo} (
                    {salaAtual.alocacoes.length})
                  </h3>
                </div>
                {salaAtual.alocacoes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Nenhuma aula alocada nesta sala na proposta atual.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 text-xs">
                    {salaAtual.alocacoes.map((a) => (
                      <div
                        key={a.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div>
                          <span className="font-black text-blue-700 mr-2">
                            [{a.componente.oferta.turma.codigo}]
                          </span>
                          <span className="font-bold text-slate-900">
                            {a.componente.oferta.disciplina.nome}
                          </span>
                        </div>
                        <div className="font-bold text-slate-700">
                          {a.diaSemana} • {a.horaInicio} às {a.horaFim}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
