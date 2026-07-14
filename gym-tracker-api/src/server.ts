import crypto from 'crypto';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bcrypt from 'bcrypt';

const app = express();
const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_RESET_TTL_MINUTES = 30;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gym-tracker-stack.vercel.app';

type AuthRequest = express.Request & { userId?: string };

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);
const base64Url = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const signAuthToken = (userId: string) => {
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64Url(JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    }));
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    return `${header}.${payload}.${signature}`;
};

const verifyAuthToken = (token: string) => {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    const receivedSignature = Buffer.from(signature);
    const validSignature = Buffer.from(expectedSignature);

    if (
        receivedSignature.length !== validSignature.length ||
        !crypto.timingSafeEqual(receivedSignature, validSignature)
    ) {
        return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }

    return decoded.sub;
};

const userResponse = (user: { id: string; nome: string | null; email: string; foto: string | null }) => ({
    id: user.id,
    nome: user.nome,
    email: user.email,
    foto: user.foto,
    token: signAuthToken(user.id)
});

const sendPasswordResetEmail = async (email: string, resetUrl: string) => {
    const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API || process.env.RESENDER_API;
    const from = process.env.PASSWORD_RESET_FROM || 'GymTracker <onboarding@resend.dev>';

    if (!apiKey) {
        console.log(`Link de recuperação para ${email}: ${resetUrl}`);
        return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from,
            to: email,
            subject: 'Recuperação de senha - GymTracker',
            html: `
                <p>Você solicitou a recuperação de senha do GymTracker.</p>
                <p>Use este link nos próximos ${PASSWORD_RESET_TTL_MINUTES} minutos:</p>
                <p><a href="${resetUrl}">Redefinir senha</a></p>
                <p>Se você não pediu isso, ignore este e-mail.</p>
            `
        })
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Falha ao enviar e-mail de recuperação: ${details}`);
    }

    return true;
};

const requireAuth: express.RequestHandler = (req: AuthRequest, res, next) => {
    const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
        return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    try {
        const userId = verifyAuthToken(token);
        if (!userId) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
        req.userId = userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
};

const requireSameUserParam = (req: AuthRequest, res: express.Response, paramUserId?: string) => {
    if (!req.userId || (paramUserId && paramUserId !== req.userId)) {
        res.status(403).json({ error: 'Acesso negado.' });
        return false;
    }
    return true;
};

const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

const parsePositiveInt = (value: string | number | undefined) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeExerciseName = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ensureActiveProgram = async (userId: string) => {
    const activeProgram = await prisma.workoutProgram.findFirst({
        where: { userId, isActive: true }
    });
    if (activeProgram) return activeProgram;

    const orphanPlans = await prisma.workoutPlan.count({
        where: { userId, programId: null }
    });

    if (orphanPlans > 0) {
        const program = await prisma.workoutProgram.create({
            data: {
                userId,
                nome: 'Plano atual',
                isActive: true
            }
        });
        await prisma.workoutPlan.updateMany({
            where: { userId, programId: null },
            data: { programId: program.id }
        });
        return program;
    }

    const latestProgram = await prisma.workoutProgram.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
    });

    if (latestProgram) {
        await prisma.workoutProgram.updateMany({
            where: { userId },
            data: { isActive: false }
        });
        return prisma.workoutProgram.update({
            where: { id: latestProgram.id },
            data: { isActive: true }
        });
    }

    return prisma.workoutProgram.create({
        data: {
            userId,
            nome: 'Plano atual',
            isActive: true
        }
    });
};

const workoutTemplates = [
    {
        id: 'full-body-3x',
        nome: 'Full Body 3x',
        objetivo: 'Iniciante',
        divisao: 'Full Body',
        nivel: 'Iniciante',
        frequencia: '3x/semana',
        descricao: 'Plano simples para treinar o corpo todo com boa frequência semanal.',
        dias: [
            {
                nome: 'Full Body A',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 3 },
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 3 },
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 3 },
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 2 },
                    { nome: 'Prancha Isométrica', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Full Body B',
                exercicios: [
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 3 },
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 3 },
                    { nome: 'Rosca Direta (Barra Reta)', seriesAlvo: 2 },
                    { nome: 'Tríceps Pulley (Corda)', seriesAlvo: 2 }
                ]
            },
            {
                nome: 'Full Body C',
                exercicios: [
                    { nome: 'Stiff', seriesAlvo: 3 },
                    { nome: 'Flexão de Braços', seriesAlvo: 3 },
                    { nome: 'Remada Unilateral (Serrote)', seriesAlvo: 3 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 2 },
                    { nome: 'Abdominal Supra (Solo)', seriesAlvo: 3 }
                ]
            }
        ]
    },
    {
        id: 'abc-geral',
        nome: 'ABC Geral',
        objetivo: 'Hipertrofia',
        divisao: 'ABC',
        nivel: 'Intermediário',
        frequencia: '3-6x/semana',
        descricao: 'Divisão clássica para peito/tríceps, costas/bíceps e pernas/ombros.',
        dias: [
            {
                nome: 'Peito e Tríceps',
                exercicios: [
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 4 },
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 3 },
                    { nome: 'Crossover (Polia Alta)', seriesAlvo: 3 },
                    { nome: 'Tríceps Pulley (Barra Reta)', seriesAlvo: 3 },
                    { nome: 'Tríceps Francês (Halter/Polia)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Costas e Bíceps',
                exercicios: [
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 4 },
                    { nome: 'Remada Curvada (Barra)', seriesAlvo: 3 },
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 3 },
                    { nome: 'Rosca Direta (Barra W)', seriesAlvo: 3 },
                    { nome: 'Rosca Martelo', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Pernas e Ombros',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 4 },
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Mesa Flexora', seriesAlvo: 3 },
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 3 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 3 }
                ]
            }
        ]
    },
    {
        id: 'ppl',
        nome: 'Push Pull Legs',
        objetivo: 'Hipertrofia',
        divisao: 'Push/Pull/Legs',
        nivel: 'Intermediário',
        frequencia: '3-6x/semana',
        descricao: 'Divisão eficiente para empurrar, puxar e pernas.',
        dias: [
            {
                nome: 'Push',
                exercicios: [
                    { nome: 'Supino Reto (Halteres)', seriesAlvo: 4 },
                    { nome: 'Desenvolvimento (Máquina)', seriesAlvo: 3 },
                    { nome: 'Elevação Lateral (Polia)', seriesAlvo: 3 },
                    { nome: 'Tríceps Pulley (Corda)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Pull',
                exercicios: [
                    { nome: 'Barra Fixa', seriesAlvo: 3 },
                    { nome: 'Puxada Frontal (Triângulo)', seriesAlvo: 3 },
                    { nome: 'Remada Unilateral (Serrote)', seriesAlvo: 3 },
                    { nome: 'Rosca Alternada (Halteres)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Legs',
                exercicios: [
                    { nome: 'Agachamento Hack', seriesAlvo: 4 },
                    { nome: 'Cadeira Extensora', seriesAlvo: 3 },
                    { nome: 'Cadeira Flexora', seriesAlvo: 3 },
                    { nome: 'Panturrilha em Pé (Máquina)', seriesAlvo: 4 }
                ]
            }
        ]
    },
    {
        id: 'superior-inferior',
        nome: 'Superior / Inferior',
        objetivo: 'Força',
        divisao: 'Superior/Inferior',
        nivel: 'Básico ao avançado',
        frequencia: '4x/semana',
        descricao: 'Alternância direta para evoluir mantendo descanso organizado.',
        dias: [
            {
                nome: 'Superior A',
                exercicios: [
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 4 },
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 4 },
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 3 },
                    { nome: 'Rosca Direta (Barra Reta)', seriesAlvo: 3 },
                    { nome: 'Tríceps Pulley (Corda)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Inferior A',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 4 },
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Mesa Flexora', seriesAlvo: 3 },
                    { nome: 'Panturrilha Sentado (Banco)', seriesAlvo: 4 }
                ]
            },
            {
                nome: 'Superior B',
                exercicios: [
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 3 },
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 4 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 3 },
                    { nome: 'Rosca Martelo', seriesAlvo: 3 },
                    { nome: 'Tríceps Testa (Barra W)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Inferior B',
                exercicios: [
                    { nome: 'Stiff', seriesAlvo: 4 },
                    { nome: 'Afundo / Passada', seriesAlvo: 3 },
                    { nome: 'Cadeira Extensora', seriesAlvo: 3 },
                    { nome: 'Panturrilha no Leg Press', seriesAlvo: 4 }
                ]
            }
        ]
    },
    {
        id: 'iniciante-full-body-2x',
        nome: 'Iniciante Full Body 2x',
        objetivo: 'Iniciante',
        divisao: 'Full Body',
        nivel: 'Iniciante',
        frequencia: '2x/semana',
        descricao: 'Plano enxuto para criar consistência sem sobrecarregar a rotina.',
        dias: [
            {
                nome: 'Corpo Todo A',
                exercicios: [
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Supino Reto (Halteres)', seriesAlvo: 3 },
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 3 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 2 },
                    { nome: 'Abdominal Supra (Solo)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Corpo Todo B',
                exercicios: [
                    { nome: 'Agachamento no Smith', seriesAlvo: 3 },
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 3 },
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 3 },
                    { nome: 'Rosca Alternada (Halteres)', seriesAlvo: 2 },
                    { nome: 'Tríceps Pulley (Corda)', seriesAlvo: 2 }
                ]
            }
        ]
    },
    {
        id: 'emagrecimento-full-body-3x',
        nome: 'Emagrecimento Full Body 3x',
        objetivo: 'Emagrecimento',
        divisao: 'Full Body',
        nivel: 'Básico ao intermediário',
        frequencia: '3x/semana',
        descricao: 'Treinos de corpo todo com exercícios grandes e ritmo constante.',
        dias: [
            {
                nome: 'Metabólico A',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 3 },
                    { nome: 'Supino Reto (Halteres)', seriesAlvo: 3 },
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 3 },
                    { nome: 'Prancha Isométrica', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Metabólico B',
                exercicios: [
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 3 },
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 3 },
                    { nome: 'Abdominal Infra (Elevação de Pernas)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Metabólico C',
                exercicios: [
                    { nome: 'Afundo / Passada', seriesAlvo: 3 },
                    { nome: 'Flexão de Braços', seriesAlvo: 3 },
                    { nome: 'Remada Unilateral (Serrote)', seriesAlvo: 3 },
                    { nome: 'Roda Abdominal', seriesAlvo: 3 }
                ]
            }
        ]
    },
    {
        id: 'forca-full-body-3x',
        nome: 'Força Full Body 3x',
        objetivo: 'Força',
        divisao: 'Full Body',
        nivel: 'Intermediário',
        frequencia: '3x/semana',
        descricao: 'Base de força com foco em movimentos compostos e progressão.',
        dias: [
            {
                nome: 'Força A',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 5 },
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 5 },
                    { nome: 'Remada Curvada (Barra)', seriesAlvo: 4 }
                ]
            },
            {
                nome: 'Força B',
                exercicios: [
                    { nome: 'Levantamento Terra', seriesAlvo: 5 },
                    { nome: 'Desenvolvimento (Barra)', seriesAlvo: 5 },
                    { nome: 'Barra Fixa', seriesAlvo: 4 }
                ]
            },
            {
                nome: 'Força C',
                exercicios: [
                    { nome: 'Agachamento no Smith', seriesAlvo: 4 },
                    { nome: 'Supino Inclinado (Barra)', seriesAlvo: 4 },
                    { nome: 'Remada Cavalinho', seriesAlvo: 4 }
                ]
            }
        ]
    },
    {
        id: 'hipertrofia-abcd-4x',
        nome: 'Hipertrofia ABCD 4x',
        objetivo: 'Hipertrofia',
        divisao: 'ABCD',
        nivel: 'Intermediário',
        frequencia: '4x/semana',
        descricao: 'Mais volume por grupo muscular para quem treina quatro vezes na semana.',
        dias: [
            {
                nome: 'Peito',
                exercicios: [
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 4 },
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 4 },
                    { nome: 'Crucifixo Inclinado', seriesAlvo: 3 },
                    { nome: 'Crossover (Polia Alta)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Costas',
                exercicios: [
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 4 },
                    { nome: 'Remada Curvada (Barra)', seriesAlvo: 4 },
                    { nome: 'Remada Máquina', seriesAlvo: 3 },
                    { nome: 'Pull Down (Corda/Barra)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Pernas',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 4 },
                    { nome: 'Leg Press 45º', seriesAlvo: 4 },
                    { nome: 'Cadeira Extensora', seriesAlvo: 3 },
                    { nome: 'Mesa Flexora', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Ombros e Braços',
                exercicios: [
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 4 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 3 },
                    { nome: 'Rosca Direta (Barra W)', seriesAlvo: 3 },
                    { nome: 'Tríceps Testa (Barra W)', seriesAlvo: 3 }
                ]
            }
        ]
    },
    {
        id: 'condicionamento-superior-inferior-4x',
        nome: 'Condicionamento 4x',
        objetivo: 'Condicionamento',
        divisao: 'Superior/Inferior',
        nivel: 'Intermediário',
        frequencia: '4x/semana',
        descricao: 'Alterna superior e inferior com exercícios que mantêm ritmo e capacidade de trabalho.',
        dias: [
            {
                nome: 'Superior Ritmo',
                exercicios: [
                    { nome: 'Supino Reto (Halteres)', seriesAlvo: 3 },
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 3 },
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 3 },
                    { nome: 'Prancha Isométrica', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Inferior Ritmo',
                exercicios: [
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Afundo / Passada', seriesAlvo: 3 },
                    { nome: 'Stiff', seriesAlvo: 3 },
                    { nome: 'Panturrilha no Leg Press', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Superior Volume',
                exercicios: [
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 3 },
                    { nome: 'Flexão de Braços', seriesAlvo: 3 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 3 },
                    { nome: 'Abdominal Oblíquo (Polia/Solo)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Inferior Volume',
                exercicios: [
                    { nome: 'Agachamento Hack', seriesAlvo: 3 },
                    { nome: 'Cadeira Extensora', seriesAlvo: 3 },
                    { nome: 'Cadeira Flexora', seriesAlvo: 3 },
                    { nome: 'Panturrilha em Pé (Máquina)', seriesAlvo: 3 }
                ]
            }
        ]
    },
    {
        id: 'hipertrofia-abcde-5x',
        nome: 'Hipertrofia 5x',
        objetivo: 'Hipertrofia',
        divisao: 'ABCD',
        nivel: 'Avançado',
        frequencia: '5x/semana',
        descricao: 'Cinco dias para alto volume com sessões mais específicas.',
        dias: [
            {
                nome: 'Peito',
                exercicios: [
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 4 },
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 4 },
                    { nome: 'Voador (Peck Deck)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Costas',
                exercicios: [
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 4 },
                    { nome: 'Remada Curvada (Barra)', seriesAlvo: 4 },
                    { nome: 'Pull Down (Corda/Barra)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Pernas',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 4 },
                    { nome: 'Leg Press 45º', seriesAlvo: 4 },
                    { nome: 'Mesa Flexora', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Ombros',
                exercicios: [
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 4 },
                    { nome: 'Elevação Lateral (Halteres)', seriesAlvo: 4 },
                    { nome: 'Crucifixo Inverso (Halter/Cabo)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Braços e Core',
                exercicios: [
                    { nome: 'Rosca Direta (Barra W)', seriesAlvo: 3 },
                    { nome: 'Tríceps Pulley (Corda)', seriesAlvo: 3 },
                    { nome: 'Abdominal Máquina', seriesAlvo: 3 }
                ]
            }
        ]
    },
    {
        id: 'ppl-6x',
        nome: 'Push Pull Legs 6x',
        objetivo: 'Hipertrofia',
        divisao: 'Push/Pull/Legs',
        nivel: 'Avançado',
        frequencia: '6x/semana',
        descricao: 'Alta frequência para repetir Push/Pull/Legs duas vezes por semana.',
        dias: [
            {
                nome: 'Push A',
                exercicios: [
                    { nome: 'Supino Reto (Barra)', seriesAlvo: 4 },
                    { nome: 'Supino Inclinado (Halteres)', seriesAlvo: 3 },
                    { nome: 'Desenvolvimento (Halteres)', seriesAlvo: 3 },
                    { nome: 'Tríceps Pulley (Corda)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Pull A',
                exercicios: [
                    { nome: 'Puxada Frontal (Aberta)', seriesAlvo: 4 },
                    { nome: 'Remada Curvada (Barra)', seriesAlvo: 3 },
                    { nome: 'Rosca Direta (Barra Reta)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Legs A',
                exercicios: [
                    { nome: 'Agachamento Livre', seriesAlvo: 4 },
                    { nome: 'Leg Press 45º', seriesAlvo: 3 },
                    { nome: 'Mesa Flexora', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Push B',
                exercicios: [
                    { nome: 'Supino Inclinado (Barra)', seriesAlvo: 4 },
                    { nome: 'Elevação Lateral (Polia)', seriesAlvo: 3 },
                    { nome: 'Tríceps Testa (Barra W)', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Pull B',
                exercicios: [
                    { nome: 'Barra Fixa', seriesAlvo: 3 },
                    { nome: 'Remada Baixa (Triângulo)', seriesAlvo: 4 },
                    { nome: 'Rosca Martelo', seriesAlvo: 3 }
                ]
            },
            {
                nome: 'Legs B',
                exercicios: [
                    { nome: 'Stiff', seriesAlvo: 4 },
                    { nome: 'Cadeira Extensora', seriesAlvo: 3 },
                    { nome: 'Panturrilha Sentado (Banco)', seriesAlvo: 4 }
                ]
            }
        ]
    }
];

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173,https://gym-tracker-web-yomc.onrender.com,https://gym-tracker-stack.vercel.app')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin?: string) => {
    if (!origin || allowedOrigins.includes(origin)) return true;

    try {
        const parsedOrigin = new URL(origin);
        const isLocalhost = ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname);
        const isRenderApp = parsedOrigin.protocol === 'https:' && parsedOrigin.hostname.endsWith('.onrender.com');
        const isVercelApp = parsedOrigin.protocol === 'https:' && parsedOrigin.hostname.endsWith('.vercel.app');

        return isLocalhost || isRenderApp || isVercelApp;
    } catch (error) {
        return false;
    }
};

app.use(cors({
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Origem não permitida pelo CORS.'));
    }
}));
app.use(express.json({ limit: '1mb' }));

app.get('/ping', (req, res) => {
    res.json({ message: 'Gym Tracker API online e conectada ao banco!' });
});

app.post('/register', async (req, res) => {
    const { email, senha, nome, foto } = req.body;

    if (typeof email !== 'string' || typeof senha !== 'string' || senha.trim().length < 6) {
        return res.status(400).json({ error: 'Informe e-mail e senha com pelo menos 6 caracteres.' });
    }

    try {
        const hashSenha = await bcrypt.hash(senha, BCRYPT_ROUNDS);
        const user = await prisma.user.create({
            data: {
                email: email.trim().toLowerCase(),
                senha: hashSenha,
                nome: typeof nome === 'string' ? nome : null,
                foto: typeof foto === 'string' ? foto : null
            }
        });

        res.status(201).json(userResponse(user));
    } catch (error) {
        console.error('ERRO AO CRIAR USUÁRIO:', error);
        res.status(400).json({ error: 'E-mail já cadastrado ou dados inválidos.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (typeof email !== 'string' || typeof senha !== 'string') {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });

        const senhaValida = isBcryptHash(user.senha)
            ? await bcrypt.compare(senha, user.senha)
            : senha === user.senha;
        if (!senhaValida) return res.status(401).json({ error: 'Credenciais inválidas.' });

        if (!isBcryptHash(user.senha)) {
            await prisma.user.update({
                where: { id: user.id },
                data: { senha: await bcrypt.hash(senha, BCRYPT_ROUNDS) }
            });
        }

        res.json(userResponse(user));
    } catch (error) {
        console.error('ERRO NO LOGIN:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/password/forgot', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const genericResponse: { message: string; resetUrl?: string } = {
        message: 'Se o e-mail estiver cadastrado, enviaremos instruções para recuperar sua senha.'
    };

    if (!normalizedEmail) return res.json(genericResponse);

    try {
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) return res.json(genericResponse);

        await prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() }
        });

        const resetToken = crypto.randomBytes(32).toString('base64url');
        const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}/?resetToken=${encodeURIComponent(resetToken)}`;

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash: hashResetToken(resetToken),
                expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000)
            }
        });

        const emailSent = await sendPasswordResetEmail(normalizedEmail, resetUrl);

        if (!emailSent && process.env.NODE_ENV !== 'production') {
            genericResponse.resetUrl = resetUrl;
        }

        res.json(genericResponse);
    } catch (error) {
        console.error('ERRO AO SOLICITAR RECUPERAÇÃO DE SENHA:', error);
        res.status(500).json({ error: 'Erro ao solicitar recuperação de senha.' });
    }
});

