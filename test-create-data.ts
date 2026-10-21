import { prisma } from "./src/lib/prisma";
import { criarSalaAction, criarTurmaAction, criarDisciplinaEOfertaAction } from "./src/app/actions/grade-actions";

async function main() {
  console.log("=== TESTANDO CADASTROS RÁPIDOS & GESTÃO (PASSO 6 DO MVP) ===\n");

  const curso = await prisma.curso.findFirst();
  const periodoLetivo = await prisma.periodoLetivo.findFirst();

  if (!curso || !periodoLetivo) {
    console.error("Dados básicos de curso/período não encontrados!");
    process.exit(1);
  }

  // 1. Teste: Cadastrar Nova Sala Física (RF07)
  console.log("1. Teste de Cadastro de Sala Física:");
  const codigoSalaTeste = `Sala Teste ${Date.now().toString().slice(-4)}`;
  const resSala = await criarSalaAction({
    codigo: codigoSalaTeste,
    predio: "Bloco D",
    capacidade: 55,
    emManutencao: false,
  });

  if (resSala.success) {
    console.log(`  ✔ PASSOU: Sala "${codigoSalaTeste}" cadastrada com sucesso!`);
  } else {
    console.error("  ✖ FALHOU:", resSala.error);
    process.exitCode = 1;
  }

  // Teste de duplicidade de sala
  const resSalaDup = await criarSalaAction({
    codigo: codigoSalaTeste,
    capacidade: 50,
  });
  if (!resSalaDup.success && resSalaDup.error?.includes("Já existe")) {
    console.log(`  ✔ PASSOU: Bloqueou duplicidade de código de sala.`);
  }

  // 2. Teste: Cadastrar Nova Turma (RF03)
  console.log("\n2. Teste de Cadastro de Turma:");
  const codigoTurmaTeste = `CC-TESTE-${Date.now().toString().slice(-4)}`;
  const resTurma = await criarTurmaAction({
    cursoId: curso.id,
    codigo: codigoTurmaTeste,
    turno: "NOITE",
    qtdAlunos: 38,
  });

  if (resTurma.success && resTurma.data) {
    console.log(`  ✔ PASSOU: Turma "${codigoTurmaTeste}" cadastrada com sucesso!`);

    // 3. Teste: Ofertar Nova Disciplina para essa turma (RF02 / RF04)
    console.log("\n3. Teste de Cadastro e Oferta de Disciplina:");
    const codigoDiscTeste = `CC999-${Date.now().toString().slice(-4)}`;
    const resDisc = await criarDisciplinaEOfertaAction({
      codigo: codigoDiscTeste,
      nome: "Segurança Ofensiva e Pentest",
      chTotal: 40,
      modalidade: "PRESENCIAL",
      qtdBlocos: 2,
      turmaId: resTurma.data.id,
      periodoLetivoId: periodoLetivo.id,
    });

    if (resDisc.success) {
      console.log(`  ✔ PASSOU: Disciplina "${codigoDiscTeste}" cadastrada e ofertada com sucesso!`);
    } else {
      console.error("  ✖ FALHOU ao ofertar:", resDisc.error);
      process.exitCode = 1;
    }

    // Limpar turma e oferta de teste
    await prisma.componenteAula.deleteMany({
      where: { oferta: { turmaId: resTurma.data.id } },
    });
    await prisma.ofertaDisciplina.deleteMany({
      where: { turmaId: resTurma.data.id },
    });
    await prisma.turma.delete({
      where: { id: resTurma.data.id },
    });
    await prisma.disciplina.deleteMany({
      where: { codigo: codigoDiscTeste },
    });
  }

  // Limpar sala de teste
  await prisma.sala.deleteMany({
    where: { codigo: codigoSalaTeste },
  });

  console.log("\n========================================================");
  console.log("RESULTADO: Todos os cadastros do Passo 6 validados com sucesso!");
  console.log("========================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
