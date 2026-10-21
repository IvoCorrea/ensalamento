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

// ==========================================
// CADASTROS RÁPIDOS (PASSO 6 DO MVP)
// ==========================================

export async function criarSalaAction(dados: {
  codigo: string;
  predio?: string;
  andar?: number;
  capacidade: number;
  emManutencao?: boolean;
}) {
  try {
    const salaExistente = await prisma.sala.findUnique({
      where: { codigo: dados.codigo },
    });

    if (salaExistente) {
      return { success: false, error: `Já existe uma sala cadastrada com o código "${dados.codigo}".` };
    }

    const novaSala = await prisma.sala.create({
      data: {
        codigo: dados.codigo,
        predio: dados.predio || null,
        andar: dados.andar || null,
        capacidade: Number(dados.capacidade),
        emManutencao: Boolean(dados.emManutencao),
        ativo: true,
      },
    });

    try {
      revalidatePath("/");
    } catch {}

    return { success: true, data: novaSala, message: `Sala "${novaSala.codigo}" cadastrada com sucesso!` };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao cadastrar sala." };
  }
}

export async function criarTurmaAction(dados: {
  cursoId: string;
  codigo: string;
  turno: "MANHA" | "NOITE";
  qtdAlunos: number;
}) {
  try {
    const novaTurma = await prisma.turma.create({
      data: {
        cursoId: dados.cursoId,
        codigo: dados.codigo,
        turno: dados.turno,
        qtdAlunos: Number(dados.qtdAlunos),
        ativo: true,
      },
    });

    try {
      revalidatePath("/");
    } catch {}

    return { success: true, data: novaTurma, message: `Turma "${novaTurma.codigo}" cadastrada com sucesso!` };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao cadastrar turma." };
  }
}

export async function criarDisciplinaEOfertaAction(dados: {
  codigo: string;
  nome: string;
  chTotal: number;
  modalidade: "PRESENCIAL" | "HIBRIDA" | "DOL" | "EAD";
  qtdBlocos: number;
  turmaId: string;
  periodoLetivoId: string;
}) {
  try {
    // Buscar ou criar disciplina
    let disciplina = await prisma.disciplina.findUnique({
      where: { codigo: dados.codigo },
    });

    if (!disciplina) {
      disciplina = await prisma.disciplina.create({
        data: {
          codigo: dados.codigo,
          nome: dados.nome,
          chTotal: Number(dados.chTotal),
          chPresencial: dados.modalidade === "DOL" || dados.modalidade === "EAD" ? 0 : Number(dados.chTotal),
          chRemota: dados.modalidade === "DOL" || dados.modalidade === "EAD" ? Number(dados.chTotal) : 0,
        },
      });
    }

    // Criar oferta para a turma
    const oferta = await prisma.ofertaDisciplina.create({
      data: {
        turmaId: dados.turmaId,
        disciplinaId: disciplina.id,
        periodoLetivoId: dados.periodoLetivoId,
        modalidade: dados.modalidade,
      },
    });

    // Criar componente de aula correspondente
    const componente = await prisma.componenteAula.create({
      data: {
        ofertaDisciplinaId: oferta.id,
        tipo: dados.modalidade === "DOL" || dados.modalidade === "EAD" ? "REMOTO" : "PRESENCIAL",
        qtdBlocos: Number(dados.qtdBlocos),
      },
    });

    try {
      revalidatePath("/");
    } catch {}

    return {
      success: true,
      message: `Disciplina "${disciplina.nome}" ofertada com sucesso para a turma!`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao cadastrar disciplina e oferta." };
  }
}