app.post('/password/reset', async (req, res) => {
    const { token, novaSenha } = req.body;

    if (typeof token !== 'string' || typeof novaSenha !== 'string' || novaSenha.trim().length < 6) {
        return res.status(400).json({ error: 'Link inválido ou senha menor que 6 caracteres.' });
    }

    try {
        const tokenHash = hashResetToken(token);
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true }
        });

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
        }

        const hashSenha = await bcrypt.hash(novaSenha, BCRYPT_ROUNDS);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { senha: hashSenha }
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() }
            })
        ]);

        res.json(userResponse(resetToken.user));
    } catch (error) {
        console.error('ERRO AO REDEFINIR SENHA:', error);
        res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
});

app.use(requireAuth);

app.get('/me', async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, nome: true, email: true, foto: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(user);
});

app.get('/exercises', async (req: AuthRequest, res) => {
    try {
        const exercises = await prisma.exercise.findMany({
            where: {
                OR: [
                    { userId: null },
                    { userId: req.userId }
                ]
            },
            orderBy: [
                { grupoMuscular: 'asc' },
                { nome: 'asc' }
            ]
        });
        res.json(exercises);
    } catch (error) {
        console.error('ERRO NO PRISMA:', error);
        res.status(500).json({ error: 'Erro ao buscar exercícios.' });
    }
});

