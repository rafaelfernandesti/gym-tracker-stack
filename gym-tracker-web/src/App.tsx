import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MEU_USER_ID = "c0476249-0dfe-42f7-8c5f-9d6a09e8e4e2"; 
const API_URL = "https://gym-tracker-api-yomc.onrender.com"; 

function App() {
  const [activeTab, setActiveTab] = useState<'treinar' | 'historico' | 'exercicios'>('treinar');
  const [exerciseId, setExerciseId] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);
  
  const [fichaAtiva, setFichaAtiva] = useState('A');
  const exerciciosFiltrados = exercises.filter(ex => (ex.ficha || 'A') === fichaAtiva);

  const [carga, setCarga] = useState('');
  const [reps, setReps] = useState('');
  const [status, setStatus] = useState('');
  const [evolutionData, setEvolutionData] = useState<any[]>([]);

  // Estados do Gerenciamento de Exercícios
  const [novoNome, setNovoNome] = useState('');
  const [novoGrupo, setNovoGrupo] = useState('Peito');
  const [novaFicha, setNovaFicha] = useState('A'); 
  const [statusExercicio, setStatusExercicio] = useState('');
  const [editingExId, setEditingExId] = useState<number | null>(null);

  // Estados do Cronômetro
  const [tempoDescanso, setTempoDescanso] = useState(90); // Padrão de 90s
  const [timerAtivo, setTimerAtivo] = useState(false);

  // Efeito do Cronômetro
  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval>;
    if (timerAtivo && tempoDescanso > 0) {
      intervalo = setInterval(() => {
        setTempoDescanso((t) => t - 1);
      }, 1000);
    } else if (tempoDescanso === 0 && timerAtivo) {
      setTimerAtivo(false);
      // Aqui você poderia colocar um aviso sonoro no futuro
    }
    return () => clearInterval(intervalo);
  }, [timerAtivo, tempoDescanso]);

  const formatarTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = (segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fetchExercises = async () => {
    try {
      const response = await fetch(`${API_URL}/exercises`);
      if (response.ok) {
        const data = await response.json();
        setExercises(data);
      }
    } catch (e) { console.error("Erro ao carregar exercícios", e); }
  };

  const fetchEvolution = async () => {
    if (!exerciseId) return;
    try {
      const response = await fetch(`${API_URL}/logs/evolution/${MEU_USER_ID}/${exerciseId}`);
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map((log: any) => ({
          ...log,
          dataFormatada: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(log.data)),
          volume: log.carga * log.repsFeitas 
        }));
        setEvolutionData(formattedData);
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchExercises(); }, []);
  
  useEffect(() => { 
    if (exerciciosFiltrados.length > 0) {
      setExerciseId(exerciciosFiltrados[0].id.toString());
    } else {
      setExerciseId('');
      setEvolutionData([]);
    }
  }, [fichaAtiva, exercises]);

  useEffect(() => { fetchEvolution(); }, [exerciseId]);

  const handleRegistrarTreino = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseId) return;
    setStatus('Salvando...');
    try {
      const response = await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: MEU_USER_ID,
          exerciseId: Number(exerciseId),
          carga: Number(carga),
          repsFeitas: Number(reps),
        }),
      });

      if (response.ok) {
        setStatus('Série registrada! 💪');
        setCarga(''); setReps('');
        fetchEvolution();
        
        // Dispara o cronômetro automaticamente
        setTempoDescanso(90);
        setTimerAtivo(true);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        setTimeout(() => setStatus(''), 3000);
      }
    } catch (error) { setStatus('Erro de conexão.'); }
  };

  const handleExcluirTreino = async (logId: string) => {
    if (!confirm('Tem certeza que deseja apagar este registro?')) return;
    try {
      const response = await fetch(`${API_URL}/logs/${logId}`, { method: 'DELETE' });
      if (response.ok) fetchEvolution();
      else alert('Erro ao excluir o treino.');
    } catch (error) { alert('Erro de conexão ao tentar excluir.'); }
  };

  const handleCriarExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusExercicio('Salvando...');
    try {
      const response = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome, grupoMuscular: novoGrupo, ficha: novaFicha }),
      });

      if (response.ok) {
        setStatusExercicio('Exercício adicionado! 🏋️‍♂️');
        limparFormularioExercicio();
        fetchExercises(); 
        setTimeout(() => setStatusExercicio(''), 3000);
      }
    } catch (error) { setStatusExercicio('Erro ao salvar.'); }
  };

  const handleAtualizarExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusExercicio('Atualizando...');
    try {
      const response = await fetch(`${API_URL}/exercises/${editingExId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome, grupoMuscular: novoGrupo, ficha: novaFicha }),
      });

      if (response.ok) {
        setStatusExercicio('Exercício atualizado! ✅');
        limparFormularioExercicio();
        fetchExercises(); 
        setTimeout(() => setStatusExercicio(''), 3000);
      }
    } catch (error) { setStatusExercicio('Erro ao atualizar.'); }
  };

  const handleExcluirExercicio = async (exId: number, nome: string) => {
    if (!confirm(`CUIDADO! Isso vai apagar o exercício "${nome}" e TODO o histórico de treino dele. Tem certeza absoluta?`)) return;
    try {
      const response = await fetch(`${API_URL}/exercises/${exId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchExercises();
        if (exerciseId === exId.toString()) setExerciseId(''); 
      } else { alert('Erro ao excluir o exercício.'); }
    } catch (error) { alert('Erro de conexão ao tentar excluir.'); }
  };

  const iniciarEdicao = (ex: any) => {
    setEditingExId(ex.id);
    setNovoNome(ex.nome);
    setNovoGrupo(ex.grupoMuscular || 'Peito');
    setNovaFicha(ex.ficha || 'A');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormularioExercicio = () => {
    setEditingExId(null);
    setNovoNome('');
    setNovoGrupo('Peito');
    setNovaFicha('A');
  };

  const cargaMaxima = evolutionData.length > 0 ? Math.max(...evolutionData.map(d => d.carga)) : 0;
  const volumeMaximo = evolutionData.length > 0 ? Math.max(...evolutionData.map(d => d.volume)) : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans pb-10">
      <header className="max-w-md mx-auto mb-8 mt-4 text-center">
        <h1 className="text-3xl font-black text-blue-500 tracking-tight">GYM<span className="text-white">TRACKER</span></h1>
      </header>

      <div className="max-w-md mx-auto flex bg-gray-800 rounded-lg p-1 mb-6 text-sm font-medium">
        <button onClick={() => setActiveTab('treinar')} className={`flex-1 py-2 rounded-md transition-all ${activeTab === 'treinar' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Treinar</button>
        <button onClick={() => setActiveTab('historico')} className={`flex-1 py-2 rounded-md transition-all ${activeTab === 'historico' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Evolução</button>
        <button onClick={() => setActiveTab('exercicios')} className={`flex-1 py-2 rounded-md transition-all ${activeTab === 'exercicios' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Gerenciar Ex.</button>
      </div>

      <main className="max-w-md mx-auto">
        {activeTab === 'treinar' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
              <div className="flex gap-2 mb-6">
                {['A', 'B', 'C'].map(ficha => (
                  <button key={ficha} onClick={() => setFichaAtiva(ficha)} className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${fichaAtiva === ficha ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>Ficha {ficha}</button>
                ))}
              </div>

              <form onSubmit={handleRegistrarTreino} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Exercício</label>
                  {exerciciosFiltrados.length > 0 ? (
                    <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      {exerciciosFiltrados.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-500 text-sm text-center">Nenhum exercício cadastrado nesta ficha.</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Carga (kg)</label>
                    <input type="number" step="0.5" required disabled={!exerciseId} value={carga} onChange={(e) => setCarga(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Reps</label>
                    <input type="number" required disabled={!exerciseId} value={reps} onChange={(e) => setReps(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                  </div>
                </div>
                <button type="submit" disabled={!exerciseId} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50">REGISTRAR SÉRIE</button>
              </form>
              {status && <div className="mt-4 text-center text-green-400 font-medium">{status}</div>}
            </div>

            {/* Painel do Cronômetro */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 text-center">
              <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">Tempo de Descanso</h3>
              <div className={`text-5xl font-black mb-6 ${timerAtivo ? 'text-blue-400' : 'text-gray-300'}`}>
                {formatarTempo(tempoDescanso)}
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => setTempoDescanso(t => Math.max(0, t - 15))} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">-15s</button>
                <button 
                  onClick={() => setTimerAtivo(!timerAtivo)} 
                  className={`${timerAtivo ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white font-bold py-2 px-6 rounded-lg w-32`}
                >
                  {timerAtivo ? 'PAUSAR' : 'INICIAR'}
                </button>
                <button onClick={() => { setTimerAtivo(false); setTempoDescanso(90); }} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">ZERAR</button>
                <button onClick={() => setTempoDescanso(t => t + 15)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">+15s</button>
              </div>
            </div>

          </div>
        )}

        {/* ... (O resto das abas histórico e exercícios permanecem inalteradas) ... */}
        {activeTab === 'historico' && (
          <div className="animate-in fade-in space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center shadow-lg">
                <p className="text-gray-500 text-xs font-bold uppercase mb-1">Carga Máxima</p>
                <p className="text-2xl font-black text-blue-400">{cargaMaxima} <span className="text-sm font-medium text-gray-500">kg</span></p>
              </div>
              <div className="flex-1 bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center shadow-lg">
                <p className="text-gray-500 text-xs font-bold uppercase mb-1">Volume Máx.</p>
                <p className="text-2xl font-black text-green-400">{volumeMaximo} <span className="text-sm font-medium text-gray-500">kg</span></p>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 h-80">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-gray-300 text-sm uppercase font-bold">Progressão</h3>
                 <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="bg-gray-900 text-xs border border-gray-700 rounded-lg p-2 text-white outline-none max-w-[150px]">
                    {exercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.nome} ({ex.ficha || 'A'})</option>
                    ))}
                 </select>
              </div>
              
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="dataFormatada" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} width={30} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} formatter={(value: any, name: any) => [value + ' kg', name === 'carga' ? 'Carga' : name]} labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }} />
                  <Line type="monotone" dataKey="carga" stroke="#3B82F6" strokeWidth={4} dot={{ r: 5, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {evolutionData.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
                <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Registros Recentes</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {[...evolutionData].reverse().map((log) => (
                    <div key={log.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700">
                      <div>
                        <p className="text-sm font-bold text-white">{log.carga} kg <span className="text-gray-400 font-normal">x {log.repsFeitas} reps</span></p>
                        <p className="text-xs text-gray-500">{log.dataFormatada}</p>
                      </div>
                      <button onClick={() => handleExcluirTreino(log.id)} className="text-red-400 hover:text-red-300 p-2 text-sm font-bold">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercicios' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
              <h3 className="text-gray-400 text-sm mb-4 uppercase font-bold">
                {editingExId ? 'Editar Exercício' : 'Cadastrar Novo Exercício'}
              </h3>
              <form onSubmit={editingExId ? handleAtualizarExercicio : handleCriarExercicio} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Nome</label>
                  <input type="text" required value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Leg Press 45" className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Ficha</label>
                    <select value={novaFicha} onChange={(e) => setNovaFicha(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Grupo</label>
                    <select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Peito">Peito</option><option value="Costas">Costas</option><option value="Pernas">Pernas</option><option value="Ombros">Ombros</option><option value="Braços">Braços</option><option value="Core">Core</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all">
                    {editingExId ? 'SALVAR' : 'CADASTRAR'}
                  </button>
                  {editingExId && (
                    <button type="button" onClick={limparFormularioExercicio} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all">
                      CANCELAR
                    </button>
                  )}
                </div>
              </form>
              {statusExercicio && <div className="mt-4 text-center text-green-400 font-medium">{statusExercicio}</div>}
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
              <h3 className="text-gray-300 text-sm uppercase font-bold mb-4">Meus Exercícios</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {exercises.map((ex) => (
                  <div key={ex.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700">
                    <div>
                      <p className="text-sm font-bold text-white">{ex.nome}</p>
                      <p className="text-xs text-gray-500">Ficha {ex.ficha || 'A'} • {ex.grupoMuscular}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => iniciarEdicao(ex)} className="text-blue-400 hover:text-blue-300 p-2 text-xs font-bold uppercase tracking-wider">Editar</button>
                      <button onClick={() => handleExcluirExercicio(ex.id, ex.nome)} className="text-red-400 hover:text-red-300 p-2 text-xs font-bold uppercase tracking-wider">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;