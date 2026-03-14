import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toBlob } from 'html-to-image';

const API_URL = "https://gym-tracker-api-yomc.onrender.com";

// Componente do Modal do Relatório (Versão à Prova de Falhas)
function ReportModal({ sessionData, allExercises, onClose, onShare, onDelete }: { sessionData: any, allExercises: any[], onClose: () => void, onShare: () => void, onDelete: () => void }) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!sessionData) return null;

  const startTime = new Date(sessionData.startTime);
  const endTime = new Date(sessionData.endTime);
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  const exercisesMap: any = {};
  const musculosTrabalhados = new Set<string>();

  sessionData.logs.forEach((log: any) => {
    // Tenta pegar do log da API. Se falhar, busca na lista global do App!
    const exerciseData = log.exercise || allExercises.find(ex => ex.id === log.exerciseId);

    const exNome = exerciseData?.nome || 'Exercício Desconhecido';
    const grupo = exerciseData?.grupoMuscular;

    if (!exercisesMap[exNome]) exercisesMap[exNome] = [];
    exercisesMap[exNome].push(log);

    if (grupo && grupo.trim() !== '') musculosTrabalhados.add(grupo);
  });

  const dataFormatada = startTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const horaInicio = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const listaMusculos = Array.from(musculosTrabalhados).join(', ');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4 animate-in fade-in overflow-y-auto scrollbar-hide">

      <div ref={reportRef} id="report-card" className="w-full max-w-sm bg-gray-950 p-6 rounded-3xl border-4 border-blue-600 shadow-2xl text-white font-sans">

        <header className="text-center mb-6 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
          <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mt-1">Resumo de Conquista</p>
        </header>

        <div className="text-center mb-6">
          <p className="text-sm font-medium text-gray-300 capitalize">{dataFormatada}</p>
          <p className="text-xs text-gray-500">Início: {horaInicio}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-800 p-4 rounded-xl text-center border border-gray-700">
            <p className="text-gray-500 text-xs font-bold uppercase">Duração</p>
            <p className="text-2xl font-black text-white">{durationMin}<span className="text-sm text-gray-400"> min</span></p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl text-center border border-gray-700">
            <p className="text-gray-500 text-xs font-bold uppercase">Queima Est.</p>
            <p className="text-2xl font-black text-green-400">{sessionData.calories || 0}<span className="text-sm text-gray-400"> kcal</span></p>
          </div>
        </div>

        {/* MAPA MUSCULAR COM SVG INLINE (NUNCA QUEBRA) */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl mb-6 flex items-center gap-4 relative overflow-hidden">
          <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-blue-500">
              <path d="M12 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM5.5 8.5a1.5 1.5 0 00-1.5 1.5v3.5a1.5 1.5 0 003 0v-2.11c1.33 1.14 3 1.86 5 1.86s3.67-.72 5-1.86v2.11a1.5 1.5 0 003 0V10a1.5 1.5 0 00-1.5-1.5h-13z" />
              <path d="M9 13v8a2 2 0 004 0v-5h2v5a2 2 0 004 0v-8c-1.63 1.25-3.66 2-5.5 2h-1c-1.84 0-3.87-.75-5.5-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Foco Muscular</h3>
            <p className="text-sm text-white font-bold leading-tight">
              {listaMusculos || 'Músculos não registrados'}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6 border-t border-gray-800 pt-4">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Detalhamento</h3>
          {Object.keys(exercisesMap).map(exNome => {
            const series = exercisesMap[exNome];
            const melhorCarga = Math.max(...series.map((l: any) => l.carga));
            return (
              <div key={exNome} className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <p className="text-sm font-bold text-white flex-1 truncate pr-2">{exNome}</p>
                <div className="text-right whitespace-nowrap">
                  <p className="text-sm font-bold text-white">{melhorCarga} kg <span className="text-xs text-gray-500 font-normal">máx</span></p>
                  <p className="text-xs text-gray-400">{series.length} séries</p>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="text-center text-gray-600 text-[10px] italic pt-2 border-t border-gray-800">
          Gerado pelo GymTracker de {sessionData.user?.nome || 'Você'}
        </footer>
      </div>

      {/* Botões de Ação (Substitua a div final de botões por este bloco) */}
      <div className="flex gap-3 mt-6 w-full max-w-sm mb-4">
        <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all text-sm">FECHAR</button>
        <button onClick={onShare} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2">COMPARTILHAR</button>
      </div>

      {/* Novo Botão de Excluir */}
      <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-xs font-bold uppercase tracking-wider mb-2 transition-colors">
        EXCLUIR ESTA SESSÃO
      </button>
    </div>
  );
}


function App() {
  // ... ESTADOS EXISTENTES ...
  const [user, setUser] = useState<{ id: string, nome: string, email: string } | null>(null);
  const [isLoginModo, setIsLoginModo] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authNome, setAuthNome] = useState('');
  const [authErro, setAuthErro] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'treinar' | 'historico' | 'exercicios' | 'perfil'>('treinar');
  const [exerciseId, setExerciseId] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);

  const [fichaAtiva, setFichaAtiva] = useState('A');
  const exerciciosFiltrados = exercises.filter(ex => (ex.ficha || 'A') === fichaAtiva);

  const [carga, setCarga] = useState('');
  const [reps, setReps] = useState('');
  const [status, setStatus] = useState('');
  const [evolutionData, setEvolutionData] = useState<any[]>([]);

  const [novoNome, setNovoNome] = useState('');
  const [novoGrupo, setNovoGrupo] = useState('Peito');
  const [novaFicha, setNovaFicha] = useState('A');
  const [statusExercicio, setStatusExercicio] = useState('');
  const [editingExId, setEditingExId] = useState<number | null>(null);
  const [filtroGrupoEx, setFiltroGrupoEx] = useState('Todos');

  const [tempoDescanso, setTempoDescanso] = useState(90);
  const [timerAtivo, setTimerAtivo] = useState(false);

  const [pesoAtualInput, setPesoAtualInput] = useState('');
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [statusPeso, setStatusPeso] = useState('');
  const [activeDays, setActiveDays] = useState<string[]>([]);

  // === NOVOS ESTADOS PARA O RELATÓRIO E SESSÃO ===
  const [activeSession, setActiveSession] = useState<any>(null); // Treino rolando agora
  const [selectedReport, setSelectedReport] = useState<any>(null); // Dados do modal
  const [loadingReport, setLoadingReport] = useState(false);
  const [daySessions, setDaySessions] = useState<any[] | null>(null); // Guarda múltiplos treinos do dia

  // === EFEITOS ===
  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('@GymTracker:user');
    if (usuarioSalvo) setUser(JSON.parse(usuarioSalvo));

    // Recupera se tinha uma sessão ativa salva localmente
    const sessaoSalva = localStorage.getItem('@GymTracker:activeSession');
    if (sessaoSalva) setActiveSession(JSON.parse(sessaoSalva));
  }, []);

  // ... (Efeitos de Timer, Carregar Dados permanecem os mesmos) ...
  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval>;
    if (timerAtivo && tempoDescanso > 0) {
      intervalo = setInterval(() => setTempoDescanso((t) => t - 1), 1000);
    } else if (tempoDescanso === 0 && timerAtivo) setTimerAtivo(false);
    return () => clearInterval(intervalo);
  }, [timerAtivo, tempoDescanso]);

  useEffect(() => {
    if (user) {
      fetchExercises();
      fetchWeightHistory();
      fetchFrequency();
    }
  }, [user]);

  useEffect(() => {
    if (exerciciosFiltrados.length > 0) setExerciseId(exerciciosFiltrados[0].id.toString());
    else { setExerciseId(''); setEvolutionData([]); }
  }, [fichaAtiva, exercises]);

  useEffect(() => { if (user && exerciseId) fetchEvolution(); }, [exerciseId, user]);

  // === FUNÇÕES DE AUTENTICAÇÃO E BUSCA (INALTERADAS) ===
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErro(''); setAuthLoading(true);
    const endpoint = isLoginModo ? '/login' : '/register';
    const body = isLoginModo ? { email: authEmail, senha: authSenha } : { email: authEmail, senha: authSenha, nome: authNome };
    try {
      const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
        localStorage.setItem('@GymTracker:user', JSON.stringify(data));
        setAuthEmail(''); setAuthSenha(''); setAuthNome('');
      } else setAuthErro(data.error || 'Erro na autenticação.');
    } catch (error) { setAuthErro('Erro de conexão.'); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('@GymTracker:user');
    localStorage.removeItem('@GymTracker:activeSession');
    setUser(null); setEvolutionData([]); setWeightHistory([]); setActiveDays([]); setActiveSession(null);
  };

  const fetchExercises = async () => { /* ... */ try { const response = await fetch(`${API_URL}/exercises`); if (response.ok) setExercises(await response.json()); } catch (e) { console.error(e); } };
  const fetchEvolution = async () => { /* ... */ if (!exerciseId || !user) return; try { const response = await fetch(`${API_URL}/logs/evolution/${user.id}/${exerciseId}`); if (response.ok) { const data = await response.json(); const formattedData = data.map((log: any) => ({ ...log, dataFormatada: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(log.data)), volume: log.carga * log.repsFeitas })); setEvolutionData(formattedData); } } catch (error) { console.error(error); } };
  const fetchWeightHistory = async () => { /* ... */ if (!user) return; try { const response = await fetch(`${API_URL}/weight/${user.id}`); if (response.ok) { const data = await response.json(); const formattedData = data.map((log: any) => ({ ...log, dataFormatada: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(log.data)), })); setWeightHistory(formattedData); } } catch (error) { console.error(error); } };
  const fetchFrequency = async () => { /* ... */ if (!user) return; try { const response = await fetch(`${API_URL}/logs/frequency/${user.id}`); if (response.ok) setActiveDays(await response.json()); } catch (error) { console.error(error); } };

  // === NOVA FUNÇÃO: CLICAR NO CALENDÁRIO ===
  // === NOVA FUNÇÃO: CLICAR NO CALENDÁRIO (MÚLTIPLOS TREINOS) ===
  const handleDayClick = async (date: string) => {
    if (!user || loadingReport) return;
    setLoadingReport(true);
    try {
      const response = await fetch(`${API_URL}/reports/${user.id}/${date}`);
      if (response.ok) {
        const sessions = await response.json();

        if (sessions.length === 0) {
          alert('Nenhum resumo de treino finalizado encontrado para este dia.');
        } else if (sessions.length === 1) {
          // Se só tem 1 treino, abre direto o relatório
          setSelectedReport(sessions[0]);
        } else {
          // Se tem mais de 1, abre o modal de seleção
          setDaySessions(sessions);
        }
      }
    } catch (error) {
      alert('Erro ao buscar o relatório.');
    } finally {
      setLoadingReport(false);
    }
  };

  // === FUNÇÕES DE PESO CORPORAL (RECUPERADAS) ===
  const handleRegistrarPeso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pesoAtualInput) return;
    setStatusPeso('Salvando...');
    try {
      const response = await fetch(`${API_URL}/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, peso: Number(pesoAtualInput) }),
      });
      if (response.ok) {
        setStatusPeso('Peso atualizado! 📈');
        setPesoAtualInput('');
        fetchWeightHistory();
        setTimeout(() => setStatusPeso(''), 3000);
      }
    } catch (error) { setStatusPeso('Erro ao salvar peso.'); }
  };

  const handleExcluirPeso = async (logId: number) => {
    if (!confirm('Tem certeza que deseja apagar este registro de peso?')) return;
    try {
      const response = await fetch(`${API_URL}/weight/${logId}`, { method: 'DELETE' });
      if (response.ok) fetchWeightHistory();
    } catch (error) { alert('Erro de conexão ao tentar excluir.'); }
  };

  // === NOVA FUNÇÃO: COMPARTILHAR RELATÓRIO (USANDO HTML-TO-IMAGE) ===
  const handleShareReport = async () => {
    const card = document.getElementById('report-card');
    if (!card) return;

    try {
      // Usa a nova biblioteca que suporta cores modernas (oklch)
      const blob = await toBlob(card, {
        backgroundColor: '#030712',
        pixelRatio: 2 // Escala 2 para alta definição
      });

      if (!blob) throw new Error('Falha ao gerar a imagem');

      const file = new File([blob], `GymTracker-Resumo-${selectedReport.startTime.split('T')[0]}.png`, { type: 'image/png' });

      // Usa a Web Share API do navegador
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Meu Treino no GymTracker 💪',
          text: 'Olha o resumo do meu treino de hoje! Gerado pelo GymTracker.',
        });
      } else {
        alert('Seu navegador não suporta compartilhamento direto de imagem. Tire um print da tela para compartilhar!');
      }
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      alert('Erro ao preparar o compartilhamento.');
    }
  };

  // === NOVA FUNÇÃO: EXCLUIR SESSÃO ===
  const handleExcluirSessao = async (sessionId: string) => {
    if (!confirm('CUIDADO! Tem certeza que deseja apagar este treino completo e TODAS as séries registradas nele?')) return;

    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
      if (response.ok) {
        setSelectedReport(null); // Fecha o modal
        fetchFrequency(); // Atualiza o calendário (o dia vai perder a cor verde)
        fetchEvolution(); // Atualiza o gráfico principal
      } else {
        alert('Erro ao excluir a sessão.');
      }
    } catch (error) {
      alert('Erro de conexão ao tentar excluir.');
    }
  };

  // === NOVAS FUNÇÕES: GERENCIAR SESSÃO (TREINAR) ===
  const handleStartWorkout = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (response.ok) {
        const session = await response.json();
        setActiveSession(session);
        localStorage.setItem('@GymTracker:activeSession', JSON.stringify(session));
      } else { alert('Já existe um treino em andamento.'); }
    } catch (error) { alert('Erro ao iniciar treino.'); }
  };

  const handleEndWorkout = async () => {
    if (!user || !activeSession) return;
    if (!confirm('Deseja finalizar o treino atual? O tempo e calorias serão calculados.')) return;
    try {
      const response = await fetch(`${API_URL}/sessions/end`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (response.ok) {
        setActiveSession(null);
        localStorage.removeItem('@GymTracker:activeSession');
        fetchFrequency(); // Atualiza calendário
        alert('Treino finalizado com sucesso! Vá em Perfil -> Calendário para ver o resumo.');
      }
    } catch (error) { alert('Erro ao finalizar treino.'); }
  };

  // ... (Funções de Registrar Treino/Exercício permanecem, mas agora enviam sessionId) ...
  const handleRegistrarTreino = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseId || !user) return;
    // Opcional: Bloquear registro se não tiver sessão ativa (para garantir dados do relatório)
    if (!activeSession) { alert('Inicie o treino no botão "COMEÇAR TREINO" antes de registrar séries.'); return; }

    setStatus('Salvando...');
    try {
      const response = await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          exerciseId: Number(exerciseId),
          carga: Number(carga),
          repsFeitas: Number(reps),
          sessionId: activeSession.id // <-- ENVIA O ID DA SESSÃO ATIVA
        }),
      });
      if (response.ok) {
        setStatus('Série registrada! 💪');
        setCarga(''); setReps(''); fetchEvolution(); setTempoDescanso(90); setTimerAtivo(true);
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (error) { setStatus('Erro de conexão.'); }
  };
  // ... (handleExcluirTreino, handleCriarExercicio... permanecem iguais) ...
  const handleExcluirTreino = async (logId: string) => { if (!confirm('Tem certeza?')) return; try { const response = await fetch(`${API_URL}/logs/${logId}`, { method: 'DELETE' }); if (response.ok) fetchEvolution(); } catch (error) { alert('Erro de ligação.'); } };
  const handleCriarExercicio = async (e: React.FormEvent) => { e.preventDefault(); setStatusExercicio('Salvando...'); try { const response = await fetch(`${API_URL}/exercises`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novoNome, grupoMuscular: novoGrupo, ficha: novaFicha }), }); if (response.ok) { setStatusExercicio('Exercício adicionado!'); limparFormularioExercicio(); fetchExercises(); setTimeout(() => setStatusExercicio(''), 3000); } } catch (error) { setStatusExercicio('Erro.'); } };
  const handleAtualizarExercicio = async (e: React.FormEvent) => { e.preventDefault(); setStatusExercicio('Atualizando...'); try { const response = await fetch(`${API_URL}/exercises/${editingExId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novoNome, grupoMuscular: novoGrupo, ficha: novaFicha }), }); if (response.ok) { setStatusExercicio('Exercício atualizado!'); limparFormularioExercicio(); fetchExercises(); setTimeout(() => setStatusExercicio(''), 3000); } } catch (error) { setStatusExercicio('Erro.'); } };
  const handleExcluirExercicio = async (exId: number, nome: string) => { if (!confirm(`CUIDADO! Deletar "${nome}" apaga o histórico. Certeza?`)) return; try { const response = await fetch(`${API_URL}/exercises/${exId}`, { method: 'DELETE' }); if (response.ok) { fetchExercises(); if (exerciseId === exId.toString()) setExerciseId(''); } } catch (error) { alert('Erro.'); } };
  const iniciarEdicao = (ex: any) => { setEditingExId(ex.id); setNovoNome(ex.nome); setNovoGrupo(ex.grupoMuscular || 'Peito'); setNovaFicha(ex.ficha || 'A'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const limparFormularioExercicio = () => { setEditingExId(null); setNovoNome(''); setNovoGrupo('Peito'); setNovaFicha('A'); };

  const cargaMaxima = evolutionData.length > 0 ? Math.max(...evolutionData.map(d => d.carga)) : 0;
  const volumeMaximo = evolutionData.length > 0 ? Math.max(...evolutionData.map(d => d.volume)) : 0;
  const gruposMuscularesLista = ['Todos', 'Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'];
  const exerciciosExibidos = filtroGrupoEx === 'Todos' ? exercises : exercises.filter(ex => ex.grupoMuscular === filtroGrupoEx);

  // === GERAÇÃO DO CALENDÁRIO (COM DIA OBJETO) ===
  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      full: d.toISOString().split('T')[0],
      dia: d.getDate().toString()
    };
  });

  if (!user) { return (<div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4 font-sans text-white"> <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700"> <h1 className="text-4xl font-black text-center text-blue-500 tracking-tight mb-2">GYM<span className="text-white">TRACKER</span></h1> <p className="text-center text-gray-400 mb-8 font-medium">{isLoginModo ? 'Acesse seus treinos' : 'Crie sua conta'}</p> <form onSubmit={handleAuth} className="space-y-4"> {!isLoginModo && (<div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Nome (Opcional)</label> <input type="text" value={authNome} onChange={(e) => setAuthNome(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Seu nome" /> </div>)} <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">E-mail</label> <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="seu@email.com" /> </div> <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Senha</label> <input type="password" required value={authSenha} onChange={(e) => setAuthSenha(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" /> </div> {authErro && <p className="text-red-400 text-sm text-center font-medium">{authErro}</p>} <button type="submit" disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 mt-2"> {authLoading ? 'AGUARDE...' : (isLoginModo ? 'ENTRAR' : 'CADASTRAR')} </button> </form> <div className="mt-6 text-center"> <button onClick={() => { setIsLoginModo(!isLoginModo); setAuthErro(''); }} className="text-gray-400 hover:text-white text-sm font-medium transition-colors"> {isLoginModo ? 'Não tem uma conta? Crie agora' : 'Já tem uma conta? Faça login'} </button> </div> </div> </div>); }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans pb-10">
      {/* Modal de Seleção de Treino (Abre se houver > 1 treino no dia) */}
      {daySessions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-gray-900 p-6 rounded-3xl border border-gray-700 shadow-2xl text-white">
            <h3 className="text-lg font-bold mb-4 text-center text-blue-400 uppercase tracking-widest">Treinos do Dia</h3>
            <p className="text-xs text-gray-400 text-center mb-6">Você treinou mais de uma vez neste dia. Qual relatório deseja visualizar?</p>

            <div className="space-y-3">
              {daySessions.map((session, index) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedReport(session); // Abre o relatório escolhido
                    setDaySessions(null); // Fecha este modal
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-xl flex justify-between items-center transition-colors border border-gray-700"
                >
                  <span className="font-bold">Sessão {index + 1}</span>
                  <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-lg">
                    {new Date(session.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>

            <button onClick={() => setDaySessions(null)} className="w-full mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all text-sm">
              CANCELAR
            </button>
          </div>
        </div>
      )}

      {/* Modal do Relatório (Abre quando selecionado) */}
      {selectedReport && (
        <ReportModal
          sessionData={selectedReport}
          allExercises={exercises}
          onClose={() => setSelectedReport(null)}
          onShare={handleShareReport}
          onDelete={() => handleExcluirSessao(selectedReport.id)}
        />
      )}

      <header className="max-w-md mx-auto mb-6 mt-2 flex justify-between items-center">
        <h1 className="text-2xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 font-medium truncate max-w-[120px]">{user.nome || user.email.split('@')[0]}</span>
          <button onClick={handleLogout} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">SAIR</button>
        </div>
      </header>

      <div className="max-w-md mx-auto flex bg-gray-800 rounded-lg p-1 mb-6 text-xs font-bold overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('treinar')} className={`flex-1 min-w-[80px] py-2.5 rounded-md transition-all ${activeTab === 'treinar' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Treinar</button>
        <button onClick={() => setActiveTab('historico')} className={`flex-1 min-w-[80px] py-2.5 rounded-md transition-all ${activeTab === 'historico' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Evolução</button>
        <button onClick={() => setActiveTab('exercicios')} className={`flex-1 min-w-[80px] py-2.5 rounded-md transition-all ${activeTab === 'exercicios' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Fichas</button>
        <button onClick={() => setActiveTab('perfil')} className={`flex-1 min-w-[80px] py-2.5 rounded-md transition-all ${activeTab === 'perfil' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Perfil</button>
      </div>

      <main className="max-w-md mx-auto">
        {activeTab === 'treinar' && (
          <div className="animate-in fade-in space-y-6">
            {/* NOVO: Gerenciador de Sessão (Cronômetro de Treino) */}
            <div className="bg-gray-800 p-5 rounded-2xl shadow-xl border border-gray-700 text-center relative overflow-hidden">
              {activeSession ? (
                <>
                  <div className="absolute top-0 right-0 bg-green-500 text-xs text-white px-3 py-1 font-bold rounded-bl-lg animate-pulse">TREINO ATIVO</div>
                  <p className="text-gray-400 text-xs font-medium mb-1">Iniciado às: {new Date(activeSession.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <button onClick={handleEndWorkout} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all text-sm">FINALIZAR TREINO</button>
                </>
              ) : (
                <button onClick={handleStartWorkout} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all text-sm">COMEÇAR TREINO (CRONÔMETRO)</button>
              )}
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
              <div className="flex gap-2 mb-6">
                {['A', 'B', 'C'].map(ficha => (<button key={ficha} onClick={() => setFichaAtiva(ficha)} className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${fichaAtiva === ficha ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>Ficha {ficha}</button>))}
              </div>
              <form onSubmit={handleRegistrarTreino} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Exercício</label>
                  {exerciciosFiltrados.length > 0 ? (<select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"> {exerciciosFiltrados.map(ex => (<option key={ex.id} value={ex.id}>{ex.nome}</option>))} </select>) : (<div className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-500 text-sm text-center">Nenhum exercício na ficha.</div>)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Carga (kg)</label> <input type="number" step="0.5" required disabled={!exerciseId || !activeSession} value={carga} onChange={(e) => setCarga(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" /> </div>
                  <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Reps</label> <input type="number" required disabled={!exerciseId || !activeSession} value={reps} onChange={(e) => setReps(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" /> </div>
                </div>
                <button type="submit" disabled={!exerciseId || !activeSession} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50">REGISTRAR SÉRIE</button>
              </form>
              {status && <div className="mt-4 text-center text-green-400 font-medium">{status}</div>}
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 text-center">
              <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">Tempo de Descanso</h3>
              <div className={`text-5xl font-black mb-6 ${timerAtivo ? 'text-blue-400' : 'text-gray-300'}`}>{new Date(tempoDescanso * 1000).toISOString().substr(14, 5)}</div>
              <div className="flex justify-center gap-3">
                <button onClick={() => setTempoDescanso(t => Math.max(0, t - 15))} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">-15s</button>
                <button onClick={() => setTimerAtivo(!timerAtivo)} className={`${timerAtivo ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white font-bold py-2 px-6 rounded-lg w-32`}>{timerAtivo ? 'PAUSAR' : 'INICIAR'}</button>
                <button onClick={() => { setTimerAtivo(false); setTempoDescanso(90); }} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">ZERAR</button>
                <button onClick={() => setTempoDescanso(t => t + 15)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">+15s</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
              <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Frequência (Últimos 30 Dias)</h3>
              <p className="text-xs text-gray-500 mb-3 -mt-3">Toque em um dia verde para ver o resumo.</p>
              <div className="flex flex-wrap gap-2 justify-start">
                {last30Days.map((dayObj) => {
                  const treinou = activeDays.includes(dayObj.full);
                  return (
                    <button
                      key={dayObj.full}
                      onClick={() => treinou && handleDayClick(dayObj.full)} // Só clica se treinou
                      disabled={!treinou || loadingReport}
                      className={`w-[13.5%] aspect-square rounded-md transition-all duration-300 flex items-center justify-center text-[11px] font-bold ${treinou ? 'bg-green-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)] active:scale-95' : 'bg-gray-900 border border-gray-700 text-gray-500'} disabled:opacity-100`}
                    >
                      {loadingReport && selectedReport?.startTime.split('T')[0] === dayObj.full ? '...' : dayObj.dia}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* ... (Registrar Peso, Gráfico e Histórico permanecem iguais) ... */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700"> <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Registrar Peso Corporal</h3> <form onSubmit={handleRegistrarPeso} className="flex gap-3"> <input type="number" step="0.1" required value={pesoAtualInput} onChange={(e) => setPesoAtualInput(e.target.value)} placeholder="Ex: 75.5" className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" /> <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all">SALVAR</button> </form> {statusPeso && <div className="mt-4 text-center text-green-400 font-medium">{statusPeso}</div>} </div>
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 h-80"> <div className="flex justify-between items-center mb-6"><h3 className="text-gray-300 text-sm uppercase font-bold">Ganho de Massa</h3></div> <ResponsiveContainer width="100%" height="85%"> <LineChart data={weightHistory}> <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} /> <XAxis dataKey="dataFormatada" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} /> <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} width={30} domain={['dataMin - 2', 'dataMax + 2']} /> <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} formatter={(value: any) => [value + ' kg', 'Peso']} labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }} /> <Line type="monotone" dataKey="peso" stroke="#10B981" strokeWidth={4} dot={{ r: 5, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 8 }} /> </LineChart> </ResponsiveContainer> </div>
            {weightHistory.length > 0 && (<div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700"> <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Histórico de Pesagens</h3> <div className="space-y-3 max-h-48 overflow-y-auto pr-2"> {[...weightHistory].reverse().map((log) => (<div key={log.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700"> <div> <p className="text-sm font-bold text-white">{log.peso} kg</p> <p className="text-xs text-gray-500">{log.dataFormatada}</p> </div> <button onClick={() => handleExcluirPeso(log.id)} className="text-red-400 hover:text-red-300 p-2 text-sm font-bold">✕</button> </div>))} </div> </div>)}
          </div>
        )}

        {/* ... (Aba Historico e Exercicios permanecem iguais) ... */}
        {activeTab === 'historico' && (<div className="animate-in fade-in space-y-4"> <div className="flex gap-4"> <div className="flex-1 bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center shadow-lg"> <p className="text-gray-500 text-xs font-bold uppercase mb-1">Carga Máxima</p> <p className="text-2xl font-black text-blue-400">{cargaMaxima} <span className="text-sm font-medium text-gray-500">kg</span></p> </div> <div className="flex-1 bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center shadow-lg"> <p className="text-gray-500 text-xs font-bold uppercase mb-1">Volume Máx.</p> <p className="text-2xl font-black text-green-400">{volumeMaximo} <span className="text-sm font-medium text-gray-500">kg</span></p> </div> </div> <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 h-80"> <div className="flex justify-between items-center mb-6"> <h3 className="text-gray-300 text-sm uppercase font-bold">Progressão</h3> <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="bg-gray-900 text-xs border border-gray-700 rounded-lg p-2 text-white outline-none max-w-[150px]"> {exercises.map(ex => (<option key={ex.id} value={ex.id}>{ex.nome} ({ex.ficha || 'A'})</option>))} </select> </div> <ResponsiveContainer width="100%" height="85%"> <LineChart data={evolutionData}> <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} /> <XAxis dataKey="dataFormatada" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} /> <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} width={30} /> <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} formatter={(value: any, name: any) => [value + ' kg', name === 'carga' ? 'Carga' : name]} labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }} /> <Line type="monotone" dataKey="carga" stroke="#3B82F6" strokeWidth={4} dot={{ r: 5, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 8 }} /> </LineChart> </ResponsiveContainer> </div> {evolutionData.length > 0 && (<div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700"> <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Registros Recentes</h3> <div className="space-y-3 max-h-48 overflow-y-auto pr-2"> {[...evolutionData].reverse().map((log) => (<div key={log.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700"> <div> <p className="text-sm font-bold text-white">{log.carga} kg <span className="text-gray-400 font-normal">x {log.repsFeitas} reps</span></p> <p className="text-xs text-gray-500">{log.dataFormatada}</p> </div> <button onClick={() => handleExcluirTreino(log.id)} className="text-red-400 hover:text-red-300 p-2 text-sm font-bold">✕</button> </div>))} </div> </div>)} </div>)}
        {activeTab === 'exercicios' && (<div className="space-y-6 animate-in fade-in"> <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700"> <h3 className="text-gray-400 text-sm mb-4 uppercase font-bold">{editingExId ? 'Editar Exercício' : 'Cadastrar Novo'}</h3> <form onSubmit={editingExId ? handleAtualizarExercicio : handleCriarExercicio} className="space-y-5"> <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Nome</label> <input type="text" required value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Leg Press 45" className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" /> </div> <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Ficha</label> <select value={novaFicha} onChange={(e) => setNovaFicha(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500"> <option value="A">A</option><option value="B">B</option><option value="C">C</option> </select> </div> <div> <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Grupo</label> <select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500"> <option value="Peito">Peito</option><option value="Costas">Costas</option><option value="Pernas">Pernas</option><option value="Ombros">Ombros</option><option value="Braços">Braços</option><option value="Core">Core</option> </select> </div> </div> <div className="flex gap-2"> <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all">{editingExId ? 'SALVAR' : 'CADASTRAR'}</button> {editingExId && <button type="button" onClick={limparFormularioExercicio} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all">CANCELAR</button>} </div> </form> {statusExercicio && <div className="mt-4 text-center text-green-400 font-medium">{statusExercicio}</div>} </div> <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700"> <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Meus Exercícios</h3> <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide"> {gruposMuscularesLista.map(grupo => (<button key={grupo} onClick={() => setFiltroGrupoEx(grupo)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${filtroGrupoEx === grupo ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>{grupo}</button>))} </div> <div className="space-y-3 max-h-60 overflow-y-auto pr-2"> {exerciciosExibidos.length > 0 ? (exerciciosExibidos.map((ex) => (<div key={ex.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700"> <div> <p className="text-sm font-bold text-white">{ex.nome}</p> <p className="text-xs text-gray-500">Ficha {ex.ficha || 'A'} • {ex.grupoMuscular}</p> </div> <div className="flex gap-2"> <button onClick={() => iniciarEdicao(ex)} className="text-blue-400 hover:text-blue-300 p-2 text-xs font-bold uppercase tracking-wider">Editar</button> <button onClick={() => handleExcluirExercicio(ex.id, ex.nome)} className="text-red-400 hover:text-red-300 p-2 text-xs font-bold uppercase tracking-wider">Excluir</button> </div> </div>))) : (<p className="text-gray-500 text-sm text-center py-4">Nenhum exercício neste grupo.</p>)} </div> </div> </div>)}
      </main>
    </div>
  );
}

export default App;