app.get('/exercises/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;

    try {
        const exercises = await prisma.exercise.findMany({
            where: {
                OR: [
                    { userId: null },
                    { userId: req.userId }
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

app.post('/exercises', async (req: AuthRequest, res) => {
    const { nome, grupoMuscular } = req.body;
    if (typeof nome !== 'string' || !nome.trim()) {
        return res.status(400).json({ error: 'Nome do exercício é obrigatório.' });
    }

    try {
        const exercise = await prisma.exercise.create({
            data: {
                nome: nome.trim(),
                grupoMuscular: typeof grupoMuscular === 'string' && grupoMuscular.trim() ? grupoMuscular.trim() : 'Geral',
                userId: req.userId
            }
        });
        res.status(201).json(exercise);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar exercício customizado.' });
    }
});

app.put('/exercises/:id', async (req: AuthRequest, res) => {
    const id = parsePositiveInt(routeParam(req.params.id));
    const { nome, grupoMuscular } = req.body;
    if (!id) return res.status(400).json({ error: 'Exercício inválido.' });

    try {
        const exercise = await prisma.exercise.updateMany({
            where: { id, userId: req.userId },
            data: {
                nome: typeof nome === 'string' && nome.trim() ? nome.trim() : undefined,
                grupoMuscular: typeof grupoMuscular === 'string' ? grupoMuscular : undefined
            }
        });
        if (!exercise.count) return res.status(403).json({ error: 'Você só pode editar exercícios criados por você.' });
        const updated = await prisma.exercise.findUnique({ where: { id } });
        res.json(updated);
    } catch (error) {
        console.error('ERRO AO ATUALIZAR EXERCÍCIO:', error);
        res.status(500).json({ error: 'Erro ao atualizar o exercício.' });
    }
});

app.delete('/exercises/:id/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;
    return deleteCustomExercise(req, res);
});

app.delete('/exercises/:id', deleteCustomExercise);

async function deleteCustomExercise(req: AuthRequest, res: express.Response) {
    const id = parsePositiveInt(routeParam(req.params.id));
    if (!id) return res.status(400).json({ error: 'Exercício inválido.' });

    try {
        const exercise = await prisma.exercise.findFirst({ where: { id, userId: req.userId } });
        if (!exercise) return res.status(403).json({ error: 'Você só pode excluir exercícios criados por você.' });

        await prisma.$transaction([
            prisma.workoutLog.deleteMany({ where: { exerciseId: id, userId: req.userId } }),
            prisma.workoutPlan.deleteMany({ where: { exerciseId: id, userId: req.userId } }),
            prisma.exercise.delete({ where: { id } })
        ]);

        res.json({ message: 'Exercício excluído com sucesso.' });
    } catch (error) {
        console.error('ERRO AO EXCLUIR EXERCÍCIO:', error);
        res.status(500).json({ error: 'Erro ao excluir o exercício.' });
    }
}

app.post('/users', (req, res) => {
    res.status(410).json({ error: 'Use /register para criar conta com senha segura.' });
});

app.put('/users/:id/profile', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.id))) return;
    const { nome, foto } = req.body;

    try {
        const user = await prisma.user.update({
            where: { id: req.userId },
            data: {
                nome: nome === undefined ? undefined : nome,
                foto: foto === undefined ? undefined : (foto || null)
            }
        });
        res.json(userResponse(user));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar o perfil.' });
    }
});

app.put('/users/:id/password', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.id))) return;
    const { senhaAtual, novaSenha } = req.body;

    try {
        if (typeof senhaAtual !== 'string') {
            return res.status(400).json({ error: 'Informe a senha atual.' });
        }
        if (typeof novaSenha !== 'string' || novaSenha.trim().length < 6) {
            return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const senhaAtualValida = isBcryptHash(user.senha)
            ? await bcrypt.compare(senhaAtual, user.senha)
            : senhaAtual === user.senha;
        if (!senhaAtualValida) return res.status(401).json({ error: 'Senha atual incorreta.' });

        await prisma.user.update({
            where: { id: req.userId },
            data: { senha: await bcrypt.hash(novaSenha, BCRYPT_ROUNDS) }
        });
        res.json({ message: 'Senha atualizada com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar a senha.' });
    }
});

