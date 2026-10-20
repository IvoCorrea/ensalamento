import { prisma } from "@/lib/prisma";
import { validarGrade, AlocacaoParaValidacao, Conflito } from "@/lib/conflicts";
import { DiaSemana, TipoComponente } from "@prisma/client";

export interface RelatorioValidacaoProposta {
  propostaId: string;
  propostaNome: string;
  totalAlocacoes: number;
  totalComponentesOfertados: number;
  componentesNaoAlocados: Array<{
    componenteId: string;
    disciplinaNome: string;
    turmaNome: string;
    tipo: TipoComponente;
    qtdBlocos: number;
  }>;
  conflitos: Conflito[];
  statusGrade: "VALIDA_COMPLETA" | "VALIDA_PARCIAL" | "COM_CONFLITOS";
}

export async function validarPropostaDoBanco(propostaId: string): Promise<RelatorioValidacaoProposta> {
  const proposta = await prisma.propostaGrade.findUnique({
    where: { id: propostaId },
    include: {
      periodoLetivo: true,
      alocacoes: {
        include: {
          sala: true,
          componenteAula: {
            include: {
              oferta: {
                include: {
                  turma: true,
                  disciplina: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!proposta) {
    throw new Error(`Proposta de grade ${propostaId} não encontrada.`);
  }

  // Buscar todos os componentes que deveriam ser alocados no período letivo desta proposta
  const todosComponentes = await prisma.componenteAula.findMany({
    where: {
      oferta: {
        periodoLetivoId: proposta.periodoLetivoId,
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

  // Mapear alocações para o validador puro
  const alocacoesParaValidar: AlocacaoParaValidacao[] = proposta.alocacoes.map((a) => ({
    id: a.id,
    salaId: a.salaId,
    diaSemana: a.diaSemana,
    horaInicio: a.horaInicio,
    horaFim: a.horaFim,
    componente: {
      id: a.componenteAula.id,
      tipo: a.componenteAula.tipo,
      oferta: {
        turmaId: a.componenteAula.oferta.turma.id,
        turmaNome: a.componenteAula.oferta.turma.codigo,
        qtdAlunos: a.componenteAula.oferta.turma.qtdAlunos,
        disciplinaNome: a.componenteAula.oferta.disciplina.nome,
      },
    },
    sala: a.sala
      ? {
          id: a.sala.id,
          codigo: a.sala.codigo,
          capacidade: a.sala.capacidade,
          emManutencao: a.sala.emManutencao,
          ativo: a.sala.ativo,
        }
      : null,
  }));

  // Executa validação de regras de negócio
  const conflitos = validarGrade(alocacoesParaValidar);

  // Identificar componentes que ficaram sem nenhuma alocação
  const idsAlocados = new Set(proposta.alocacoes.map((a) => a.componenteAulaId));
  const componentesNaoAlocados = todosComponentes
    .filter((c) => !idsAlocados.has(c.id))
    .map((c) => ({
      componenteId: c.id,
      disciplinaNome: c.oferta.disciplina.nome,
      turmaNome: c.oferta.turma.codigo,
      tipo: c.tipo,
      qtdBlocos: c.qtdBlocos,
    }));

  let statusGrade: "VALIDA_COMPLETA" | "VALIDA_PARCIAL" | "COM_CONFLITOS" = "VALIDA_COMPLETA";

  if (conflitos.some((c) => c.gravidade === "ERRO")) {
    statusGrade = "COM_CONFLITOS";
  } else if (componentesNaoAlocados.length > 0) {
    statusGrade = "VALIDA_PARCIAL";
  }

  return {
    propostaId: proposta.id,
    propostaNome: proposta.nome,
    totalAlocacoes: proposta.alocacoes.length,
    totalComponentesOfertados: todosComponentes.length,
    componentesNaoAlocados,
    conflitos,
    statusGrade,
  };
}
