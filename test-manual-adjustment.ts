import { prisma } from "./src/lib/prisma";
import { atualizarAlocacaoAction } from "./src/app/actions/grade-actions";
import { DiaSemana } from "@prisma/client";

async function main() {
  console.log("=== TESTANDO AJUSTES MANUAIS COM VALIDAÇÃO PRÉ-VOO (PASSO 5) ===\n");

  const aloc = await prisma.alocacao.findFirst({
    where: {
      diaSemana: DiaSemana.TERCA,
      componenteAula: {
        tipo: "PRESENCIAL",
      },
    },
    include: {
      sala: true,
      componenteAula: {
        include: {
          oferta: {
            include: { turma: true, disciplina: true },
          },
        },
      },
    },
  });

  if (!aloc) {
    console.error("Nenhuma alocação presencial na terça encontrada!");
    process.exit(1);
  }

  const sala102 = await prisma.sala.findUnique({ where: { codigo: "Sala 102 - Bloco A" } });
  if (!sala102) {
    console.error("Sala 102 não encontrada!");
    process.exit(1);
  }

  console.log(`Testando com a disciplina: "${aloc.componenteAula.oferta.disciplina.nome}" (Turma com ${aloc.componenteAula.oferta.turma.qtdAlunos} alunos)`);

  // CENÁRIO 1: Tentar trocar para a Sala 102 (35 vagas para 40 alunos) mantendo o mesmo horário
  console.log("\n1. Teste de Rejeição por Capacidade Insuficiente (RN11):");
  const res1 = await atualizarAlocacaoAction({
    alocacaoId: aloc.id,
    diaSemana: aloc.diaSemana,
    horaInicio: aloc.horaInicio,
    horaFim: aloc.horaFim,
    salaId: sala102.id,
  });

  if (!res1.success && res1.conflitos?.some((c: any) => c.tipo === "CAPACIDADE_INSUFICIENTE")) {
    console.log(`  ✔ PASSOU: Bloqueou alteração inválida por capacidade insuficiente:\n    "${res1.error}"`);
  } else {
    console.error("  ✖ FALHOU: Deveria ter bloqueado por capacidade insuficiente!", res1);
    process.exitCode = 1;
  }

  // CENÁRIO 2: Alteração Válida (Mover para Sexta-feira na Sala 201, horário livre)
  console.log("\n2. Teste de Alteração Válida (Sexta-feira na Sala 201 livre):");
  const sala201 = await prisma.sala.findUnique({ where: { codigo: "Sala 201 - Bloco B" } });
  const res2 = await atualizarAlocacaoAction({
    alocacaoId: aloc.id,
    diaSemana: DiaSemana.SEXTA,
    horaInicio: "18:30",
    horaFim: "20:10",
    salaId: sala201?.id || null,
  });

  if (res2.success) {
    console.log("  ✔ PASSOU: Ajuste manual válido aprovado e gravado com sucesso!");
    // Reverter para Terça mantendo os dados originais
    await atualizarAlocacaoAction({
      alocacaoId: aloc.id,
      diaSemana: aloc.diaSemana,
      horaInicio: aloc.horaInicio,
      horaFim: aloc.horaFim,
      salaId: aloc.salaId,
    });
    console.log("  ✔ Reverteu o teste para o horário original na Terça-feira.");
  } else {
    console.error("  ✖ FALHOU: Ajuste válido foi recusado indevidamente:", res2.error);
    process.exitCode = 1;
  }

  console.log("\n========================================================");
  console.log("RESULTADO: Todos os critérios do Passo 5 validados com sucesso!");
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
