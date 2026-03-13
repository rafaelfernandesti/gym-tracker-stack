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

// Rota para listar todos os exercícios
app.get('/exercises', async (req, res) => {
    try {
        const exercises = await prisma.exercise.findMany();
        res.json(exercises);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar exercícios.' });
    }
});

app.post('/exercises', async (req, res) => {
    const { nome, grupoMuscular, equipamento } = req.body;
    try {
        const exercise = await prisma.exercise.create({
            data: { nome, grupoMuscular, equipamento }
        });
        res.status(201).json(exercise);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cadastrar o exercício.' });
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});