import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar, QrCode, UserCheck, UserX, ScanFace } from 'lucide-react';
import { useGymData } from '../hooks/useGymData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FullScreenValidatorProps {
  onClose: () => void;
}

export default function FullScreenValidator({ onClose }: FullScreenValidatorProps) {
  const { students, accessLogs } = useGymData();
  
  // Estados de Relógio Digital
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Estados de Transição de Evento
  const [activeLog, setActiveLog] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);

  // Escuta relógio interno a cada segundo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(format(now, 'HH:mm:ss'));
      setDateStr(format(now, "eeee, dd 'de' MMMM 'de' yyyy", { locale: ptBR }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sintetizador de Som Web Audio API para feedbacks de bip sem assets externos
  const playBeep = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        // Bip agudo e limpo (autorizado)
        osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota Lá
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        // Dois bips graves e espaçados (rejeitado)
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Nota Lá grave
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        
        // Segundo bip
        setTimeout(() => {
          try {
            const ctx2 = new AudioCtx();
            const osc2 = ctx2.createOscillator();
            const gain2 = ctx2.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx2.destination);
            osc2.frequency.setValueAtTime(220, ctx2.currentTime);
            gain2.gain.setValueAtTime(0.15, ctx2.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.15);
            osc2.start();
            osc2.stop(ctx2.currentTime + 0.15);
          } catch(e){}
        }, 200);
      }
    } catch (e) {
      console.warn('Erro ao tocar efeito sonoro:', e);
    }
  };

  // Escuta novas passagens na tabela accessLogs do Firestore em tempo real
  useEffect(() => {
    if (accessLogs.length === 0) return;
    
    // Pega o último log inserido na fila
    const latestLog = accessLogs[0];
    
    // Garante que o log seja recente (últimos 8 segundos) para evitar loops e flashes no carregamento inicial
    const logTime = latestLog.timestamp?.toDate ? latestLog.timestamp.toDate() : new Date(latestLog.timestamp);
    const now = new Date();
    const diffSeconds = Math.abs(now.getTime() - logTime.getTime()) / 1000;
    
    if (diffSeconds < 8) {
      const student = students.find(s => s.id === latestLog.studentId);
      
      // Armazena e exibe a passagem
      setActiveLog(latestLog);
      setActiveStudent(student || null);
      setShowVerification(true);
      
      // Toca feedback de áudio apropriado
      if (student && student.status === 'active') {
        playBeep('success');
      } else {
        playBeep('error');
      }
      
      // Reseta a tela para o estado de "Aguardando" após 5 segundos
      const timer = setTimeout(() => {
        setShowVerification(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [accessLogs, students]);

  // Data de validade formatada
  const getExpirationDate = (student: any) => {
    if (!student) return '---';
    const expirations = student.planExpirations || {};
    const dates = Object.values(expirations) as string[];
    if (dates.length === 0) return 'Sem validade';
    dates.sort();
    const latest = dates[dates.length - 1];
    const [year, month, day] = latest.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-gradient-to-br from-neutral-950 via-neutral-900 to-purple-950 text-white flex flex-col justify-between p-12 overflow-hidden select-none">
      
      {/* Silhueta Kickboxer Esportiva de Fundo em Homenagem ao Carrasco */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-500/20 via-transparent to-transparent flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-[60vw] h-[60vw] text-white select-none">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <path d="M45,35 L48,40 L52,38 L55,42 L53,48 L58,54 L52,65" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>

      {/* Botão de Fechar Telão no Canto Superior Direito */}
      <button 
        onClick={onClose}
        className="absolute right-12 top-12 z-[2100] p-4 bg-black/60 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
      >
        <X size={24} />
      </button>

      {/* Transição em Tela Cheia (Flashes Verde / Vermelho de Validação) */}
      <AnimatePresence>
        {showVerification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-[2050] flex flex-col items-center justify-center p-12 text-center transition-all ${activeStudent?.status === 'active' ? "bg-green-950/95" : "bg-red-950/95"}`}
          >
            {/* Círculo com Efeito Ondulado de Status */}
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="relative mb-8"
            >
              <div className={`w-40 h-40 rounded-full overflow-hidden border-4 shadow-2xl relative ${activeStudent?.status === 'active' ? "border-green-400 shadow-green-500/30" : "border-red-400 shadow-red-500/30"}`}>
                {activeStudent?.photoUrl ? (
                  <img 
                    src={activeStudent.photoUrl} 
                    alt={activeStudent.name} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-black/50 flex items-center justify-center text-neutral-400">
                    <ScanFace size={64} />
                  </div>
                )}
              </div>
              
              {/* Selo Flutuante */}
              <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5 ${activeStudent?.status === 'active' ? "bg-green-500 text-white border-green-400" : "bg-red-500 text-white border-red-400"}`}>
                {activeStudent?.status === 'active' ? <UserCheck size={12} /> : <UserX size={12} />}
                {activeStudent?.status === 'active' ? 'Liberado' : 'Bloqueado'}
              </div>
            </motion.div>

            {/* Texto de Status do Aluno */}
            <div className="space-y-4 max-w-4xl">
              <h1 className="text-6xl font-black italic uppercase tracking-tighter text-white leading-none">
                {activeStudent ? activeStudent.name : 'Visitante não cadastrado'}
              </h1>
              
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-neutral-400">
                {activeStudent ? `Matrícula Nº ${activeStudent.registrationNumber || activeStudent.id?.slice(0, 6)}` : 'Código não reconhecido'}
              </p>

              <div className="h-6" />

              {/* Informações Rápidas de Contrato no Flash */}
              {activeStudent && (
                <div className="inline-flex gap-8 justify-center p-6 bg-black/30 border border-white/5 rounded-3xl backdrop-blur-md">
                  <div className="text-center">
                    <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-1">Situação do Aluno</p>
                    <p className={`text-base font-black uppercase tracking-wide italic ${activeStudent.status === 'active' ? "text-green-400" : "text-red-400"}`}>
                      {activeStudent.status === 'active' ? 'Contrato Ativo' : 'Matrícula Pendente'}
                    </p>
                  </div>
                  
                  <div className="w-px bg-white/10" />

                  <div className="text-center">
                    <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-1">Validade do Contrato</p>
                    <p className="text-base font-black text-white font-mono">{getExpirationDate(activeStudent)}</p>
                  </div>
                </div>
              )}
              
              {!activeStudent && (
                <div className="p-6 bg-black/30 border border-red-500/20 rounded-3xl max-w-lg mx-auto">
                  <p className="text-sm text-red-400 font-black uppercase tracking-widest">Aviso: Acesso Negado</p>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed uppercase tracking-wider font-semibold">
                    Esta pessoa não possui cadastro de biometria facial ou registro de matrícula ativo no Carrasco Fit.
                  </p>
                </div>
              )}
            </div>

            {/* Rodapé do Flash */}
            <div className="absolute bottom-12 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
              Retornando ao estado padrão em instantes...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Header do Telão (Nome da Academia e Status) */}
      <div className="flex items-center justify-between z-10 shrink-0">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            CARRASCO <span className="text-violet-500">FIT</span>
          </h2>
          <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Painel Telão de Monitoramento</p>
        </div>

        <div className="flex items-center gap-3 bg-neutral-950/60 border border-neutral-900 px-6 py-3 rounded-full backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Sistema Conectado</span>
        </div>
      </div>

      {/* 2. Conteúdo Central: Relógio Digital Gigante e Data */}
      <div className="flex flex-col items-center justify-center flex-1 z-10 py-12">
        <div className="relative flex flex-col items-center select-none">
          {/* Relógio Digital */}
          <h1 className="text-[12vw] font-black italic uppercase tracking-tighter text-white font-mono leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            {timeStr || '00:00:00'}
          </h1>
          {/* Data por Extenso */}
          <p className="text-xl md:text-2xl font-black italic uppercase tracking-widest text-violet-400/90 mt-4 bg-violet-950/10 px-8 py-2 rounded-full border border-violet-500/10 backdrop-blur-sm">
            {dateStr || 'Carregando data...'}
          </p>
        </div>
      </div>

      {/* 3. Rodapé do Telão: QR Code de Acesso e Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 z-10 shrink-0 items-end">
        
        {/* QR Code de Entrada no Rodapé Esquerdo */}
        <div className="flex items-center gap-6 bg-white/5 border border-white/5 p-6 rounded-[32px] backdrop-blur-md max-w-sm">
          <div className="p-4 bg-white rounded-2xl shadow-xl shadow-black/40 shrink-0 text-black">
            <QrCode size={64} />
          </div>
          <div className="space-y-1 text-left">
            <h4 className="text-sm font-black italic uppercase tracking-wider text-white">Acesso Dinâmico</h4>
            <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest leading-relaxed">
              Escaneie o QR Code do seu aplicativo na leitora para liberar a passagem.
            </p>
          </div>
        </div>

        {/* Status Blocks no Rodapé Direito */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] backdrop-blur-md text-center">
            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mb-1.5">Situação</p>
            <p className="text-sm font-black text-green-500 uppercase tracking-wider italic">AGUARDANDO</p>
          </div>
          
          <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] backdrop-blur-md text-center">
            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mb-1.5">Validade Plano</p>
            <p className="text-sm font-black text-neutral-300 font-mono">---</p>
          </div>
          
          <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] backdrop-blur-md text-center">
            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mb-1.5">Última Passagem</p>
            <p className="text-sm font-black text-violet-400 font-mono font-bold">--:--:--</p>
          </div>
        </div>

      </div>

    </div>
  );
}
