import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const exerciciosGlobais = [
    // PEITO
    { nome: 'Supino Reto (Barra)', grupoMuscular: 'Peito' },
    { nome: 'Supino Reto (Halteres)', grupoMuscular: 'Peito' },
    { nome: 'Supino Inclinado (Barra)', grupoMuscular: 'Peito' },
    { nome: 'Supino Inclinado (Halteres)', grupoMuscular: 'Peito' },
    { nome: 'Supino Declinado', grupoMuscular: 'Peito' },
    { nome: 'Crucifixo Reto (Halteres)', grupoMuscular: 'Peito' },
    { nome: 'Crucifixo Inclinado', grupoMuscular: 'Peito' },
    { nome: 'Voador (Peck Deck)', grupoMuscular: 'Peito' },
    { nome: 'Crossover (Polia Alta)', grupoMuscular: 'Peito' },
    { nome: 'Crossover (Polia Média)', grupoMuscular: 'Peito' },
    { nome: 'Crossover (Polia Baixa)', grupoMuscular: 'Peito' },
    { nome: 'Pullover', grupoMuscular: 'Peito' },
    { nome: 'Flexão de Braços', grupoMuscular: 'Peito' },

    // COSTAS
    { nome: 'Barra Fixa', grupoMuscular: 'Costas' },
    { nome: 'Puxada Frontal (Aberta)', grupoMuscular: 'Costas' },
    { nome: 'Puxada Frontal (Triângulo)', grupoMuscular: 'Costas' },
    { nome: 'Puxada Frontal (Supinada)', grupoMuscular: 'Costas' },
    { nome: 'Remada Curvada (Barra)', grupoMuscular: 'Costas' },
    { nome: 'Remada Baixa (Triângulo)', grupoMuscular: 'Costas' },
    { nome: 'Remada Unilateral (Serrote)', grupoMuscular: 'Costas' },
    { nome: 'Remada Cavalinho', grupoMuscular: 'Costas' },
    { nome: 'Remada Máquina', grupoMuscular: 'Costas' },
    { nome: 'Pull Down (Corda/Barra)', grupoMuscular: 'Costas' },
    { nome: 'Levantamento Terra', grupoMuscular: 'Costas' },
    { nome: 'Crucifixo Inverso (Máquina)', grupoMuscular: 'Costas' },

    // PERNAS
    { nome: 'Agachamento Livre', grupoMuscular: 'Pernas' },
    { nome: 'Agachamento no Smith', grupoMuscular: 'Pernas' },
    { nome: 'Agachamento Hack', grupoMuscular: 'Pernas' },
    { nome: 'Leg Press 45º', grupoMuscular: 'Pernas' },
    { nome: 'Leg Press Horizontal', grupoMuscular: 'Pernas' },
    { nome: 'Afundo / Passada', grupoMuscular: 'Pernas' },
    { nome: 'Cadeira Extensora', grupoMuscular: 'Pernas' },
    { nome: 'Mesa Flexora', grupoMuscular: 'Pernas' },
    { nome: 'Cadeira Flexora', grupoMuscular: 'Pernas' },
    { nome: 'Stiff', grupoMuscular: 'Pernas' },
    { nome: 'Elevação Pélvica', grupoMuscular: 'Pernas' },
    { nome: 'Cadeira Abdutora', grupoMuscular: 'Pernas' },
    { nome: 'Cadeira Adutora', grupoMuscular: 'Pernas' },
    { nome: 'Panturrilha em Pé (Máquina)', grupoMuscular: 'Pernas' },
    { nome: 'Panturrilha Sentado (Banco)', grupoMuscular: 'Pernas' },
    { nome: 'Panturrilha no Leg Press', grupoMuscular: 'Pernas' },

    // OMBROS
    { nome: 'Desenvolvimento (Barra)', grupoMuscular: 'Ombros' },
    { nome: 'Desenvolvimento (Halteres)', grupoMuscular: 'Ombros' },
    { nome: 'Desenvolvimento (Máquina)', grupoMuscular: 'Ombros' },
    { nome: 'Elevação Lateral (Halteres)', grupoMuscular: 'Ombros' },
    { nome: 'Elevação Lateral (Polia)', grupoMuscular: 'Ombros' },
    { nome: 'Elevação Frontal (Halter/Barra)', grupoMuscular: 'Ombros' },
    { nome: 'Elevação Frontal (Polia)', grupoMuscular: 'Ombros' },
    { nome: 'Crucifixo Inverso (Halter/Cabo)', grupoMuscular: 'Ombros' },
    { nome: 'Encolhimento de Ombros (Trapézio)', grupoMuscular: 'Ombros' },

    // BRAÇOS
    { nome: 'Rosca Direta (Barra Reta)', grupoMuscular: 'Braços' },
    { nome: 'Rosca Direta (Barra W)', grupoMuscular: 'Braços' },
    { nome: 'Rosca Alternada (Halteres)', grupoMuscular: 'Braços' },
    { nome: 'Rosca Martelo', grupoMuscular: 'Braços' },
    { nome: 'Rosca Scott (Máquina/Barra)', grupoMuscular: 'Braços' },
    { nome: 'Rosca Concentrada', grupoMuscular: 'Braços' },
    { nome: 'Rosca Inversa (Antebraço)', grupoMuscular: 'Braços' },
    { nome: 'Tríceps Pulley (Barra Reta)', grupoMuscular: 'Braços' },
    { nome: 'Tríceps Pulley (Corda)', grupoMuscular: 'Braços' },
    { nome: 'Tríceps Testa (Barra W)', grupoMuscular: 'Braços' },
    { nome: 'Tríceps Francês (Halter/Polia)', grupoMuscular: 'Braços' },
    { nome: 'Tríceps Coice (Polia/Halter)', grupoMuscular: 'Braços' },
    { nome: 'Mergulho nas Paralelas', grupoMuscular: 'Braços' },
    { nome: 'Mergulho no Banco', grupoMuscular: 'Braços' },

    // CORE
    { nome: 'Abdominal Supra (Solo)', grupoMuscular: 'Core' },
    { nome: 'Abdominal Infra (Elevação de Pernas)', grupoMuscular: 'Core' },
    { nome: 'Abdominal Máquina', grupoMuscular: 'Core' },
    { nome: 'Abdominal Oblíquo (Polia/Solo)', grupoMuscular: 'Core' },
    { nome: 'Prancha Isométrica', grupoMuscular: 'Core' },
    { nome: 'Roda Abdominal', grupoMuscular: 'Core' }
  ];

  console.log('Limpando a biblioteca global antiga...');
  // Apaga apenas os exercícios que não pertencem a nenhum usuário (Globais)
  await prisma.exercise.deleteMany({
    where: { userId: null }
  });

  console.log('Injetando nova biblioteca completa de exercícios...');

  for (const ex of exerciciosGlobais) {
    await prisma.exercise.create({
      data: { 
        nome: ex.nome, 
        grupoMuscular: ex.grupoMuscular, 
        userId: null 
      },
    });
  }
  
  console.log(`Biblioteca atualizada com sucesso! ${exerciciosGlobais.length} exercícios adicionados.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });