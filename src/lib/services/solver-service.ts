import { prisma } from "@/lib/prisma";
import { DiaSemana, TipoComponente, Turno } from "@prisma/client";
import { haSobreposicaoHorario } from "@/lib/conflicts";
import { validarPropostaDoBanco, RelatorioValidacaoProposta } from "@/lib/services/grade-service";

export interface JanelaHorario {
  qtdBlocos: number;
  horaInicio: string;
  horaFim: string;
}

export interface SlotGrade {
  id: number;
  horaInicio: string;
  horaFim: string;
  label: string;
}

export const SLOTS_MANHA: SlotGrade[] = [
  { id: 1, horaInicio: "07:30", horaFim: "08:20", label: "07:30 às 08:20" },
  { id: 2, horaInicio: "08:20", horaFim: "09:10", label: "08:20 às 09:10" },
  { id: 3, horaInicio: "09:10", horaFim: "10:00", label: "09:10 às 10:00" },
  { id: 4, horaInicio: "10:00", horaFim: "10:50", label: "10:00 às 10:50" },
];

export const SLOTS_NOITE: SlotGrade[] = [
  { id: 1, horaInicio: "18:30", horaFim: "19:20", label: "18:30 às 19:20" },
  { id: 2, horaInicio: "19:20", horaFim: "20:10", label: "19:20 às 20:10" },
  { id: 3, horaInicio: "20:10", horaFim: "21:00", label: "20:10 às 21:00" },
  { id: 4, horaInicio: "21:00", horaFim: "21:50", label: "21:00 às 21:50" },
];

// Janelas válidas de aula para o turno da manhã
export const JANELAS_MANHA: Record<number, JanelaHorario[]> = {
  1: [
    { qtdBlocos: 1, horaInicio: "07:30", horaFim: "08:20" },
    { qtdBlocos: 1, horaInicio: "08:20", horaFim: "09:10" },
    { qtdBlocos: 1, horaInicio: "09:10", horaFim: "10:00" },
    { qtdBlocos: 1, horaInicio: "10:00", horaFim: "10:50" },
  ],
  2: [
    { qtdBlocos: 2, horaInicio: "07:30", horaFim: "09:10" }, // 1º e 2º blocos
    { qtdBlocos: 2, horaInicio: "09:10", horaFim: "10:50" }, // 3º e 4º blocos
  ],
  3: [
    { qtdBlocos: 3, horaInicio: "07:30", horaFim: "10:00" }, // 1º, 2º e 3º blocos
    { qtdBlocos: 3, horaInicio: "08:20", horaFim: "10:50" }, // 2º, 3º e 4º blocos
  ],
  4: [
    { qtdBlocos: 4, horaInicio: "07:30", horaFim: "10:50" },
  ],
};

// Janelas válidas de aula para o turno da noite
export const JANELAS_NOITE: Record<number, JanelaHorario[]> = {
  1: [
    { qtdBlocos: 1, horaInicio: "18:30", horaFim: "19:20" },
    { qtdBlocos: 1, horaInicio: "19:20", horaFim: "20:10" },
    { qtdBlocos: 1, horaInicio: "20:10", horaFim: "21:00" },
    { qtdBlocos: 1, horaInicio: "21:00", horaFim: "21:50" },
  ],
  2: [
    { qtdBlocos: 2, horaInicio: "18:30", horaFim: "20:10" }, // 1º e 2º blocos
    { qtdBlocos: 2, horaInicio: "20:10", horaFim: "21:50" }, // 3º e 4º blocos
  ],
  3: [
    { qtdBlocos: 3, horaInicio: "19:20", horaFim: "21:50" }, // 2º, 3º e 4º blocos (padrão da grade de referência)
    { qtdBlocos: 3, horaInicio: "18:30", horaFim: "21:00" }, // 1º, 2º e 3º blocos
  ],
  4: [
    { qtdBlocos: 4, horaInicio: "18:30", horaFim: "21:50" },
  ],
};

export function getJanelasPorTurno(turno: Turno, qtdBlocos: number): JanelaHorario[] {
  const mapa = turno === Turno.MANHA ? JANELAS_MANHA : JANELAS_NOITE;
  return mapa[qtdBlocos] || mapa[2];
}

const DIAS_PRESENCIAIS: DiaSemana[] = [
  DiaSemana.SEGUNDA,
  DiaSemana.TERCA,
  DiaSemana.QUARTA,
  DiaSemana.QUINTA,
  DiaSemana.SEXTA,
];

