const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Populando dados iniciais baseados na grade de referência...');

  // 1. Limpar dados anteriores (se houver)
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
      nome: 'Primeiro Semestre de 2026',
      ativo: true,
    },
  });

  // 3. Curso e Matriz
  const cursoCC = await prisma.curso.create({
    data: {
      codigo: 'CC',
      nome: 'Ciência da Computação',
      ativo: true,
    },
  });

  const matrizCC = await prisma.matrizCurricular.create({
    data: {
      cursoId: cursoCC.id,
      versao: '2024.1',
      ativo: true,
    },
  });

  const periodo6 = await prisma.periodoCurricular.create({
    data: {
      matrizId: matrizCC.id,
      numero: 6,
    },
  });

  // 4. Turma Noturna (6º período, 40 alunos)
  const turma6NA = await prisma.turma.create({
    data: {
      codigo: 'CC-6NA',
      cursoId: cursoCC.id,
      periodoCurricularId: periodo6.id,
      turno: 'NOITE',
      qtdAlunos: 40,
      ativo: true,
    },
  });

  // 5. Disciplinas da Grade de Referência
  const disciplinasData = [
    { codigo: 'CC601', nome: 'Redes Neurais Artificiais', chTotal: 60, chPresencial: 60, chRemota: 0 },
    { codigo: 'CC602', nome: 'Linguagens Formais e Autômatos', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC603', nome: 'Sistemas Multimídias', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC604', nome: 'Atividades Práticas Interdisciplinares de Extensão III', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC605', nome: 'Paradigmas de Programação', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC606', nome: 'Microprocessadores e Microcontroladores', chTotal: 40, chPresencial: 40, chRemota: 0 },
    { codigo: 'CC607', nome: 'Estágio Supervisionado I (Ciência da Computação)', chTotal: 40, chPresencial: 40, chRemota: 0 },
    // Disciplina 100% Online (DOL) - Sábado
    { codigo: 'DOL101', nome: 'Empreendedorismo e Gestão de TI (DOL)', chTotal: 40, chPresencial: 0, chRemota: 40 },
  ];

  const disciplinasMap = {};
  for (const d of disciplinasData) {
    const disc = await prisma.disciplina.create({ data: d });
    disciplinasMap[d.codigo] = disc;

    await prisma.disciplinaMatriz.create({
      data: {
        periodoCurricularId: periodo6.id,
        disciplinaId: disc.id,
      },
    });
  }

  // 6. Ofertas e Componentes de Aula
  const ofertasMap = {};
  for (const [codigo, disc] of Object.entries(disciplinasMap)) {
    const isDol = codigo === 'DOL101';
    const oferta = await prisma.ofertaDisciplina.create({
      data: {
        turmaId: turma6NA.id,
        disciplinaId: disc.id,
        periodoLetivoId: periodoLetivo.id,
        modalidade: isDol ? 'DOL' : 'PRESENCIAL',
      },
    });
    ofertasMap[codigo] = oferta;

    // Componente de aula
    await prisma.componenteAula.create({
      data: {
        ofertaDisciplinaId: oferta.id,
        tipo: isDol ? 'REMOTO' : 'PRESENCIAL',
        qtdBlocos: codigo === 'CC601' ? 3 : 2, // Redes Neurais ocupa 3 blocos
      },
    });
  }

  // 7. Cadastro de Salas Físicas
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

  const labComp = await prisma.sala.create({
    data: {
      codigo: 'Lab de Computação 3',
      predio: 'Bloco C',
      andar: 1,
      capacidade: 45,
      ativo: true,
      emManutencao: false,
    },
  });

  const sala102 = await prisma.sala.create({
    data: {
      codigo: 'Sala 102 - Bloco A',
      predio: 'Bloco A',
      andar: 1,
      capacidade: 35, // Atenção: menor que 40, serve para testar conflito de capacidade!
      ativo: true,
      emManutencao: false,
    },
  });

  // 8. Criação de Proposta de Grade com as alocações da imagem
  const proposta = await prisma.propostaGrade.create({
    data: {
      periodoLetivoId: periodoLetivo.id,
      nome: 'Grade Oficial 2026.1 - CC-6NA',
      status: 'CONFIRMADA',
      observacoes: 'Alocações presenciais seg-qui e DOL informativo no sábado sem sala física.',
    },
  });

  // Buscar componentes criados
  const componentes = await prisma.componenteAula.findMany({
    include: {
      oferta: {
        include: { disciplina: true },
      },
    },
  });

  const getCompId = (codigo) => componentes.find((c) => c.oferta.disciplina.codigo === codigo).id;

  // Alocações exatas da imagem enviada pelo usuário
  const alocacoesParaCriar = [
    // Segunda: Redes Neurais Artificiais (19:20 - 21:50) -> Sala 201
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC601'),
      salaId: sala201.id,
      diaSemana: 'SEGUNDA',
      horaInicio: '19:20',
      horaFim: '21:50',
    },
    // Terça: Linguagens Formais e Autômatos (18:30 - 20:10) -> Sala 201
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC602'),
      salaId: sala201.id,
      diaSemana: 'TERCA',
      horaInicio: '18:30',
      horaFim: '20:10',
    },
    // Terça: Sistemas Multimídias (20:10 - 21:50) -> Sala 201
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC603'),
      salaId: sala201.id,
      diaSemana: 'TERCA',
      horaInicio: '20:10',
      horaFim: '21:50',
    },
    // Quarta: Atividades Práticas Interdisciplinares de Extensão III (18:30 - 20:10) -> Lab Comp 3
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC604'),
      salaId: labComp.id,
      diaSemana: 'QUARTA',
      horaInicio: '18:30',
      horaFim: '20:10',
    },
    // Quarta: Paradigmas de Programação (20:10 - 21:50) -> Lab Comp 3
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC605'),
      salaId: labComp.id,
      diaSemana: 'QUARTA',
      horaInicio: '20:10',
      horaFim: '21:50',
    },
    // Quinta: Microprocessadores e Microcontroladores (18:30 - 20:10) -> Lab Comp 3
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC606'),
      salaId: labComp.id,
      diaSemana: 'QUINTA',
      horaInicio: '18:30',
      horaFim: '20:10',
    },
    // Quinta: Estágio Supervisionado I (20:10 - 21:50) -> Sala 201
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('CC607'),
      salaId: sala201.id,
      diaSemana: 'QUINTA',
      horaInicio: '20:10',
      horaFim: '21:50',
    },
    // Sábado: DOL Online (Sem sala física - salaId: null!)
    {
      propostaId: proposta.id,
      componenteAulaId: getCompId('DOL101'),
      salaId: null, // SEM SALA FÍSICA!
      diaSemana: 'SABADO',
      horaInicio: '08:00',
      horaFim: '11:40',
    },
  ];

  for (const a of alocacoesParaCriar) {
    await prisma.alocacao.create({ data: a });
  }

  console.log('Seed executado com sucesso! Grade e alocações criadas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
