import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bcrypt from 'bcrypt';

const app = express();
const prisma = new PrismaClient();

app.use(cors()); // Permite conexões do front-end
app.use(express.json());

// ROTA: Criar nova conta
app.post('/register', async (req, res) => {
    const { email, senha, nome } = req.body;

    try {
        // Criptografa a senha antes de salvar
        const hashSenha = await bcrypt.hash(senha, 10);

        const user = await prisma.user.create({
            data: {
                email,
                senha: hashSenha,
                nome
            }
        });

        // Devolve os dados (menos a senha) para o Front-end fazer o login automático
        res.status(201).json({ id: user.id, nome: user.nome, email: user.email });
    } catch (error) {
        console.error("ERRO AO CRIAR USUÁRIO:", error);
        res.status(400).json({ error: 'E-mail já cadastrado ou dados inválidos.' });
    }
});

// ROTA: Fazer Login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // Compara a senha digitada com o hash salvo no banco
        const senhaValida = await bcrypt.compare(senha, user.senha);
        if (!senhaValida) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        res.json({ id: user.id, nome: user.nome, email: user.email });
    } catch (error) {
        console.error("ERRO NO LOGIN:", error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

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

// BUSCAR EXERCÍCIOS: Globais (userId null) + Customizados do Usuário
app.get('/exercises/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const exercises = await prisma.exercise.findMany({
            where: {
                OR: [
                    { userId: null },   // Exercícios padrão
                    { userId: userId }  // Exercícios criados por este usuário
                ]
            },
            orderBy: [
                { grupoMuscular: 'asc' },
                { nome: 'asc' }
            ]
        });
        res.json(exercises);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar exercícios.' });
    }
});

// CRIAR EXERCÍCIO CUSTOMIZADO
app.post('/exercises', async (req, res) => {
    const { nome, grupoMuscular, userId } = req.body;
    try {
        const exercise = await prisma.exercise.create({
            data: {
                nome,
                grupoMuscular,
                userId // Agora vinculado ao dono
            }
        });
        res.status(201).json(exercise);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar exercício customizado.' });
    }
});

// EXCLUIR EXERCÍCIO (Apenas se for customizado do usuário)
app.delete('/exercises/:id/:userId', async (req, res) => {
    const { id, userId } = req.params;
    try {
        const ex = await prisma.exercise.findFirst({
            where: { id: Number(id), userId: userId }
        });

        if (!ex) return res.status(403).json({ error: 'Você não pode excluir um exercício padrão.' });

        await prisma.exercise.delete({ where: { id: Number(id) } });
        res.json({ message: 'Excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir.' });
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

// 1. Buscar a Ficha do Usuário (Corrigido: removido 'items' ou 'nome')
app.get('/plans/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const plans = await prisma.workoutPlan.findMany({
            where: { userId },
            include: {
                exercise: true // Isso traz os dados do exercício (nome, grupoMuscular)
            },
            orderBy: { ficha: 'asc' }
        });
        res.json(plans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar sua ficha.' });
    }
});