app.delete('/users/:id', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.id))) return;

    try {
        await prisma.$transaction([
            prisma.workoutLog.deleteMany({ where: { userId: req.userId } }),
            prisma.workoutSession.deleteMany({ where: { userId: req.userId } }),
            prisma.workoutPlan.deleteMany({ where: { userId: req.userId } }),
            prisma.workoutProgram.deleteMany({ where: { userId: req.userId } }),
            prisma.weightLog.deleteMany({ where: { userId: req.userId } }),
            prisma.passwordResetToken.deleteMany({ where: { userId: req.userId } }),
            prisma.exercise.deleteMany({ where: { userId: req.userId } }),
            prisma.user.delete({ where: { id: req.userId } })
        ]);

        res.json({ message: 'Conta e dados excluídos com sucesso.' });
    } catch (error) {
        console.error('ERRO AO EXCLUIR CONTA:', error);
        res.status(500).json({ error: 'Erro ao excluir a conta.' });
    }
});

app.get('/programs', async (req: AuthRequest, res) => {
    try {
        await ensureActiveProgram(req.userId!);
        const programs = await prisma.workoutProgram.findMany({
            where: { userId: req.userId },
            include: { _count: { select: { plans: true } } },
            orderBy: [
                { isActive: 'desc' },
                { updatedAt: 'desc' }
            ]
        });

        res.json(programs.map(program => ({
            id: program.id,
            nome: program.nome,
            templateId: program.templateId,
            objetivo: program.objetivo,
            divisao: program.divisao,
            frequencia: program.frequencia,
            isActive: program.isActive,
            exercicios: program._count.plans,
            createdAt: program.createdAt,
            updatedAt: program.updatedAt
        })));
    } catch (error) {
        console.error('Erro ao buscar planos salvos:', error);
        res.status(500).json({ error: 'Erro ao buscar planos salvos.' });
    }
});

