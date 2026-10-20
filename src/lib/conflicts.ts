import { DiaSemana, TipoComponente } from "@prisma/client";

export type TipoConflito =
  | "SALA_SOBREPOSTA"          // RN10: Duas atividades na mesma sala em horário sobreposto
  | "TURMA_SOBREPOSTA"         // Mesma turma com duas atividades no mesmo horário
  | "CAPACIDADE_INSUFICIENTE"  // RN11: Quantidade de alunos excede capacidade da sala
  | "SALA_EM_MANUTENCAO"       // RN12: Sala em manutenção ou inativa
  | "SABADO_COM_SALA_FISICA"   // Regra do Projeto: Aos sábados não há presencial no campus
  | "REMOTO_COM_SALA"          // RN09: Componente remoto ocupando sala física
  | "PRESENCIAL_SEM_SALA";     // RN09/RN13: Componente presencial sem sala de segunda a sexta

export interface Conflito {
  tipo: TipoConflito;
  gravidade: "ERRO" | "AVISO";
  mensagem: string;
  alocacaoIdA?: string;
  alocacaoIdB?: string;
  salaId?: string;
  turmaId?: string;
  diaSemana?: DiaSemana;
  horario?: string;
}

export interface AlocacaoParaValidacao {
  id?: string;
  salaId?: string | null;
  diaSemana: DiaSemana;
  horaInicio: string; // formato "HH:mm" (ex: "18:30")
  horaFim: string;    // formato "HH:mm" (ex: "20:10")
  componente: {
    id: string;
    tipo: TipoComponente;
    oferta: {
      turmaId: string;
      turmaNome: string;
      qtdAlunos: number;
      disciplinaNome: string;
    };
  };
  sala?: {
    id: string;
    codigo: string;
    capacidade: number;
    emManutencao: boolean;
    ativo: boolean;
  } | null;
}

/**
 * Converte string "HH:mm" para minutos a partir de 00:00
 */
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Verifica se dois intervalos de horário se sobrepõem.
 * [inicioA, fimA] e [inicioB, fimB]
 * Conflita se o início de um for estritamente anterior ao fim do outro em ambas as direções.
 */
export function haSobreposicaoHorario(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string
): boolean {
  const minInicioA = horaParaMinutos(inicioA);
  const minFimA = horaParaMinutos(fimA);
  const minInicioB = horaParaMinutos(inicioB);
  const minFimB = horaParaMinutos(fimB);

  return Math.max(minInicioA, minInicioB) < Math.min(minFimA, minFimB);
}

/**
 * Validador completo de uma grade de alocações (RN09 a RN15).
 */
