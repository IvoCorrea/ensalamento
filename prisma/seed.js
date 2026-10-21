const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Populando banco de dados acadêmico completo (Cursos, Matrizes, Turmas Manhã/Noite, Ofertas, Salas e Grade)...');

  // 1. Limpar dados anteriores
  await prisma.alocacao.deleteMany();
  await prisma.propostaGrade.deleteMany();
  await prisma.disponibilidadeSala.deleteMany();
  await prisma.componenteAula.deleteMany();
  await prisma.ofertaDisciplina.deleteMany();
  await prisma.disciplinaMatriz.deleteMany();
  await prisma.turma.deleteMany();
  await prisma.disciplina.deleteMany();
  await prisma.periodoCurricular.deleteMany();
  await prisma.matrizCurricular.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.periodoLetivo.deleteMany();
  await prisma.sala.deleteMany();

  // 2. Período Letivo
  const periodoLetivo = await prisma.periodoLetivo.create({
    data: {
      codigo: '2026.1',
      nome: 'Primeiro Semestre Letivo de 2026',
      ativo: true,
    },
  });

  // 3. Cursos (CC, ES, ADS)
  const cursoCC = await prisma.curso.create({
    data: { codigo: 'CC', nome: 'Ciência da Computação', ativo: true },
  });
  const cursoES = await prisma.curso.create({
    data: { codigo: 'ES', nome: 'Engenharia de Software', ativo: true },
  });
  const cursoADS = await prisma.curso.create({
    data: { codigo: 'ADS', nome: 'Análise e Desenvolvimento de Sistemas', ativo: true },
  });

  // 4. Matrizes Curriculares e Períodos
  const matrizCC = await prisma.matrizCurricular.create({
    data: { cursoId: cursoCC.id, versao: '2024.1', ativo: true },
  });
  const matrizES = await prisma.matrizCurricular.create({
    data: { cursoId: cursoES.id, versao: '2025.1', ativo: true },
  });
  const matrizADS = await prisma.matrizCurricular.create({
    data: { cursoId: cursoADS.id, versao: '2025.1', ativo: true },
  });

  const ccP2 = await prisma.periodoCurricular.create({ data: { matrizId: matrizCC.id, numero: 2 } });
  const ccP4 = await prisma.periodoCurricular.create({ data: { matrizId: matrizCC.id, numero: 4 } });
  const ccP6 = await prisma.periodoCurricular.create({ data: { matrizId: matrizCC.id, numero: 6 } });
  const ccP8 = await prisma.periodoCurricular.create({ data: { matrizId: matrizCC.id, numero: 8 } });

  const esP2 = await prisma.periodoCurricular.create({ data: { matrizId: matrizES.id, numero: 2 } });
  const esP4 = await prisma.periodoCurricular.create({ data: { matrizId: matrizES.id, numero: 4 } });

  const adsP1 = await prisma.periodoCurricular.create({ data: { matrizId: matrizADS.id, numero: 1 } });
  const adsP3 = await prisma.periodoCurricular.create({ data: { matrizId: matrizADS.id, numero: 3 } });

  // 5. Catálogo de Disciplinas (incluindo disciplinas compartilhadas entre matrizes - RN05)
  const listaDisciplinas = [
    // 6º Período CC (Grade de Referência enviada pelo usuário)
    { codigo: 'CC601', nome: 'Redes Neurais Artificiais', chTotal: 60, chPresencial: 60, chRemota: 0 },
    { codigo: 'CC602', nome: 'Linguagens Formais e Autômatos', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC603', nome: 'Sistemas Multimídias', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC604', nome: 'Atividades Práticas Interdisciplinares de Extensão III', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC605', nome: 'Paradigmas de Programação', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC606', nome: 'Microprocessadores e Microcontroladores', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC607', nome: 'Estágio Supervisionado I (Ciência da Computação)', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'DOL101', nome: 'Empreendedorismo e Gestão de TI (DOL)', chTotal: 40, chPresencial: 0, chRemota: 40 },

    // Disciplinas Compartilhadas entre Cursos (CC, ES e ADS - RN05)
    { codigo: 'COMP201', nome: 'Estrutura de Dados e Algoritmos', chTotal: 60, chPresencial: 60, chRemota: 0 },
    { codigo: 'COMP202', nome: 'Programação Orientada a Objetos', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'COMP203', nome: 'Modelagem de Banco de Dados', chTotal: 60, chPresencial: 40, chRemota: 20 }, // Híbrida
    { codigo: 'MAT201', nome: 'Cálculo Diferencial e Integral II', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'DOL102', nome: 'Sociedade, Ética e Cidadania Digital (DOL)', chTotal: 40, chPresencial: 0, chRemota: 40 },

    // 4º Período CC / ES
    { codigo: 'CC401', nome: 'Sistemas Operacionais', chTotal: 60, chPresencial: 60, chRemota: 0 },
    { codigo: 'CC402', nome: 'Redes de Computadores', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'ES401', nome: 'Engenharia de Requisitos e Testes', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC403', nome: 'Projeto Integrador de Software II', chTotal: 40, chPresencial: 40, chRemota: 0 },

    // 1º Período ADS
    { codigo: 'ADS101', nome: 'Lógica de Programação e Algoritmos', chTotal: 60, chPresencial: 60, chRemota: 0 },
    { codigo: 'ADS102', nome: 'Arquitetura e Organização de Computadores', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'ADS103', nome: 'Desenvolvimento Web Front-End', chTotal: 40, chPresencial: 40, chRemota: 0 },
  ];

  const discMap = {};
  for (const d of listaDisciplinas) {
    discMap[d.codigo] = await prisma.disciplina.create({ data: d });
  }

  // Vincular disciplinas às matrizes (incluindo reutilização RN05)
  const vinculosMatriz = [
    // CC 6º Período
    { periodoId: ccP6.id, codigos: ['CC601', 'CC602', 'CC603', 'CC604', 'CC605', 'CC606', 'CC607', 'DOL101'] },
    // CC 2º Período
    { periodoId: ccP2.id, codigos: ['COMP201', 'COMP202', 'MAT201', 'DOL102'] },
    // CC 4º Período
    { periodoId: ccP4.id, codigos: ['CC401', 'CC402', 'COMP203', 'CC403'] },
    // ES 2º Período (compartilha COMP201, COMP202, COMP203 e DOL102!)
    { periodoId: esP2.id, codigos: ['COMP201', 'COMP202', 'COMP203', 'ES401', 'DOL102'] },
    // ADS 1º Período
    { periodoId: adsP1.id, codigos: ['ADS101', 'ADS102', 'ADS103', 'DOL101'] },
  ];

  for (const v of vinculosMatriz) {
    for (const cod of v.codigos) {
      await prisma.disciplinaMatriz.create({
        data: {
          periodoCurricularId: v.periodoId,
          disciplinaId: discMap[cod].id,
        },
      });
    }
  }

  // 6. Criar Turmas (Manhã e Noite, diferentes cursos e quantidades de alunos)
  const turmaCC6NA = await prisma.turma.create({
    data: {
      codigo: 'CC-6NA',
      cursoId: cursoCC.id,
      periodoCurricularId: ccP6.id,
      turno: 'NOITE',
      qtdAlunos: 40,
      ativo: true,
    },
  });

  const turmaCC4NA = await prisma.turma.create({
    data: {
      codigo: 'CC-4NA',
      cursoId: cursoCC.id,
      periodoCurricularId: ccP4.id,
      turno: 'NOITE',
      qtdAlunos: 34,
      ativo: true,
    },
  });

  const turmaCC2MA = await prisma.turma.create({
    data: {
      codigo: 'CC-2MA',
      cursoId: cursoCC.id,
      periodoCurricularId: ccP2.id,
      turno: 'MANHA',
      qtdAlunos: 42,
      ativo: true,
    },
  });

  const turmaES2NA = await prisma.turma.create({
    data: {
      codigo: 'ES-2NA',
      cursoId: cursoES.id,
      periodoCurricularId: esP2.id,
      turno: 'NOITE',
      qtdAlunos: 48,
      ativo: true,
    },
  });

  const turmaADS1NA = await prisma.turma.create({
    data: {
      codigo: 'ADS-1NA',
      cursoId: cursoADS.id,
      periodoCurricularId: adsP1.id,
      turno: 'NOITE',
      qtdAlunos: 52,
      ativo: true,
    },
  });

  // 7. Cadastro de Salas Físicas e Disponibilidades
  const sala102 = await prisma.sala.create({
    data: {
      codigo: 'Sala 102 - Bloco A',
      predio: 'Bloco A',
      andar: 1,
      capacidade: 35, // Comporta CC-4NA (34 alunos), mas NÃO comporta CC-6NA (40 alunos)!
      ativo: true,
      emManutencao: false,
    },
  });

  const sala104 = await prisma.sala.create({
    data: {
      codigo: 'Sala 104 - Bloco A',
      predio: 'Bloco A',
      andar: 1,
      capacidade: 45,
      ativo: true,
      emManutencao: false,
    },
  });

  const sala201 = await prisma.sala.create({
    data: {
      codigo: 'Sala 201 - Bloco B',
      predio: 'Bloco B',
      andar: 2,
      capacidade: 50,
      ativo: true,
      emManutencao: false,
    },
  });

  const sala202 = await prisma.sala.create({
    data: {
      codigo: 'Sala 202 - Bloco B',
      predio: 'Bloco B',
      andar: 2,
      capacidade: 55,
      ativo: true,
      emManutencao: false,
    },
  });

  const labComp1 = await prisma.sala.create({
    data: {
      codigo: 'Lab de Computação 1',
      predio: 'Bloco C',
      andar: 1,
      capacidade: 45,
      ativo: true,
      emManutencao: true, // Em manutenção para demonstrar RN12
    },
  });

  const labComp2 = await prisma.sala.create({
    data: {
      codigo: 'Lab de Computação 2',
      predio: 'Bloco C',
      andar: 1,
      capacidade: 50,
      ativo: true,
      emManutencao: false,
      disponibilidade: {
        create: [
          {
            diaSemana: 'SEXTA',
            horaInicio: '18:30',
            horaFim: '21:50',
            disponivel: false, // Indisponível na sexta à noite (manutenção preventiva semanal)
          },
        ],
      },
    },
  });

  const labComp3 = await prisma.sala.create({
    data: {
      codigo: 'Lab de Computação 3',
      predio: 'Bloco C',
      andar: 1,
      capacidade: 45,
      ativo: true,
      emManutencao: false,
    },
  });

  const auditorioC = await prisma.sala.create({
    data: {
      codigo: 'Auditório Multimídia - Bloco C',
      predio: 'Bloco C',
      andar: 2,
      capacidade: 65,
      ativo: true,
      emManutencao: false,
    },
  });

  // Helper para criar oferta + componente(s)
  const compMap = {}; // chave: `${turma.codigo}:${discCodigo}:${tipo}`
  async function criarOfertaCompleta(turma, discCodigo, modalidade, blocosPresencial, blocosRemoto = 0) {
    const disc = discMap[discCodigo];
    const oferta = await prisma.ofertaDisciplina.create({
      data: {
        turmaId: turma.id,
        disciplinaId: disc.id,
        periodoLetivoId: periodoLetivo.id,
        modalidade,
      },
    });

    if (blocosPresencial > 0) {
      const cPres = await prisma.componenteAula.create({
        data: {
          ofertaDisciplinaId: oferta.id,
          tipo: 'PRESENCIAL',
          qtdBlocos: blocosPresencial,
        },
      });
      compMap[`${turma.codigo}:${discCodigo}:PRESENCIAL`] = cPres;
    }

    if (blocosRemoto > 0) {
      const cRem = await prisma.componenteAula.create({
        data: {
          ofertaDisciplinaId: oferta.id,
          tipo: 'REMOTO',
          qtdBlocos: blocosRemoto,
        },
      });
      compMap[`${turma.codigo}:${discCodigo}:REMOTO`] = cRem;
    }
  }

  // 8. Criar Ofertas das 5 Turmas
  // 8.1 Turma CC-6NA (Referência exata do usuário)
  await criarOfertaCompleta(turmaCC6NA, 'CC601', 'PRESENCIAL', 3, 0);
  await criarOfertaCompleta(turmaCC6NA, 'CC602', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC6NA, 'CC603', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC6NA, 'CC604', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC6NA, 'CC605', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC6NA, 'CC606', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC6NA, 'CC607', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC6NA, 'DOL101', 'DOL', 0, 2);

  // 8.2 Turma CC-4NA (Noite - 34 alunos)
  await criarOfertaCompleta(turmaCC4NA, 'CC401', 'PRESENCIAL', 3, 0);
  await criarOfertaCompleta(turmaCC4NA, 'CC402', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC4NA, 'COMP203', 'HIBRIDA', 2, 1); // Híbrida: 2 blocos presenciais + 1 remoto no sábado!
  await criarOfertaCompleta(turmaCC4NA, 'CC403', 'PRESENCIAL', 2, 0);

  // 8.3 Turma CC-2MA (Manhã - 42 alunos)
  await criarOfertaCompleta(turmaCC2MA, 'COMP201', 'PRESENCIAL', 3, 0);
  await criarOfertaCompleta(turmaCC2MA, 'COMP202', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC2MA, 'MAT201', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaCC2MA, 'DOL102', 'DOL', 0, 2);

  // 8.4 Turma ES-2NA (Noite - 48 alunos)
  await criarOfertaCompleta(turmaES2NA, 'COMP201', 'PRESENCIAL', 3, 0);
  await criarOfertaCompleta(turmaES2NA, 'COMP202', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaES2NA, 'ES401', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaES2NA, 'DOL102', 'DOL', 0, 2);

  // 8.5 Turma ADS-1NA (Noite - 52 alunos)
  await criarOfertaCompleta(turmaADS1NA, 'ADS101', 'PRESENCIAL', 3, 0);
  await criarOfertaCompleta(turmaADS1NA, 'ADS102', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaADS1NA, 'ADS103', 'PRESENCIAL', 2, 0);
  await criarOfertaCompleta(turmaADS1NA, 'DOL101', 'DOL', 0, 2);

  // 9. Criar Proposta Oficial Confirmada com todas as alocações sem conflitos
  const proposta = await prisma.propostaGrade.create({
    data: {
      periodoLetivoId: periodoLetivo.id,
      nome: 'Grade Oficial 2026.1 - Campus Principal',
      status: 'CONFIRMADA',
      observacoes: 'Proposta completa contemplando 5 turmas (Manhã e Noite) de CC, ES e ADS sem conflitos.',
    },
  });

  const alocacoes = [
    // === TURMA CC-6NA (Grade de Referência exata da imagem) ===
    { comp: 'CC-6NA:CC601:PRESENCIAL', salaId: sala201.id, dia: 'SEGUNDA', inicio: '19:20', fim: '21:50' },
    { comp: 'CC-6NA:CC602:PRESENCIAL', salaId: sala201.id, dia: 'TERCA', inicio: '18:30', fim: '20:10' },
    { comp: 'CC-6NA:CC603:PRESENCIAL', salaId: sala201.id, dia: 'TERCA', inicio: '20:10', fim: '21:50' },
    { comp: 'CC-6NA:CC604:PRESENCIAL', salaId: labComp3.id, dia: 'QUARTA', inicio: '18:30', fim: '20:10' },
    { comp: 'CC-6NA:CC605:PRESENCIAL', salaId: labComp3.id, dia: 'QUARTA', inicio: '20:10', fim: '21:50' },
    { comp: 'CC-6NA:CC606:PRESENCIAL', salaId: labComp3.id, dia: 'QUINTA', inicio: '18:30', fim: '20:10' },
    { comp: 'CC-6NA:CC607:PRESENCIAL', salaId: sala201.id, dia: 'QUINTA', inicio: '20:10', fim: '21:50' },
    { comp: 'CC-6NA:DOL101:REMOTO', salaId: null, dia: 'SABADO', inicio: '08:00', fim: '09:40' },

    // === TURMA CC-4NA (34 alunos -> usa Sala 102 de 35 vagas e Lab Comp 3 nos dias livres) ===
    { comp: 'CC-4NA:CC401:PRESENCIAL', salaId: sala102.id, dia: 'SEGUNDA', inicio: '19:20', fim: '21:50' },
    { comp: 'CC-4NA:CC402:PRESENCIAL', salaId: labComp3.id, dia: 'TERCA', inicio: '18:30', fim: '20:10' },
    { comp: 'CC-4NA:COMP203:PRESENCIAL', salaId: labComp3.id, dia: 'TERCA', inicio: '20:10', fim: '21:50' },
    { comp: 'CC-4NA:COMP203:REMOTO', salaId: null, dia: 'SABADO', inicio: '09:40', fim: '10:30' },
    { comp: 'CC-4NA:CC403:PRESENCIAL', salaId: sala102.id, dia: 'QUARTA', inicio: '18:30', fim: '20:10' },

    // === TURMA CC-2MA (Manhã - 42 alunos -> usa Sala 104 e Lab Comp 3 pela manhã) ===
    { comp: 'CC-2MA:COMP201:PRESENCIAL', salaId: labComp3.id, dia: 'SEGUNDA', inicio: '08:20', fim: '10:50' },
    { comp: 'CC-2MA:COMP202:PRESENCIAL', salaId: labComp3.id, dia: 'TERCA', inicio: '07:30', fim: '09:10' },
    { comp: 'CC-2MA:MAT201:PRESENCIAL', salaId: sala104.id, dia: 'QUARTA', inicio: '07:30', fim: '09:10' },
    { comp: 'CC-2MA:DOL102:REMOTO', salaId: null, dia: 'SABADO', inicio: '08:00', fim: '09:40' },

    // === TURMA ES-2NA (Noite - 48 alunos -> usa Lab Comp 2 de 50 vagas e Sala 201 na segunda/quarta) ===
    { comp: 'ES-2NA:COMP201:PRESENCIAL', salaId: labComp2.id, dia: 'SEGUNDA', inicio: '19:20', fim: '21:50' },
    { comp: 'ES-2NA:COMP202:PRESENCIAL', salaId: labComp2.id, dia: 'TERCA', inicio: '18:30', fim: '20:10' },
    { comp: 'ES-2NA:ES401:PRESENCIAL', salaId: sala201.id, dia: 'QUARTA', inicio: '18:30', fim: '20:10' },
    { comp: 'ES-2NA:DOL102:REMOTO', salaId: null, dia: 'SABADO', inicio: '08:00', fim: '09:40' },

    // === TURMA ADS-1NA (Noite - 52 alunos -> usa Sala 202 de 55 vagas e Auditório de 65 vagas) ===
    { comp: 'ADS-1NA:ADS101:PRESENCIAL', salaId: sala202.id, dia: 'SEGUNDA', inicio: '19:20', fim: '21:50' },
    { comp: 'ADS-1NA:ADS102:PRESENCIAL', salaId: sala202.id, dia: 'TERCA', inicio: '18:30', fim: '20:10' },
    { comp: 'ADS-1NA:ADS103:PRESENCIAL', salaId: auditorioC.id, dia: 'QUINTA', inicio: '18:30', fim: '20:10' },
    { comp: 'ADS-1NA:DOL101:REMOTO', salaId: null, dia: 'SABADO', inicio: '08:00', fim: '09:40' },
  ];

  for (const a of alocacoes) {
    const componente = compMap[a.comp];
    if (!componente) {
      throw new Error(`Componente não encontrado no seed: ${a.comp}`);
    }
    await prisma.alocacao.create({
      data: {
        propostaId: proposta.id,
        componenteAulaId: componente.id,
        salaId: a.salaId,
        diaSemana: a.dia,
        horaInicio: a.inicio,
        horaFim: a.fim,
      },
    });
  }

  console.log('Seed completo executado com sucesso! 3 cursos, 5 turmas (Manhã/Noite), 8 salas e 24 alocações criadas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