app.post('/programs/:id/activate', async (req: AuthRequest, res) => {
    const programId = routeParam(req.params.id);
    if (!programId) return res.status(400).json({ error: 'Plano inválido.' });

    try {
        const program = await prisma.workoutProgram.findFirst({
            where: { id: programId, userId: req.userId }
        });
        if (!program) return res.status(404).json({ error: 'Plano não encontrado.' });

        await prisma.$transaction([
            prisma.workoutProgram.updateMany({
                where: { userId: req.userId },
                data: { isActive: false }
            }),
            prisma.workoutProgram.update({
                where: { id: program.id },
                data: { isActive: true }
            })
        ]);

        const plans = await prisma.workoutPlan.findMany({
            where: { userId: req.userId, programId: program.id },
            include: { exercise: true },
            orderBy: { ordem: 'asc' }
        });

        res.json({
            message: 'Plano ativado.',
            program: { ...program, isActive: true },
            plans
        });
    } catch (error) {
        console.error('Erro ao ativar plano:', error);
        res.status(500).json({ error: 'Erro ao ativar plano.' });
    }
});

app.get('/templates', async (_req: AuthRequest, res) => {
    res.json(workoutTemplates.map(template => ({
        id: template.id,
        nome: template.nome,
        objetivo: template.objetivo,
        divisao: template.divisao,
        nivel: template.nivel,
        frequencia: template.frequencia,
        descricao: template.descricao,
        dias: template.dias.map(dia => ({
            nome: dia.nome,
            exercicios: dia.exercicios
        }))
    })));
});