export interface ResultadoGeracaoGrade {
  propostaId: string;
  propostaNome: string;
  resultado: "PROPOSTA_COMPLETA" | "PROPOSTA_PARCIAL" | "SEM_SOLUCAO";
  totalAtividades: number;
  totalAlocadas: number;
  atividadesNaoAlocadas: Array<{
    componenteId: string;
    disciplinaNome: string;
    turmaNome: string;
    motivo: string;
  }>;
  relatorioValidacao: RelatorioValidacaoProposta;
}

interface AlocacaoEmMemoria {
  componenteAulaId: string;
  salaId: string | null;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  turmaId: string;
}

/**
 * Algoritmo Heurístico de Ensalamento baseado nos princípios do FET:
 * - Suporta Turnos da Manhã e da Noite (RN04)
 * - Most Constrained First (atividades com mais blocos e turmas maiores primeiro)
 * - Best-Fit Room Allocation (minimiza o desperdício de assentos)
 * - Restrição estrita de Sábado (apenas online/DOL/remoto, sem alocação física)
 * - Restrições obrigatórias de choque de sala, choque de turma, manutenção e intervalos de indisponibilidade (RN10-RN12)
 */
export async function gerarPropostaGradeAutomatica(
  periodoLetivoId: string,
  nomeProposta?: string
): Promise<ResultadoGeracaoGrade> {
  const periodoLetivo = await prisma.periodoLetivo.findUnique({
    where: { id: periodoLetivoId },
  });

  if (!periodoLetivo) {
    throw new Error(`Período letivo ${periodoLetivoId} não encontrado.`);
  }

  // 1. Carregar todos os componentes de aula do período
  const todosComponentes = await prisma.componenteAula.findMany({
    where: {
      oferta: {
        periodoLetivoId: periodoLetivoId,
      },
    },
    include: {
      oferta: {
        include: {
          turma: true,
          disciplina: true,
        },
      },
    },
  });

  if (todosComponentes.length === 0) {
    throw new Error("Não há componentes de aula cadastrados para este período letivo.");
  }

  // 2. Carregar todas as salas ativas e não em manutenção, junto com regras de disponibilidade
  const salasDisponiveis = await prisma.sala.findMany({
    where: {
      ativo: true,
      emManutencao: false,
    },
    include: {
      disponibilidade: true,
    },
    orderBy: { capacidade: "asc" },
  });

  const alocacoesGeradas: AlocacaoEmMemoria[] = [];
  const atividadesNaoAlocadas: ResultadoGeracaoGrade["atividadesNaoAlocadas"] = [];

  // 3. Separar componentes remotos (DOL / EAD / parte remota de Híbrida) dos presenciais
  const componentesRemotos = todosComponentes.filter((c) => c.tipo === TipoComponente.REMOTO);
  const componentesPresenciais = todosComponentes.filter((c) => c.tipo === TipoComponente.PRESENCIAL);

  // 3.1 Alocar componentes DOL/Remotos automaticamente aos Sábados (Sem sala física)
  for (const comp of componentesRemotos) {
    alocacoesGeradas.push({
      componenteAulaId: comp.id,
      salaId: null, // SEM SALA FÍSICA NO CAMPUS!
      diaSemana: DiaSemana.SABADO,
      horaInicio: "08:00",
      horaFim: comp.qtdBlocos >= 3 ? "10:30" : "09:40",
      turmaId: comp.oferta.turma.id,
    });
  }

  // 4. Ordenação Heurística dos Presenciais (Most Constrained First)
  componentesPresenciais.sort((a, b) => {
    if (b.qtdBlocos !== a.qtdBlocos) {
      return b.qtdBlocos - a.qtdBlocos;
    }
    return b.oferta.turma.qtdAlunos - a.oferta.turma.qtdAlunos;
  });

  // 5. Motor de Ensalamento Guloso com Verificação de Conflitos
  for (const comp of componentesPresenciais) {
    const turma = comp.oferta.turma;
    const qtdBlocos = comp.qtdBlocos;
    const janelasPossiveis = getJanelasPorTurno(turma.turno, qtdBlocos);

    // Salas capazes de acomodar a turma (capacidade >= alunos)
    const salasCompativeis = salasDisponiveis.filter((s) => s.capacidade >= turma.qtdAlunos);

    if (salasCompativeis.length === 0) {
      const maiorCap = salasDisponiveis.length > 0 ? Math.max(...salasDisponiveis.map((s) => s.capacidade)) : 0;
      atividadesNaoAlocadas.push({
        componenteId: comp.id,
        disciplinaNome: comp.oferta.disciplina.nome,
        turmaNome: turma.codigo,
        motivo: `Capacidade insuficiente: a turma possui ${turma.qtdAlunos} alunos, mas a maior sala disponível comporta ${maiorCap} alunos.`,
      });
      continue;
    }

    // Heurística Best-Fit: salas com menor folga de capacidade primeiro
    salasCompativeis.sort((a, b) => {
      const folgaA = a.capacidade - turma.qtdAlunos;
      const folgaB = b.capacidade - turma.qtdAlunos;
      return folgaA - folgaB;
    });

    let alocadoComSucesso = false;

    // Iterar pelos dias úteis (Segunda a Sexta)
    for (const dia of DIAS_PRESENCIAIS) {
      if (alocadoComSucesso) break;

      for (const janela of janelasPossiveis) {
        if (alocadoComSucesso) break;

        // Verificar se a turma já tem aula neste dia e horário
        const turmaOcupada = alocacoesGeradas.some(
          (a) =>
            a.turmaId === turma.id &&
            a.diaSemana === dia &&
            haSobreposicaoHorario(a.horaInicio, a.horaFim, janela.horaInicio, janela.horaFim)
        );

        if (turmaOcupada) {
          continue;
        }

        // Tentar encontrar uma sala compatível que esteja livre e disponível no horário
        for (const sala of salasCompativeis) {
          // Verificar restrição de disponibilidade da sala (RN12)
          const restritaNoHorario = sala.disponibilidade.some(
            (d) =>
              !d.disponivel &&
              d.diaSemana === dia &&
              haSobreposicaoHorario(janela.horaInicio, janela.horaFim, d.horaInicio, d.horaFim)
          );
          if (restritaNoHorario) continue;

          const salaOcupada = alocacoesGeradas.some(
            (a) =>
              a.salaId === sala.id &&
              a.diaSemana === dia &&
              haSobreposicaoHorario(a.horaInicio, a.horaFim, janela.horaInicio, janela.horaFim)
          );

          if (!salaOcupada) {
            alocacoesGeradas.push({
              componenteAulaId: comp.id,
              salaId: sala.id,
              diaSemana: dia,
              horaInicio: janela.horaInicio,
              horaFim: janela.horaFim,
              turmaId: turma.id,
            });
            alocadoComSucesso = true;
            break;
          }
        }
      }
    }

    if (!alocadoComSucesso) {
      atividadesNaoAlocadas.push({
        componenteId: comp.id,
        disciplinaNome: comp.oferta.disciplina.nome,
        turmaNome: turma.codigo,
        motivo: `Sem combinação de horário e sala livre no turno ${turma.turno} para ${comp.qtdBlocos} blocos consecutivos.`,
      });
    }
  }

  // 6. Classificar Resultado
  let resultado: ResultadoGeracaoGrade["resultado"] = "PROPOSTA_COMPLETA";
  if (alocacoesGeradas.length === 0) {
    resultado = "SEM_SOLUCAO";
  } else if (atividadesNaoAlocadas.length > 0) {
    resultado = "PROPOSTA_PARCIAL";
  }

  // 7. Persistir a Proposta no Banco de Dados Supabase
  const nomeFinal =
    nomeProposta ||
    `Proposta Automática - ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const novaProposta = await prisma.propostaGrade.create({
    data: {
      periodoLetivoId: periodoLetivoId,
      nome: nomeFinal,
      status: "RASCUNHO",
      observacoes: `Gerada automaticamente pelo sistema de alocação. Resultado: ${resultado} (${alocacoesGeradas.length}/${todosComponentes.length} componentes alocados).`,
      alocacoes: {
        create: alocacoesGeradas.map((a) => ({
          componenteAulaId: a.componenteAulaId,
          salaId: a.salaId,
          diaSemana: a.diaSemana,
          horaInicio: a.horaInicio,
          horaFim: a.horaFim,
        })),
      },
    },
  });

  // 8. Executar validação rigorosa com o motor de regras
  const relatorioValidacao = await validarPropostaDoBanco(novaProposta.id);

  return {
    propostaId: novaProposta.id,
    propostaNome: novaProposta.nome,
    resultado,
    totalAtividades: todosComponentes.length,
    totalAlocadas: alocacoesGeradas.length,
    atividadesNaoAlocadas,
    relatorioValidacao,
  };
}
