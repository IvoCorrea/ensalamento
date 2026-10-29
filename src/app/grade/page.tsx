import { getDadosGradeCompleta } from "@/lib/services/grade-service";
import GradeAlocacaoClient from "@/components/grade/GradeAlocacaoClient";

export const dynamic = "force-dynamic";

export default async function GradeEAlocacaoPage({
  searchParams,
}: {
  searchParams: Promise<{
    proposta?: string;
    turma?: string;
    modo?: string;
    sala?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getDadosGradeCompleta(params.proposta);

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1550px] w-full mx-auto">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wide">
          Grade e Ensalamento
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
          Grade Semanal Multi-Turma e Alocação de Salas
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Visualize a grade horária de qualquer turma (Manhã ou Noite), inspecione a ocupação por sala física ou mapa diário, gere propostas automáticas e realize ajustes manuais com validação em tempo real.
        </p>
      </header>

      <GradeAlocacaoClient
        propostaAtual={data.propostaAtual}
        propostas={data.propostas}
        turmas={data.turmas}
        salas={data.salas}
        alocacoes={data.alocacoes}
        componentesNaoAlocados={data.componentesNaoAlocados}
        validacao={data.validacao}
        slotsManha={data.slotsManha}
        slotsNoite={data.slotsNoite}
        turmaInicialCodigo={params.turma}
        modoInicial={params.modo}
        salaInicialId={params.sala}
      />
    </main>
  );
}