app.post('/templates/:id/apply', async (req: AuthRequest, res) => {
    const templateId = routeParam(req.params.id);
    const template = workoutTemplates.find(item => item.id === templateId);
    if (!template) return res.status(404).json({ error: 'Template não encontrado.' });

    try {
        const exerciseNames = Array.from(new Set(template.dias.flatMap(dia => dia.exercicios.map(exercicio => exercicio.nome))));
        const globalExercises = await prisma.exercise.findMany({ where: { userId: null } });
        const exerciseByName = new Map(globalExercises.map(exercise => [normalizeExerciseName(exercise.nome), exercise]));

        for (const nome of exerciseNames) {
            const key = normalizeExerciseName(nome);
            if (!exerciseByName.has(key)) {
                const created = await prisma.exercise.create({
                    data: {
                        nome,
                        grupoMuscular: 'Geral',
                        userId: null
                    }
                });
                exerciseByName.set(key, created);
            }
        }

        const result = await prisma.$transaction(async tx => {
            await tx.workoutProgram.updateMany({
                where: { userId: req.userId },
                data: { isActive: false }
            });

            const program = await tx.workoutProgram.create({
                data: {
                    userId: req.userId!,
                    nome: template.nome,
                    templateId: template.id,
                    objetivo: template.objetivo,
                    divisao: template.divisao,
                    frequencia: template.frequencia,
                    isActive: true
                }
            });

            const createdPlans = [];
            for (const dia of template.dias) {
                for (const [index, item] of dia.exercicios.entries()) {
                    const created = await tx.workoutPlan.create({
                        data: {
                            userId: req.userId!,
                            programId: program.id,
                            exerciseId: exerciseByName.get(normalizeExerciseName(item.nome))!.id,
                            ficha: dia.nome,
                            seriesAlvo: item.seriesAlvo,
                            ordem: index
                        },
                        include: { exercise: true }
                    });
                    createdPlans.push(created);
                }
            }

            return { program, plans: createdPlans };
        });

        res.status(201).json({
            message: 'Template aplicado com sucesso.',
            template: {
                id: template.id,
                nome: template.nome
            },
            program: result.program,
            plans: result.plans
        });
    } catch (error) {
        console.error('Erro ao aplicar template:', error);
        res.status(500).json({ error: 'Erro ao aplicar template.' });
    }
});

