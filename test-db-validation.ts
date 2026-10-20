import { prisma } from "./src/lib/prisma";
import { validarPropostaDoBanco } from "./src/lib/services/grade-service";

async function main() {
  console.log("=== TESTANDO VALIDAÇÃO DA PROPOSTA NO BANCO SUPABASE ===");

  const proposta = await prisma.propostaGrade.findFirst();
  if (!proposta) {
    console.error("Nenhuma proposta encontrada no banco!");
    process.exit(1);
  }

  console.log(`Proposta encontrada: "${proposta.nome}" (ID: ${proposta.id})`);
  const relatorio = await validarPropostaDoBanco(proposta.id);

  console.log("\n--- RESULTADO DA ANÁLISE ---");
  console.log(`Status da Grade: ${relatorio.statusGrade}`);
  console.log(`Total de alocações: ${relatorio.totalAlocacoes}`);
  console.log(`Total de componentes ofertados: ${relatorio.totalComponentesOfertados}`);
  console.log(`Componentes não alocados: ${relatorio.componentesNaoAlocados.length}`);
  console.log(`Conflitos detectados: ${relatorio.conflitos.length}`);

  if (relatorio.conflitos.length > 0) {
    console.log("\nLista de Conflitos:");
    relatorio.conflitos.forEach((c, idx) => {
      console.log(` [${idx + 1}] [${c.gravidade}] ${c.tipo}: ${c.mensagem}`);
    });
  } else {
    console.log("\n✔ Perfeito! A grade da turma CC-6NA está 100% válida, sem nenhum conflito de sala, capacidade ou horário.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
