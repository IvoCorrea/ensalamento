import { prisma } from "@/lib/prisma";
import { validarGrade, AlocacaoParaValidacao, Conflito } from "@/lib/conflicts";
import { DiaSemana, TipoComponente, Turno, ModalidadeOferta } from "@prisma/client";
import { SLOTS_MANHA, SLOTS_NOITE } from "@/lib/services/solver-service";

export interface ComponenteNaoAlocadoInfo {
  componenteId: string;
  disciplinaCodigo: string;
  disciplinaNome: string;
  turmaId: string;
  turmaNome: string;
  turno: Turno;
  qtdAlunos: number;
  modalidade: ModalidadeOferta;
  tipo: TipoComponente;
  qtdBlocos: number;
  motivoDiagnostico: string;
}

export interface RelatorioValidacaoProposta {
  propostaId: string;
  propostaNome: string;
  propostaStatus: string;
  statusProposta: string;
  periodoLetivoCodigo: string;
  totalAlocacoes: number;
  totalComponentesOfertados: number;
  totalComponentesSemestre: number;
  componentesPendentes: number;
  totalConflitos: number;
  componentesNaoAlocados: ComponenteNaoAlocadoInfo[];
  conflitos: (Conflito & { severidade: string; alocacaoIds: string[] })[];
  statusGrade: "VALIDA_COMPLETA" | "VALIDA_PARCIAL" | "COM_CONFLITOS";
  statusValidacao: "VALIDA_COMPLETA" | "VALIDA_PARCIAL" | "COM_CONFLITOS";
  valida: boolean;
}

