import { getDadosTurmasEOfertas } from "@/lib/services/grade-service";
import TurmasOfertasClient from "@/components/turmas/TurmasOfertasClient";

export const dynamic = "force-dynamic";

export default async function TurmasEOfertasPage({
  searchParams,
}: {
  searchParams: Promise<{ turma?: string }>;
}) {
  const params = await searchParams;
  const { turmas, cursos, disciplinas } = await getDadosTurmasEOfertas();

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1500px] w-full mx-auto">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wide">
          Módulo 3 • RF05 e RF06
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
          Gestão de Turmas e Ofertas por Modalidade
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Cadastre turmas nos turnos Manhã e Noite, estime o número de alunos (RN11), importe disciplinas previstas na matriz ou classifique ofertas em Presencial, Híbrida, DOL, EAD, Ubíqua e Notável Mestre.
        </p>
      </header>

      <TurmasOfertasClient
        turmas={turmas}
        cursos={cursos}
        disciplinas={disciplinas}
        turmaInicialId={params.turma}
      />
    </main>
  );
}
