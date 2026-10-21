import { getDadosSalasEHorarios } from "@/lib/services/grade-service";
import SalasHorariosClient from "@/components/salas/SalasHorariosClient";

export const dynamic = "force-dynamic";

export default async function SalasEHorariosPage() {
  const { salas, slotsManha, slotsNoite } = await getDadosSalasEHorarios();

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1500px] w-full mx-auto">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wide">
          Módulo 4 • RF07 e RF08
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
          Salas Físicas, Capacidades e Horários Disponíveis
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gerencie o inventário de salas de aula e laboratórios, capacidades máximas (RN11), bloqueios por manutenção ou janelas de indisponibilidade (RN12) e consulte as grades de horários dos turnos Manhã e Noite.
        </p>
      </header>

      <SalasHorariosClient
        salas={salas}
        slotsManha={slotsManha}
        slotsNoite={slotsNoite}
      />
    </main>
  );
}