export function validarGrade(alocacoes: AlocacaoParaValidacao[]): Conflito[] {
  const conflitos: Conflito[] = [];

  for (let i = 0; i < alocacoes.length; i++) {
    const a = alocacoes[i];

    // Regra 1: Sábado não pode ter alocação de sala física
    if (a.diaSemana === DiaSemana.SABADO && a.salaId) {
      conflitos.push({
        tipo: "SABADO_COM_SALA_FISICA",
        gravidade: "ERRO",
        mensagem: `Aos sábados não são permitidas aulas presenciais com alocação física no campus. Disciplina: "${a.componente.oferta.disciplinaNome}".`,
        alocacaoIdA: a.id,
        diaSemana: a.diaSemana,
        horario: `${a.horaInicio} - ${a.horaFim}`,
      });
    }

    // Regra 2 (RN09): Componente REMOTO não pode ocupar sala física
    if (a.componente.tipo === TipoComponente.REMOTO && a.salaId) {
      conflitos.push({
        tipo: "REMOTO_COM_SALA",
        gravidade: "ERRO",
        mensagem: `A disciplina "${a.componente.oferta.disciplinaNome}" é remota/DOL e não deve ocupar sala física.`,
        alocacaoIdA: a.id,
        salaId: a.salaId,
      });
    }

    // Regra 3 (RN13): Componente PRESENCIAL de Seg a Sex exige sala física
    if (
      a.componente.tipo === TipoComponente.PRESENCIAL &&
      a.diaSemana !== DiaSemana.SABADO &&
      !a.salaId
    ) {
      conflitos.push({
        tipo: "PRESENCIAL_SEM_SALA",
        gravidade: "ERRO",
        mensagem: `A disciplina presencial "${a.componente.oferta.disciplinaNome}" (${a.componente.oferta.turmaNome}) está sem sala alocada em ${a.diaSemana}.`,
        alocacaoIdA: a.id,
        diaSemana: a.diaSemana,
        horario: `${a.horaInicio} - ${a.horaFim}`,
      });
    }

    // Validações da Sala (quando há sala alocada)
    if (a.sala) {
      // Regra 4 (RN12): Sala em manutenção ou inativa
      if (a.sala.emManutencao || !a.sala.ativo) {
        conflitos.push({
          tipo: "SALA_EM_MANUTENCAO",
          gravidade: "ERRO",
          mensagem: `A sala "${a.sala.codigo}" está em manutenção ou inativa e não pode receber a turma "${a.componente.oferta.turmaNome}".`,
          alocacaoIdA: a.id,
          salaId: a.sala.id,
        });
      }

      // Regra 5 (RN11): Capacidade da sala insuficiente para a turma
      if (a.sala.capacidade < a.componente.oferta.qtdAlunos) {
        conflitos.push({
          tipo: "CAPACIDADE_INSUFICIENTE",
          gravidade: "ERRO",
          mensagem: `Capacidade insuficiente: a sala "${a.sala.codigo}" comporta ${a.sala.capacidade} alunos, mas a turma "${a.componente.oferta.turmaNome}" possui ${a.componente.oferta.qtdAlunos} alunos.`,
          alocacaoIdA: a.id,
          salaId: a.sala.id,
          turmaId: a.componente.oferta.turmaId,
        });
      }
    }

    // Comparações par a par para detectar sobreposições
    for (let j = i + 1; j < alocacoes.length; j++) {
      const b = alocacoes[j];

      // Só há choque se for no mesmo dia da semana
      if (a.diaSemana !== b.diaSemana) continue;

      // E se houver sobreposição nos intervalos de horário
      if (!haSobreposicaoHorario(a.horaInicio, a.horaFim, b.horaInicio, b.horaFim)) {
        continue;
      }

      // Regra 6 (RN10): Duas turmas/atividades usando a MESMA sala física no mesmo dia e horário
      if (a.salaId && b.salaId && a.salaId === b.salaId) {
        conflitos.push({
          tipo: "SALA_SOBREPOSTA",
          gravidade: "ERRO",
          mensagem: `Choque de sala: a sala "${a.sala?.codigo || a.salaId}" foi alocada simultaneamente para "${a.componente.oferta.disciplinaNome}" (${a.componente.oferta.turmaNome}) e "${b.componente.oferta.disciplinaNome}" (${b.componente.oferta.turmaNome}) na ${a.diaSemana} entre ${a.horaInicio}-${a.horaFim} e ${b.horaInicio}-${b.horaFim}.`,
          alocacaoIdA: a.id,
          alocacaoIdB: b.id,
          salaId: a.salaId,
          diaSemana: a.diaSemana,
          horario: `${a.horaInicio} - ${a.horaFim}`,
        });
      }

      // Regra 7: A MESMA turma com duas atividades simultâneas no mesmo horário
      if (a.componente.oferta.turmaId === b.componente.oferta.turmaId) {
        conflitos.push({
          tipo: "TURMA_SOBREPOSTA",
          gravidade: "ERRO",
          mensagem: `Choque de turma: a turma "${a.componente.oferta.turmaNome}" possui duas aulas simultâneas ("${a.componente.oferta.disciplinaNome}" e "${b.componente.oferta.disciplinaNome}") na ${a.diaSemana}.`,
          alocacaoIdA: a.id,
          alocacaoIdB: b.id,
          turmaId: a.componente.oferta.turmaId,
          diaSemana: a.diaSemana,
        });
      }
    }
  }

  return conflitos;
}

/**
 * Validação pré-voo (pre-flight) para testar se uma nova alocação ou movimentação é válida
 * antes de salvar no banco de dados.
 */
export function validarCandidataAlocacao(
  candidata: AlocacaoParaValidacao,
  alocacoesExistentes: AlocacaoParaValidacao[]
): Conflito[] {
  // Filtra para ignorar a própria alocação caso seja uma edição
  const lista = alocacoesExistentes.filter((x) => x.id !== candidata.id);
  lista.push(candidata);
  return validarGrade(lista);
}
