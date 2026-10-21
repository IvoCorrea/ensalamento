"use server";

import { revalidatePath } from "next/cache";
import { gerarPropostaGradeAutomatica } from "@/lib/services/solver-service";
import { prisma } from "@/lib/prisma";
import { DiaSemana } from "@prisma/client";
import { validarCandidataAlocacao, AlocacaoParaValidacao } from "@/lib/conflicts";

export async function gerarGradeAutomaticaAction(periodoLetivoId: string, nomeProposta?: string) {
  try {
    const resultado = await gerarPropostaGradeAutomatica(periodoLetivoId, nomeProposta);
    try {
      revalidatePath("/");
    } catch {}
    return { success: true, data: resultado };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao gerar grade automática." };
  }
}

export async function confirmarGradeAction(propostaId: string) {
  try {
    const atualizada = await prisma.propostaGrade.update({
      where: { id: propostaId },
      data: { status: "CONFIRMADA" },
    });
    try {
      revalidatePath("/");
    } catch {}
    return { success: true, data: atualizada };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao confirmar grade." };
  }
}

export async function atualizarAlocacaoAction(dados: {
  alocacaoId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  salaId: string | null;
}) {
  try {
    const alocAtual = await prisma.alocacao.findUnique({
      where: { id: dados.alocacaoId },
      include: {
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
    });

    if (!alocAtual) {
      return { success: false, error: "Alocação não encontrada." };
    }

    // Carregar todas as alocações da proposta para verificar choques
    const todasAlocacoes = await prisma.alocacao.findMany({
      where: { propostaId: alocAtual.propostaId },
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
    });

    // Carregar a nova sala escolhida
    const novaSala = dados.salaId
      ? await prisma.sala.findUnique({ where: { id: dados.salaId } })
      : null;

    // Montar o objeto para o motor de validação (Passo 2)
    const candidata: AlocacaoParaValidacao = {
      id: alocAtual.id,
      salaId: dados.salaId,
      diaSemana: dados.diaSemana,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      componente: {
        id: alocAtual.componenteAula.id,
        tipo: alocAtual.componenteAula.tipo,
        oferta: {
          turmaId: alocAtual.componenteAula.oferta.turma.id,
          turmaNome: alocAtual.componenteAula.oferta.turma.codigo,
          qtdAlunos: alocAtual.componenteAula.oferta.turma.qtdAlunos,
          disciplinaNome: alocAtual.componenteAula.oferta.disciplina.nome,
        },
      },
      sala: novaSala
        ? {
            id: novaSala.id,
            codigo: novaSala.codigo,
            capacidade: novaSala.capacidade,
            emManutencao: novaSala.emManutencao,
            ativo: novaSala.ativo,
          }
        : null,
    };

    const outrasAlocacoes: AlocacaoParaValidacao[] = todasAlocacoes.map((a) => ({
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

    // Executar validação pré-voo (RN14 e RN15)
    const conflitos = validarCandidataAlocacao(candidata, outrasAlocacoes);
    const errosImpeditivos = conflitos.filter((c) => c.gravidade === "ERRO");

    if (errosImpeditivos.length > 0) {
      return {
        success: false,
        error: errosImpeditivos[0].mensagem,
        conflitos: errosImpeditivos,
      };
    }

    // Se passou na validação, salvar no banco de dados
    await prisma.alocacao.update({
      where: { id: dados.alocacaoId },
      data: {
        diaSemana: dados.diaSemana,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        salaId: dados.salaId,
      },
    });

    try {
      revalidatePath("/");
    } catch {
      // Ignora erro de revalidatePath fora de requisição HTTP (ex: testes)
    }

    return { success: true, message: "Alocação alterada com sucesso!" };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao atualizar alocação." };
  }
}
