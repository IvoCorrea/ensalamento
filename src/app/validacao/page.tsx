import { getDadosGradeCompleta } from "@/lib/services/grade-service";
import ValidacaoPropostaClient from "@/components/validacao/ValidacaoPropostaClient";

export const dynamic = "force-dynamic";

export default async function ValidacaoDaPropostaPage({
  searchParams,
}: {
  searchParams: Promise<{ proposta?: string }>;
}) {
  const params = await searchParams;
  const data = await getDadosGradeCompleta(params.proposta);

  // Calcula quantas salas ativas suportam a capacidade de cada turma para diagnóstico RF13
  const totalSalasCapazesPorTurma: Record<string, number> = {};
  for (const t of data.turmas) {
    totalSalasCapazesPorTurma[t.codigo] = data.salas.filter(
      (s) => !s.emManutencao && s.capacidade >= t.qtdAlunos
    ).length;
  }

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1500px] w-full mx-auto">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wide">
          Módulo 6 • RF10, RF13, RF14 e RN14
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
          Auditoria, Validação de Conflitos e Confirmação da Proposta
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Inspecione a conformidade da proposta de grade com todas as regras de negócio (RN09 a RN15), diagnostique atividades não alocadas e oficialize a grade do semestre.
        </p>
      </header>

      <ValidacaoPropostaClient
        propostaAtual={data.propostaAtual}
        propostas={data.propostas}
        validacao={data.validacao}
        componentesNaoAlocados={data.componentesNaoAlocados}
        totalSalasCapazesPorTurma={totalSalasCapazesPorTurma}
      />
    </main>
  );
}
