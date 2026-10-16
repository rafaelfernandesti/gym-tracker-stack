import { PrismaClient } from '@prisma/client';

const COACH_WINDOW_MS = 60 * 60 * 1000;
const COACH_MAX_PER_HOUR = 10;
const QUESTION_MAX_LENGTH = 400;
const coachHits = new Map<string, number[]>();

export type CoachAdvice = {
    ficha: string | null;
    headline: string;
    summary: string;
    actions: string[];
    loads: { exercise: string; note: string }[];
    warning: string | null;
};

export const allowCoachRequest = (userId: string) => {
    const now = Date.now();
    const hits = (coachHits.get(userId) || []).filter(time => now - time < COACH_WINDOW_MS);
    if (hits.length >= COACH_MAX_PER_HOUR) {
        coachHits.set(userId, hits);
        return false;
    }
    hits.push(now);
    coachHits.set(userId, hits);
    return true;
};

export const sanitizeCoachQuestion = (value: unknown) => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX_LENGTH);
};

const SYSTEM_PROMPT = `Você é o coach do GymTracker, um app de registro de treinos.
Responda SEMPRE em português do Brasil, em JSON válido, sem markdown.
Seja concreto, curto e baseado só no contexto enviado. Não invente cargas, exercícios ou sessões que não estejam nos dados.
Não dê diagnóstico médico. Se faltar histórico, peça o mínimo e sugira a ficha mais lógica do plano ativo.
Se o usuário pedir algo fora de treino, recuse em uma frase e volte ao treino.
JSON obrigatório:
{
  "ficha": "letra da ficha sugerida ou null",
  "headline": "frase curta de até 70 caracteres",
  "summary": "2 a 4 frases com o raciocínio",
  "actions": ["até 3 ações práticas"],
  "loads": [{"exercise": "nome do exercício", "note": "ajuste de carga/reps"}],
  "warning": "alerta de recuperação/forma ou null"
}
Máximo 4 itens em loads. Se não houver ajuste de carga, use array vazio.`;

const emptyAdvice = (summary: string): CoachAdvice => ({
    ficha: null,
    headline: 'Coach',
    summary,
    actions: [],
    loads: [],
    warning: null
});

const parseAdvice = (raw: string): CoachAdvice => {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<CoachAdvice>;
    const loads = Array.isArray(parsed.loads)
        ? parsed.loads
            .slice(0, 4)
            .map(item => ({
                exercise: String(item?.exercise || '').trim(),
                note: String(item?.note || '').trim()
            }))
            .filter(item => item.exercise && item.note)
        : [];

    return {
        ficha: parsed.ficha ? String(parsed.ficha).trim().slice(0, 8) : null,
        headline: String(parsed.headline || 'Sugestão de treino').trim().slice(0, 80),
        summary: String(parsed.summary || '').trim().slice(0, 800),
        actions: Array.isArray(parsed.actions)
            ? parsed.actions.map(item => String(item).trim()).filter(Boolean).slice(0, 3)
            : [],
        loads,
        warning: parsed.warning ? String(parsed.warning).trim().slice(0, 240) : null
    };
};

const getAiConfig = () => {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const openAiKey = process.env.OPENAI_API_KEY || '';
    const provider = (process.env.AI_PROVIDER || (geminiKey ? 'gemini' : openAiKey ? 'openai' : '')).toLowerCase();

    if (provider === 'gemini' && geminiKey) {
        return {
            provider: 'gemini' as const,
            apiKey: geminiKey,
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
            baseUrl: ''
        };
    }

    if (openAiKey) {
        return {
            provider: 'openai' as const,
            apiKey: openAiKey,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
        };
    }

    return null;
};

export const isCoachConfigured = () => Boolean(getAiConfig());