app.get('/plans/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;

    try {
        const activeProgram = await ensureActiveProgram(req.userId!);
        const plans = await prisma.workoutPlan.findMany({
            where: { userId: req.userId, programId: activeProgram.id },
            include: { exercise: true },
            orderBy: { ordem: 'asc' }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar fichas.' });
    }
});

app.put('/plans/reorder', async (req: AuthRequest, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Atualizações inválidas.' });

    try {
        const transactions = updates.map((u: any) =>
            prisma.workoutPlan.updateMany({
                where: { id: Number(u.id), userId: req.userId },
                data: { ordem: Number(u.ordem) }
            })
        );
        const results = await prisma.$transaction(transactions);
        if (results.some(result => result.count === 0)) {
            return res.status(403).json({ error: 'Acesso negado a uma ou mais fichas.' });
        }
        res.json({ message: 'Ordem salva!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao reordenar.' });
    }
});

app.put('/plans/:id', async (req: AuthRequest, res) => {
    const id = parsePositiveInt(routeParam(req.params.id));
    const { seriesAlvo } = req.body;
    if (!id) return res.status(400).json({ error: 'Ficha inválida.' });

    try {
        const result = await prisma.workoutPlan.updateMany({
            where: { id, userId: req.userId },
            data: { seriesAlvo: Number(seriesAlvo) }
        });
        if (!result.count) return res.status(403).json({ error: 'Acesso negado.' });
        res.json({ message: 'Meta atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar meta:', error);
        res.status(500).json({ error: 'Erro ao atualizar meta.' });
    }
});

app.delete('/plans/:id', async (req: AuthRequest, res) => {
    const id = parsePositiveInt(routeParam(req.params.id));
    if (!id) return res.status(400).json({ error: 'Ficha inválida.' });

    try {
        const result = await prisma.workoutPlan.deleteMany({ where: { id, userId: req.userId } });
        if (!result.count) return res.status(403).json({ error: 'Acesso negado.' });
        res.json({ message: 'Exercício removido da ficha com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar da ficha:', error);
        res.status(500).json({ error: 'Erro ao remover exercício da ficha.' });
    }
});

app.post('/plans', async (req: AuthRequest, res) => {
    const { exerciseId, ficha } = req.body;
    const parsedExerciseId = parsePositiveInt(exerciseId);
    if (!parsedExerciseId || typeof ficha !== 'string') {
        return res.status(400).json({ error: 'Dados da ficha inválidos.' });
    }

    try {
        const activeProgram = await ensureActiveProgram(req.userId!);
        const exercise = await prisma.exercise.findFirst({
            where: {
                id: parsedExerciseId,
                OR: [{ userId: null }, { userId: req.userId }]
            }
        });
        if (!exercise) return res.status(403).json({ error: 'Exercício indisponível para este usuário.' });

        const fichaNormalizada = ficha.trim();
        const ordem = await prisma.workoutPlan.count({
            where: { userId: req.userId, programId: activeProgram.id, ficha: fichaNormalizada }
        });

        const plan = await prisma.workoutPlan.create({
            data: {
                userId: req.userId!,
                programId: activeProgram.id,
                exerciseId: parsedExerciseId,
                ficha: fichaNormalizada,
                ordem
            }
        });
        res.status(201).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao adicionar exercício à ficha.' });
    }
});

app.post('/logs', async (req: AuthRequest, res) => {
    const { exerciseId, carga, repsFeitas, sessionId } = req.body;
    const parsedExerciseId = parsePositiveInt(exerciseId);
    if (!parsedExerciseId) return res.status(400).json({ error: 'Exercício inválido.' });

    try {
        const exercise = await prisma.exercise.findFirst({
            where: {
                id: parsedExerciseId,
                OR: [{ userId: null }, { userId: req.userId }]
            }
        });
        if (!exercise) return res.status(403).json({ error: 'Exercício indisponível para este usuário.' });

        if (sessionId) {
            const session = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId: req.userId } });
            if (!session) return res.status(403).json({ error: 'Sessão indisponível para este usuário.' });
        }

        const log = await prisma.workoutLog.create({
            data: {
                userId: req.userId!,
                exerciseId: parsedExerciseId,
                carga: Number(carga),
                repsFeitas: Number(repsFeitas),
                sessionId: sessionId || null
            }
        });
        res.status(201).json(log);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao registrar a execução do exercício.' });
    }
});

