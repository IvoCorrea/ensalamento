import { prisma } from "./src/lib/prisma";
import { gerarPropostaGradeAutomatica } from "./src/lib/services/solver-service";

async function main() {
  console.log("=== TESTANDO GERAÇÃO AUTOMÁTICA DE GRADE (PASSO 4 - MOTOR FET) ===\n");

  const periodoLetivo = await prisma.periodoLetivo.findFirst();
  if (!periodoLetivo) {
    console.error("Período letivo não encontrado!");
    process.exit(1);
  }

  console.log(`Iniciando geração para o período letivo: ${periodoLetivo.codigo} (${periodoLetivo.nome})...`);

  const resultado = await gerarPropostaGradeAutomatica(
    periodoLetivo.id,
    "Proposta Teste Passo 4 - Auto FET"
  );

  console.log("\n--- RESULTADO DA GERAÇÃO ---");
  console.log(`Proposta ID: ${resultado.propostaId}`);
  console.log(`Nome da Proposta: ${resultado.propostaNome}`);
  console.log(`Resultado: ${resultado.resultado}`);
  console.log(`Total de Atividades: ${resultado.totalAtividades}`);
  console.log(`Total Alocadas com Sucesso: ${resultado.totalAlocadas}`);
  console.log(`Atividades não alocadas: ${resultado.atividadesNaoAlocadas.length}`);

  if (resultado.atividadesNaoAlocadas.length > 0) {
    console.log("Atividades pendentes:");
    resultado.atividadesNaoAlocadas.forEach((na) => {
      console.log(` - [${na.turmaNome}] ${na.disciplinaNome}: ${na.motivo}`);
    });
  }

  console.log("\n--- AUDITORIA DE CONFLITOS (PASSO 2 ENGINE) ---");
  console.log(`Status de Integridade: ${resultado.relatorioValidacao.statusGrade}`);
  console.log(`Total de Conflitos Detectados: ${resultado.relatorioValidacao.conflitos.length}`);

  if (resultado.relatorioValidacao.conflitos.length === 0) {
    console.log("✔ SUCESSO ABSOLUTO: 100% das atividades alocadas sem nenhum conflito de sala, horário ou capacidade!");
  } else {
    console.error("✖ ATENÇÃO: Foram detectados conflitos na proposta gerada:");
    resultado.relatorioValidacao.conflitos.forEach((c) => {
      console.error(` - [${c.tipo}] ${c.mensagem}`);
    });
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
