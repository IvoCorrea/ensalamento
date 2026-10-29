import { getDadosCursosEMatrizes } from "@/lib/services/grade-service";
import CursosMatrizesClient from "@/components/cursos/CursosMatrizesClient";

export const dynamic = "force-dynamic";

export default async function CursosEMatrizesPage() {
  const { cursos, disciplinas } = await getDadosCursosEMatrizes();

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1500px] w-full mx-auto">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wide">
          Estrutura Curricular
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
          Cursos, Matrizes Curriculares e Catálogo de Disciplinas
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Cadastre cursos de graduação, estruture as matrizes curriculares por versão e período, e gerencie disciplinas compartilhadas entre cursos.
        </p>
      </header>

      <CursosMatrizesClient cursos={cursos} disciplinas={disciplinas} />
    </main>
  );
}
