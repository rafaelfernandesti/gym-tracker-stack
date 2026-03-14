import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const app = express();
const prisma = new PrismaClient();

app.use(cors()); // Permite conexões do front-end
app.use(express.json());

app.get('/ping', (req, res) => {
    res.json({ message: 'Gym Tracker API online e conectada ao banco!' });
});

app.get('/exercises', async (req, res) => {
    try {
        const exercises = await prisma.exercise.findMany();
        res.json(exercises);
    } catch (error) {
        console.error("ERRO NO PRISMA:", error);
        // Agora vamos mandar o erro real para o Front-end ver
        res.status(500).json({
            error: 'Erro ao buscar exercícios.',
            detalhes: String(error)
        });
    }
});

// Nova rota de criação de exercício
app.post('/exercises', async (req, res) => {
    const { nome, grupoMuscular, equipamento, ficha } = req.body;

    try {
        const exercise = await prisma.exercise.create({
            data: {
                nome,
                grupoMuscular: grupoMuscular || 'Geral',
                equipamento: equipamento || 'Livre',
                ficha: ficha || 'A' // <-- Salva a ficha recebida
            }
        });
        res.status(201).json(exercise);
    } catch (error) {
        console.error("ERRO NO PRISMA:", error);
        res.status(500).json({ error: 'Erro ao criar exercício.', detalhes: String(error) });
    }
});

// NOVA ROTA: Cadastrar Usuário
app.post('/users', async (req, res) => {
    const { nome, email, altura, pesoAtual } = req.body;
    try {
        const user = await prisma.user.create({
            data: { nome, email, altura, pesoAtual }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
    }
});

// NOVA ROTA: Criar Ficha de Treino
app.post('/plans', async (req, res) => {
    const { userId, nome, items } = req.body;
    try {
        const plan = await prisma.workoutPlan.create({
            data: {
                userId,
                nome,
                items: {
                    create: items
                }
            },
            include: {
                items: true // Faz a API devolver os itens na resposta para validação
            }
        });
        res.status(201).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar ficha de treino.' });
    }
});
// NOVA ROTA: Registrar Execução Diária (Log)
app.post('/logs', async (req, res) => {
    const { userId, exerciseId, carga, repsFeitas } = req.body;
    try {
        const log = await prisma.workoutLog.create({
            data: {
                userId,
                exerciseId,
                carga,
                repsFeitas
            }
        });
        res.status(201).json(log);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao registrar a execução do exercício.' });
    }
});

// NOVA ROTA: Histórico de Evolução de Carga
app.get('/logs/evolution/:userId/:exerciseId', async (req, res) => {
    const { userId, exerciseId } = req.params;
    try {
        const evolution = await prisma.workoutLog.findMany({
            where: {
                userId,
                exerciseId: Number(exerciseId)
            },
            orderBy: {
                data: 'asc'
            },
            select: {
                id: true,
                data: true,
                carga: true,
                repsFeitas: true
            }
        });
        res.status(200).json(evolution);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar o histórico de evolução.' });
    }
});
// Rota para cadastrar um novo exercício
app.post('/exercises', async (req, res) => {
    const { nome, grupoMuscular, equipamento } = req.body;

    try {
        const exercise = await prisma.exercise.create({
            data: {
                nome,
                grupoMuscular: grupoMuscular || 'Geral',
                equipamento: equipamento || 'Livre'
            }
        });
        res.status(201).json(exercise);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar exercício.' });
    }
});

// Rota para deletar um registro de treino
app.delete('/logs/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.workoutLog.delete({
            where: { id: id }
        });
        res.json({ message: 'Treino excluído com sucesso' });
    } catch (error) {
        console.error("ERRO AO EXCLUIR TREINO:", error);
        res.status(500).json({ error: 'Erro ao excluir o registro.' });
    }
});

// Rota para editar um exercício existente
app.put('/exercises/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, grupoMuscular, ficha } = req.body;

    try {
        const exercise = await prisma.exercise.update({
            where: { id: Number(id) },
            data: {
                nome,
                grupoMuscular,
                ficha
            }
        });
        res.json(exercise);
    } catch (error) {
        console.error("ERRO AO ATUALIZAR EXERCÍCIO:", error);
        res.status(500).json({ error: 'Erro ao atualizar o exercício.' });
    }
});

// Rota para excluir um exercício e todo o seu histórico
app.delete('/exercises/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1º passo: Apaga todo o histórico de treinos desse exercício
        await prisma.workoutLog.deleteMany({
            where: { exerciseId: Number(id) }
        });

        // 2º passo: Apaga o exercício
        await prisma.exercise.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Exercício e histórico excluídos com sucesso' });
    } catch (error) {
        console.error("ERRO AO EXCLUIR EXERCÍCIO:", error);
        res.status(500).json({ error: 'Erro ao excluir o exercício.' });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});