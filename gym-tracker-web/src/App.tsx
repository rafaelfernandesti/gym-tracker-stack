import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toBlob } from 'html-to-image';
import {
  BicepsFlexed,
  CalendarCheck,
  ChartLine,
  CheckCircle2,
  ClipboardList,
  Flame,
  KeyRound,
  LoaderCircle,
  LogOut,
  Plus,
  Save,
  Share2,
  Trash2,
  Trophy,
  TrendingUp,
  UserRound,
  X
} from 'lucide-react';

const API_URL = "https://gym-tracker-api-yomc.onrender.com";

const getUserDisplayName = (user: any) => {
  if (user?.nome?.trim()) return user.nome.trim();
  return user?.email?.split('@')[0]?.replace('.', ' ') || 'Atleta';
};

const getUserInitials = (user: any) => {
  const base = user?.nome?.trim() || user?.email || 'GT';
  return base.substring(0, 2).toUpperCase();
};

type Toast = {
  id: number;
  message: string;
  type?: 'success' | 'error' | 'info';
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger' | 'success';
  resolve: (value: boolean) => void;
} | null;

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;

  const toneClass = {
    success: 'border-green-500/40 bg-green-950/90 text-green-100',
    error: 'border-red-500/40 bg-red-950/90 text-red-100',
    info: 'border-blue-500/40 bg-gray-900/95 text-white'
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-[80] pointer-events-none px-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-md ${toneClass[toast.type || 'info']}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: (value: boolean) => void }) {
  if (!state) return null;

  const confirmClass = state.tone === 'danger'
    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
    : state.tone === 'success'
      ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20'
      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-gray-700 bg-gray-900 p-6 text-white shadow-2xl">
        <p className="text-lg font-black leading-tight">{state.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">{state.message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => onClose(false)}
            className="rounded-2xl border border-gray-700 bg-gray-800 py-3 text-sm font-bold text-gray-300 transition-colors hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => onClose(true)}
            className={`rounded-2xl py-3 text-sm font-black text-white shadow-lg transition-colors ${confirmClass}`}
          >
            {state.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingIcon({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="animate-spin" />;
}

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
function ReportModal({ sessionData, allExercises, user, onClose, onShare, onDelete, isSharing }: any) {
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
        <button onClick={onClose} className="flex-1 bg-gray-800 border border-gray-700 py-4 rounded-2xl font-bold text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-2">
          <X size={16} />
          FECHAR
        </button>
        <button disabled={isSharing} onClick={onShare} className="flex-1 bg-blue-600 shadow-lg shadow-blue-600/30 py-4 rounded-2xl font-black tracking-wider hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
          {isSharing ? <LoadingIcon size={16} /> : <Share2 size={16} />}
          {isSharing ? 'GERANDO...' : 'COMPARTILHAR'}
        </button>
      </div>
      <button onClick={onDelete} className="mt-6 text-red-500/70 text-xs font-bold uppercase hover:text-red-400 transition-colors underline underline-offset-4 flex items-center gap-2">
        <Trash2 size={14} />
        Excluir Registro
      </button>
    </div>
  );
}

// --- APLICATIVO ---
export default function App() {
  const wakeLockRef = useRef<any>(null);
  const hasHandledExpiredSessionRef = useRef(false);
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
  const [currentLogs, setCurrentLogs] = useState<{ id?: number | string, exerciseId: number, carga: number, reps: number }[]>([]);

  // UI Modais e Login
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libTab, setLibTab] = useState<'global' | 'custom'>('global');
  const [isLogin, setIsLogin] = useState(true);
  const [authMode, setAuthMode] = useState<'auth' | 'forgot' | 'reset'>('auth');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [isServerWaking, setIsServerWaking] = useState(false);
  const [serverStatus, setServerStatus] = useState<'idle' | 'online' | 'slow' | 'offline'>('idle');
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [isEndingWorkout, setIsEndingWorkout] = useState(false);
  const [isCancellingWorkout, setIsCancellingWorkout] = useState(false);
  const [addingSeries, setAddingSeries] = useState<Record<number, boolean>>({});
  const [deletingSeries, setDeletingSeries] = useState<Record<string, boolean>>({});
  const [mutatingPlans, setMutatingPlans] = useState<Record<number, boolean>>({});
  const [addingPlanKey, setAddingPlanKey] = useState('');
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [deletingExerciseId, setDeletingExerciseId] = useState<number | null>(null);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [reportLoadingDate, setReportLoadingDate] = useState('');
  const [isSharingReport, setIsSharingReport] = useState(false);

  // Formulários
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [resetToken, setResetToken] = useState('');
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

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 2800);
  };

  const askConfirm = (options: Omit<NonNullable<ConfirmState>, 'resolve'>) => {
    return new Promise<boolean>(resolve => {
      setConfirmState({ ...options, resolve });
    });
  };

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const handleExpiredSession = () => {
    if (hasHandledExpiredSessionRef.current) return;

    hasHandledExpiredSessionRef.current = true;
    localStorage.removeItem('@GymTracker:user');
    localStorage.removeItem('@GymTracker:activeSession');
    setUser(null);
    setActiveSession(null);
    setCurrentLogs([]);
    setSelectedReport(null);
    setDaySessions(null);
    stopRestTimer();
    showToast('Sua sessão expirou. Faça login novamente.', 'info');

    window.setTimeout(() => {
      hasHandledExpiredSessionRef.current = false;
    }, 3000);
  };

  const authFetch = async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (user?.token) headers.set('Authorization', `Bearer ${user.token}`);

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      handleExpiredSession();
    }

    return response;
  };

  const checkServerAwake = async (showSuccessToast = false) => {
    setIsCheckingServer(true);
    setServerStatus('idle');

    const wakeTimer = window.setTimeout(() => {
      setIsServerWaking(true);
      setServerStatus('slow');
    }, 1800);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(`${API_URL}/ping`, {
        cache: 'no-store',
        signal: controller.signal
      });

      if (!res.ok) throw new Error('Ping falhou');

      setServerStatus('online');
      if (showSuccessToast) showToast('Servidor conectado.', 'success');
      return true;
    } catch (e) {
      setServerStatus('offline');
      showToast('Servidor indisponível no momento. Tente novamente em instantes.', 'error');
      return false;
    } finally {
      window.clearTimeout(wakeTimer);
      window.clearTimeout(timeout);
      setIsCheckingServer(false);
      setIsServerWaking(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('resetToken');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setAuthMode('reset');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const saved = localStorage.getItem('@GymTracker:user');
    if (saved) {
      const parsedUser = JSON.parse(saved);
      if (parsedUser?.token) {
        setUser(parsedUser);
      } else {
        localStorage.removeItem('@GymTracker:user');
        localStorage.removeItem('@GymTracker:activeSession');
      }
    }

    const sessao = localStorage.getItem('@GymTracker:activeSession');
    if (sessao) {
      const parsedSession = JSON.parse(sessao);
      setActiveSession(parsedSession);
      if (parsedSession.logs) {
        setCurrentLogs(parsedSession.logs.map((l: any) => ({ exerciseId: l.exerciseId, carga: l.carga, reps: l.repsFeitas || l.reps })));
      }
    }

    checkServerAwake();
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
    if (!user?.id) return;
    setIsLoadingData(true);
    setDataError('');
    const wakeTimer = window.setTimeout(() => {
      setIsServerWaking(true);
      setServerStatus('slow');
    }, 1800);
    try {
      const [libRes, planRes, weightRes, freqRes, volRes, lastRes] = await Promise.all([
        authFetch(`/exercises/${user.id}`),
        authFetch(`/plans/${user.id}`),
        authFetch(`/weight/${user.id}`),
        authFetch(`/logs/frequency/${user.id}`),
        authFetch(`/volume/${user.id}`),
        authFetch(`/logs/last/${user.id}`)
      ]);
      if (libRes.ok) setLibrary(await libRes.json());
      if (planRes.ok) setMyPlans(await planRes.json());
      if (weightRes.ok) setWeightHistory(await weightRes.json());
      if (freqRes.ok) setFrequency(await freqRes.json());
      if (volRes.ok) setVolumeHistory(await volRes.json());
      if (lastRes.ok) setLastLogs(await lastRes.json());
      if (![libRes, planRes, weightRes, freqRes, volRes, lastRes].every(res => res.ok)) {
        setDataError('Alguns dados não carregaram. Tente atualizar.');
      }
    } catch (e) {
      console.error("Erro ao carregar dados");
      setServerStatus('offline');
      setDataError('Não foi possível carregar seus dados agora. O servidor pode estar acordando ou indisponível.');
    } finally {
      window.clearTimeout(wakeTimer);
      setIsServerWaking(false);
      setIsLoadingData(false);
    }
  };

  const handleAuth = async (e: any) => {
    e.preventDefault();
    if (isAuthLoading) return;
    const route = isLogin ? '/login' : '/register';
    setIsAuthLoading(true);
    const wakeTimer = window.setTimeout(() => {
      setIsServerWaking(true);
      setServerStatus('slow');
    }, 1800);
    try {
      const res = await fetch(`${API_URL}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('@GymTracker:user', JSON.stringify(data));
        showToast(isLogin ? 'Bem-vindo de volta.' : 'Conta criada com sucesso.', 'success');
      } else showToast(data.error || 'Não foi possível entrar.', 'error');
    } catch (e) {
      setServerStatus('offline');
      showToast('Não foi possível conectar à API. Se o Render estiver acordando, tente novamente em alguns segundos.', 'error');
    } finally {
      window.clearTimeout(wakeTimer);
      setIsServerWaking(false);
      setIsAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: any) => {
    e.preventDefault();
    if (!email || isAuthLoading) return;

    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        showToast(data?.message || 'Se o e-mail existir, enviaremos instruções.', 'success');
        if (data?.resetUrl) {
          const token = new URL(data.resetUrl).searchParams.get('resetToken');
          if (token) {
            setResetToken(token);
            setAuthMode('reset');
          }
        } else {
          setAuthMode('auth');
        }
      } else {
        showToast(data?.error || 'Não foi possível solicitar recuperação.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível solicitar recuperação.', 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResetPassword = async (e: any) => {
    e.preventDefault();
    if (!resetToken || !novaSenha || isAuthLoading) return;

    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, novaSenha })
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setUser(data);
        localStorage.setItem('@GymTracker:user', JSON.stringify(data));
        setResetToken('');
        setNovaSenha('');
        setAuthMode('auth');
        showToast('Senha redefinida com sucesso.', 'success');
      } else {
        showToast(data?.error || 'Não foi possível redefinir a senha.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível redefinir a senha.', 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };
  const handleMudarSenha = async (e: any) => {
    e.preventDefault();
    if (!senhaAtual || !novaSenha || isChangingPassword) return;

    setIsChangingPassword(true);
    try {
      const res = await authFetch(`/users/${user.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha })
      });

      if (res.ok) {
        showToast("Senha atualizada com sucesso.", 'success');
        setSenhaAtual('');
        setNovaSenha('');
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "Erro ao tentar atualizar a senha.", 'error');
      }
    } catch (e) {
      showToast("Erro ao tentar atualizar a senha.", 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingProfile(true);
    try {
      const res = await authFetch(`/users/${user.id}/profile`, {
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
        showToast("Perfil atualizado com sucesso.", 'success');
      } else {
        showToast(data.error || "Erro ao atualizar perfil.", 'error');
      }
    } catch (e) {
      showToast("Erro ao atualizar perfil.", 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartWorkout = async () => {
    if (isStartingWorkout) return;
    setIsStartingWorkout(true);
    try {
      const res = await authFetch('/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.logs) data.logs = [];
        setActiveSession(data);
        setCurrentLogs(data.logs.map((l: any) => ({ id: l.id, exerciseId: l.exerciseId, carga: l.carga, reps: l.repsFeitas || l.reps })));
        localStorage.setItem('@GymTracker:activeSession', JSON.stringify(data));
        showToast(data.logs?.length ? 'Treino retomado.' : 'Treino iniciado.', 'success');

        try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); ctx.resume(); } catch (e) { }
      } else {
        showToast('Não foi possível iniciar o treino.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível iniciar o treino.', 'error');
    } finally {
      setIsStartingWorkout(false);
    }
  };

  const handleAddSerie = async (exId: number) => {
    const c = Number(cargas[exId]);
    const r = Number(repsSet[exId]);
    if (!c || !r || !activeSession) {
      showToast('Informe carga e repetições para registrar a série.', 'info');
      return;
    }
    if (addingSeries[exId]) return;

    setAddingSeries(prev => ({ ...prev, [exId]: true }));
    try {
      const res = await authFetch('/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        showToast('Série registrada.', 'success');
      } else {
        showToast('Não foi possível registrar a série.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível registrar a série.', 'error');
    } finally {
      setAddingSeries(prev => ({ ...prev, [exId]: false }));
    }
  };

  const handleDeleteSerie = async (logId: number | string) => {
    const confirmed = await askConfirm({
      title: 'Excluir série?',
      message: 'Esta série será removida do treino atual.',
      confirmLabel: 'Excluir',
      tone: 'danger'
    });
    if (!confirmed) return;
    const key = String(logId);
    if (deletingSeries[key]) return;

    // Apaga da tela na hora para não travar o seu treino
    const newLogs = currentLogs.filter(l => l.id !== logId);
    setCurrentLogs(newLogs);

    const updatedSession = { ...activeSession, logs: newLogs };
    setActiveSession(updatedSession);
    localStorage.setItem('@GymTracker:activeSession', JSON.stringify(updatedSession));

    // Manda a ordem silenciosa para a API apagar no banco
    setDeletingSeries(prev => ({ ...prev, [key]: true }));
    try {
      const res = await authFetch(`/logs/${logId}`, { method: 'DELETE' });
      if (res.ok) showToast('Série excluída.', 'success');
      else showToast('A série saiu da tela, mas a API não confirmou a exclusão.', 'error');
    } catch (e) {
      showToast('A série saiu da tela, mas a API não confirmou a exclusão.', 'error');
    } finally {
      setDeletingSeries(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleEndWorkout = async () => {
    if (isEndingWorkout) return;
    const confirmed = await askConfirm({
      title: 'Finalizar treino?',
      message: 'O treino será salvo no histórico e o relatório ficará pronto para compartilhar.',
      confirmLabel: 'Finalizar',
      tone: 'success'
    });
    if (!confirmed) return;
    setIsEndingWorkout(true);
    try {
      const res = await authFetch('/sessions/end', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
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
        showToast('Treino finalizado.', 'success');
      } else {
        showToast('Não foi possível finalizar o treino.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível finalizar o treino.', 'error');
    } finally {
      setIsEndingWorkout(false);
    }
  };

  // --- NOVA FUNÇÃO: CANCELAR TREINO ---
  const handleCancelWorkout = async () => {
    if (isCancellingWorkout) return;
    const confirmed = await askConfirm({
      title: 'Cancelar treino?',
      message: 'A sessão atual será descartada e as séries deste treino não serão mantidas.',
      confirmLabel: 'Cancelar treino',
      tone: 'danger'
    });
    if (!confirmed) return;

    // Deleta a sessão diretamente do banco de dados
    setIsCancellingWorkout(true);
    try {
      const res = await authFetch(`/sessions/${activeSession.id}`, { method: 'DELETE' });

      if (res.ok) {
        setActiveSession(null);
        setCurrentLogs([]);
        stopRestTimer();
        localStorage.removeItem('@GymTracker:activeSession');
        fetchData(); // Recarrega gráficos limpos
        showToast('Treino cancelado.', 'info');
      } else {
        showToast('Não foi possível cancelar o treino.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível cancelar o treino.', 'error');
    } finally {
      setIsCancellingWorkout(false);
    }
  };

  // --- ROTINAS DE API ---
  const handleAddToPlan = async (exId: number, ficha: string) => {
    const key = `${exId}-${ficha}`;
    if (addingPlanKey) return;
    setAddingPlanKey(key);
    try {
      const res = await authFetch('/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId: exId, ficha })
      });
      if (res.ok) {
        await fetchData();
        setIsLibraryOpen(false);
        showToast(`Exercício adicionado à Ficha ${ficha}.`, 'success');
      } else {
        showToast('Não foi possível adicionar o exercício.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível adicionar o exercício.', 'error');
    } finally {
      setAddingPlanKey('');
    }
  };

  const handleRemoveFromPlan = async (id: number) => {
    const confirmed = await askConfirm({
      title: 'Remover exercício?',
      message: 'Ele sairá desta ficha, mas o histórico de treinos será preservado.',
      confirmLabel: 'Remover',
      tone: 'danger'
    });
    if (!confirmed) return;
    setMutatingPlans(prev => ({ ...prev, [id]: true }));
    try {
      const res = await authFetch(`/plans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
        showToast('Exercício removido da ficha.', 'success');
      } else {
        showToast('Não foi possível remover o exercício.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível remover o exercício.', 'error');
    } finally {
      setMutatingPlans(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleUpdateSeries = async (id: number, seriesAlvo: number) => {
    if (mutatingPlans[id]) return;
    setMutatingPlans(prev => ({ ...prev, [id]: true }));
    try {
      const res = await authFetch(`/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesAlvo })
      });
      if (res.ok) fetchData(); // Atualiza a tela automaticamente
      else showToast('Não foi possível atualizar as séries.', 'error');
    } catch (e) {
      console.error(e);
      showToast('Não foi possível atualizar as séries.', 'error');
    } finally {
      setMutatingPlans(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCreateCustomExercise = async (e: any) => {
    e.preventDefault();
    if (!novoExNome || isCreatingExercise) return;
    setIsCreatingExercise(true);
    try {
      const res = await authFetch('/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoExNome, grupoMuscular: novoExGrupo })
      });
      if (res.ok) {
        await fetchData();
        setNovoExNome('');
        showToast("Exercício criado.", 'success');
      } else {
        showToast("Não foi possível criar o exercício.", 'error');
      }
    } catch (e) {
      showToast("Não foi possível criar o exercício.", 'error');
    } finally {
      setIsCreatingExercise(false);
    }
  };

  const handleDeleteCustomExercise = async (id: number) => {
    const confirmed = await askConfirm({
      title: 'Excluir exercício?',
      message: 'A exclusão é permanente para exercícios criados por você.',
      confirmLabel: 'Excluir',
      tone: 'danger'
    });
    if (!confirmed) return;
    setDeletingExerciseId(id);
    try {
      const res = await authFetch(`/exercises/${id}/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
        showToast('Exercício excluído.', 'success');
      }
      else showToast("Você só pode excluir exercícios que você mesmo criou.", 'error');
    } catch (e) {
      showToast("Não foi possível excluir o exercício.", 'error');
    } finally {
      setDeletingExerciseId(null);
    }
  };

  const handleRegistrarPeso = async (e: any) => {
    e.preventDefault();
    if (!novoPeso || isSavingWeight) return;
    setIsSavingWeight(true);
    try {
      const res = await authFetch('/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peso: Number(novoPeso) })
      });
      if (res.ok) {
        await fetchData();
        setNovoPeso('');
        showToast('Peso registrado.', 'success');
      } else {
        showToast('Não foi possível registrar o peso.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível registrar o peso.', 'error');
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleOpenReport = async (date: string) => {
    if (reportLoadingDate) return;
    setReportLoadingDate(date);
    try {
      const res = await authFetch(`/reports/${user.id}/${date}`);
      if (res.ok) {
        const reports = await res.json();
        if (reports.length === 1) {
          setSelectedReport(reports[0]);
        } else if (reports.length > 1) {
          setDaySessions(reports);
        }
      } else {
        showToast('Não foi possível abrir o relatório.', 'error');
      }
    } catch (e) {
      showToast('Não foi possível abrir o relatório.', 'error');
    } finally {
      setReportLoadingDate('');
    }
  };

  const shareReport = async () => {
    const node = document.getElementById('report-card');
    if (!node) return;
    if (isSharingReport) return;
    setIsSharingReport(true);
    try {
      const blob = await toBlob(node, { pixelRatio: 2 });
      if (!blob) return;
      const file = new File([blob], 'treino.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'Meu Treino' });
      } else {
        showToast("Navegador não suporta compartilhamento direto.", 'error');
      }
    } catch (e) {
      showToast("Não foi possível compartilhar o relatório.", 'error');
    } finally {
      setIsSharingReport(false);
    }
  };

  // --- TELA DE LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col justify-center p-4 text-white">
        <ToastStack toasts={toasts} />
        <div className="max-w-md mx-auto w-full bg-gray-900 p-8 rounded-[1.75rem] border border-gray-800 shadow-2xl">
          <div className="flex flex-col items-center justify-center mb-8">
            <img src="/logo.png" alt="GymTracker Logo" className="w-20 h-20 mb-4 rounded-2xl shadow-lg" onError={(e) => e.currentTarget.style.display = 'none'} />
            <h1 className="text-3xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
            <p className="text-gray-400 text-sm mt-2">
              {authMode === 'forgot'
                ? 'Informe seu e-mail para recuperar o acesso.'
                : authMode === 'reset'
                  ? 'Defina uma nova senha para sua conta.'
                  : isLogin ? 'Continue seu treino de onde parou.' : 'Crie sua conta para acompanhar evolução.'}
            </p>
          </div>

          {(isCheckingServer || isServerWaking || serverStatus === 'offline') && (
            <div className={`mb-5 rounded-2xl border p-4 text-sm ${serverStatus === 'offline' ? 'border-red-500/30 bg-red-950/30 text-red-100' : 'border-blue-500/30 bg-blue-950/20 text-blue-100'}`}>
              <div className="flex items-start gap-3">
                {(isCheckingServer || isServerWaking) && <LoadingIcon size={16} />}
                <div className="flex-1">
                  <p className="font-bold">
                    {serverStatus === 'offline'
                      ? 'Servidor indisponível'
                      : isServerWaking
                        ? 'Acordando o servidor'
                        : 'Conectando ao servidor'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed opacity-80">
                    {serverStatus === 'offline'
                      ? 'O Render pode estar reiniciando. Aguarde um pouco e tente novamente.'
                      : 'No Render gratuito, a primeira resposta pode levar alguns segundos.'}
                  </p>
                </div>
                {serverStatus === 'offline' && (
                  <button onClick={() => checkServerAwake(true)} disabled={isCheckingServer} className="text-xs font-black uppercase tracking-wider disabled:opacity-50">
                    Tentar
                  </button>
                )}
              </div>
            </div>
          )}

          {authMode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input disabled={isAuthLoading} type="email" placeholder="E-mail" className="w-full bg-gray-950 p-4 rounded-xl border border-gray-700 outline-none focus:border-blue-500 transition-colors disabled:opacity-60" value={email} onChange={e => setEmail(e.target.value)} />
              <button disabled={isAuthLoading || !email} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isAuthLoading && <LoadingIcon size={17} />}
                {isAuthLoading ? 'Enviando...' : 'Enviar Link'}
              </button>
            </form>
          ) : authMode === 'reset' ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input disabled={isAuthLoading} type="password" placeholder="Nova senha" className="w-full bg-gray-950 p-4 rounded-xl border border-gray-700 outline-none focus:border-blue-500 transition-colors disabled:opacity-60" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
              <button disabled={isAuthLoading || !novaSenha} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isAuthLoading && <LoadingIcon size={17} />}
                {isAuthLoading ? 'Salvando...' : 'Redefinir Senha'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <input disabled={isAuthLoading} type="email" placeholder="E-mail" className="w-full bg-gray-950 p-4 rounded-xl border border-gray-700 outline-none focus:border-blue-500 transition-colors disabled:opacity-60" value={email} onChange={e => setEmail(e.target.value)} />
              <input disabled={isAuthLoading} type="password" placeholder="Senha" className="w-full bg-gray-950 p-4 rounded-xl border border-gray-700 outline-none focus:border-blue-500 transition-colors disabled:opacity-60" value={senha} onChange={e => setSenha(e.target.value)} />
              <button disabled={isAuthLoading} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isAuthLoading && <LoadingIcon size={17} />}
                {isAuthLoading ? (isServerWaking ? 'Acordando servidor...' : isLogin ? 'Entrando...' : 'Cadastrando...') : (isLogin ? 'Entrar' : 'Cadastrar')}
              </button>
            </form>
          )}
          {authMode === 'auth' && (
            <div className="mt-6 space-y-3 text-center">
              {isLogin && (
                <button disabled={isAuthLoading} onClick={() => setAuthMode('forgot')} className="w-full text-gray-400 text-sm hover:text-white transition-colors disabled:opacity-50">Esqueci minha senha</button>
              )}
              <button disabled={isAuthLoading} onClick={() => setIsLogin(!isLogin)} className="w-full text-gray-400 text-sm hover:text-white transition-colors disabled:opacity-50">{isLogin ? 'Criar nova conta' : 'Já tenho conta'}</button>
            </div>
          )}
          {authMode !== 'auth' && (
            <button disabled={isAuthLoading} onClick={() => { setAuthMode('auth'); setResetToken(''); }} className="w-full mt-6 text-gray-400 text-sm hover:text-white transition-colors disabled:opacity-50">Voltar para login</button>
          )}
        </div>
      </div>
    );
  }

  const exerciciosAtuais = myPlans.filter(p => p.ficha === fichaAtiva).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const customExercises = library.filter(ex => ex.userId === user.id);
  const totalSeriesPlanejadas = exerciciosAtuais.reduce((acc, plan) => acc + (plan.seriesAlvo || 3), 0);
  const totalSeriesFeitas = currentLogs.length;
  const navItems = [
    { id: 'treinar', label: 'Treinar', Icon: BicepsFlexed },
    { id: 'fichas', label: 'Fichas', Icon: ClipboardList },
    { id: 'evolucao', label: 'Evolução', Icon: ChartLine },
    { id: 'perfil', label: 'Perfil', Icon: UserRound }
  ] as const;
  const volumeChartData = volumeHistory.map((v: any) => ({ ...v, d: new Date(v.data).getDate() }));
  const weightChartData = weightHistory.map((w: any) => ({ ...w, d: new Date(w.data).getDate() }));
  const totalVolume = volumeHistory.reduce((acc: number, item: any) => acc + Number(item.volume || 0), 0);
  const bestVolume = volumeHistory.reduce((best: number, item: any) => Math.max(best, Number(item.volume || 0)), 0);
  const lastVolume = Number(volumeHistory[volumeHistory.length - 1]?.volume || 0);
  const previousVolume = Number(volumeHistory[volumeHistory.length - 2]?.volume || 0);
  const volumeTrend = previousVolume ? Math.round(((lastVolume - previousVolume) / previousVolume) * 100) : 0;
  const sortedFrequencyDates = [...frequency]
    .map(date => new Date(date))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  const lastWorkoutDate = sortedFrequencyDates[0];
  const lastWorkoutLabel = lastWorkoutDate
    ? lastWorkoutDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : '--';
  const frequencySet = new Set(sortedFrequencyDates.map(date => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }));
  let currentStreak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!frequencySet.has(key)) break;
    currentStreak += 1;
  }
  const firstWeight = Number(weightHistory[0]?.peso || 0);
  const latestWeight = Number(weightHistory[weightHistory.length - 1]?.peso || 0);
  const weightDelta = firstWeight && latestWeight ? Number((latestWeight - firstWeight).toFixed(1)) : 0;
  const topStrengthMarks = [...lastLogs]
    .sort((a: any, b: any) => Number(b.carga || 0) - Number(a.carga || 0))
    .slice(0, 3)
    .map((log: any) => ({
      ...log,
      exerciseName: library.find(ex => ex.id === log.exerciseId)?.nome || 'Exercício'
    }));
  const hasEvolutionData = volumeHistory.length > 0 || weightHistory.length > 0 || frequency.length > 0 || lastLogs.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-28 font-sans">
      <ToastStack toasts={toasts} />
      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
      <header className="sticky top-0 z-30 border-b border-gray-900/80 bg-gray-950/90 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-md" onError={(e) => e.currentTarget.style.display = 'none'} />
          <h1 className="text-xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="max-w-[130px] truncate text-right text-xs font-bold text-gray-400">Olá, {getUserDisplayName(user)}</span>
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-gray-900 text-[10px] font-black text-gray-400">
            {user.foto ? <img src={user.foto} alt="" className="h-full w-full object-cover" /> : getUserInitials(user)}
          </div>
        </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-6">
        {dataError && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-100">
            <div className="flex items-start justify-between gap-3">
              <p>{dataError}</p>
              <button onClick={() => { checkServerAwake(); fetchData(); }} disabled={isLoadingData || isCheckingServer} className="shrink-0 text-xs font-black uppercase tracking-wider text-red-200 disabled:opacity-50">
                {isLoadingData ? 'Atualizando' : 'Tentar'}
              </button>
            </div>
          </div>
        )}
        {(isLoadingData || isServerWaking) && !dataError && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-gray-900/70 p-3 text-xs font-bold uppercase tracking-widest text-gray-400">
            <LoadingIcon size={14} />
            {isServerWaking ? 'Acordando servidor do Render' : 'Atualizando dados'}
          </div>
        )}

        {/* ABA TREINAR */}
        {activeTab === 'treinar' && (
          <div className="space-y-6 animate-in slide-in-from-bottom">

            {!activeSession ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Treino</p>
                  <h2 className="mt-1 text-2xl font-black">Qual o alvo de hoje?</h2>
                  <p className="mt-1 text-sm text-gray-500">{exerciciosAtuais.length} exercícios programados na Ficha {fichaAtiva}</p>
                </div>

                <div className="flex gap-2 bg-gray-900 p-1 rounded-xl border border-gray-800">
                  {['A', 'B', 'C'].map(f => (
                    <button key={f} onClick={() => setFichaAtiva(f)} className={`flex-1 py-3 rounded-lg font-bold transition-colors ${fichaAtiva === f ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Ficha {f}</button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Exercícios</p>
                    <p className="mt-1 text-2xl font-black">{exerciciosAtuais.length}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Séries alvo</p>
                    <p className="mt-1 text-2xl font-black">{totalSeriesPlanejadas}</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                  {exerciciosAtuais.length > 0 ? exerciciosAtuais.map(p => (
                    <div key={p.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 relative overflow-hidden transition-all flex justify-between items-center">
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
                            disabled={!!mutatingPlans[p.id]}
                            className="w-12 bg-gray-900 text-center text-sm font-bold py-1 rounded-lg border border-gray-700 outline-none text-white focus:border-blue-500 transition-colors"
                            value={p.seriesAlvo || 3}
                            onChange={(e) => handleUpdateSeries(p.id, Number(e.target.value))}
                          />
                        </div>
                        <button disabled={!!mutatingPlans[p.id]} onClick={() => handleRemoveFromPlan(p.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Remover exercício">
                          {mutatingPlans[p.id] ? <LoadingIcon size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>

                    </div>
                  )) : (
                    <div className="text-center py-8 border border-dashed border-gray-700 rounded-2xl bg-gray-900/40">
                      <p className="text-gray-500 text-sm">Ficha {fichaAtiva} vazia.</p>
                      <button onClick={() => setActiveTab('fichas')} className="text-blue-500 text-xs font-bold mt-2 uppercase">Ir para Fichas</button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartWorkout}
                  disabled={exerciciosAtuais.length === 0 || isStartingWorkout || isLoadingData}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                >
                  {isStartingWorkout ? <LoadingIcon size={18} /> : <BicepsFlexed size={18} />}
                  {isStartingWorkout ? 'INICIANDO...' : 'INICIAR TREINO'}
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
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-900">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(100, totalSeriesPlanejadas ? (totalSeriesFeitas / totalSeriesPlanejadas) * 100 : 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">{totalSeriesFeitas} de {totalSeriesPlanejadas} séries planejadas</p>

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
                                <button disabled={!!log.id && !!deletingSeries[String(log.id)]} onClick={() => log.id && handleDeleteSerie(log.id)} className="text-red-500 hover:text-red-400 font-bold p-1 text-xs opacity-70 hover:opacity-100 transition-opacity disabled:cursor-not-allowed" aria-label="Excluir série">
                                  {log.id && deletingSeries[String(log.id)] ? <LoadingIcon size={14} /> : <Trash2 size={14} />}
                                </button>
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
                            disabled={!cargas[p.exercise.id] || !repsSet[p.exercise.id] || !!addingSeries[p.exercise.id]}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed py-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                          >
                            {addingSeries[p.exercise.id] ? <LoadingIcon size={15} /> : <Plus size={15} />}
                            {addingSeries[p.exercise.id] ? 'SALVANDO...' : 'SÉRIE'}
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
                  <button disabled={isEndingWorkout || isCancellingWorkout} onClick={handleEndWorkout} className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isEndingWorkout ? <LoadingIcon size={18} /> : <CheckCircle2 size={18} />}
                    {isEndingWorkout ? 'FINALIZANDO...' : 'FINALIZAR TREINO'}
                  </button>
                  <button disabled={isEndingWorkout || isCancellingWorkout} onClick={handleCancelWorkout} className="w-full py-4 rounded-2xl font-bold text-red-500/80 uppercase tracking-widest hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/30 text-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isCancellingWorkout ? <LoadingIcon size={15} /> : <X size={15} />}
                    {isCancellingWorkout ? 'Cancelando...' : 'Cancelar Treino'}
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
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Biblioteca</p>
                  <h2 className="text-2xl font-black">Configurar Fichas</h2>
                </div>
                <button onClick={() => setIsLibraryOpen(true)} className="bg-blue-600 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 flex items-center gap-2">
                  <Plus size={15} />
                  Adicionar
                </button>
              </div>

              <div className="flex gap-2 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800">
                {['A', 'B', 'C'].map(f => (
                  <button key={f} onClick={() => setFichaAtiva(f)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${fichaAtiva === f ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Ficha {f}</button>
                ))}
              </div>

              <div className="space-y-3">
                {exerciciosAtuais.length > 0 ? exerciciosAtuais.map(p => (
                  <div key={p.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-lg relative overflow-hidden transition-all">
                    <div className="flex w-full items-center justify-between gap-4">
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
                            disabled={!!mutatingPlans[p.id]}
                            className="w-12 bg-gray-900 text-center text-sm font-bold py-1 rounded-lg border border-gray-700 outline-none text-white focus:border-blue-500 transition-colors"
                            value={p.seriesAlvo || 3}
                            onChange={(e) => handleUpdateSeries(p.id, Number(e.target.value))}
                          />
                        </div>
                        <button disabled={!!mutatingPlans[p.id]} onClick={() => handleRemoveFromPlan(p.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Remover exercício">
                          {mutatingPlans[p.id] ? <LoadingIcon size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                    <p className="text-gray-500">Nenhum exercício na Ficha {fichaAtiva}.</p>
                    <button onClick={() => setIsLibraryOpen(true)} className="mt-3 text-xs font-black uppercase tracking-wider text-blue-400 inline-flex items-center gap-2">
                      <Plus size={14} />
                      Adicionar exercício
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* ABA EVOLUÇÃO */}
        {activeTab === 'evolucao' && (
          <div className="space-y-6 animate-in slide-in-from-bottom">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Progresso</p>
              <h2 className="mt-1 text-2xl font-black">Evolução</h2>
              <p className="mt-1 text-sm text-gray-500">Seu panorama recente de consistência, volume e marcas.</p>
            </div>

            {!hasEvolutionData && (
              <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
                <Trophy className="mx-auto mb-3 text-gray-500" size={28} />
                <p className="font-black text-white">Finalize seu primeiro treino</p>
                <p className="mt-2 text-sm text-gray-500">Assim que houver histórico, esta tela mostra volume, frequência e melhores marcas.</p>
                <button onClick={() => setActiveTab('treinar')} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white">
                  Ir para treino
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">
                  <CalendarCheck size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Treinos 30d</p>
                <p className="mt-1 text-2xl font-black">{frequency.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-green-600/15 text-green-400">
                  <Flame size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Sequência</p>
                <p className="mt-1 text-2xl font-black">{currentStreak} <span className="text-sm text-gray-500">dias</span></p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600/15 text-cyan-300">
                  <TrendingUp size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Volume total</p>
                <p className="mt-1 text-2xl font-black">{Math.round(totalVolume).toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/15 text-violet-300">
                  <Trophy size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Último treino</p>
                <p className="mt-1 text-2xl font-black">{lastWorkoutLabel}</p>
              </div>
            </div>

            {(lastVolume > 0 || weightDelta !== 0 || bestVolume > 0) && (
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Insights rápidos</h3>
                <div className="mt-4 space-y-3">
                  {lastVolume > 0 && (
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-950 p-3">
                      <span className="text-sm text-gray-300">Último volume registrado</span>
                      <span className="font-black text-white">{Math.round(lastVolume).toLocaleString('pt-BR')} kg</span>
                    </div>
                  )}
                  {previousVolume > 0 && (
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-950 p-3">
                      <span className="text-sm text-gray-300">Variação vs. treino anterior</span>
                      <span className={`font-black ${volumeTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {volumeTrend >= 0 ? '+' : ''}{volumeTrend}%
                      </span>
                    </div>
                  )}
                  {weightHistory.length > 1 && (
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-950 p-3">
                      <span className="text-sm text-gray-300">Mudança de peso</span>
                      <span className={`font-black ${weightDelta <= 0 ? 'text-green-400' : 'text-blue-400'}`}>
                        {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg h-64 flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Volume Total de Carga (kg)</h3>
              {volumeChartData.length > 0 ? (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeChartData}>
                      <XAxis dataKey="d" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                      <Bar dataKey="volume" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-700 text-center text-sm text-gray-500">
                  Finalize treinos para ver seu volume.
                </div>
              )}
            </div>

            {topStrengthMarks.length > 0 && (
              <div className="rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Melhores cargas recentes</h3>
                  <Trophy size={18} className="text-yellow-400" />
                </div>
                <div className="space-y-3">
                  {topStrengthMarks.map((mark: any, idx: number) => (
                    <div key={`${mark.exerciseId}-${idx}`} className="flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-900 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/15 text-xs font-black text-blue-400">{idx + 1}</span>
                        <div>
                          <p className="text-sm font-black text-white">{mark.exerciseName}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{mark.repsFeitas} reps</p>
                        </div>
                      </div>
                      <p className="text-lg font-black text-white">{mark.carga}<span className="text-xs text-gray-500"> kg</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg h-80 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Peso Corporal</h3>
                <form onSubmit={handleRegistrarPeso} className="flex gap-2">
                  <input disabled={isSavingWeight} type="number" step="0.1" placeholder="Ex: 85.5" className="w-24 bg-gray-900 p-2 rounded-lg border border-gray-700 outline-none text-sm text-center disabled:opacity-60" value={novoPeso} onChange={e => setNovoPeso(e.target.value)} />
                  <button disabled={isSavingWeight || !novoPeso} className="bg-blue-600 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSavingWeight ? <LoadingIcon size={14} /> : '+'}
                  </button>
                </form>
              </div>
              {weightChartData.length > 0 ? (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData}>
                      <XAxis dataKey="d" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                      <Line type="monotone" dataKey="peso" stroke="#10B981" strokeWidth={4} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#1F2937' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-700 text-center text-sm text-gray-500">
                  Registre seu peso para acompanhar a curva.
                </div>
              )}
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
                      disabled={!!reportLoadingDate}
                      onClick={() => treinou && handleOpenReport(iso)}
                      className={`w-[11%] aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all disabled:cursor-wait ${treinou ? 'bg-green-500 text-white shadow-lg shadow-green-500/40' : 'bg-gray-900 border border-gray-700 text-gray-600'}`}
                    >
                      {reportLoadingDate === iso ? <LoadingIcon size={12} /> : dia}
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
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? <LoadingIcon size={16} /> : <Save size={16} />}
                  {isSavingProfile ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </form>

              {/* FORMULÁRIO DE TROCA DE SENHA */}
              <form onSubmit={handleMudarSenha} className="mb-8 space-y-3 bg-gray-900 p-4 rounded-2xl border border-gray-700 text-left">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Segurança</p>
                <input
                  type="password"
                  placeholder="Senha atual"
                  className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 outline-none text-sm focus:border-blue-500 transition-colors"
                  value={senhaAtual}
                  onChange={e => setSenhaAtual(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Digitar nova senha"
                  className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 outline-none text-sm focus:border-blue-500 transition-colors"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                />
                <button
                  disabled={!senhaAtual || !novaSenha || isChangingPassword}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? <LoadingIcon size={16} /> : <KeyRound size={16} />}
                  {isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </form>

              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full bg-gray-900 border border-red-500/30 text-red-500 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
                <LogOut size={16} />
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
              <button onClick={() => setIsLibraryOpen(false)} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors" aria-label="Fechar biblioteca">
                <X size={22} />
              </button>
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
                              <button disabled={!!addingPlanKey} key={f} onClick={() => handleAddToPlan(ex.id, f)} className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                {addingPlanKey === `${ex.id}-${f}` ? <LoadingIcon size={12} /> : `+${f}`}
                              </button>
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
                      <input disabled={isCreatingExercise} type="text" placeholder="Nome (Ex: Supino Declinado)" className="w-full bg-gray-900 p-4 rounded-xl border border-gray-700 outline-none disabled:opacity-60" value={novoExNome} onChange={e => setNovoExNome(e.target.value)} required />
                      <select disabled={isCreatingExercise} className="w-full bg-gray-900 p-4 rounded-xl border border-gray-700 outline-none disabled:opacity-60" value={novoExGrupo} onChange={e => setNovoExGrupo(e.target.value)}>
                        {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <button disabled={isCreatingExercise} className="w-full bg-green-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                        {isCreatingExercise ? <LoadingIcon size={16} /> : <Save size={16} />}
                        {isCreatingExercise ? 'SALVANDO...' : 'SALVAR'}
                      </button>
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
                                <button disabled={!!addingPlanKey || deletingExerciseId === ex.id} key={f} onClick={() => handleAddToPlan(ex.id, f)} className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-[10px] font-black hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                  {addingPlanKey === `${ex.id}-${f}` ? <LoadingIcon size={12} /> : `+${f}`}
                                </button>
                              ))}
                              <div className="w-px h-6 bg-gray-700 mx-1"></div>
                              <button disabled={deletingExerciseId === ex.id} onClick={() => handleDeleteCustomExercise(ex.id)} className="text-red-500 hover:text-red-400 p-1 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Excluir exercício">
                                {deletingExerciseId === ex.id ? <LoadingIcon size={15} /> : <Trash2 size={15} />}
                              </button>
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
          isSharing={isSharingReport}
          onClose={() => setSelectedReport(null)}
          onShare={shareReport}
          onDelete={async () => {
            const confirmed = await askConfirm({
              title: 'Excluir treino?',
              message: 'Este registro e suas séries serão removidos do histórico.',
              confirmLabel: 'Excluir',
              tone: 'danger'
            });
            if (confirmed) {
              await authFetch(`/sessions/${selectedReport.id}`, { method: 'DELETE' });
              setSelectedReport(null);
              fetchData();
              showToast('Treino excluído.', 'success');
            }
          }}
        />
      )
      }

      {/* NAVEGAÇÃO BOTTOM */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-gray-800 bg-gray-950/95 px-3 pb-4 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="grid grid-cols-4 gap-2">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-[11px] font-black transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}`}
              >
                <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full ${isActive ? 'bg-white/15' : 'bg-gray-900'}`}>
                  <Icon size={15} strokeWidth={2.4} />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div >
  );
}
