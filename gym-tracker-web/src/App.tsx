import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toBlob } from 'html-to-image';

const API_URL = "https://gym-tracker-api-yomc.onrender.com";

// --- COMPONENTE DO RELATÓRIO PRINTÁVEL ---
function ReportModal({ sessionData, allExercises, onClose, onShare, onDelete }: any) {
  const reportRef = useRef<HTMLDivElement>(null);
  if (!sessionData) return null;

  const startTime = new Date(sessionData.startTime);
  const endTime = new Date(sessionData.endTime);
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  const exercisesMap: any = {};
  const musculosTrabalhados = new Set<string>();

  sessionData.logs.forEach((log: any) => {
    const exerciseData = log.exercise || allExercises.find((ex: any) => ex.id === log.exerciseId);
    const exNome = exerciseData?.nome || 'Exercício';
    const grupo = exerciseData?.grupoMuscular;
    if (!exercisesMap[exNome]) exercisesMap[exNome] = [];
    exercisesMap[exNome].push(log);
    if (grupo) musculosTrabalhados.add(grupo);
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4 animate-in fade-in overflow-y-auto">
      <div ref={reportRef} id="report-card" className="w-full max-w-sm bg-gray-950 p-6 rounded-3xl border-4 border-blue-600 shadow-2xl text-white">
        <header className="text-center mb-6 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-black text-blue-500 italic">GYMTRACKER</h1>
          <p className="text-xs text-gray-400 uppercase font-bold mt-1">Resumo de Treino</p>
        </header>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-800 p-4 rounded-xl text-center">
            <p className="text-gray-500 text-[10px] uppercase font-bold">Duração</p>
            <p className="text-xl font-black">{durationMin} min</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl text-center">
            <p className="text-gray-500 text-[10px] uppercase font-bold">Calorias Est.</p>
            <p className="text-xl font-black text-green-400">{sessionData.calories} kcal</p>
          </div>
        </div>
        <div className="bg-gray-900 p-3 rounded-xl mb-4 border border-gray-800 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Foco do Dia</p>
          <p className="text-sm font-bold">{Array.from(musculosTrabalhados).join(', ') || 'Geral'}</p>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {Object.keys(exercisesMap).map(nome => (
            <div key={nome} className="flex justify-between text-sm bg-gray-900 p-2 rounded-lg">
              <span className="font-medium">{nome}</span>
              <span className="text-gray-400">{exercisesMap[nome].length} séries</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mt-6 w-full max-w-sm">
        <button onClick={onClose} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold">FECHAR</button>
        <button onClick={onShare} className="flex-1 bg-green-600 py-3 rounded-xl font-bold">WHATSAPP</button>
      </div>
      <button onClick={onDelete} className="mt-4 text-red-500 text-xs font-bold uppercase opacity-50">Excluir Registro</button>
    </div>
  );
}

// --- APLICATIVO ---
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'treinar' | 'fichas' | 'evolucao' | 'perfil'>('treinar');
  const [fichaAtiva, setFichaAtiva] = useState('A');

  // Dados
  const [library, setLibrary] = useState<any[]>([]);
  const [myPlans, setMyPlans] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [frequency, setFrequency] = useState<string[]>([]);

  // UI
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carga, setCarga] = useState('');
  const [reps, setReps] = useState('');
  const [exSelecionado, setExSelecionado] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('@GymTracker:user');
    if (saved) setUser(JSON.parse(saved));
    const sessao = localStorage.getItem('@GymTracker:activeSession');
    if (sessao) setActiveSession(JSON.parse(sessao));
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [libRes, planRes, weightRes, freqRes] = await Promise.all([
        fetch(`${API_URL}/exercises/${user.id}`),
        fetch(`${API_URL}/plans/${user.id}`),
        fetch(`${API_URL}/weight/${user.id}`),
        fetch(`${API_URL}/logs/frequency/${user.id}`)
      ]);
      if (libRes.ok) setLibrary(await libRes.json());
      if (planRes.ok) setMyPlans(await planRes.json());
      if (weightRes.ok) setWeightHistory(await weightRes.json());
      if (freqRes.ok) setFrequency(await freqRes.json());
    } catch (e) { console.error("Erro ao carregar dados"); }
  };

  const handleAuth = async (e: any) => {
    e.preventDefault();
    const route = isLogin ? '/login' : '/register';
    const res = await fetch(`${API_URL}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data);
      localStorage.setItem('@GymTracker:user', JSON.stringify(data));
    } else alert(data.error);
  };

  const handleStartWorkout = async () => {
    const res = await fetch(`${API_URL}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    if (res.ok) {
      const data = await res.json();
      setActiveSession(data);
      localStorage.setItem('@GymTracker:activeSession', JSON.stringify(data));
    }
  };

  const handleEndWorkout = async () => {
    if (!confirm("Encerrar treino e calcular calorias?")) return;
    const res = await fetch(`${API_URL}/sessions/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    if (res.ok) {
      setActiveSession(null);
      localStorage.removeItem('@GymTracker:activeSession');
      fetchData();
      alert("Treino salvo com sucesso!");
    }
  };

  const handleAddSerie = async (e: any) => {
    e.preventDefault();
    if (!exSelecionado || !activeSession) return;
    const res = await fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        exerciseId: Number(exSelecionado),
        carga: Number(carga),
        repsFeitas: Number(reps),
        sessionId: activeSession.id
      })
    });
    if (res.ok) {
      setCarga(''); setReps('');
      alert("Série registrada!");
    }
  };

  const handleAddToPlan = async (exId: number, ficha: string) => {
    const res = await fetch(`${API_URL}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, exerciseId: exId, ficha })
    });
    if (res.ok) {
      fetchData();
      setIsLibraryOpen(false);
    }
  };

  const handleRemoveFromPlan = async (id: number) => {
    if (!confirm("Remover da ficha?")) return;
    await fetch(`${API_URL}/plans/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleOpenReport = async (date: string) => {
    const res = await fetch(`${API_URL}/reports/${user.id}/${date}`);
    if (res.ok) {
      const reports = await res.json();
      if (reports.length > 0) setSelectedReport(reports[0]);
    }
  };

  const shareReport = async () => {
    const node = document.getElementById('report-card');
    if (!node) return;
    const blob = await toBlob(node, { pixelRatio: 2 });
    if (!blob) return;
    const file = new File([blob], 'treino.png', { type: 'image/png' });
    if (navigator.share) {
      navigator.share({ files: [file], title: 'Meu Treino' });
    } else {
      alert("Navegador não suporta compartilhamento direto.");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm bg-gray-900 p-8 rounded-3xl border border-gray-800">
          <h1 className="text-3xl font-black text-blue-500 mb-8 text-center italic">GYMTRACKER</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="E-mail" className="w-full bg-gray-800 p-4 rounded-2xl outline-none" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Senha" className="w-full bg-gray-800 p-4 rounded-2xl outline-none" value={senha} onChange={e => setSenha(e.target.value)} />
            <button className="w-full bg-blue-600 py-4 rounded-2xl font-bold uppercase">{isLogin ? 'Entrar' : 'Cadastrar'}</button>
          </form>
          <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-6 text-gray-500 text-sm">{isLogin ? 'Criar conta' : 'Já tenho conta'}</button>
        </div>
      </div>
    );
  }

  const exerciciosAtuais = myPlans.filter(p => p.ficha === fichaAtiva);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-28 font-sans">
      <header className="p-6 flex justify-between items-center max-w-md mx-auto">
        <h1 className="text-xl font-black text-blue-500 italic tracking-tighter">GYMTRACKER</h1>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[10px] font-bold text-red-500 border border-red-500/30 px-2 py-1 rounded">SAIR</button>
      </header>

      <main className="max-w-md mx-auto px-4">
        {/* TREINAR */}
        {activeTab === 'treinar' && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800 text-center">
              {activeSession ? (
                <div>
                  <div className="text-xs text-green-400 font-bold mb-3 animate-pulse">SESSÃO ATIVA</div>
                  <button onClick={handleEndWorkout} className="w-full bg-red-600 py-4 rounded-2xl font-bold">FINALIZAR TREINO</button>
                </div>
              ) : (
                <button onClick={handleStartWorkout} className="w-full bg-blue-600 py-4 rounded-2xl font-bold uppercase">Iniciar Cronômetro</button>
              )}
            </div>

            <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
              <div className="flex gap-2 mb-6">
                {['A', 'B', 'C'].map(f => (
                  <button key={f} onClick={() => setFichaAtiva(f)} className={`flex-1 py-2 rounded-xl font-bold ${fichaAtiva === f ? 'bg-blue-600' : 'bg-gray-800 text-gray-500'}`}>Ficha {f}</button>
                ))}
              </div>
              <form onSubmit={handleAddSerie} className="space-y-4">
                <select className="w-full bg-gray-800 p-4 rounded-2xl" value={exSelecionado} onChange={e => setExSelecionado(e.target.value)}>
                  <option value="">Escolha o exercício...</option>
                  {exerciciosAtuais.map(p => <option key={p.id} value={p.exercise.id}>{p.exercise.nome}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Peso (kg)" className="bg-gray-800 p-4 rounded-2xl" value={carga} onChange={e => setCarga(e.target.value)} />
                  <input type="number" placeholder="Reps" className="bg-gray-800 p-4 rounded-2xl" value={reps} onChange={e => setReps(e.target.value)} />
                </div>
                <button disabled={!activeSession} className="w-full bg-blue-600 py-4 rounded-2xl font-bold disabled:opacity-20 uppercase">Salvar Série</button>
              </form>
            </div>
          </div>
        )}

        {/* MINHAS FICHAS */}
        {activeTab === 'fichas' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Treino {fichaAtiva}</h2>
              <button onClick={() => setIsLibraryOpen(true)} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold">+ ADICIONAR</button>
            </div>
            <div className="flex gap-2 mb-4">
              {['A', 'B', 'C'].map(f => (
                <button key={f} onClick={() => setFichaAtiva(f)} className={`flex-1 py-2 rounded-xl font-bold text-xs ${fichaAtiva === f ? 'bg-blue-600' : 'bg-gray-900'}`}>{f}</button>
              ))}
            </div>
            <div className="space-y-3">
              {exerciciosAtuais.map(p => (
                <div key={p.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <p className="font-bold">{p.exercise.nome}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">{p.exercise.grupoMuscular}</p>
                  </div>
                  <button onClick={() => handleRemoveFromPlan(p.id)} className="text-red-500 p-2">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PERFIL & FREQUÊNCIA */}
        {activeTab === 'perfil' && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase">Frequência Mensal</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 30 }).map((_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (29 - i));
                  const iso = d.toISOString().split('T')[0];
                  const treinou = frequency.includes(iso);
                  return (
                    <button
                      key={iso}
                      onClick={() => treinou && handleOpenReport(iso)}
                      className={`w-[11.5%] aspect-square rounded-md text-[9px] font-bold flex items-center justify-center transition-all ${treinou ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-gray-800 text-gray-600'}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Histórico de Peso Simples */}
            <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 h-64">
              <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase">Massa Corporal</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={weightHistory.map((w: any) => ({ ...w, d: new Date(w.data).getDate() }))}>
                  <XAxis dataKey="d" stroke="#4B5563" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#111827', border: 'none', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="peso" stroke="#3B82F6" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>

      {/* MODAL BIBLIOTECA */}
      {isLibraryOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black italic">BIBLIOTECA</h2>
            <button onClick={() => setIsLibraryOpen(false)} className="text-3xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'].map(grupo => (
              <div key={grupo}>
                <h3 className="text-blue-500 text-[10px] font-black uppercase mb-3 tracking-widest">{grupo}</h3>
                <div className="space-y-2">
                  {library.filter(ex => ex.grupoMuscular === grupo).map(ex => (
                    <div key={ex.id} className="bg-gray-900 p-4 rounded-2xl flex justify-between items-center border border-gray-800">
                      <span className="font-bold text-sm">{ex.nome}</span>
                      <div className="flex gap-1">
                        {['A', 'B', 'C'].map(f => (
                          <button key={f} onClick={() => handleAddToPlan(ex.id, f)} className="bg-gray-800 px-3 py-1 rounded-lg text-[10px] font-black hover:bg-blue-600">+{f}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIO */}
      {selectedReport && (
        <ReportModal
          sessionData={selectedReport}
          allExercises={library}
          onClose={() => setSelectedReport(null)}
          onShare={shareReport}
          onDelete={async () => {
            if (confirm("Excluir treino?")) {
              await fetch(`${API_URL}/sessions/${selectedReport.id}`, { method: 'DELETE' });
              setSelectedReport(null); fetchData();
            }
          }}
        />
      )}

      {/* NAVEGAÇÃO */}
      <nav className="fixed bottom-6 left-6 right-6 bg-gray-900/90 backdrop-blur-xl border border-gray-800 p-2 flex justify-around rounded-full shadow-2xl z-40 max-w-md mx-auto">
        <button onClick={() => setActiveTab('treinar')} className={`p-4 rounded-full transition-all ${activeTab === 'treinar' ? 'bg-blue-600 shadow-lg shadow-blue-500/40' : 'text-gray-500'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
        <button onClick={() => setActiveTab('fichas')} className={`p-4 rounded-full transition-all ${activeTab === 'fichas' ? 'bg-blue-600 shadow-lg shadow-blue-500/40' : 'text-gray-500'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 0h6" /></svg>
        </button>
        <button onClick={() => setActiveTab('perfil')} className={`p-4 rounded-full transition-all ${activeTab === 'perfil' ? 'bg-blue-600 shadow-lg shadow-blue-500/40' : 'text-gray-500'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </button>
      </nav>
    </div>
  );
}