app.get('/logs/evolution/:userId/:exerciseId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;
    const exerciseId = parsePositiveInt(routeParam(req.params.exerciseId));
    if (!exerciseId) return res.status(400).json({ error: 'Exercício inválido.' });

    try {
        const evolution = await prisma.workoutLog.findMany({
            where: {
                userId: req.userId,
                exerciseId
            },
            orderBy: { data: 'asc' },
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

app.delete('/logs/:id', async (req: AuthRequest, res) => {
    try {
        const result = await prisma.workoutLog.deleteMany({ where: { id: routeParam(req.params.id), userId: req.userId } });
        if (!result.count) return res.status(403).json({ error: 'Acesso negado.' });
        res.json({ message: 'Série removida com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao remover série.' });
    }
});

app.post('/weight', async (req: AuthRequest, res) => {
    const { peso } = req.body;
    const parsedPeso = Number(peso);
    if (!Number.isFinite(parsedPeso) || parsedPeso <= 0) {
        return res.status(400).json({ error: 'Peso inválido.' });
    }

    try {
        const log = await prisma.weightLog.create({
            data: { userId: req.userId!, peso: parsedPeso }
        });
        await prisma.user.update({
            where: { id: req.userId },
            data: { pesoAtual: parsedPeso }
        });
        res.status(201).json(log);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao registrar peso.' });
    }
});

app.get('/weight/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;

    try {
        const history = await prisma.weightLog.findMany({
            where: { userId: req.userId },
            orderBy: { data: 'asc' }
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar histórico de peso.' });
    }
});

app.delete('/weight/:id', async (req: AuthRequest, res) => {
    const id = parsePositiveInt(routeParam(req.params.id));
    if (!id) return res.status(400).json({ error: 'Registro inválido.' });

    try {
        const result = await prisma.weightLog.deleteMany({ where: { id, userId: req.userId } });
        if (!result.count) return res.status(403).json({ error: 'Acesso negado.' });
        res.json({ message: 'Registro de peso excluído.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir peso.' });
    }
});

app.get('/logs/frequency/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;

    try {
        const sessions = await prisma.workoutSession.findMany({
            where: {
                userId: req.userId,
                endTime: { not: null },
                logs: { some: {} }
            },
            select: { startTime: true }
        });

        res.json(sessions.map(s => s.startTime.toISOString()));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar frequência.' });
    }
});

app.post('/sessions/start', async (req: AuthRequest, res) => {
    try {
        const openSession = await prisma.workoutSession.findFirst({
            where: { userId: req.userId, endTime: null },
            include: { logs: true }
        });

        if (openSession) return res.json(openSession);

        const newSession = await prisma.workoutSession.create({
            data: { userId: req.userId! }
        });
        res.json(newSession);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Erro ao iniciar sessão.' });
    }
});

app.put('/sessions/end', async (req: AuthRequest, res) => {
    try {
        const session = await prisma.workoutSession.findFirst({
            where: { userId: req.userId, endTime: null }
        });
        if (!session) return res.status(404).json({ error: 'Nenhuma sessão ativa encontrada.' });

        const endTime = new Date();
        const durationMin = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60);
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        const peso = user?.pesoAtual || 70;
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

app.delete('/sessions/:id', async (req: AuthRequest, res) => {
    const id = routeParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Sessão inválida.' });

    try {
        const session = await prisma.workoutSession.findFirst({ where: { id, userId: req.userId } });
        if (!session) return res.status(403).json({ error: 'Acesso negado.' });

        await prisma.$transaction([
            prisma.workoutLog.deleteMany({ where: { sessionId: id, userId: req.userId } }),
            prisma.workoutSession.delete({ where: { id } })
        ]);

        res.json({ message: 'Sessão e séries excluídas com sucesso.' });
    } catch (error) {
        console.error('ERRO AO EXCLUIR SESSÃO:', error);
        res.status(500).json({ error: 'Erro ao excluir a sessão.' });
    }
});

app.get('/reports/:userId/:date', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;
    const { date } = req.params;

    try {
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        const sessions = await prisma.workoutSession.findMany({
            where: {
                userId: req.userId,
                startTime: { gte: startOfDay, lte: endOfDay },
                endTime: { not: null }
            },
            include: {
                logs: { include: { exercise: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        res.json(sessions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar relatório.' });
    }
});

app.get('/volume/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;

    try {
        const sessions = await prisma.workoutSession.findMany({
            where: { userId: req.userId, endTime: { not: null } },
            include: { logs: true },
            orderBy: { startTime: 'asc' },
            take: 7
        });

        const volumeData = sessions.map(session => ({
            data: session.startTime.toISOString(),
            volume: session.logs.reduce((acc, log) => acc + (log.carga * log.repsFeitas), 0)
        }));

        res.json(volumeData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar volume.' });
    }
});

app.get('/logs/last/:userId', async (req: AuthRequest, res) => {
    if (!requireSameUserParam(req, res, routeParam(req.params.userId))) return;

    try {
        const lastLogs = await prisma.workoutLog.findMany({
            where: { userId: req.userId },
            orderBy: { id: 'desc' },
            distinct: ['exerciseId']
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
