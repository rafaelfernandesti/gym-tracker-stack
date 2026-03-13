import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MEU_USER_ID = "c0476249-0dfe-42f7-8c5f-9d6a09e8e4e2"; 
const API_URL = "https://gym-tracker-api-yomc.onrender.com"; 

function App() {
  const [activeTab, setActiveTab] = useState<'treinar' | 'historico' | 'exercicios'>('treinar');
  const [exerciseId, setExerciseId] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);
  
  const [carga, setCarga] = useState('');
  const [reps, setReps] = useState('');
  const [status, setStatus] = useState('');
  const [evolutionData, setEvolutionData] = useState<any[]>([]);

  const [novoNome, setNovoNome] = useState('');
  const [novoGrupo, setNovoGrupo] = useState('Peito');
  const [statusExercicio, setStatusExercicio] = useState('');

  const fetchExercises = async () => {
    try {
      const response = await fetch(`${API_URL}/exercises`);
      if (response.ok) {
        const data = await response.json();
        setExercises(data);
        if (data.length > 0 && !exerciseId) setExerciseId(data[0].id.toString());
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
          // Calcula o volume multiplicando a carga pelas repetições
          volume: log.carga * log.repsFeitas 
        }));
        setEvolutionData(formattedData);
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchExercises(); }, []);
  useEffect(() => { fetchEvolution(); }, [exerciseId]);

  const handleRegistrarTreino = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (error) { setStatus('Erro de conexão.'); }
  };

  const handleCriarExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusExercicio('Salvando...');
    try {
      const response = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome, grupoMuscular: novoGrupo }),
      });

      if (response.ok) {
        setStatusExercicio('Exercício adicionado com sucesso! 🏋️‍♂️');
        setNovoNome('');
        fetchExercises(); 
        setTimeout(() => setStatusExercicio(''), 3000);
      }
    } catch (error) { setStatusExercicio('Erro ao salvar.'); }
  };

  // Cálculos para os Cards de Estatísticas
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
        <button onClick={() => setActiveTab('exercicios')} className={`flex-1 py-2 rounded-md transition-all ${activeTab === 'exercicios' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'}`}>Novo Ex.</button>
      </div>

      <main className="max-w-md mx-auto">
        {activeTab === 'treinar' && (
          <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 animate-in fade-in">
            <form onSubmit={handleRegistrarTreino} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Exercício</label>
                <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  {exercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.nome}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Carga (kg)</label>
                  <input type="number" step="0.5" required value={carga} onChange={(e) => setCarga(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Reps</label>
                  <input type="number" required value={reps} onChange={(e) => setReps(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all">REGISTRAR SÉRIE</button>
            </form>
            {status && <div className="mt-4 text-center text-green-400 font-medium">{status}</div>}
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="animate-in fade-in">
            {/* Cards de Estatísticas */}
            <div className="flex gap-4 mb-4">
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
                 <h3 className="text-gray-300 text-sm uppercase font-bold">Progressão de Carga</h3>
                 <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="bg-gray-900 text-xs border border-gray-700 rounded-lg p-2 text-white outline-none">
                    {exercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.nome}</option>
                    ))}
                 </select>
              </div>
              
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="dataFormatada" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} width={30} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(value: any, name: any) => [value + ' kg', name === 'carga' ? 'Carga' : name]}
                    labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                  />
                  <Line type="monotone" dataKey="carga" stroke="#3B82F6" strokeWidth={4} dot={{ r: 5, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'exercicios' && (
          <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 animate-in fade-in">
             <h3 className="text-gray-400 text-sm mb-4 uppercase font-bold">Cadastrar Novo Exercício</h3>
             <form onSubmit={handleCriarExercicio} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Nome</label>
                <input type="text" required value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Leg Press 45" className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Grupo Muscular</label>
                <select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Peito">Peito</option>
                  <option value="Costas">Costas</option>
                  <option value="Pernas">Pernas</option>
                  <option value="Ombros">Ombros</option>
                  <option value="Braços">Braços</option>
                  <option value="Core">Core</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl transition-all">CADASTRAR</button>
            </form>
            {statusExercicio && <div className="mt-4 text-center text-green-400 font-medium">{statusExercicio}</div>}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;