export async function validarPropostaDoBanco(
  propostaId: string
): Promise<RelatorioValidacaoProposta> {
  const proposta = await prisma.propostaGrade.findUnique({
    where: { id: propostaId },
    include: {
      periodoLetivo: true,
      alocacoes: {
        include: {
          sala: {
            include: {
              disponibilidade: true,
            },
          },
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

  const salasAtivas = await prisma.sala.findMany({
    where: { ativo: true, emManutencao: false },
  });
  const maiorCapacidadeSala =
    salasAtivas.length > 0
      ? Math.max(...salasAtivas.map((s) => s.capacidade))
      : 0;

  const alocacoesParaValidar: AlocacaoParaValidacao[] = proposta.alocacoes.map(
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

  const conflitosBrutos = validarGrade(alocacoesParaValidar);
  const conflitos = conflitosBrutos.map((c) => ({
    ...c,
    severidade: c.gravidade,
    alocacaoIds: [c.alocacaoIdA, c.alocacaoIdB].filter(
      (id): id is string => Boolean(id)
    ),
  }));

  const idsAlocados = new Set(
    proposta.alocacoes.map((a) => a.componenteAulaId)
  );
  const componentesNaoAlocados: ComponenteNaoAlocadoInfo[] = todosComponentes
    .filter((c) => !idsAlocados.has(c.id))
    .map((c) => {
      const qtdAlunos = c.oferta.turma.qtdAlunos;
      let motivoDiagnostico =
        "Aguardando alocação na grade (manual ou geração automática).";
      if (
        c.tipo === TipoComponente.PRESENCIAL &&
        qtdAlunos > maiorCapacidadeSala
      ) {
        motivoDiagnostico = `Capacidade incompatível (RN11): turma com ${qtdAlunos} alunos excede a maior sala disponível (${maiorCapacidadeSala} lugares).`;
      }
      return {
        componenteId: c.id,
        disciplinaCodigo: c.oferta.disciplina.codigo,
        disciplinaNome: c.oferta.disciplina.nome,
        turmaId: c.oferta.turma.id,
        turmaNome: c.oferta.turma.codigo,
        turno: c.oferta.turma.turno,
        qtdAlunos,
        modalidade: c.oferta.modalidade,
        tipo: c.tipo,
        qtdBlocos: c.qtdBlocos,
        motivoDiagnostico,
      };
    });

  let statusGrade: "VALIDA_COMPLETA" | "VALIDA_PARCIAL" | "COM_CONFLITOS" =
    "VALIDA_COMPLETA";

  if (conflitos.some((c) => c.gravidade === "ERRO")) {
    statusGrade = "COM_CONFLITOS";
  } else if (componentesNaoAlocados.length > 0) {
    statusGrade = "VALIDA_PARCIAL";
  }

  return {
    propostaId: proposta.id,
    propostaNome: proposta.nome,
    propostaStatus: proposta.status,
    statusProposta: proposta.status,
    periodoLetivoCodigo: proposta.periodoLetivo.codigo,
    totalAlocacoes: proposta.alocacoes.length,
    totalComponentesOfertados: todosComponentes.length,
    totalComponentesSemestre: todosComponentes.length,
    componentesPendentes: componentesNaoAlocados.length,
    totalConflitos: conflitos.length,
    componentesNaoAlocados,
    conflitos,
    statusGrade,
    statusValidacao: statusGrade,
    valida: statusGrade !== "COM_CONFLITOS",
  };
}

/**
 * 1. Dados para o Painel Inicial (Dashboard Executivo)
 */
export async function getDadosDashboard() {
  const [
    cursos,
    matrizes,
    disciplinas,
    turmasBanco,
    salas,
    periodosLetivos,
    propostas,
  ] = await Promise.all([
    prisma.curso.findMany({
      include: {
        matrizes: true,
        turmas: true,
      },
      orderBy: { codigo: "asc" },
    }),
    prisma.matrizCurricular.findMany(),
    prisma.disciplina.findMany(),
    prisma.turma.findMany({
      include: {
        curso: true,
        periodoCurricular: true,
        ofertas: {
          include: {
            disciplina: true,
            componentes: {
              include: {
                alocacoes: true,
              },
            },
          },
        },
      },
      orderBy: [{ turno: "asc" }, { codigo: "asc" }],
    }),
    prisma.sala.findMany({
      include: {
        disponibilidade: true,
        alocacoes: true,
      },
      orderBy: [{ predio: "asc" }, { codigo: "asc" }],
    }),
    prisma.periodoLetivo.findMany({
      orderBy: { codigo: "desc" },
    }),
    prisma.propostaGrade.findMany({
      include: {
        periodoLetivo: true,
        _count: {
          select: { alocacoes: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const periodoLetivo = periodosLetivos[0] ?? null;
  const propostaAtiva =
    propostas.find((p) => p.status === "CONFIRMADA") || propostas[0] || null;

  const validacaoAtual = propostaAtiva
    ? await validarPropostaDoBanco(propostaAtiva.id)
    : null;

  const turmas = turmasBanco.map((t) => {
    const todosComp = t.ofertas.flatMap((o) => o.componentes);
    const alocados = todosComp.filter((c) =>
      propostaAtiva
        ? c.alocacoes.some((a) => a.propostaId === propostaAtiva.id)
        : c.alocacoes.length > 0
    ).length;

    return {
      id: t.id,
      codigo: t.codigo,
      turno: t.turno,
      qtdAlunos: t.qtdAlunos,
      cursoNome: t.curso.nome,
      cursoCodigo: t.curso.codigo,
      periodoNumero: t.periodoCurricular?.numero ?? null,
      periodoNome: t.periodoCurricular
        ? `${t.periodoCurricular.numero}º Período`
        : "Sem período",
      totalOfertas: t.ofertas.length,
      totalComponentes: todosComp.length,
      componentesAlocados: alocados,
    };
  });

  const resumo = {
    totalCursos: cursos.length,
    totalMatrizes: matrizes.length,
    totalDisciplinas: disciplinas.length,
    totalTurmas: turmas.length,
    turmasManha: turmas.filter((t) => t.turno === "MANHA").length,
    turmasNoite: turmas.filter((t) => t.turno === "NOITE").length,
    totalSalas: salas.length,
    salasAtivas: salas.filter((s) => s.ativo && !s.emManutencao).length,
    salasManutencao: salas.filter((s) => s.emManutencao).length,
    totalComponentes: validacaoAtual?.totalComponentesSemestre ?? 0,
    componentesAlocados: validacaoAtual?.totalAlocacoes ?? 0,
    componentesPendentes: validacaoAtual?.componentesPendentes ?? 0,
    totalConflitos: validacaoAtual?.totalConflitos ?? 0,
  };

  return {
    periodoLetivo,
    cursos,
    matrizes,
    disciplinas,
    turmas,
    salas,
    periodosLetivos,
    propostas,
    propostaAtiva,
    relatorioAtivo: validacaoAtual,
    validacaoAtual,
    resumo,
  };
}

/**
 * 2. Dados para a Tela de Cursos, Matrizes e Disciplinas (/cursos)
 */
export async function getDadosCursosEMatrizes() {
  const [cursosBanco, disciplinasBanco] = await Promise.all([
    prisma.curso.findMany({
      include: {
        _count: { select: { turmas: true } },
        matrizes: {
          include: {
            periodos: {
              include: {
                disciplinas: {
                  include: {
                    disciplina: true,
                  },
                },
              },
              orderBy: { numero: "asc" },
            },
          },
          orderBy: { versao: "desc" },
        },
        turmas: true,
      },
      orderBy: { nome: "asc" },
    }),
    prisma.disciplina.findMany({
      include: {
        matrizes: {
          include: {
            periodoCurricular: {
              include: {
                matriz: {
                  include: {
                    curso: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { ofertas: true },
        },
      },
      orderBy: { codigo: "asc" },
    }),
  ]);

  const cursos = cursosBanco.map((c) => ({
    ...c,
    matrizes: c.matrizes.map((m) => ({
      id: m.id,
      nome: `Matriz ${c.nome}`,
      versao: m.versao,
      ativa: m.ativo,
      periodos: m.periodos.map((p) => ({
        id: p.id,
        numero: p.numero,
        nome: `${p.numero}º Semestre`,
        disciplinas: p.disciplinas.map((dm) => ({
          id: dm.id,
          obrigatoria: true,
          disciplina: {
            id: dm.disciplina.id,
            codigo: dm.disciplina.codigo,
            nome: dm.disciplina.nome,
            cargaHorariaTotal: dm.disciplina.chTotal,
          },
        })),
      })),
    })),
  }));

  const disciplinas = disciplinasBanco.map((d) => ({
    id: d.id,
    codigo: d.codigo,
    nome: d.nome,
    cargaHorariaTotal: d.chTotal,
    matrizes: d.matrizes,
  }));

  return { cursos, disciplinas };
}

/**
 * 3. Dados para a Tela de Turmas e Ofertas (/turmas)
 */
export async function getDadosTurmasEOfertas() {
  const [turmasBanco, cursosBanco, disciplinasBanco, periodosLetivos] =
    await Promise.all([
      prisma.turma.findMany({
        include: {
          curso: true,
          periodoCurricular: {
            include: {
              matriz: true,
              disciplinas: {
                include: {
                  disciplina: true,
                },
              },
            },
          },
          ofertas: {
            include: {
              disciplina: true,
              periodoLetivo: true,
              componentes: {
                include: {
                  alocacoes: {
                    include: {
                      sala: true,
                      proposta: true,
                    },
                  },
                },
              },
            },
            orderBy: { disciplina: { nome: "asc" } },
          },
        },
        orderBy: [{ curso: { codigo: "asc" } }, { codigo: "asc" }],
      }),
      prisma.curso.findMany({
        include: {
          matrizes: {
            include: {
              periodos: {
                include: {
                  disciplinas: {
                    include: {
                      disciplina: true,
                    },
                  },
                },
                orderBy: { numero: "asc" },
              },
            },
          },
        },
        orderBy: { nome: "asc" },
      }),
      prisma.disciplina.findMany({
        orderBy: { nome: "asc" },
      }),
      prisma.periodoLetivo.findMany({
        orderBy: { codigo: "desc" },
      }),
    ]);

  const turmas = turmasBanco.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    turno: t.turno,
    qtdAlunos: t.qtdAlunos,
    cursoId: t.cursoId,
    periodoCurricularId: t.periodoCurricularId,
    curso: {
      id: t.curso.id,
      codigo: t.curso.codigo,
      nome: t.curso.nome,
    },
    periodoCurricular: t.periodoCurricular
      ? {
          id: t.periodoCurricular.id,
          numero: t.periodoCurricular.numero,
          nome: `${t.periodoCurricular.numero}º Período`,
          disciplinas: t.periodoCurricular.disciplinas,
        }
      : null,
    ofertas: t.ofertas.map((of) => ({
      id: of.id,
      modalidade: of.modalidade,
      disciplina: {
        id: of.disciplina.id,
        codigo: of.disciplina.codigo,
        nome: of.disciplina.nome,
        cargaHorariaTotal: of.disciplina.chTotal,
      },
      componentes: of.componentes.map((comp) => ({
        id: comp.id,
        tipo: comp.tipo,
        blocosSemanais: comp.qtdBlocos,
        requerSalaFisica: comp.tipo === "PRESENCIAL",
        alocacoes: comp.alocacoes.map((a) => ({
          id: a.id,
          diaSemana: a.diaSemana,
          horaInicio: a.horaInicio,
          horaFim: a.horaFim,
          sala: a.sala ? { codigo: a.sala.codigo } : null,
        })),
      })),
    })),
  }));

  const cursos = cursosBanco.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    matrizes: c.matrizes.map((m) => ({
      id: m.id,
      versao: m.versao,
      periodos: m.periodos.map((p) => ({
        id: p.id,
        numero: p.numero,
        nome: `${p.numero}º Período`,
        disciplinas: p.disciplinas,
      })),
    })),
  }));

  const disciplinas = disciplinasBanco.map((d) => ({
    id: d.id,
    codigo: d.codigo,
    nome: d.nome,
    cargaHorariaTotal: d.chTotal,
  }));

  return { turmas, cursos, disciplinas, periodosLetivos };
}

/**
 * 4. Dados para a Tela de Salas e Horários (/salas)
 */
export async function getDadosSalasEHorarios() {
  const salasBanco = await prisma.sala.findMany({
    include: {
      disponibilidade: {
        orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
      },
      alocacoes: {
        include: {
          proposta: true,
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
    orderBy: [{ predio: "asc" }, { codigo: "asc" }],
  });

  const salas = salasBanco.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    bloco: s.predio ?? "Bloco Principal",
    andar: s.andar !== null ? `${s.andar}º Andar` : "Térreo",
    capacidade: s.capacidade,
    ativa: s.ativo,
    emManutencao: s.emManutencao,
    disponibilidades: s.disponibilidade.map((d) => ({
      id: d.id,
      diaSemana: d.diaSemana,
      horaInicio: d.horaInicio,
      horaFim: d.horaFim,
      disponivel: d.disponivel,
      motivo: "Bloqueio de Horário (RN12)",
    })),
    alocacoes: s.alocacoes.map((a) => ({
      id: a.id,
      diaSemana: a.diaSemana,
      horaInicio: a.horaInicio,
      horaFim: a.horaFim,
      componente: {
        oferta: {
          turma: { codigo: a.componenteAula.oferta.turma.codigo },
          disciplina: { nome: a.componenteAula.oferta.disciplina.nome },
        },
      },
    })),
  }));

  const slotsManha = SLOTS_MANHA.map((s) => ({
    inicio: s.horaInicio,
    fim: s.horaFim,
    label: s.label,
  }));

  const slotsNoite = SLOTS_NOITE.map((s) => ({
    inicio: s.horaInicio,
    fim: s.horaFim,
    label: s.label,
  }));

  return { salas, slotsManha, slotsNoite };
}

/**
 * 5 & 6. Dados Completos para Grade e Alocação (/grade) e Validação (/validacao)
 */
export async function getDadosGradeCompleta(propostaId?: string) {
  const [todasTurmas, todasSalas, todasPropostas, periodosLetivos] =
    await Promise.all([
      prisma.turma.findMany({
        include: {
          curso: true,
          periodoCurricular: true,
        },
        orderBy: [{ turno: "asc" }, { codigo: "asc" }],
      }),
      prisma.sala.findMany({
        include: {
          disponibilidade: true,
        },
        orderBy: [{ predio: "asc" }, { codigo: "asc" }],
      }),
      prisma.propostaGrade.findMany({
        include: {
          periodoLetivo: true,
          _count: { select: { alocacoes: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.periodoLetivo.findMany({
        orderBy: { codigo: "desc" },
      }),
    ]);

  const idAlvo =
    propostaId ||
    todasPropostas.find((p) => p.status === "CONFIRMADA")?.id ||
    todasPropostas[0]?.id;

  const proposta = idAlvo
    ? await prisma.propostaGrade.findUnique({
        where: { id: idAlvo },
        include: {
          periodoLetivo: true,
          alocacoes: {
            include: {
              sala: {
                include: {
                  disponibilidade: true,
                },
              },
              componenteAula: {
                include: {
                  oferta: {
                    include: {
                      disciplina: true,
                      turma: {
                        include: {
                          curso: true,
                          periodoCurricular: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const todosComponentesBanco = proposta
    ? await prisma.componenteAula.findMany({
        where: {
          oferta: {
            periodoLetivoId: proposta.periodoLetivoId,
          },
        },
        include: {
          oferta: {
            include: {
              disciplina: true,
              turma: {
                include: {
                  curso: true,
                },
              },
            },
          },
        },
      })
    : [];

  const relatorioValidacao = proposta
    ? await validarPropostaDoBanco(proposta.id)
    : null;

  const turmas = todasTurmas.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    turno: t.turno,
    qtdAlunos: t.qtdAlunos,
    curso: { codigo: t.curso.codigo, nome: t.curso.nome },
    periodoCurricular: t.periodoCurricular
      ? {
          numero: t.periodoCurricular.numero,
          nome: `${t.periodoCurricular.numero}º Período`,
        }
      : null,
  }));

  const salas = todasSalas.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    bloco: s.predio ?? "Bloco Principal",
    andar: s.andar !== null ? `${s.andar}º Andar` : "Térreo",
    capacidade: s.capacidade,
    emManutencao: s.emManutencao,
    disponibilidades: s.disponibilidade.map((d) => ({
      id: d.id,
      diaSemana: d.diaSemana,
      horaInicio: d.horaInicio,
      horaFim: d.horaFim,
      disponivel: d.disponivel,
      motivo: "Horário indisponível (RN12)",
    })),
  }));

  const alocacoes = (proposta?.alocacoes ?? []).map((a) => ({
    id: a.id,
    componenteId: a.componenteAulaId,
    salaId: a.salaId,
    diaSemana: a.diaSemana,
    horaInicio: a.horaInicio,
    horaFim: a.horaFim,
    status: proposta?.status ?? "RASCUNHO",
    sala: a.sala
      ? {
          id: a.sala.id,
          codigo: a.sala.codigo,
          bloco: a.sala.predio ?? "Bloco Principal",
          andar: a.sala.andar !== null ? `${a.sala.andar}º Andar` : "Térreo",
          capacidade: a.sala.capacidade,
          emManutencao: a.sala.emManutencao,
          disponibilidades: a.sala.disponibilidade.map((d) => ({
            id: d.id,
            diaSemana: d.diaSemana,
            horaInicio: d.horaInicio,
            horaFim: d.horaFim,
            disponivel: d.disponivel,
            motivo: "Indisponível",
          })),
        }
      : null,
    componente: {
      id: a.componenteAula.id,
      tipo: a.componenteAula.tipo,
      blocosSemanais: a.componenteAula.qtdBlocos,
      requerSalaFisica: a.componenteAula.tipo === "PRESENCIAL",
      oferta: {
        modalidade: a.componenteAula.oferta.modalidade,
        turma: {
          id: a.componenteAula.oferta.turma.id,
          codigo: a.componenteAula.oferta.turma.codigo,
          turno: a.componenteAula.oferta.turma.turno,
          qtdAlunos: a.componenteAula.oferta.turma.qtdAlunos,
          curso: {
            codigo: a.componenteAula.oferta.turma.curso.codigo,
            nome: a.componenteAula.oferta.turma.curso.nome,
          },
          periodoCurricular: a.componenteAula.oferta.turma.periodoCurricular
            ? {
                numero: a.componenteAula.oferta.turma.periodoCurricular.numero,
                nome: `${a.componenteAula.oferta.turma.periodoCurricular.numero}º Período`,
              }
            : null,
        },
        disciplina: {
          id: a.componenteAula.oferta.disciplina.id,
          codigo: a.componenteAula.oferta.disciplina.codigo,
          nome: a.componenteAula.oferta.disciplina.nome,
        },
      },
    },
  }));

  const idsAlocados = new Set(alocacoes.map((a) => a.componenteId));
  const componentesNaoAlocados = todosComponentesBanco
    .filter((c) => !idsAlocados.has(c.id))
    .map((c) => ({
      id: c.id,
      tipo: c.tipo,
      blocosSemanais: c.qtdBlocos,
      requerSalaFisica: c.tipo === "PRESENCIAL",
      oferta: {
        modalidade: c.oferta.modalidade,
        turma: {
          id: c.oferta.turma.id,
          codigo: c.oferta.turma.codigo,
          turno: c.oferta.turma.turno,
          qtdAlunos: c.oferta.turma.qtdAlunos,
          curso: {
            codigo: c.oferta.turma.curso.codigo,
            nome: c.oferta.turma.curso.nome,
          },
        },
        disciplina: {
          codigo: c.oferta.disciplina.codigo,
          nome: c.oferta.disciplina.nome,
        },
      },
    }));

  const propostas = todasPropostas.map((p) => ({
    id: p.id,
    nome: p.nome,
    status: p.status,
    geradaAutomaticamente: true,
  }));

  const propostaAtual = proposta
    ? {
        id: proposta.id,
        nome: proposta.nome,
        status: proposta.status,
        geradaAutomaticamente: true,
      }
    : null;

  const slotsManha = SLOTS_MANHA.map((s) => ({
    inicio: s.horaInicio,
    fim: s.horaFim,
    label: s.label,
  }));

  const slotsNoite = SLOTS_NOITE.map((s) => ({
    inicio: s.horaInicio,
    fim: s.horaFim,
    label: s.label,
  }));

  return {
    proposta,
    propostaAtual,
    propostas,
    todasPropostas,
    turmas,
    todasTurmas,
    salas,
    todasSalas,
    alocacoes,
    componentesNaoAlocados,
    periodosLetivos,
    validacao: relatorioValidacao,
    relatorioValidacao,
    slotsManha,
    slotsNoite,
  };
}
