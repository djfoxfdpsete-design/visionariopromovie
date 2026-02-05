
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ImageTask,
  AspectRatio,
  GenerationStep
} from './types';
import { GeminiService } from './services/geminiService';
import { videoService } from './services/videoService';

const MAX_IMAGES = 50;

const App: React.FC = () => {
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkAuth = async () => {
    // Verificacao simplificada para ambiente local
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_api_key_here') {
      setAuthorized(true);
      return true;
    }
    return false;
  };

  const handleOpenKeySelector = async () => {
    // Simples alerta para configurar .env no ambiente local
    alert('Por favor, configure VITE_GEMINI_API_KEY no arquivo .env');
    setStep(GenerationStep.IDLE);
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files) as File[];
    const availableCapacity = MAX_IMAGES - tasks.length;
    const filesToProcess = newFiles.slice(0, availableCapacity);

    const newTasks: ImageTask[] = filesToProcess.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0
    }));

    setTasks(prev => [...prev, ...newTasks]);
  };

  const removeTask = (id: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task?.previewUrl) URL.revokeObjectURL(task.previewUrl);
      if (task?.videoUrl) URL.revokeObjectURL(task.videoUrl);
      return prev.filter(t => t.id !== id);
    });
  };

  const startGeneration = async () => {
    const isAuthed = await checkAuth();
    if (!isAuthed) {
      setStep(GenerationStep.AUTH);
      return;
    }

    setStep(GenerationStep.PROCESSING);
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    const pendingTasks = tasks.filter(t => t.status === 'pending');

    for (const task of pendingTasks) {
      if (abortControllerRef.current.signal.aborted) break;

      updateTask(task.id, { status: 'processing', progress: 10 });

      try {
        const videoUrl = await GeminiService.generateVideo(
          task.file,
          aspectRatio,
          undefined,
          abortControllerRef.current.signal
        );

        // Salvar no Supabase
        try {
          await videoService.saveVideo({
            prompt: 'Professional cinematic conversion...', // Deveria ser dinâmico se possível
            video_url: videoUrl
          });
        } catch (err) {
          console.error("Falha ao salvar no banco", err);
          // Não falha a task se apenas o salvamento falhar
        }

        updateTask(task.id, {
          status: 'completed',
          videoUrl,
          progress: 100
        });
      } catch (error: any) {
        if (error.message === 'ABORTED') {
          updateTask(task.id, { status: 'pending', progress: 0 });
          break;
        }
        if (error.message === 'REAUTH_NEEDED') {
          setAuthorized(false);
          setStep(GenerationStep.AUTH);
          break;
        }
        console.error("Task failed:", error);
        updateTask(task.id, {
          status: 'failed',
          error: error.message || "Falha ao gerar vídeo."
        });
      }
    }

    setIsProcessing(false);
    if (!abortControllerRef.current?.signal.aborted) {
      setStep(GenerationStep.FINISHED);
    } else {
      setStep(GenerationStep.IDLE);
    }
    abortControllerRef.current = null;
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setStep(GenerationStep.IDLE);
      setTasks(prev => prev.map(t => t.status === 'processing' ? { ...t, status: 'pending', progress: 0 } : t));
    }
  };

  const updateTask = (id: string, updates: Partial<ImageTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const downloadAll = () => {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.videoUrl);
    completedTasks.forEach((task, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = task.videoUrl!;
        link.download = `visionario-pro-${task.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 500);
    });
  };

  const resetAll = () => {
    tasks.forEach(t => {
      if (t.previewUrl) URL.revokeObjectURL(t.previewUrl);
      if (t.videoUrl) URL.revokeObjectURL(t.videoUrl);
    });
    setTasks([]);
    setStep(GenerationStep.IDLE);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center neon-glow">
            <i className="fas fa-film text-white text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic">
            Visionário <span className="text-cyan-400">Pro 2.0</span> Movie
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-zinc-500 uppercase tracking-widest font-semibold">
            {tasks.length} / {MAX_IMAGES} Imagens
          </span>
          {step === GenerationStep.FINISHED && (
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-full border border-zinc-700 hover:bg-zinc-800 transition text-sm font-medium"
            >
              Nova Sessão
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8 flex flex-col gap-8">
        {step === GenerationStep.AUTH ? (
          <div className="max-w-md mx-auto mt-20 p-8 glass rounded-3xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto text-cyan-400">
              <i className="fas fa-key text-2xl"></i>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Chave de API Necessária</h2>
              <p className="text-zinc-400 text-sm">Para usar o gerador Veo 3.1, selecione uma chave de API válida em um projeto faturável.</p>
            </div>
            <button
              onClick={handleOpenKeySelector}
              className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold rounded-xl transition-all active:scale-95"
            >
              Selecionar Chave de API
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <section className="glass rounded-3xl p-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Upload de Imagens</h3>
                      <p className="text-sm text-zinc-400">Até {MAX_IMAGES} fotos por lote.</p>
                    </div>
                    <label className={`cursor-pointer bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-zinc-200 transition active:scale-95 text-sm ${tasks.length >= MAX_IMAGES || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <i className="fas fa-plus mr-2"></i> Adicionar Fotos
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={onFilesSelected}
                        disabled={isProcessing || tasks.length >= MAX_IMAGES}
                      />
                    </label>
                  </div>

                  {tasks.length === 0 && (
                    <div className="border-2 border-dashed border-zinc-800 rounded-2xl py-20 flex flex-col items-center justify-center text-zinc-600 gap-4">
                      <i className="fas fa-images text-5xl"></i>
                      <p className="font-medium">Arraste fotos ou clique no botão acima</p>
                    </div>
                  )}

                  {tasks.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {tasks.map(task => (
                        <div key={task.id} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl group">
                          <img src={task.previewUrl} className="w-full h-full object-cover" alt="Preview" />

                          {!isProcessing && task.status === 'pending' && (
                            <button
                              onClick={() => removeTask(task.id)}
                              className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-10"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          )}

                          {task.status === 'processing' && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4">
                              <i className="fas fa-spinner fa-spin text-cyan-400 mb-2"></i>
                              <span className="text-[10px] uppercase font-bold text-cyan-400">Renderizando...</span>
                            </div>
                          )}

                          {task.status === 'completed' && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                              <i className="fas fa-check text-white text-[10px]"></i>
                            </div>
                          )}

                          {task.status === 'failed' && (
                            <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center p-2 text-center">
                              <i className="fas fa-exclamation-triangle text-white mb-1"></i>
                              <p className="text-[8px] text-white font-bold leading-tight">{task.error}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6">
                <section className="glass rounded-3xl p-8 space-y-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <i className="fas fa-sliders-h text-cyan-400"></i>
                    Configurações
                  </h3>

                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Proporção (Aspect Ratio)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['16:9', '9:16', '4:3'] as AspectRatio[]).map(ratio => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`py-3 rounded-xl text-xs font-bold border transition ${aspectRatio === ratio ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-zinc-800 hover:border-zinc-700'}`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Padrão Profissional</label>
                    <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                      <p className="text-sm font-semibold">Resolução HD 720p</p>
                      <p className="text-[10px] text-zinc-500">8 segundos • Movimento Cinematográfico</p>
                    </div>
                  </div>

                  <button
                    onClick={startGeneration}
                    disabled={isProcessing || tasks.length === 0 || tasks.every(t => t.status === 'completed')}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-tighter text-lg transition-all flex items-center justify-center gap-3 ${isProcessing || tasks.length === 0 || tasks.every(t => t.status === 'completed') ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90 shadow-lg neon-glow active:scale-[0.98]'}`}
                  >
                    {isProcessing ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin"></i>
                        Trabalhando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-bolt"></i>
                        Iniciar Produção
                      </>
                    )}
                  </button>
                </section>

                <div className="p-6 glass rounded-3xl border border-cyan-500/20">
                  <h4 className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wide">Sobre a Tecnologia</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Utilizamos o motor **Veo 3.1** da Google para criar interpolação de frames fluida. O processamento ocorre em lote para garantir máxima eficiência.
                  </p>
                </div>
              </aside>
            </div>

            {tasks.some(t => t.status === 'completed') && (
              <section className="space-y-6 pb-32">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">Minha <span className="text-cyan-400">Cinematografia</span></h2>
                  <button
                    onClick={downloadAll}
                    className="bg-cyan-500 text-zinc-950 px-8 py-3 rounded-full font-black uppercase tracking-tighter hover:bg-cyan-400 transition-all flex items-center gap-3 shadow-xl neon-glow"
                  >
                    <i className="fas fa-download"></i>
                    Exportar Tudo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tasks.filter(t => t.status === 'completed').map(task => (
                    <div key={`video-${task.id}`} className="glass rounded-3xl overflow-hidden flex flex-col border border-zinc-800/50 shadow-2xl">
                      <div className={`relative ${aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-video'} bg-black`}>
                        <video
                          src={task.videoUrl}
                          controls
                          className="w-full h-full object-cover"
                          poster={task.previewUrl}
                        />
                      </div>
                      <div className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Projeto ID {task.id.toUpperCase()}</p>
                          <p className="text-sm font-bold">Vídeo Finalizado</p>
                        </div>
                        <a
                          href={task.videoUrl}
                          download={`visionario-pro-${task.id}.mp4`}
                          className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-cyan-500 hover:text-zinc-950 transition-all flex items-center justify-center"
                        >
                          <i className="fas fa-arrow-down"></i>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="py-10 mt-auto border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-xl z-10">
        <div className="container mx-auto text-center px-4">
          <p className="text-sm font-black tracking-[0.2em] uppercase transition-all hover:scale-105 inline-block" style={{
            color: '#06b6d4',
            textShadow: '0 0 8px rgba(6, 182, 212, 0.7), 0 0 20px rgba(6, 182, 212, 0.3)'
          }}>
            PRODUZIDO POR: WFOX SOLUÇÕES INTELIGENTES. TODOS OS DIREITOS RESERVADOS.
          </p>
        </div>
      </footer>

      {isProcessing && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 glass border border-cyan-500/40 p-5 z-50 rounded-3xl min-w-[320px] md:min-w-[750px] shadow-2xl animate-in slide-in-from-bottom duration-500">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <i className="fas fa-atom fa-spin text-cyan-400 text-2xl"></i>
                <div className="absolute inset-0 bg-cyan-400/30 blur-xl rounded-full animate-pulse"></div>
              </div>
              <div className="hidden sm:block">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-100">Renderização em Fluxo</h4>
                <p className="text-[9px] text-zinc-500 uppercase">Processando redes neurais de vídeo</p>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-cyan-400">
                <span>Status da Produção</span>
                <span>{tasks.filter(t => t.status === 'completed').length} de {tasks.length}</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400 progress-bar-animate shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  style={{ width: `${(tasks.filter(t => t.status === 'completed').length / tasks.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <button
              onClick={stopGeneration}
              className="px-6 py-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-tighter hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95 whitespace-nowrap"
            >
              <i className="fas fa-hand-paper mr-2"></i>
              Abortar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