const callGemini = async (apiKey: string, model: string, userPrompt: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
                temperature: 0.4,
                responseMimeType: 'application/json'
            }
        })
    });

    const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string };
        candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini HTTP ${response.status}`);
    }

    return payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
};

const callOpenAi = async (apiKey: string, model: string, baseUrl: string, userPrompt: string) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
            model,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ]
        })
    });

    const payload = await response.json().catch(() => ({})) as {
        error?: { message?: string };
        choices?: { message?: { content?: string } }[];
    };

    if (!response.ok) {
        throw new Error(payload.error?.message || `OpenAI HTTP ${response.status}`);
    }

    return payload.choices?.[0]?.message?.content || '';
};

export const buildCoachContext = async (prisma: PrismaClient, userId: string, extras: {
    question: string;
    fichaAtiva?: string;
    inSession?: boolean;
}) => {
    const since = new Date();
    since.setDate(since.getDate() - 21);

    const [user, program, plans, logs, weightLogs, lastLogs] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { nome: true, altura: true, pesoAtual: true }
        }),
        prisma.workoutProgram.findFirst({
            where: { userId, isActive: true },
            select: { nome: true, objetivo: true, divisao: true, frequencia: true }
        }),
        prisma.workoutPlan.findMany({
            where: { userId },
            include: { exercise: { select: { nome: true, grupoMuscular: true } } },
            orderBy: [{ ficha: 'asc' }, { ordem: 'asc' }]
        }),
        prisma.workoutLog.findMany({
            where: { userId, data: { gte: since } },
            include: { exercise: { select: { nome: true, grupoMuscular: true } } },
            orderBy: { data: 'desc' },
            take: 180
        }),
        prisma.weightLog.findMany({
            where: { userId },
            orderBy: { data: 'desc' },
            take: 6
        }),
        prisma.workoutLog.findMany({
            where: { userId },
            include: { exercise: { select: { nome: true } } },
            orderBy: { data: 'desc' },
            distinct: ['exerciseId'],
            take: 40
        })
    ]);

    const fichas: Record<string, { nome: string; grupo: string | null; seriesAlvo: number }[]> = {};
    for (const plan of plans) {
        if (!fichas[plan.ficha]) fichas[plan.ficha] = [];
        fichas[plan.ficha].push({
            nome: plan.exercise.nome,
            grupo: plan.exercise.grupoMuscular,
            seriesAlvo: plan.seriesAlvo
        });
    }

    const recentSets = logs.map(log => ({
        data: log.data.toISOString().slice(0, 10),
        exercicio: log.exercise.nome,
        grupo: log.exercise.grupoMuscular,
        carga: log.carga,
        reps: log.repsFeitas
    }));

    return {
        atleta: {
            nome: user?.nome || 'Atleta',
            alturaCm: user?.altura ?? null,
            pesoKg: user?.pesoAtual ?? null
        },
        programaAtivo: program,
        fichaSelecionada: extras.fichaAtiva || null,
        treinoEmAndamento: Boolean(extras.inSession),
        fichas,
        pesoRecente: weightLogs.map(item => ({
            data: item.data.toISOString().slice(0, 10),
            peso: item.peso
        })),
        ultimoRegistroPorExercicio: lastLogs.map(log => ({
            exercicio: log.exercise.nome,
            carga: log.carga,
            reps: log.repsFeitas,
            data: log.data.toISOString().slice(0, 10)
        })),
        seriesRecentes: recentSets,
        pergunta: extras.question || 'O que treinar hoje e como ajustar as cargas?'
    };
};

export const requestCoachAdvice = async (context: unknown): Promise<CoachAdvice> => {
    const config = getAiConfig();
    if (!config) {
        const error = new Error('AI_NOT_CONFIGURED');
        error.name = 'AI_NOT_CONFIGURED';
        throw error;
    }

    const userPrompt = `Contexto do atleta (JSON). Use só estes dados:\n${JSON.stringify(context)}`;
    const raw = config.provider === 'gemini'
        ? await callGemini(config.apiKey, config.model, userPrompt)
        : await callOpenAi(config.apiKey, config.model, config.baseUrl, userPrompt);

    if (!raw.trim()) return emptyAdvice('Não consegui gerar uma sugestão agora. Tente de novo em instantes.');

    try {
        const advice = parseAdvice(raw);
        if (!advice.summary) advice.summary = advice.headline;
        return advice;
    } catch {
        return emptyAdvice(raw.slice(0, 800));
    }
};