// 2. Adicionar Exercício à Ficha (Corrigido: removido campos inexistentes)
app.post('/plans', async (req, res) => {
    const { userId, exerciseId, ficha } = req.body;
    try {
        const plan = await prisma.workoutPlan.create({
            data: {
                userId,
                exerciseId: Number(exerciseId),
                ficha: ficha.toUpperCase()
            }
        });
        res.status(201).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao adicionar exercício à ficha.' });
    }
});
// NOVA ROTA: Registrar Execução Diária (Log)
app.post('/logs', async (req, res) => {
    const { userId, exerciseId, carga, repsFeitas, sessionId } = req.body;
    try {
        const log = await prisma.workoutLog.create({
            data: {
                userId,
                exerciseId,
                carga,
                repsFeitas,
                sessionId: sessionId || null
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
                grupoMuscular
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

// Registrar novo peso
app.post('/weight', async (req, res) => {
    const { userId, peso } = req.body;
    try {
        const log = await prisma.weightLog.create({
            data: { userId, peso: Number(peso) }
        });
        // Atualiza também o peso mais recente no perfil do usuário
        await prisma.user.update({
            where: { id: userId },
            data: { pesoAtual: Number(peso) }
        });
        res.status(201).json(log);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao registrar peso.' });
    }
});

// Buscar histórico de peso do usuário
app.get('/weight/:userId', async (req, res) => {
    try {
        const history = await prisma.weightLog.findMany({
            where: { userId: req.params.userId },
            orderBy: { data: 'asc' }
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar histórico de peso.' });
    }
});

// Excluir registro de peso incorreto
app.delete('/weight/:id', async (req, res) => {
    try {
        await prisma.weightLog.delete({
            where: { id: Number(req.params.id) }
        });
        res.json({ message: 'Registro de peso excluído' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir peso.' });
    }
});

// ROTA: Buscar frequência de treinos (dias activos)
app.get('/logs/frequency/:userId', async (req, res) => {
    try {
        const logs = await prisma.workoutLog.findMany({
            where: { userId: req.params.userId },
            select: { data: true },
            orderBy: { data: 'asc' }
        });

        // Extrai apenas as datas únicas no formato YYYY-MM-DD
        const diasActivos = [...new Set(logs.map(log => log.data.toISOString().split('T')[0]))];

        res.json(diasActivos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar frequência.' });
    }
});

// === ROTAS DE SESSÃO DE TREINO (RELATÓRIO) ===

// 1. Iniciar um novo treino (Cria a sessão)
app.post('/sessions/start', async (req, res) => {
    const { userId } = req.body;
    try {
        // Verifica se já não tem um treino rodando (endTime nulo)
        const activeSession = await prisma.workoutSession.findFirst({
            where: { userId, endTime: null }
        });
        if (activeSession) return res.status(400).json({ error: 'Você já tem um treino em andamento.' });

        const session = await prisma.workoutSession.create({
            data: { userId }
        });
        res.status(201).json(session);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao iniciar treino.' });
    }
});

// 2. Finalizar treino atual (Calcula tempo e calorias)
app.put('/sessions/end', async (req, res) => {
    const { userId } = req.body;
    try {
        const session = await prisma.workoutSession.findFirst({
            where: { userId, endTime: null }
        });
        if (!session) return res.status(404).json({ error: 'Nenhuma sessão ativa encontrada.' });

        const endTime = new Date();
        const durationMin = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60);

        // Busca peso do usuário para calcular caloria
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const peso = user?.pesoAtual || 70; // Default 70kg se não tiver

        // Fórmula Simples: MET Musculação (aprox 5.0) * Peso * Tempo(h)
        const caloriasEstimadas = (5.0 * peso * (durationMin / 60));

        const updatedSession = await prisma.workoutSession.update({
            where: { id: session.id },
            data: {
                endTime,
                calories: Math.round(caloriasEstimadas)
            }
        });
        res.json(updatedSession);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao finalizar treino.' });
    }
});
// 4. Excluir uma Sessão de Treino inteira
app.delete('/sessions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1º passo: Apaga todos os logs vinculados a esta sessão para não deixar dados órfãos
        await prisma.workoutLog.deleteMany({
            where: { sessionId: id }
        });

        // 2º passo: Apaga a sessão do calendário
        await prisma.workoutSession.delete({
            where: { id }
        });

        res.json({ message: 'Sessão e séries excluídas com sucesso' });
    } catch (error) {
        console.error("ERRO AO EXCLUIR SESSÃO:", error);
        res.status(500).json({ error: 'Erro ao excluir a sessão.' });
    }
});
// 3. Buscar Relatório Detalhado de um dia específico (AGORA SUPORTA MÚLTIPLOS)
app.get('/reports/:userId/:date', async (req, res) => {
    const { userId, date } = req.params; // date no formato YYYY-MM-DD
    try {
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        // Busca TODAS as sessões finalizadas daquele dia
        const sessions = await prisma.workoutSession.findMany({
            where: {
                userId,
                startTime: { gte: startOfDay, lte: endOfDay },
                endTime: { not: null }
            },
            include: {
                logs: { include: { exercise: true } }
            },
            orderBy: { startTime: 'asc' } // Ordena do mais cedo para o mais tarde
        });

        res.json(sessions); // Retorna a lista de sessões
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar relatório.' });
    }
});

// 5. Buscar Volume Total de Carga (Últimos 7 Treinos)
app.get('/volume/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const sessions = await prisma.workoutSession.findMany({
            where: { userId, endTime: { not: null } },
            include: { logs: true },
            orderBy: { startTime: 'asc' },
            take: 7 // Pega apenas os últimos 7 treinos finalizados
        });

        const volumeData = sessions.map(session => {
            // Faz a conta: Carga * Repetições para cada série e soma tudo
            const totalVolume = session.logs.reduce((acc, log) => acc + (log.carga * log.repsFeitas), 0);
            return {
                data: session.startTime.toISOString(),
                volume: totalVolume
            };
        });

        res.json(volumeData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar volume.' });
    }
});

// 6. Buscar Último Treino por Exercício (O "Fantasma")
app.get('/logs/last/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const lastLogs = await prisma.workoutLog.findMany({
            where: { userId },
            orderBy: { id: 'desc' }, // Pega do mais recente para o mais antigo
            distinct: ['exerciseId'], // Pega apenas a última aparição de cada exercício
        });
        res.json(lastLogs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar histórico fantasma.' });
    }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});