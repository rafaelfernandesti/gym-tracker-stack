import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const exercicios = [
        { nome: 'Supino Reto', grupoMuscular: 'Peito' },
        { nome: 'Supino Inclinado', grupoMuscular: 'Peito' },
        { nome: 'Crucifixo', grupoMuscular: 'Peito' },
        { nome: 'Crossover', grupoMuscular: 'Peito' },
        { nome: 'Puxada Frontal', grupoMuscular: 'Costas' },
        { nome: 'Remada Curvada', grupoMuscular: 'Costas' },
        { nome: 'Pull Down', grupoMuscular: 'Costas' },
        { nome: 'Levantamento Terra', grupoMuscular: 'Costas' },
        { nome: 'Agachamento Livre', grupoMuscular: 'Pernas' },
        { nome: 'Leg Press 45', grupoMuscular: 'Pernas' },
        { nome: 'Extensora', grupoMuscular: 'Pernas' },
        { nome: 'Flexora', grupoMuscular: 'Pernas' },
        { nome: 'Desenvolvimento', grupoMuscular: 'Ombros' },
        { nome: 'Elevação Lateral', grupoMuscular: 'Ombros' },
        { nome: 'Rosca Direta', grupoMuscular: 'Braços' },
        { nome: 'Tríceps Corda', grupoMuscular: 'Braços' },
        { nome: 'Prancha Abdominal', grupoMuscular: 'Core' },
    ];

    for (const ex of exercicios) {
        await prisma.exercise.upsert({
            where: { id: 0 }, // Gambiarra para não duplicar se rodar de novo
            update: {},
            create: { ...ex, userId: null },
        });
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());