"use server";

import { revalidatePath } from "next/cache";
import { gerarPropostaGradeAutomatica } from "@/lib/services/solver-service";
import { validarPropostaDoBanco } from "@/lib/services/grade-service";
import { prisma } from "@/lib/prisma";
import {
  DiaSemana,
  ModalidadeOferta,
  StatusProposta,
  TipoComponente,
  Turno,
} from "@prisma/client";
import {
  validarCandidataAlocacao,
  AlocacaoParaValidacao,
} from "@/lib/conflicts";

function safeRevalidate() {
  try {
    revalidatePath("/");
    revalidatePath("/cursos");
    revalidatePath("/turmas");
    revalidatePath("/salas");
    revalidatePath("/grade");
    revalidatePath("/validacao");
  } catch {
    // Ignora fora do contexto HTTP (ex: scripts de teste)
  }
}

async function obterPeriodoLetivoPadraoId(): Promise<string> {
  const pl = await prisma.periodoLetivo.findFirst({
    orderBy: { codigo: "desc" },
  });
  if (pl) return pl.id;
  const novo = await prisma.periodoLetivo.create({
    data: { codigo: "2026.1", nome: "Primeiro Semestre 2026", ativo: true },
  });
  return novo.id;
}

// =========================================================
// 1. AÇÕES DE GERAÇÃO, ALOCAÇÃO E PROPOSTAS (RN09 - RN17)
// =========================================================

