import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Calendar, QrCode, ScanFace, X } from 'lucide-react';
import { useGymData } from '../hooks/useGymData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TelaoPage() {
  const { students, accessLogs } = useGymData();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [activeStudent, setActiveStudent] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [lastLogId, setLastLogId] = useState<string | null>(null);

  // Relógio em tempo real
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(format(now, 'HH:mm:ss'));
      setDateStr(format(now, "eeee, dd 'de' MMMM", { locale: ptBR }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Bip sonoro
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
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  };

  // Detecta acesso em tempo real via accessLogs
  useEffect(() => {
    if (accessLogs.length === 0) return;
    const latestLog = accessLogs[0];
    const logId = latestLog.id || latestLog.studentId + latestLog.timestamp;
    if (logId === lastLogId) return;

    const logTime = latestLog.timestamp?.toDate
      ? latestLog.timestamp.toDate()
      : new Date(latestLog.timestamp);
    const diffSeconds = Math.abs(Date.now() - logTime.getTime()) / 1000;

    if (diffSeconds < 10) {
      const student = students.find(s => s.id === latestLog.studentId) || null;
      setActiveStudent(student);
      setShowVerification(true);
      setLastLogId(logId);
      playBeep(student?.status === 'active' ? 'success' : 'error');

      const timer = setTimeout(() => setShowVerification(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [accessLogs, students, lastLogId]);

  const isActive = activeStudent?.status === 'active';

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-[#4a0808] via-neutral-950 to-purple-950 text-white flex flex-col justify-between overflow-hidden select-none relative">

      {/* Silhueta de fundo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-[55vw] h-[55vw] text-white">
          <path
            d="M48,22 C46,24 45,26 44,28 C45,30 46,31 47,33 C45,35 44,38 43,41 C41,45 38,48 36,50 C37,52 38,55 39,58 C38,62 37,65 36,70 M47,33 C50,31 52,28 55,26 C58,25 61,23 64,21 M43,41 C48,43 52,44 57,45 C62,45 68,43 72,40 C75,38 78,36 81,34 C83,33 85,32 87,31"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Header */}
      <div className="px-12 py-6 bg-black/60 border-b border-white/5 flex items-center justify-between z-10 shrink-0 backdrop-blur-md">
        <div className="w-10" />

        <div className="flex items-center gap-3.5 bg-neutral-900/40 px-6 py-2.5 rounded-full border border-white/5 shadow-inner">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black italic tracking-tighter text-white text-base border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            CF
          </div>
          <span className="text-2xl font-black italic uppercase tracking-tighter text-white">
            CARRASCO <span className="text-red-500">FIT</span>
          </span>
        </div>

        <button
          onClick={() => window.close()}
          title="Fechar telão"
          className="p-3 bg-red-950/60 border border-red-500/30 hover:bg-red-800 text-white rounded-full transition-colors hover:scale-105 active:scale-95 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Relógio central */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 py-12">
        <h1 className="text-[13vw] font-black italic tracking-tighter text-white font-mono leading-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
          {timeStr || '--:--:--'}
        </h1>
        <p className="text-2xl font-black italic uppercase tracking-widest text-red-500/90 mt-4 bg-red-950/20 px-8 py-2 rounded-full border border-red-500/20 backdrop-blur-sm capitalize">
          {dateStr || '...'}
        </p>
      </div>

      {/* Flash de verificação de acesso */}
      <AnimatePresence>
        {showVerification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-12 text-center
              ${isActive
                ? 'bg-green-950/98 border-[12px] border-green-500'
                : 'bg-red-950/98 border-[12px] border-red-600'
              }`}
          >
            <motion.div
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="w-44 h-44 rounded-full overflow-hidden border-4 border-white/80 shadow-2xl mb-8"
            >
              {activeStudent?.photoUrl ? (
                <img
                  src={activeStudent.photoUrl}
                  alt={activeStudent.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-black/60 flex items-center justify-center">
                  <span className="text-7xl font-black text-white">
                    {activeStudent?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-[7vw] font-black italic uppercase tracking-tighter text-white leading-none drop-shadow-lg"
            >
              {activeStudent?.name || 'Visitante'}
            </motion.h1>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-6 flex items-center gap-3 px-10 py-4 rounded-full border-2 text-xl font-black uppercase tracking-[0.3em]
                ${isActive
                  ? 'border-green-400/50 bg-green-500/20 text-green-300'
                  : 'border-red-400/50 bg-red-500/20 text-red-300'
                }`}
            >
              {isActive ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
              {isActive ? 'ACESSO LIBERADO' : 'ACESSO BLOQUEADO'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rodapé: QR Code + Blocos de status */}
      <div className="px-16 pb-14 grid grid-cols-1 lg:grid-cols-3 gap-8 z-10 shrink-0 items-end">

        {/* QR Code */}
        <div className="lg:col-span-1 bg-white p-5 rounded-[24px] shadow-2xl max-w-[240px] border border-neutral-200">
          <div className="w-full aspect-square flex items-center justify-center text-black mb-3">
            <QrCode size={160} className="w-full h-full" />
          </div>
          <p className="text-[10px] font-black text-black tracking-widest text-center uppercase">
            ESCANEIE PARA ACESSAR
          </p>
        </div>

        {/* Blocos de status neon */}
        <div className="lg:col-span-2 space-y-3 max-w-lg ml-auto w-full">
          <div className="bg-[#18101a]/85 border border-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.3)] rounded-[20px] p-5 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-1">SITUAÇÃO</p>
              <div className="flex items-center gap-2 text-white font-black text-lg tracking-tight">
                <CheckCircle2 size={18} className="text-[#22c55e]" />
                ATIVO
              </div>
            </div>
            <span className="text-xs font-bold text-[#22c55e] uppercase tracking-wider">Acesso Liberado</span>
          </div>

          <div className="bg-[#18101a]/85 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] rounded-[20px] p-5 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-1">VALIDADE</p>
              <div className="flex items-center gap-2 text-white font-black text-lg tracking-tight">
                <AlertTriangle size={18} className="text-red-500" />
                VERIFICAR
              </div>
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Aguardando acesso</span>
          </div>

          <div className="bg-[#18101a]/85 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] rounded-[20px] p-5 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-1">PRÓXIMO PAGAMENTO</p>
              <div className="flex items-center gap-2 text-white font-black text-lg tracking-tight">
                <Calendar size={18} className="text-red-500" />
                —
              </div>
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Aguardando</span>
          </div>
        </div>
      </div>
    </div>
  );
}
