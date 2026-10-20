const { horaParaMinutos, haSobreposicaoHorario, validarGrade } = require('./src/lib/conflicts');
const { DiaSemana, TipoComponente } = require('@prisma/client');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✔ PASSOU: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✖ FALHOU: ${message}`);
    process.exitCode = 1;
  }
}

console.log("=== INICIANDO TESTES DO VALIDADOR DE CONFLITOS (PASSO 2) ===\n");

// 1. Testes de sobreposição de horários
console.log("1. Testes de Sobreposição de Horários:");
assert(horaParaMinutos("18:30") === 1110, "18:30 equivale a 1110 minutos");
assert(haSobreposicaoHorario("18:30", "20:10", "19:20", "21:00") === true, "Sobreposição parcial detectada (18:30-20:10 vs 19:20-21:00)");
assert(haSobreposicaoHorario("18:30", "19:20", "19:20", "20:10") === false, "Aulas consecutivas não conflitam (18:30-19:20 vs 19:20-20:10)");
assert(haSobreposicaoHorario("18:30", "21:50", "19:20", "20:10") === true, "Aula contida dentro de outra detectada como conflito");

// 2. Teste: Grade Válida (Cenário da sua grade de referência)
console.log("\n2. Teste da Grade Válida (Grade de Referência):");
const gradeValida = [
  {
    id: "a1",
    salaId: "sala-201",
    diaSemana: DiaSemana.TERCA,
    horaInicio: "18:30",
    horaFim: "20:10",
    componente: {
      id: "c1",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "Linguagens Formais" }
    },
    sala: { id: "sala-201", codigo: "Sala 201", capacidade: 50, emManutencao: false, ativo: true }
  },
  {
    id: "a2",
    salaId: "sala-201",
    diaSemana: DiaSemana.TERCA,
    horaInicio: "20:10",
    horaFim: "21:50",
    componente: {
      id: "c2",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "Sistemas Multimídias" }
    },
    sala: { id: "sala-201", codigo: "Sala 201", capacidade: 50, emManutencao: false, ativo: true }
  },
  {
    id: "a3",
    salaId: null, // Sábado sem sala física
    diaSemana: DiaSemana.SABADO,
    horaInicio: "08:00",
    horaFim: "11:40",
    componente: {
      id: "c3",
      tipo: TipoComponente.REMOTO,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "DOL Empreendedorismo" }
    },
    sala: null
  }
];

const conflitosValidos = validarGrade(gradeValida);
assert(conflitosValidos.length === 0, "Grade válida não deve gerar nenhum conflito");

// 3. Teste: Conflito de Capacidade (RN11)
console.log("\n3. Teste de Conflito de Capacidade (RN11):");
const gradeCapacidadeInsuficiente = [
  {
    id: "a4",
    salaId: "sala-102",
    diaSemana: DiaSemana.SEGUNDA,
    horaInicio: "19:20",
    horaFim: "21:50",
    componente: {
      id: "c4",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "Redes Neurais" }
    },
    sala: { id: "sala-102", codigo: "Sala 102", capacidade: 35, emManutencao: false, ativo: true } // 35 < 40!
  }
];
const conflitosCapacidade = validarGrade(gradeCapacidadeInsuficiente);
assert(conflitosCapacidade.some(c => c.tipo === "CAPACIDADE_INSUFICIENTE"), "Detectou que sala de 35 vagas não suporta turma de 40 alunos");

// 4. Teste: Choque de Sala (RN10)
console.log("\n4. Teste de Choque de Sala (RN10):");
const gradeChoqueSala = [
  {
    id: "a5",
    salaId: "sala-201",
    diaSemana: DiaSemana.QUARTA,
    horaInicio: "18:30",
    horaFim: "20:10",
    componente: {
      id: "c5",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "Paradigmas" }
    },
    sala: { id: "sala-201", codigo: "Sala 201", capacidade: 50, emManutencao: false, ativo: true }
  },
  {
    id: "a6",
    salaId: "sala-201", // Mesma sala!
    diaSemana: DiaSemana.QUARTA,
    horaInicio: "19:20", // Sobreposição com 18:30-20:10!
    horaFim: "21:00",
    componente: {
      id: "c6",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t2", turmaNome: "ENG-4NA", qtdAlunos: 30, disciplinaNome: "Cálculo III" }
    },
    sala: { id: "sala-201", codigo: "Sala 201", capacidade: 50, emManutencao: false, ativo: true }
  }
];
const conflitosChoqueSala = validarGrade(gradeChoqueSala);
assert(conflitosChoqueSala.some(c => c.tipo === "SALA_SOBREPOSTA"), "Detectou choque de sala simultânea em horários sobrepostos");

// 5. Teste: Regra de Sábado (Sem presencial no campus)
console.log("\n5. Teste da Regra de Sábado:");
const gradeSabadoComSala = [
  {
    id: "a7",
    salaId: "sala-201", // Violando: colocou sala no sábado!
    diaSemana: DiaSemana.SABADO,
    horaInicio: "08:00",
    horaFim: "11:40",
    componente: {
      id: "c7",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "Aula Presencial Sábado" }
    },
    sala: { id: "sala-201", codigo: "Sala 201", capacidade: 50, emManutencao: false, ativo: true }
  }
];
const conflitosSabado = validarGrade(gradeSabadoComSala);
assert(conflitosSabado.some(c => c.tipo === "SABADO_COM_SALA_FISICA"), "Bloqueou alocação física presencial no sábado");

// 6. Teste: Sala em Manutenção (RN12)
console.log("\n6. Teste de Sala em Manutenção (RN12):");
const gradeManutencao = [
  {
    id: "a8",
    salaId: "sala-manutencao",
    diaSemana: DiaSemana.SEXTA,
    horaInicio: "18:30",
    horaFim: "20:10",
    componente: {
      id: "c8",
      tipo: TipoComponente.PRESENCIAL,
      oferta: { turmaId: "t1", turmaNome: "CC-6NA", qtdAlunos: 40, disciplinaNome: "Compiladores" }
    },
    sala: { id: "sala-manutencao", codigo: "Lab 01 (Reforma)", capacidade: 50, emManutencao: true, ativo: true }
  }
];
const conflitosManutencao = validarGrade(gradeManutencao);
assert(conflitosManutencao.some(c => c.tipo === "SALA_EM_MANUTENCAO"), "Bloqueou uso de sala em manutenção");

console.log(`\n========================================`);
console.log(`RESULTADO: ${passedTests}/${totalTests} testes passaram com sucesso!`);
console.log(`========================================\n`);