export async function gerarGradeAutomaticaAction(
  periodoLetivoId?: string,
  nomeProposta?: string
) {
  try {
    const plId = periodoLetivoId || (await obterPeriodoLetivoPadraoId());
    const resultado = await gerarPropostaGradeAutomatica(plId, nomeProposta);
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: resultado,
      propostaId: resultado.propostaId,
      totalAlocados: resultado.totalAlocadas,
      totalConflitos: resultado.relatorioValidacao.conflitos.length,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao gerar grade automática.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function gerarNovaPropostaAutomaticaAction() {
  return gerarGradeAutomaticaAction();
}

export async function confirmarGradeAction(propostaId: string) {
  return alterarStatusPropostaAction({ propostaId, novoStatus: "CONFIRMADA" });
}

export async function alterarStatusPropostaAction(dados: {
  propostaId: string;
  novoStatus: StatusProposta;
}) {
  try {
    // RN14: O sistema deve impedir a confirmação de uma alocação que viole uma regra obrigatória
    if (dados.novoStatus === "CONFIRMADA") {
      const validacao = await validarPropostaDoBanco(dados.propostaId);
      const erros = validacao.conflitos.filter((c) => c.gravidade === "ERRO");
      if (erros.length > 0) {
        const msg = `RN14: Não é possível confirmar a proposta pois existem ${erros.length} violação(ões) obrigatória(s): ${erros[0].mensagem}`;
        return {
          success: false,
          sucesso: false,
          error: msg,
          erro: msg,
        };
      }
    }

    const atualizada = await prisma.propostaGrade.update({
      where: { id: dados.propostaId },
      data: { status: dados.novoStatus },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: atualizada,
      message: `Status da proposta atualizado para ${dados.novoStatus}!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao alterar status da proposta.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function atualizarStatusPropostaAction(dados: {
  propostaId: string;
  novoStatus: StatusProposta;
}) {
  return alterarStatusPropostaAction(dados);
}

export async function excluirPropostaAction(propostaId: string) {
  try {
    await prisma.propostaGrade.delete({
      where: { id: propostaId },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Proposta excluída com sucesso.",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao excluir proposta.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function criarAlocacaoManualAction(dados: {
  propostaId: string;
  componenteAulaId?: string;
  componenteId?: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  salaId: string | null;
  forcarMesmoComConflito?: boolean;
}) {
  try {
    const compId = dados.componenteAulaId || dados.componenteId;
    if (!compId) {
      return {
        success: false,
        sucesso: false,
        error: "ID do componente não informado.",
        erro: "ID do componente não informado.",
      };
    }

    const componente = await prisma.componenteAula.findUnique({
      where: { id: compId },
      include: {
        oferta: {
          include: {
            turma: true,
            disciplina: true,
          },
        },
      },
    });

    if (!componente) {
      return {
        success: false,
        sucesso: false,
        error: "Componente de aula não encontrado.",
        erro: "Componente de aula não encontrado.",
      };
    }

    const todasAlocacoes = await prisma.alocacao.findMany({
      where: { propostaId: dados.propostaId },
      include: {
        sala: { include: { disponibilidade: true } },
        componenteAula: {
          include: {
            oferta: {
              include: { turma: true, disciplina: true },
            },
          },
        },
      },
    });

    const salaEscolhida = dados.salaId
      ? await prisma.sala.findUnique({
          where: { id: dados.salaId },
          include: { disponibilidade: true },
        })
      : null;

    const candidata: AlocacaoParaValidacao = {
      id: "nova-alocacao-temp",
      salaId: dados.salaId,
      diaSemana: dados.diaSemana,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      componente: {
        id: componente.id,
        tipo: componente.tipo,
        oferta: {
          turmaId: componente.oferta.turma.id,
          turmaNome: componente.oferta.turma.codigo,
          qtdAlunos: componente.oferta.turma.qtdAlunos,
          disciplinaNome: componente.oferta.disciplina.nome,
        },
      },
      sala: salaEscolhida
        ? {
            id: salaEscolhida.id,
            codigo: salaEscolhida.codigo,
            capacidade: salaEscolhida.capacidade,
            emManutencao: salaEscolhida.emManutencao,
            ativo: salaEscolhida.ativo,
            disponibilidade: salaEscolhida.disponibilidade,
          }
        : null,
    };

    const existentes: AlocacaoParaValidacao[] = todasAlocacoes.map((a) => ({
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
            disponibilidade: a.sala.disponibilidade,
          }
        : null,
    }));

    const conflitos = validarCandidataAlocacao(candidata, existentes);
    const erros = conflitos.filter((c) => c.gravidade === "ERRO");

    if (erros.length > 0 && !dados.forcarMesmoComConflito) {
      return {
        success: false,
        sucesso: false,
        error: erros[0].mensagem,
        erro: erros[0].mensagem,
        conflitos: erros,
      };
    }

    await prisma.alocacao.create({
      data: {
        propostaId: dados.propostaId,
        componenteAulaId: compId,
        diaSemana: dados.diaSemana,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        salaId: dados.salaId,
      },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Atividade alocada com sucesso na grade!",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao criar alocação.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function atualizarAlocacaoAction(dados: {
  alocacaoId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  salaId: string | null;
  forcarMesmoComConflito?: boolean;
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
      return {
        success: false,
        sucesso: false,
        error: "Alocação não encontrada.",
        erro: "Alocação não encontrada.",
      };
    }

    const todasAlocacoes = await prisma.alocacao.findMany({
      where: { propostaId: alocAtual.propostaId },
      include: {
        sala: { include: { disponibilidade: true } },
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

    const novaSala = dados.salaId
      ? await prisma.sala.findUnique({
          where: { id: dados.salaId },
          include: { disponibilidade: true },
        })
      : null;

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
            disponibilidade: novaSala.disponibilidade,
          }
        : null,
    };

    const outrasAlocacoes: AlocacaoParaValidacao[] = todasAlocacoes.map(
      (a) => ({
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
              disponibilidade: a.sala.disponibilidade,
            }
          : null,
      })
    );

    const conflitos = validarCandidataAlocacao(candidata, outrasAlocacoes);
    const errosImpeditivos = conflitos.filter((c) => c.gravidade === "ERRO");

    if (errosImpeditivos.length > 0 && !dados.forcarMesmoComConflito) {
      return {
        success: false,
        sucesso: false,
        error: errosImpeditivos[0].mensagem,
        erro: errosImpeditivos[0].mensagem,
        conflitos: errosImpeditivos,
      };
    }

    await prisma.alocacao.update({
      where: { id: dados.alocacaoId },
      data: {
        diaSemana: dados.diaSemana,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        salaId: dados.salaId,
      },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Alocação alterada com sucesso!",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao atualizar alocação.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function atualizarAlocacaoManualAction(dados: {
  alocacaoId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  salaId: string | null;
  forcarMesmoComConflito?: boolean;
}) {
  return atualizarAlocacaoAction(dados);
}

export async function removerAlocacaoAction(alocacaoId: string) {
  try {
    await prisma.alocacao.delete({
      where: { id: alocacaoId },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Alocação removida da grade.",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao remover alocação.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

// =========================================================
// 2. AÇÕES DE CURSOS, MATRIZES E DISCIPLINAS (RF01 - RF04)
// =========================================================

export async function criarCursoAction(dados: {
  codigo: string;
  nome: string;
  versaoMatrizInicial?: string;
  qtdPeriodos?: number;
}) {
  try {
    const existente = await prisma.curso.findUnique({
      where: { codigo: dados.codigo.toUpperCase().trim() },
    });
    if (existente) {
      const msg = `Já existe um curso com o código "${dados.codigo}".`;
      return { success: false, sucesso: false, error: msg, erro: msg };
    }

    const qtdPeriodos = dados.qtdPeriodos || 8;
    const versao = dados.versaoMatrizInicial || "2026.1";

    const novoCurso = await prisma.curso.create({
      data: {
        codigo: dados.codigo.toUpperCase().trim(),
        nome: dados.nome.trim(),
        ativo: true,
        matrizes: {
          create: {
            versao,
            ativo: true,
            periodos: {
              create: Array.from({ length: qtdPeriodos }, (_, idx) => ({
                numero: idx + 1,
              })),
            },
          },
        },
      },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      cursoId: novoCurso.id,
      data: novoCurso,
      message: `Curso "${novoCurso.nome}" e matriz ${versao} criados com sucesso!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao criar curso.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function excluirCursoAction(cursoId: string) {
  try {
    await prisma.curso.delete({ where: { id: cursoId } });
    safeRevalidate();
    return { success: true, sucesso: true };
  } catch (error: any) {
    const msg =
      error.message ||
      "Não é possível excluir um curso que possui turmas vinculadas.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function criarMatrizCurricularAction(dados: {
  cursoId: string;
  nome?: string;
  versao: string;
  qtdPeriodos: number;
}) {
  try {
    const matriz = await prisma.matrizCurricular.create({
      data: {
        cursoId: dados.cursoId,
        versao: dados.versao,
        ativo: true,
        periodos: {
          create: Array.from(
            { length: Number(dados.qtdPeriodos) || 8 },
            (_, idx) => ({
              numero: idx + 1,
            })
          ),
        },
      },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: matriz,
      message: `Matriz "${matriz.versao}" criada com ${dados.qtdPeriodos} períodos!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao criar matriz curricular.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function criarDisciplinaCatalogoAction(dados: {
  codigo: string;
  nome: string;
  chTotal: number;
  chPresencial?: number;
  chRemota?: number;
  periodoCurricularId?: string;
}) {
  try {
    const codigoFormatado = dados.codigo.toUpperCase().trim();
    let disc = await prisma.disciplina.findUnique({
      where: { codigo: codigoFormatado },
    });

    if (!disc) {
      disc = await prisma.disciplina.create({
        data: {
          codigo: codigoFormatado,
          nome: dados.nome.trim(),
          chTotal: Number(dados.chTotal),
          chPresencial:
            dados.chPresencial !== undefined
              ? Number(dados.chPresencial)
              : Number(dados.chTotal),
          chRemota:
            dados.chRemota !== undefined ? Number(dados.chRemota) : 0,
        },
      });
    }

    if (dados.periodoCurricularId) {
      await prisma.disciplinaMatriz.upsert({
        where: {
          periodoCurricularId_disciplinaId: {
            periodoCurricularId: dados.periodoCurricularId,
            disciplinaId: disc.id,
          },
        },
        update: {},
        create: {
          periodoCurricularId: dados.periodoCurricularId,
          disciplinaId: disc.id,
        },
      });
    }

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: disc,
      message: `Disciplina "${disc.nome}" registrada com sucesso!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao cadastrar disciplina.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function criarDisciplinaAction(dados: {
  codigo: string;
  nome: string;
  cargaHorariaTotal: number;
}) {
  return criarDisciplinaCatalogoAction({
    codigo: dados.codigo,
    nome: dados.nome,
    chTotal: dados.cargaHorariaTotal,
  });
}

export async function vincularDisciplinaMatrizAction(dados: {
  periodoCurricularId: string;
  disciplinaId: string;
  obrigatoria?: boolean;
}) {
  try {
    await prisma.disciplinaMatriz.create({
      data: {
        periodoCurricularId: dados.periodoCurricularId,
        disciplinaId: dados.disciplinaId,
      },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Disciplina vinculada ao período da matriz com sucesso!",
    };
  } catch {
    const msg = "Esta disciplina já está vinculada a este período.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function desvincularDisciplinaMatrizAction(
  disciplinaMatrizId: string
) {
  try {
    await prisma.disciplinaMatriz.delete({
      where: { id: disciplinaMatrizId },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Vínculo removido da matriz.",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao remover vínculo.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

// =========================================================
// 3. AÇÕES DE TURMAS E OFERTAS (RF05, RF06)
// =========================================================

export async function criarTurmaAction(dados: {
  cursoId: string;
  periodoCurricularId?: string | null;
  codigo: string;
  turno: "MANHA" | "NOITE";
  qtdAlunos: number;
}) {
  try {
    const novaTurma = await prisma.turma.create({
      data: {
        cursoId: dados.cursoId,
        periodoCurricularId: dados.periodoCurricularId || null,
        codigo: dados.codigo.toUpperCase().trim(),
        turno: dados.turno,
        qtdAlunos: Number(dados.qtdAlunos),
        ativo: true,
      },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      turmaId: novaTurma.id,
      data: novaTurma,
      message: `Turma "${novaTurma.codigo}" cadastrada com sucesso!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao cadastrar turma.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function atualizarTurmaAction(dados: {
  turmaId: string;
  codigo?: string;
  turno: Turno;
  qtdAlunos: number;
  periodoCurricularId?: string | null;
}) {
  try {
    const atualizada = await prisma.turma.update({
      where: { id: dados.turmaId },
      data: {
        ...(dados.codigo ? { codigo: dados.codigo.toUpperCase().trim() } : {}),
        turno: dados.turno,
        qtdAlunos: Number(dados.qtdAlunos),
        ...(dados.periodoCurricularId !== undefined
          ? { periodoCurricularId: dados.periodoCurricularId || null }
          : {}),
      },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: atualizada,
      message: `Turma "${atualizada.codigo}" atualizada!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao atualizar turma.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function excluirTurmaAction(turmaId: string) {
  try {
    await prisma.turma.delete({
      where: { id: turmaId },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Turma excluída com sucesso.",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao excluir turma.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function importarOfertasDaMatrizAction(
  entrada: string | { turmaId: string; periodoLetivoId?: string }
) {
  try {
    const turmaId = typeof entrada === "string" ? entrada : entrada.turmaId;
    const periodoLetivoId =
      (typeof entrada === "object" && entrada.periodoLetivoId) ||
      (await obterPeriodoLetivoPadraoId());

    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      include: {
        periodoCurricular: {
          include: {
            disciplinas: {
              include: { disciplina: true },
            },
          },
        },
      },
    });

    if (!turma || !turma.periodoCurricular) {
      const msg =
        "Esta turma não possui um período curricular vinculado para importar da matriz.";
      return { success: false, sucesso: false, error: msg, erro: msg };
    }

    const disciplinasDaMatriz = turma.periodoCurricular.disciplinas;
    if (disciplinasDaMatriz.length === 0) {
      const msg =
        "O período curricular vinculado não possui disciplinas cadastradas na matriz.";
      return { success: false, sucesso: false, error: msg, erro: msg };
    }

    let importadas = 0;
    for (const dm of disciplinasDaMatriz) {
      const d = dm.disciplina;
      const jaOfertada = await prisma.ofertaDisciplina.findUnique({
        where: {
          turmaId_disciplinaId_periodoLetivoId: {
            turmaId: turma.id,
            disciplinaId: d.id,
            periodoLetivoId,
          },
        },
      });

      if (jaOfertada) continue;

      let modalidade: ModalidadeOferta = "PRESENCIAL";
      if (d.chPresencial === 0 && d.chRemota > 0) {
        modalidade = "DOL";
      } else if (d.chPresencial > 0 && d.chRemota > 0) {
        modalidade = "HIBRIDA";
      }

      const oferta = await prisma.ofertaDisciplina.create({
        data: {
          turmaId: turma.id,
          disciplinaId: d.id,
          periodoLetivoId,
          modalidade,
        },
      });

      if (modalidade === "DOL") {
        await prisma.componenteAula.create({
          data: {
            ofertaDisciplinaId: oferta.id,
            tipo: "REMOTO",
            qtdBlocos: d.chTotal >= 60 ? 3 : 2,
          },
        });
      } else if (modalidade === "HIBRIDA") {
        await prisma.componenteAula.createMany({
          data: [
            {
              ofertaDisciplinaId: oferta.id,
              tipo: "PRESENCIAL",
              qtdBlocos: 2,
            },
            {
              ofertaDisciplinaId: oferta.id,
              tipo: "REMOTO",
              qtdBlocos: 1,
            },
          ],
        });
      } else {
        await prisma.componenteAula.create({
          data: {
            ofertaDisciplinaId: oferta.id,
            tipo: "PRESENCIAL",
            qtdBlocos: d.chTotal >= 60 ? 3 : 2,
          },
        });
      }

      importadas++;
    }

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      criadas: importadas,
      message: `${importadas} disciplina(s) importada(s) da matriz curricular para a turma ${turma.codigo}!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao importar disciplinas da matriz.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function criarOfertaDisciplinaAction(dados: {
  turmaId: string;
  disciplinaId: string;
  modalidade: ModalidadeOferta;
  blocosPresenciais?: number;
  blocosRemotos?: number;
  periodoLetivoId?: string;
}) {
  try {
    const periodoLetivoId =
      dados.periodoLetivoId || (await obterPeriodoLetivoPadraoId());

    const existente = await prisma.ofertaDisciplina.findUnique({
      where: {
        turmaId_disciplinaId_periodoLetivoId: {
          turmaId: dados.turmaId,
          disciplinaId: dados.disciplinaId,
          periodoLetivoId,
        },
      },
    });

    if (existente) {
      const msg =
        "Esta disciplina já está ofertada nesta turma no período letivo atual.";
      return { success: false, sucesso: false, error: msg, erro: msg };
    }

    const oferta = await prisma.ofertaDisciplina.create({
      data: {
        turmaId: dados.turmaId,
        disciplinaId: dados.disciplinaId,
        periodoLetivoId,
        modalidade: dados.modalidade,
      },
    });

    if (
      dados.modalidade === "PRESENCIAL" ||
      dados.modalidade === "NOTAVEL_MESTRE"
    ) {
      await prisma.componenteAula.create({
        data: {
          ofertaDisciplinaId: oferta.id,
          tipo: "PRESENCIAL",
          qtdBlocos: Number(dados.blocosPresenciais) || 2,
        },
      });
    } else if (dados.modalidade === "HIBRIDA") {
      await prisma.componenteAula.createMany({
        data: [
          {
            ofertaDisciplinaId: oferta.id,
            tipo: "PRESENCIAL",
            qtdBlocos: Number(dados.blocosPresenciais) || 2,
          },
          {
            ofertaDisciplinaId: oferta.id,
            tipo: "REMOTO",
            qtdBlocos: Number(dados.blocosRemotos) || 2,
          },
        ],
      });
    } else {
      await prisma.componenteAula.create({
        data: {
          ofertaDisciplinaId: oferta.id,
          tipo: "REMOTO",
          qtdBlocos: Number(dados.blocosRemotos) || 2,
        },
      });
    }

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: oferta,
      message: "Disciplina ofertada com sucesso!",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao criar oferta.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function criarDisciplinaEOfertaAction(dados: {
  codigo: string;
  nome: string;
  chTotal: number;
  modalidade: ModalidadeOferta;
  qtdBlocos: number;
  qtdBlocosRemoto?: number;
  turmaId: string;
  periodoLetivoId: string;
}) {
  try {
    const codigoFormatado = dados.codigo.toUpperCase().trim();
    let disciplina = await prisma.disciplina.findUnique({
      where: { codigo: codigoFormatado },
    });

    const isSomenteRemoto =
      dados.modalidade === "DOL" || dados.modalidade === "EAD";
    const isHibrida = dados.modalidade === "HIBRIDA";

    if (!disciplina) {
      disciplina = await prisma.disciplina.create({
        data: {
          codigo: codigoFormatado,
          nome: dados.nome.trim(),
          chTotal: Number(dados.chTotal),
          chPresencial: isSomenteRemoto
            ? 0
            : isHibrida
            ? Math.round(Number(dados.chTotal) / 2)
            : Number(dados.chTotal),
          chRemota: isSomenteRemoto
            ? Number(dados.chTotal)
            : isHibrida
            ? Math.round(Number(dados.chTotal) / 2)
            : 0,
        },
      });
    }

    return criarOfertaDisciplinaAction({
      turmaId: dados.turmaId,
      disciplinaId: disciplina.id,
      modalidade: dados.modalidade,
      blocosPresenciais: dados.qtdBlocos,
      blocosRemotos: dados.qtdBlocosRemoto || dados.qtdBlocos,
      periodoLetivoId: dados.periodoLetivoId,
    });
  } catch (error: any) {
    const msg = error.message || "Erro ao cadastrar disciplina e oferta.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function excluirOfertaAction(ofertaId: string) {
  try {
    await prisma.ofertaDisciplina.delete({
      where: { id: ofertaId },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Oferta removida da turma.",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao remover oferta.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function excluirOfertaDisciplinaAction(ofertaId: string) {
  return excluirOfertaAction(ofertaId);
}

// =========================================================
// 4. AÇÕES DE SALAS E DISPONIBILIDADE (RF07, RF08)
// =========================================================

export async function criarSalaAction(dados: {
  codigo: string;
  predio?: string;
  bloco?: string;
  andar?: number | string;
  capacidade: number;
  emManutencao?: boolean;
}) {
  try {
    const salaExistente = await prisma.sala.findUnique({
      where: { codigo: dados.codigo.trim().toUpperCase() },
    });

    if (salaExistente) {
      const msg = `Já existe uma sala cadastrada com o código "${dados.codigo}".`;
      return { success: false, sucesso: false, error: msg, erro: msg };
    }

    const andarNum =
      typeof dados.andar === "number"
        ? dados.andar
        : dados.andar
        ? parseInt(String(dados.andar).replace(/\D/g, ""), 10) || 1
        : 1;

    const novaSala = await prisma.sala.create({
      data: {
        codigo: dados.codigo.trim().toUpperCase(),
        predio: (dados.predio || dados.bloco || "Bloco Principal").trim(),
        andar: andarNum,
        capacidade: Number(dados.capacidade),
        emManutencao: Boolean(dados.emManutencao),
        ativo: true,
      },
    });

    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: novaSala,
      message: `Sala "${novaSala.codigo}" cadastrada com sucesso!`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao cadastrar sala.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function alternarStatusSalaAction(dados: {
  salaId: string;
  emManutencao: boolean;
}) {
  try {
    const sala = await prisma.sala.update({
      where: { id: dados.salaId },
      data: { emManutencao: dados.emManutencao },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      data: sala,
      message: `Sala "${sala.codigo}" marcada como ${
        sala.emManutencao ? "Em Manutenção" : "Disponível"
      }.`,
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao atualizar situação da sala.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function alternarManutencaoSalaAction(
  salaId: string,
  emManutencao: boolean
) {
  return alternarStatusSalaAction({ salaId, emManutencao });
}

export async function excluirSalaAction(salaId: string) {
  try {
    await prisma.sala.delete({ where: { id: salaId } });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Sala excluída com sucesso.",
    };
  } catch {
    const msg =
      "Não é possível excluir uma sala que possui alocações ativas.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function adicionarRestricaoSalaAction(dados: {
  salaId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  motivo?: string;
}) {
  try {
    await prisma.disponibilidadeSala.create({
      data: {
        salaId: dados.salaId,
        diaSemana: dados.diaSemana,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        disponivel: false,
      },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Restrição de horário registrada para a sala!",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao registrar restrição.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}

export async function removerRestricaoSalaAction(restricaoId: string) {
  try {
    await prisma.disponibilidadeSala.delete({
      where: { id: restricaoId },
    });
    safeRevalidate();
    return {
      success: true,
      sucesso: true,
      message: "Restrição de horário removida.",
    };
  } catch (error: any) {
    const msg = error.message || "Erro ao remover restrição.";
    return { success: false, sucesso: false, error: msg, erro: msg };
  }
}
