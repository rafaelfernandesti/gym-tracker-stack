import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toBlob } from 'html-to-image';

const API_URL = "https://gym-tracker-api-yomc.onrender.com";

const getUserDisplayName = (user: any) => {
  if (user?.nome?.trim()) return user.nome.trim();
  return user?.email?.split('@')[0]?.replace('.', ' ') || 'Atleta';
};

const getUserInitials = (user: any) => {
  const base = user?.nome?.trim() || user?.email || 'GT';
  return base.substring(0, 2).toUpperCase();
};

// --- FUNÇÃO DE ALARME DO DESCANSO (NATIVA) ---
const dispararAlarmeDescanso = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 150, 300, 150, 500]);
  }
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    }
  } catch (e) {
    console.log("Áudio não suportado ou bloqueado.");
  }
};

// --- COMPONENTE DO RELATÓRIO PRINTÁVEL ---
function ReportModal({ sessionData, allExercises, user, onClose, onShare, onDelete }: any) {
  const reportRef = useRef<HTMLDivElement>(null);
  if (!sessionData) return null;

  const startTime = new Date(sessionData.startTime);
  const endTime = new Date(sessionData.endTime);
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  const dataFormatada = startTime.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const exercisesMap: any = {};
  const musculosTrabalhados = new Set<string>();

  sessionData.logs.forEach((log: any) => {
    const exerciseData = log.exercise || allExercises.find((ex: any) => ex.id === log.exerciseId);
    const exNome = exerciseData?.nome || 'Exercício';
    const grupo = exerciseData?.grupoMuscular;

    if (!exercisesMap[exNome]) {
      exercisesMap[exNome] = { series: 0, maxCarga: 0, grupo };
    }
    exercisesMap[exNome].series += 1;
    if (log.carga > exercisesMap[exNome].maxCarga) {
      exercisesMap[exNome].maxCarga = log.carga;
    }

    if (grupo) musculosTrabalhados.add(grupo);
  });

  const sortedExercises = Object.entries(exercisesMap).sort((a: any, b: any) => b[1].maxCarga - a[1].maxCarga);
  const top3 = sortedExercises.slice(0, 3);
  const outrosCount = sortedExercises.length > 3 ? sortedExercises.length - 3 : 0;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4 animate-in fade-in overflow-y-auto">
      <div ref={reportRef} id="report-card" className="w-full max-w-sm bg-gray-900 p-8 rounded-[2rem] border border-gray-700 shadow-2xl text-white relative overflow-hidden">

        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-600/20 to-transparent"></div>

        {/* NOVO CABEÇALHO DO RELATÓRIO COM PERFIL */}
        <div className="flex justify-between items-center w-full mb-8 relative z-10 border-b border-gray-800/80 pb-5">

          {/* Perfil do Atleta */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center border-2 border-gray-700 overflow-hidden shadow-lg shrink-0">
              {user?.foto ? (
                <img src={user.foto} alt="Atleta" crossOrigin="anonymous" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-black text-gray-400">{getUserInitials(user)}</span>
              )}
            </div>
            <div className="text-left">
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1">Atleta</p>
              <p className="text-sm font-black text-white capitalize truncate max-w-[100px]">
                {getUserDisplayName(user)}
              </p>
            </div>
          </div>

          {/* Logo e Data */}
          <div className="text-right">
            <h1 className="text-lg font-black text-blue-500 tracking-tight leading-none">GYM<span className="text-white">TRACKER</span></h1>
            <p className="text-[8px] text-gray-400 uppercase font-bold mt-1.5 tracking-widest">{dataFormatada}</p>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
          <div className="bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl text-center border border-gray-700 shadow-inner">
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Duração</p>
            <p className="text-2xl font-black">{durationMin} <span className="text-sm font-normal text-gray-400">min</span></p>
          </div>
          <div className="bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl text-center border border-gray-700 shadow-inner">
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Queima Est.</p>
            <p className="text-2xl font-black text-green-400">{sessionData.calories || Math.round(durationMin * 6.5)} <span className="text-sm font-normal text-gray-500">kcal</span></p>
          </div>
        </div>

        <div className="bg-gray-950 p-4 rounded-2xl mb-6 border border-gray-800 text-center relative z-10">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-3 tracking-widest">Músculos Focados</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from(musculosTrabalhados).map(m => (
              <span key={m} className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-full text-xs font-black border border-blue-500/30 uppercase tracking-wider">
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-3 tracking-widest text-center">Destaques do Treino</p>
          <div className="space-y-3">
            {top3.map(([nome, dados]: any, idx) => (
              <div key={nome} className="flex justify-between items-center bg-gray-800 p-3 px-4 rounded-xl border border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-blue-500 font-black text-lg w-4">{idx + 1}º</span>
                  <div>
                    <span className="font-bold text-sm block text-white">{nome}</span>
                    <span className="text-[10px] text-gray-400">{dados.series} séries</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-black text-white">{dados.maxCarga}kg</span>
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Máx</span>
                </div>
              </div>
            ))}
          </div>

          {outrosCount > 0 && (
            <div className="mt-4 text-center">
              <span className="text-[10px] text-gray-500 font-bold bg-gray-900 px-4 py-1.5 rounded-full border border-gray-800 uppercase tracking-wider">
                + {outrosCount} outros exercícios
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6 w-full max-w-sm">
        <button onClick={onClose} className="flex-1 bg-gray-800 border border-gray-700 py-4 rounded-2xl font-bold text-gray-300 hover:text-white transition-colors">FECHAR</button>
        <button onClick={onShare} className="flex-1 bg-blue-600 shadow-lg shadow-blue-600/30 py-4 rounded-2xl font-black tracking-wider hover:bg-blue-500 transition-colors">COMPARTILHAR</button>
      </div>
      <button onClick={onDelete} className="mt-6 text-red-500/70 text-xs font-bold uppercase hover:text-red-400 transition-colors underline underline-offset-4">Excluir Registro</button>
    </div>
  );
}

// --- APLICATIVO ---
export default function App() {
  const wakeLockRef = useRef<any>(null);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'treinar' | 'fichas' | 'evolucao' | 'perfil'>('treinar');
  const [fichaAtiva, setFichaAtiva] = useState('A');

  // Dados Globais
  const [library, setLibrary] = useState<any[]>([]);
  const [myPlans, setMyPlans] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [daySessions, setDaySessions] = useState<any[] | null>(null);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [frequency, setFrequency] = useState<string[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<any[]>([]);
  const [lastLogs, setLastLogs] = useState<any[]>([]);

  // UX de Treino Ativo 
  const [cargas, setCargas] = useState<Record<number, string>>({});
  const [repsSet, setRepsSet] = useState<Record<number, string>>({});
  const [currentLogs, setCurrentLogs] = useState<{ id?: number, exerciseId: number, carga: number, reps: number }[]>([]);

  // UI Modais e Login
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libTab, setLibTab] = useState<'global' | 'custom'>('global');
  const [isLogin, setIsLogin] = useState(true);

  // Formulários
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [novoExNome, setNovoExNome] = useState('');
  const [novoExGrupo, setNovoExGrupo] = useState('Peito');
  const [novoPeso, setNovoPeso] = useState('');

  // Cronômetros
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [restTime, setRestTime] = useState(0);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('@GymTracker:user');
    if (saved) setUser(JSON.parse(saved));

    const sessao = localStorage.getItem('@GymTracker:activeSession');
    if (sessao) {
      const parsedSession = JSON.parse(sessao);
      setActiveSession(parsedSession);
      if (parsedSession.logs) {
        setCurrentLogs(parsedSession.logs.map((l: any) => ({ exerciseId: l.exerciseId, carga: l.carga, reps: l.repsFeitas || l.reps })));
      }
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    setProfileName(user?.nome || '');
    setProfilePhoto(user?.foto || '');
  }, [user]);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if (!activeSession || !('wakeLock' in navigator) || document.hidden) return;

        if (wakeLockRef.current) return;

        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current?.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      } catch (e) {
        console.error('Wake Lock falhou', e);
        wakeLockRef.current = null;
      }
    };

    const releaseWakeLock = async () => {
      try {
        await wakeLockRef.current?.release();
      } catch (e) {
        console.error('Erro ao liberar Wake Lock', e);
      } finally {
        wakeLockRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseWakeLock();
      } else if (activeSession) {
        requestWakeLock();
      }
    };

    if (activeSession) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [activeSession]);

  // Cronômetro Geral
  useEffect(() => {
    let interval: any;
    if (activeSession) {
      interval = setInterval(() => {
        const start = new Date(activeSession.startTime).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${m}:${s}`);
      }, 1000);
    } else {
      setElapsedTime('00:00');
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  // Cronômetro de Descanso
  useEffect(() => {
    if (!restEndTime) {
      setRestTime(0);
      return;
    }

    let finished = false;

    const syncRestTimer = () => {
      if (finished) return;

      const remaining = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));

      if (remaining === 0) {
        finished = true;
        setRestTime(0);
        setRestEndTime(null);
        dispararAlarmeDescanso();
        return;
      }

      setRestTime(prev => (prev === remaining ? prev : remaining));
    };

    syncRestTimer();

    const intervalId = window.setInterval(syncRestTimer, 250);
    const handleVisibilityChange = () => {
      if (!document.hidden) syncRestTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      finished = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [restEndTime]);

  const startRestTimer = (seconds: number) => {
    setRestEndTime(Date.now() + seconds * 1000);
    setRestTime(seconds);
  };

  const stopRestTimer = () => {
    setRestEndTime(null);
    setRestTime(0);
  };

  const fetchData = async () => {
    try {
      const [libRes, planRes, weightRes, freqRes, volRes, lastRes] = await Promise.all([
        fetch(`${API_URL}/exercises/${user.id}`),
        fetch(`${API_URL}/plans/${user.id}`),
        fetch(`${API_URL}/weight/${user.id}`),
        fetch(`${API_URL}/logs/frequency/${user.id}`),
        fetch(`${API_URL}/volume/${user.id}`),
        fetch(`${API_URL}/logs/last/${user.id}`)
      ]);
      if (libRes.ok) setLibrary(await libRes.json());
      if (planRes.ok) setMyPlans(await planRes.json());
      if (weightRes.ok) setWeightHistory(await weightRes.json());
      if (freqRes.ok) setFrequency(await freqRes.json());
      if (volRes.ok) setVolumeHistory(await volRes.json());
      if (lastRes.ok) setLastLogs(await lastRes.json());
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
  const handleMudarSenha = async (e: any) => {
    e.preventDefault();
    if (!novaSenha) return;

    const res = await fetch(`${API_URL}/users/${user.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novaSenha })
    });

    if (res.ok) {
      alert("Senha atualizada com sucesso!");
      setNovaSenha('');
    } else {
      alert("Erro ao tentar atualizar a senha.");
    }
  };

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: profileName.trim() || null,
          foto: profilePhoto.trim() || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data);
        localStorage.setItem('@GymTracker:user', JSON.stringify(data));
        alert("Perfil atualizado com sucesso!");
      } else {
        alert(data.error || "Erro ao atualizar perfil.");
      }
    } catch (e) {
      alert("Erro ao atualizar perfil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartWorkout = async () => {
    const res = await fetch(`${API_URL}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.logs) data.logs = [];
      setActiveSession(data);
      setCurrentLogs(data.logs.map((l: any) => ({ exerciseId: l.exerciseId, carga: l.carga, reps: l.repsFeitas || l.reps })));
      localStorage.setItem('@GymTracker:activeSession', JSON.stringify(data));

      try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); ctx.resume(); } catch (e) { }
    }
  };

  const handleAddSerie = async (exId: number) => {
    const c = Number(cargas[exId]);
    const r = Number(repsSet[exId]);
    if (!c || !r || !activeSession) return;

    const res = await fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        exerciseId: exId,
        carga: c,
        repsFeitas: r,
        sessionId: activeSession.id
      })
    });

    if (res.ok) {
      const savedLog = await res.json(); // Pega o ID gerado pelo banco

      // Adiciona a série com o ID oficial do banco (ou um temporário por segurança)
      const newLogs = [...currentLogs, {
        id: savedLog.id || Date.now(),
        exerciseId: exId,
        carga: c,
        reps: r
      }];

      setCurrentLogs(newLogs);

      const updatedSession = { ...activeSession, logs: newLogs };
      setActiveSession(updatedSession);
      localStorage.setItem('@GymTracker:activeSession', JSON.stringify(updatedSession));

      //setCargas({ ...cargas, [exId]: '' });
      //setRepsSet({ ...repsSet, [exId]: '' });
      startRestTimer(60);
    }
  };

  const handleDeleteSerie = async (logId: number) => {
    if (!confirm("Excluir esta série?")) return;

    // Apaga da tela na hora para não travar o seu treino
    const newLogs = currentLogs.filter(l => l.id !== logId);
    setCurrentLogs(newLogs);

    const updatedSession = { ...activeSession, logs: newLogs };
    setActiveSession(updatedSession);
    localStorage.setItem('@GymTracker:activeSession', JSON.stringify(updatedSession));

    // Manda a ordem silenciosa para a API apagar no banco
    await fetch(`${API_URL}/logs/${logId}`, { method: 'DELETE' });
  };

  const handleEndWorkout = async () => {
    if (!confirm("Finalizar sessão e salvar progresso?")) return;
    const res = await fetch(`${API_URL}/sessions/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    if (res.ok) {
      const sessionFinalizada = await res.json();
      sessionFinalizada.logs = currentLogs;

      setActiveSession(null);
      setCurrentLogs([]);
      stopRestTimer();
      localStorage.removeItem('@GymTracker:activeSession');

      fetchData();
      setSelectedReport(sessionFinalizada);
    }
  };

  // --- NOVA FUNÇÃO: CANCELAR TREINO ---
  const handleCancelWorkout = async () => {
    if (!confirm("Tem certeza que deseja cancelar? Nenhuma série será salva.")) return;

    // Deleta a sessão diretamente do banco de dados
    const res = await fetch(`${API_URL}/sessions/${activeSession.id}`, { method: 'DELETE' });

    if (res.ok) {
      setActiveSession(null);
      setCurrentLogs([]);
      stopRestTimer();
      localStorage.removeItem('@GymTracker:activeSession');
      fetchData(); // Recarrega gráficos limpos
    }
  };

  // --- ROTINAS DE API ---
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

  const handleUpdateSeries = async (id: number, seriesAlvo: number) => {
    try {
      const res = await fetch(`${API_URL}/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesAlvo })
      });
      if (res.ok) fetchData(); // Atualiza a tela automaticamente
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCustomExercise = async (e: any) => {
    e.preventDefault();
    if (!novoExNome) return;
    const res = await fetch(`${API_URL}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoExNome, grupoMuscular: novoExGrupo, userId: user.id })
    });
    if (res.ok) {
      fetchData();
      setNovoExNome('');
      alert("Exercício criado!");
    }
  };

  const handleDeleteCustomExercise = async (id: number) => {
    if (!confirm("Excluir este exercício permanentemente?")) return;
    const res = await fetch(`${API_URL}/exercises/${id}/${user.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else alert("Você só pode excluir exercícios que você mesmo criou.");
  };

  const handleRegistrarPeso = async (e: any) => {
    e.preventDefault();
    if (!novoPeso) return;
    const res = await fetch(`${API_URL}/weight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, peso: Number(novoPeso) })
    });
    if (res.ok) {
      fetchData();
      setNovoPeso('');
    }
  };

  const handleOpenReport = async (date: string) => {
    const res = await fetch(`${API_URL}/reports/${user.id}/${date}`);
    if (res.ok) {
      const reports = await res.json();
      if (reports.length === 1) {
        setSelectedReport(reports[0]);
      } else if (reports.length > 1) {
        setDaySessions(reports);
      }
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

  // --- TELA DE LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col justify-center p-4 text-white">
        <div className="max-w-md mx-auto w-full bg-gray-800 p-8 rounded-3xl border border-gray-700 shadow-2xl">
          <div className="flex flex-col items-center justify-center mb-8">
            <img src="/logo.png" alt="GymTracker Logo" className="w-20 h-20 mb-4 rounded-2xl shadow-lg" onError={(e) => e.currentTarget.style.display = 'none'} />
            <h1 className="text-3xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
            <p className="text-gray-400 text-sm mt-2">O seu treino, no seu controle.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="E-mail" className="w-full bg-gray-900 p-4 rounded-xl border border-gray-700 outline-none focus:border-blue-500 transition-colors" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Senha" className="w-full bg-gray-900 p-4 rounded-xl border border-gray-700 outline-none focus:border-blue-500 transition-colors" value={senha} onChange={e => setSenha(e.target.value)} />
            <button className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-bold uppercase transition-colors">{isLogin ? 'Entrar' : 'Cadastrar'}</button>
          </form>
          <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-6 text-gray-400 text-sm hover:text-white transition-colors">{isLogin ? 'Criar nova conta' : 'Já tenho conta'}</button>
        </div>
      </div>
    );
  }

  const exerciciosAtuais = myPlans.filter(p => p.ficha === fichaAtiva).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const customExercises = library.filter(ex => ex.userId === user.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-28 font-sans">
      <header className="p-6 flex justify-between items-center max-w-md mx-auto border-b border-gray-900">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-md" onError={(e) => e.currentTarget.style.display = 'none'} />
          <h1 className="text-xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Olá, {user.email.split('@')[0]}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-6">

        {/* ABA TREINAR */}
        {activeTab === 'treinar' && (
          <div className="space-y-6 animate-in slide-in-from-bottom">

            {!activeSession ? (
              <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg">
                <h2 className="text-xl font-black mb-4 text-center">Qual o alvo de hoje?</h2>

                <div className="flex gap-2 mb-6 bg-gray-900 p-1 rounded-xl">
                  {['A', 'B', 'C'].map(f => (
                    <button key={f} onClick={() => setFichaAtiva(f)} className={`flex-1 py-3 rounded-lg font-bold transition-colors ${fichaAtiva === f ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Ficha {f}</button>
                  ))}
                </div>

                <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                  {exerciciosAtuais.length > 0 ? exerciciosAtuais.map(p => (
                    <div key={p.id} className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-lg relative overflow-hidden transition-all flex justify-between items-center">
                      <div>
                        <p className="font-bold text-white">{p.exercise.nome}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{p.exercise.grupoMuscular}</p>
                      </div>

                      {/* NOVA ÁREA DE CONTROLOS */}
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Séries</span>
                          <input
                            type="number"
                            min="1"
                            className="w-12 bg-gray-900 text-center text-sm font-bold py-1 rounded-lg border border-gray-700 outline-none text-white focus:border-blue-500 transition-colors"
                            value={p.seriesAlvo || 3}
                            onChange={(e) => handleUpdateSeries(p.id, Number(e.target.value))}
                          />
                        </div>
                        <button onClick={() => handleRemoveFromPlan(p.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">✕</button>
                      </div>

                    </div>
                  )) : (
                    <div className="text-center py-6 border border-dashed border-gray-700 rounded-xl">
                      <p className="text-gray-500 text-sm">Ficha {fichaAtiva} vazia.</p>
                      <button onClick={() => setActiveTab('fichas')} className="text-blue-500 text-xs font-bold mt-2 uppercase">Ir para Fichas</button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartWorkout}
                  disabled={exerciciosAtuais.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/30"
                >
                  INICIAR TREINO
                </button>
              </div>

            ) : (

              <div className="space-y-6">
                <div className="bg-gray-800 p-4 rounded-3xl border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)] text-center sticky top-4 z-30">
                  <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-400 font-bold text-[10px] tracking-widest uppercase">Gravando</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-white tracking-widest">{elapsedTime}</div>
                  </div>

                  {restTime > 0 && (
                    <div className="mt-3 bg-blue-900/40 p-2 rounded-xl border border-blue-500/30 flex justify-between items-center animate-pulse">
                      <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest pl-2">Descanso</span>
                      <span className="text-xl font-black font-mono text-white">00:{restTime.toString().padStart(2, '0')}</span>
                      <button onClick={stopRestTimer} className="bg-gray-900 px-3 py-1 rounded-lg text-[10px] text-gray-400 font-bold hover:text-white">PULAR</button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {exerciciosAtuais.map(p => {
                    const exLogs = currentLogs.filter(l => l.exerciseId === p.exercise.id);
                    const fantasma = lastLogs.find(l => l.exerciseId === p.exercise.id);
                    const metaInt = p.seriesAlvo || 3;
                    const currentSerieNum = exLogs.length + 1;

                    // Calcula quantas séries faltam para bater a meta (mínimo zero, para não quebrar se você fizer séries extras)
                    const remainingSets = Math.max(0, metaInt - currentSerieNum);
                    const emptySetsArray = Array.from({ length: remainingSets });

                    return (
                      <div key={p.id} className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-xl overflow-hidden relative">

                        {/* CABEÇALHO DO EXERCÍCIO COM A META */}
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="font-black text-lg text-white leading-tight">{p.exercise.nome}</h3>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{p.exercise.grupoMuscular}</p>
                          </div>

                          <div className="bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-700 flex flex-col items-center shadow-inner">
                            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Meta</span>
                            <span className="text-sm font-black text-white">
                              <span className={exLogs.length >= metaInt ? "text-green-400" : "text-blue-500"}>
                                {exLogs.length}
                              </span> / {metaInt}
                            </span>
                          </div>
                        </div>

                        {/* ÁREA VISUAL DAS SÉRIES (LINHA DO TEMPO COMPLETA) */}
                        <div className="space-y-3 relative mb-6">
                          {/* Linha vertical conectora */}
                          <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-700 z-0"></div>

                          {/* 1. SÉRIES JÁ CONCLUÍDAS */}
                          {exLogs.map((log, idx) => (
                            <div key={log.id || idx} className="flex items-center gap-4 pl-0 z-10 relative">
                              <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-green-500">✓</span>
                              </div>
                              <div className="flex-1 flex items-center justify-between bg-gray-900/50 p-2 px-4 rounded-xl border border-gray-700/50">
                                <div>
                                  <span className="text-sm font-black text-white">{log.carga} <span className="text-gray-500 font-normal text-xs">kg ×</span> {log.reps} <span className="text-gray-500 font-normal text-xs">reps</span></span>
                                </div>
                                <button onClick={() => log.id && handleDeleteSerie(log.id)} className="text-red-500 hover:text-red-400 font-bold p-1 text-xs opacity-70 hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            </div>
                          ))}

                          {/* 2. SÉRIE ATUAL (Sempre aparece, mesmo se passar da meta) */}
                          <div className="flex items-center gap-4 pl-0 z-10 relative mt-2">
                            <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                              <span className="text-sm font-black text-white">{currentSerieNum}</span>
                            </div>

                            <div className="flex-1 flex gap-2">
                              <input
                                type="number"
                                placeholder="kg"
                                className="w-full bg-gray-900 p-3 rounded-xl border border-gray-700 outline-none focus:border-blue-500 font-bold text-sm text-white text-center transition-colors"
                                value={cargas[p.exercise.id] || ''}
                                onChange={e => setCargas({ ...cargas, [p.exercise.id]: e.target.value })}
                              />
                              <input
                                type="number"
                                placeholder="reps"
                                className="w-full bg-gray-900 p-3 rounded-xl border border-gray-700 outline-none focus:border-blue-500 font-bold text-sm text-white text-center transition-colors"
                                value={repsSet[p.exercise.id] || ''}
                                onChange={e => setRepsSet({ ...repsSet, [p.exercise.id]: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* 3. SÉRIES FUTURAS (O que falta para a meta) */}
                          {emptySetsArray.map((_, i) => {
                            const setNum = currentSerieNum + 1 + i;
                            return (
                              <div key={`empty-${setNum}`} className="flex items-center gap-4 pl-0 z-10 relative mt-2 opacity-40">
                                <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-gray-500">{setNum}</span>
                                </div>
                                <div className="flex-1 flex gap-2">
                                  <div className="w-full bg-gray-900/50 p-3 rounded-xl border border-gray-700 h-11"></div>
                                  <div className="w-full bg-gray-900/50 p-3 rounded-xl border border-gray-700 h-11"></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* BOTÃO E FANTASMA */}
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => handleAddSerie(p.exercise.id)}
                            disabled={!cargas[p.exercise.id] || !repsSet[p.exercise.id]}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed py-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-colors"
                          >
                            + SÉRIE
                          </button>

                          {fantasma && (
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center mt-1">
                              Último Treino: <span className="text-blue-400">{fantasma.carga}kg × {fantasma.repsFeitas} reps</span>
                            </p>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* BOTÕES DE AÇÃO DO TREINO */}
                <div className="mt-8 space-y-3">
                  <button onClick={handleEndWorkout} className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-green-500/20 transition-all">
                    FINALIZAR TREINO
                  </button>
                  <button onClick={handleCancelWorkout} className="w-full py-4 rounded-2xl font-bold text-red-500/80 uppercase tracking-widest hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/30 text-xs">
                    Cancelar Treino
                  </button>
                </div>
              </div>
            )
            }
          </div >
        )}

        {/* ABA FICHAS */}
        {
          activeTab === 'fichas' && (
            <div className="space-y-6 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold">Configurar Fichas</h2>
                <button onClick={() => setIsLibraryOpen(true)} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30">+ EXERCÍCIO</button>
              </div>

              <div className="flex gap-2 mb-6 bg-gray-900 p-1 rounded-xl">
                {['A', 'B', 'C'].map(f => (
                  <button key={f} onClick={() => setFichaAtiva(f)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${fichaAtiva === f ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Ficha {f}</button>
                ))}
              </div>

              <div className="space-y-3">
                {exerciciosAtuais.length > 0 ? exerciciosAtuais.map(p => (
                  <div key={p.id} className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-lg relative overflow-hidden transition-all flex justify-between items-center">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-white">{p.exercise.nome}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{p.exercise.grupoMuscular}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Séries</span>
                          <input
                            type="number"
                            min="1"
                            className="w-12 bg-gray-900 text-center text-sm font-bold py-1 rounded-lg border border-gray-700 outline-none text-white focus:border-blue-500 transition-colors"
                            value={p.seriesAlvo || 3}
                            onChange={(e) => handleUpdateSeries(p.id, Number(e.target.value))}
                          />
                        </div>
                        <button onClick={() => handleRemoveFromPlan(p.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">✕</button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 bg-gray-800/50 rounded-2xl border border-gray-800 border-dashed">
                    <p className="text-gray-500">Nenhum exercício na Ficha {fichaAtiva}.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* ABA EVOLUÇÃO */}
        {activeTab === 'evolucao' && (
          <div className="space-y-6 animate-in slide-in-from-bottom">
            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg h-64 flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Volume Total de Carga (kg)</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeHistory.map((v: any) => ({ ...v, d: new Date(v.data).getDate() }))}>
                    <XAxis dataKey="d" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                    <Bar dataKey="volume" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg h-80 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Peso Corporal</h3>
                <form onSubmit={handleRegistrarPeso} className="flex gap-2">
                  <input type="number" step="0.1" placeholder="Ex: 85.5" className="w-24 bg-gray-900 p-2 rounded-lg border border-gray-700 outline-none text-sm text-center" value={novoPeso} onChange={e => setNovoPeso(e.target.value)} />
                  <button className="bg-blue-600 px-3 py-2 rounded-lg text-xs font-bold">+</button>
                </form>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistory.map((w: any) => ({ ...w, d: new Date(w.data).getDate() }))}>
                    <XAxis dataKey="d" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                    <Line type="monotone" dataKey="peso" stroke="#10B981" strokeWidth={4} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#1F2937' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg mb-8">
              <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest text-center">Frequência Mensal</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: 30 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (29 - i));
                  const ano = d.getFullYear();
                  const mes = d.getMonth();
                  const dia = d.getDate();
                  const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

                  const treinou = frequency.some((isoDateString: string) => {
                    const dataTreino = new Date(isoDateString);
                    return dataTreino.getFullYear() === ano &&
                      dataTreino.getMonth() === mes &&
                      dataTreino.getDate() === dia;
                  });

                  return (
                    <button
                      key={iso}
                      onClick={() => treinou && handleOpenReport(iso)}
                      className={`w-[11%] aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all ${treinou ? 'bg-green-500 text-white shadow-lg shadow-green-500/40' : 'bg-gray-900 border border-gray-700 text-gray-600'}`}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ABA PERFIL */}
        {activeTab === 'perfil' && (
          <div className="space-y-6 animate-in slide-in-from-bottom">
            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg text-center">
              <div className="w-20 h-20 bg-gray-900 rounded-full mx-auto flex items-center justify-center border-4 border-gray-700 mb-4 overflow-hidden">
                {user.foto ? (
                  <img src={user.foto} alt="Foto de perfil" crossOrigin="anonymous" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-gray-500">{getUserInitials(user)}</span>
                )}
              </div>
              <h2 className="text-xl font-bold mb-1">{user.email}</h2>
              <p className="text-gray-500 text-sm mb-8">Membro GymTracker</p>

              <form onSubmit={handleUpdateProfile} className="mb-8 space-y-3 bg-gray-900 p-4 rounded-2xl border border-gray-700 text-left">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Perfil</p>
                <input
                  type="text"
                  placeholder="Nome de exibição"
                  className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 outline-none text-sm focus:border-blue-500 transition-colors"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                />
                <input
                  type="url"
                  placeholder="https://sua-foto.jpg"
                  className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 outline-none text-sm focus:border-blue-500 transition-colors"
                  value={profilePhoto}
                  onChange={e => setProfilePhoto(e.target.value)}
                />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Use uma imagem pública com CORS liberado para aparecer no compartilhamento do relatório.
                </p>
                <button
                  disabled={isSavingProfile}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-green-500/20"
                >
                  {isSavingProfile ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </form>

              {/* FORMULÁRIO DE TROCA DE SENHA */}
              <form onSubmit={handleMudarSenha} className="mb-8 space-y-3 bg-gray-900 p-4 rounded-2xl border border-gray-700 text-left">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Segurança</p>
                <input
                  type="password"
                  placeholder="Digitar nova senha"
                  className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 outline-none text-sm focus:border-blue-500 transition-colors"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                />
                <button
                  disabled={!novaSenha}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-blue-500/20"
                >
                  Atualizar Senha
                </button>
              </form>

              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full bg-gray-900 border border-red-500/30 text-red-500 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-red-500/10 transition-colors">
                Sair da Conta
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL SELETOR DE TREINOS DO DIA */}
      {
        daySessions && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4 animate-in fade-in">
            <div className="bg-gray-900 p-6 rounded-3xl border border-gray-700 max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-white text-center">Treinos do Dia</h3>
              <div className="space-y-3">
                {daySessions.map((sess, i) => (
                  <button
                    key={sess.id}
                    onClick={() => {
                      setSelectedReport(sess);
                      setDaySessions(null);
                    }}
                    className="w-full bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 hover:bg-blue-600 transition-colors group"
                  >
                    <span className="font-bold text-white">Sessão {i + 1}</span>
                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                      {new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setDaySessions(null)} className="w-full mt-4 p-3 font-bold text-gray-500 hover:text-white uppercase tracking-widest text-xs transition-colors">Cancelar</button>
            </div>
          </div>
        )
      }

      {/* MODAL BIBLIOTECA & CRIAÇÃO */}
      {
        isLibraryOpen && (
          <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col animate-in slide-in-from-bottom duration-200">
            <header className="p-6 flex justify-between items-center border-b border-gray-800 bg-gray-900">
              <h2 className="text-xl font-bold">Adicionar Exercício</h2>
              <button onClick={() => setIsLibraryOpen(false)} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
            </header>

            <div className="flex bg-gray-900 border-b border-gray-800 p-2">
              <button onClick={() => setLibTab('global')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${libTab === 'global' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Biblioteca Global</button>
              <button onClick={() => setLibTab('custom')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${libTab === 'custom' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Meus Exercícios</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-20">
              {libTab === 'global' ? (
                ['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'].map(grupo => (
                  <div key={grupo}>
                    <h3 className="text-blue-500 text-[11px] font-black uppercase mb-3 tracking-widest">{grupo}</h3>
                    <div className="space-y-2">
                      {library.filter(ex => ex.grupoMuscular === grupo && !ex.userId).map(ex => (
                        <div key={ex.id} className="bg-gray-800 p-4 rounded-2xl flex justify-between items-center border border-gray-700">
                          <span className="font-bold text-sm text-white">{ex.nome}</span>
                          <div className="flex gap-1">
                            {['A', 'B', 'C'].map(f => (
                              <button key={f} onClick={() => handleAddToPlan(ex.id, f)} className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-blue-600 transition-colors">+{f}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
                    <h3 className="text-lg font-bold mb-4">Novo Exercício</h3>
                    <form onSubmit={handleCreateCustomExercise} className="space-y-4">
                      <input type="text" placeholder="Nome (Ex: Supino Declinado)" className="w-full bg-gray-900 p-4 rounded-xl border border-gray-700 outline-none" value={novoExNome} onChange={e => setNovoExNome(e.target.value)} required />
                      <select className="w-full bg-gray-900 p-4 rounded-xl border border-gray-700 outline-none" value={novoExGrupo} onChange={e => setNovoExGrupo(e.target.value)}>
                        {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <button className="w-full bg-green-600 py-4 rounded-xl font-bold">SALVAR</button>
                    </form>
                  </div>

                  {customExercises.length > 0 && (
                    <div>
                      <h3 className="text-gray-400 text-[11px] font-black uppercase mb-3 tracking-widest">Criados por você</h3>
                      <div className="space-y-2">
                        {customExercises.map(ex => (
                          <div key={ex.id} className="bg-gray-800 p-4 rounded-2xl flex justify-between items-center border border-gray-700">
                            <div>
                              <span className="font-bold text-sm text-white block">{ex.nome}</span>
                              <span className="text-[10px] text-gray-500 uppercase">{ex.grupoMuscular}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {['A', 'B', 'C'].map(f => (
                                <button key={f} onClick={() => handleAddToPlan(ex.id, f)} className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-[10px] font-black hover:bg-blue-600 transition-colors">+{f}</button>
                              ))}
                              <div className="w-px h-6 bg-gray-700 mx-1"></div>
                              <button onClick={() => handleDeleteCustomExercise(ex.id)} className="text-red-500 hover:text-red-400 p-1">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      }

      {selectedReport && (
        <ReportModal
          sessionData={selectedReport}
          allExercises={library}
          user={user} // <--- ADICIONE ESTA LINHA AQUI
          onClose={() => setSelectedReport(null)}
          onShare={shareReport}
          onDelete={async () => {
            if (confirm("Excluir treino?")) {
              await fetch(`${API_URL}/sessions/${selectedReport.id}`, { method: 'DELETE' });
              setSelectedReport(null); fetchData();
            }
          }}
        />
      )
      }

      {/* NAVEGAÇÃO BOTTOM */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 flex justify-around z-40 max-w-md mx-auto rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <button onClick={() => setActiveTab('treinar')} className={`p-3 rounded-2xl font-bold text-xs transition-colors flex-1 text-center ${activeTab === 'treinar' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Treinar</button>
        <button onClick={() => setActiveTab('fichas')} className={`p-3 rounded-2xl font-bold text-xs transition-colors flex-1 text-center ${activeTab === 'fichas' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Fichas</button>
        <button onClick={() => setActiveTab('evolucao')} className={`p-3 rounded-2xl font-bold text-xs transition-colors flex-1 text-center ${activeTab === 'evolucao' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Evolução</button>
        <button onClick={() => setActiveTab('perfil')} className={`p-3 rounded-2xl font-bold text-xs transition-colors flex-1 text-center ${activeTab === 'perfil' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Perfil</button>
      </nav>
    </div >
  );
}
