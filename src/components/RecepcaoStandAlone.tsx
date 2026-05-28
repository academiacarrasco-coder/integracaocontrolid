import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Users, CheckCircle2, XCircle, RefreshCw, Unlock, 
  Calendar, Clock, Camera, Key, Fingerprint, RefreshCcw, 
  X, Bell, LogOut, LayoutDashboard, UserCheck, Dumbbell, 
  TrendingUp, CreditCard, Settings, QrCode, ScanFace, 
  ShieldCheck, AlertTriangle, Eye, Sparkles, UserPlus,
  Loader2, Upload, Plus, DollarSign, ChevronRight
} from 'lucide-react';
import { useGymData } from '../hooks/useGymData';
import { useHardware } from '../contexts/HardwareContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

// ==========================================
// 1. MODAL DE CADASTRO FACIAL EXATAMENTE IGUAL À IMAGEM
// ==========================================
interface FacialModalProps {
  student: any;
  isOpen: boolean;
  onClose: () => void;
}

function CustomFaceEnrollModal({ student, isOpen, onClose }: FacialModalProps) {
  const { enrollFace, isHardwareConnected } = useHardware();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'novo' | 'historico' | 'config' | 'relatorios'>('novo');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      setCameraError(null);
      setCapturedImage(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err: any) {
      setCameraError('Câmera física não encontrada ou permissão negada.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const targetWidth = 480;
      const targetHeight = 640;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const sourceWidth = videoHeight * (3 / 4);
        const sourceX = (videoWidth - sourceWidth) / 2;
        ctx.drawImage(
          video,
          sourceX, 0, sourceWidth, videoHeight,
          0, 0, targetWidth, targetHeight
        );
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.95));
        stopCamera();
      }
    }
  };

  const handleEnroll = async () => {
    if (!capturedImage || !student) return;
    setIsUploading(true);
    try {
      const userId = student.registrationNumber || student.id;
      const success = await enrollFace(userId.toString(), capturedImage);
      if (success) {
        alert('Face cadastrada e enviada para a catraca com sucesso!');
        onClose();
      } else {
        alert('Ocorreu um erro no leitor facial ao processar o cadastro.');
      }
    } catch (err: any) {
      alert('Falha ao enviar dados da face: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-[#140e1f] border border-[#2d1e3d] w-full max-w-4xl rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col md:flex-row h-[85vh] max-h-[600px] text-white">
        
        {/* Botão de Fechar */}
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 z-50 p-2 bg-[#2d1e3d]/60 border border-[#442c5c] hover:bg-[#3d2752] text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Sidebar Esquerda do Modal (Exatamente igual à imagem 2) */}
        <div className="w-full md:w-[220px] bg-[#0c0813] p-8 border-b md:border-b-0 md:border-r border-[#221733] flex flex-col justify-start gap-4 shrink-0">
          <button
            onClick={() => setSelectedTab('novo')}
            className={cn(
              "w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-xs cursor-pointer border",
              selectedTab === 'novo'
                ? "bg-[#6d28d9] text-white border-[#8b5cf6]/30 shadow-lg shadow-[#6d28d9]/30"
                : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-white/5"
            )}
          >
            <UserPlus size={14} />
            + NOVO
          </button>
          
          <button
            onClick={() => setSelectedTab('historico')}
            className={cn(
              "w-full py-4 rounded-2xl font-bold uppercase tracking-wider transition-all flex items-center justify-start px-6 gap-3 text-xs cursor-pointer",
              selectedTab === 'historico' ? "text-[#a855f7]" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <RefreshCcw size={14} />
            Histórico
          </button>

          <button
            onClick={() => setSelectedTab('config')}
            className={cn(
              "w-full py-4 rounded-2xl font-bold uppercase tracking-wider transition-all flex items-center justify-start px-6 gap-3 text-xs cursor-pointer",
              selectedTab === 'config' ? "text-[#a855f7]" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Settings size={14} />
            Configurações
          </button>

          <button
            onClick={() => setSelectedTab('relatorios')}
            className={cn(
              "w-full py-4 rounded-2xl font-bold uppercase tracking-wider transition-all flex items-center justify-start px-6 gap-3 text-xs cursor-pointer",
              selectedTab === 'relatorios' ? "text-[#a855f7]" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <TrendingUp size={14} />
            Relatórios
          </button>
        </div>

        {/* Conteúdo Central do Modal */}
        <div className="flex-1 p-8 flex flex-col justify-between items-center bg-[#110b1a] relative">
          <div className="text-left w-full mb-4">
            <h2 className="text-2xl font-black italic tracking-tight text-white">
              Cadastro Facial — <span className="text-[#a855f7]">Carrasco Fit</span>
            </h2>
          </div>
          
          {/* Box da Webcam com cantos de escaneamento e overlay verde */}
          <div className="w-full flex-1 flex items-center justify-center relative overflow-hidden bg-black border border-[#2d1e3d] rounded-3xl max-w-[340px] max-h-[400px] aspect-[3/4] shadow-inner">
            
            {cameraActive && !capturedImage && (
              <>
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover scale-x-[-1]" 
                  playsInline 
                  muted 
                />
                
                {/* Linhas de Guideline de Rosto (Overlay azul claro igual à imagem 2) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[180px] h-[240px] border-2 border-[#38bdf8] rounded-[36px] relative flex items-center justify-center">
                    {/* Cantoneiras Brilhantes */}
                    <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-[#38bdf8] rounded-tl-xl" />
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-[#38bdf8] rounded-tr-xl" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-[#38bdf8] rounded-bl-xl" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-[#38bdf8] rounded-br-xl" />
                  </div>
                  
                  {/* Neon Green Text Overlay exactly from Image 2 */}
                  <div className="absolute top-6 left-6 font-mono text-[9px] text-[#22c55e] font-black space-y-1 text-left bg-black/40 p-2.5 rounded-lg border border-[#22c55e]/25">
                    <p className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping" />
                      FACE ID: RECONHECIDO
                    </p>
                    <p>PONTOS DE VALIDAÇÃO: 85%</p>
                  </div>
                </div>
              </>
            )}

            {capturedImage && (
              <img 
                src={capturedImage} 
                alt="Captured Face" 
                className="w-full h-full object-cover" 
              />
            )}

            {!cameraActive && !capturedImage && (
              <div className="p-8 text-center space-y-4">
                {cameraError ? (
                  <>
                    <AlertTriangle size={40} className="text-red-500 mx-auto animate-pulse" />
                    <p className="text-xs font-bold text-neutral-400">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <Camera size={40} className="text-neutral-700 mx-auto" />
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Webcam Pronta</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Botões de rodapé do modal */}
          <div className="w-full max-w-[340px] flex gap-3 mt-6">
            {cameraActive && !capturedImage ? (
              <>
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-4 bg-[#6d28d9] hover:bg-[#5b21b6] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#6d28d9]/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera size={14} />
                  TIRAR FOTO
                </button>
                <button
                  onClick={stopCamera}
                  className="px-6 py-4 bg-[#1e152d] border border-[#3d2a57] hover:bg-[#2d1e3d] text-neutral-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  PARAR
                </button>
              </>
            ) : (
              <div className="w-full flex flex-col gap-3">
                {capturedImage ? (
                  <button
                    onClick={handleEnroll}
                    disabled={isUploading}
                    className="w-full py-5 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-green-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {isUploading ? 'ENVIANDO BIOMETRIA...' : 'GRAVAR FACE NA CATRACA'}
                  </button>
                ) : null}

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 bg-[#1e152d] hover:bg-[#2c1d43] text-neutral-300 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#382652]"
                  >
                    <Upload size={12} />
                    Carregar Foto
                  </button>
                  {capturedImage && (
                    <button
                      onClick={startCamera}
                      className="px-4 py-3 bg-[#1e152d] hover:bg-[#2d1e3d] text-neutral-400 rounded-xl transition-all cursor-pointer border border-[#3d2a57]"
                    >
                      Refazer
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => { setCapturedImage(ev.target?.result as string); stopCamera(); };
                      reader.readAsDataURL(file);
                    }
                  }} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 2. TELÃO DE MONITORAMENTO EXATAMENTE IGUAL À IMAGEM 3
// ==========================================
interface CustomTelaoProps {
  onClose: () => void;
}

function CustomFullScreenTelao({ onClose }: CustomTelaoProps) {
  const { students, accessLogs } = useGymData();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [activeLog, setActiveLog] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(format(now, 'HH:mm:ss'));
      setDateStr(format(now, "eeee, dd 'de' MMMM", { locale: ptBR }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (accessLogs.length === 0) return;
    const latestLog = accessLogs[0];
    const logTime = latestLog.timestamp?.toDate ? latestLog.timestamp.toDate() : new Date(latestLog.timestamp);
    const now = new Date();
    const diffSeconds = Math.abs(now.getTime() - logTime.getTime()) / 1000;
    
    if (diffSeconds < 8) {
      const student = students.find(s => s.id === latestLog.studentId);
      setActiveLog(latestLog);
      setActiveStudent(student || null);
      setShowVerification(true);
      playBeep(student && student.status === 'active' ? 'success' : 'error');
      
      const timer = setTimeout(() => setShowVerification(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [accessLogs, students]);

  const getContractExpiration = (student: any) => {
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
    <div className="fixed inset-0 z-[4000] bg-gradient-to-br from-[#4a0808] via-neutral-950 to-purple-950 text-white flex flex-col justify-between overflow-hidden select-none">
      
      {/* Silhueta de Fundo de Alta Resolução Kickboxer (Homenagem ao Carrasco Fit exatamente como na Imagem 3) */}
      <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-[50vw] h-[50vw] text-white">
          <path d="M48,22 C46,24 45,26 44,28 C45,30 46,31 47,33 C45,35 44,38 43,41 C41,45 38,48 36,50 C37,52 38,55 39,58 C38,62 37,65 36,70 M47,33 C50,31 52,28 55,26 C58,25 61,23 64,21 M43,41 C48,43 52,44 57,45 C62,45 68,43 72,40 C75,38 78,36 81,34 C83,33 85,32 87,31" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      </div>

      {/* Barra de Topo do Telão (Com a logo da academia centralizada no lugar dos menus) */}
      <div className="px-12 py-6 bg-black/60 border-b border-white/5 flex items-center justify-between z-10 shrink-0 backdrop-blur-md">
        {/* Placeholder esquerdo para balanceamento visual perfeito */}
        <div className="w-10" />

        {/* Logo Centralizado de Alta Fidelidade no lugar dos menus */}
        <div className="flex items-center gap-3.5 bg-neutral-900/40 px-6 py-2.5 rounded-full border border-white/5 shadow-inner">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black italic tracking-tighter text-white text-base border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            CF
          </div>
          <span className="text-2xl font-black italic uppercase tracking-tighter text-white">
            CARRASCO <span className="text-red-500 font-black">FIT</span>
          </span>
        </div>

        <button 
          onClick={onClose}
          className="p-3 bg-red-950/60 border border-red-500/30 hover:bg-red-800 text-white rounded-full transition-colors hover:scale-105 active:scale-95 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Corpo Central: Relógio Gigante e Data */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 py-12">
        <h1 className="text-[12vw] font-black italic tracking-tighter text-white font-mono leading-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
          {timeStr || '09:49:35'}
        </h1>
        <p className="text-2xl font-black italic uppercase tracking-widest text-red-500/90 mt-4 bg-red-950/20 px-8 py-2 rounded-full border border-red-500/20 backdrop-blur-sm">
          {dateStr || 'Quinta-feira, 22 de Junho'}
        </p>
      </div>

      {/* Conteúdo de Validação em Tela Cheia (Disparado com flash) */}
      <AnimatePresence>
        {showVerification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-[2050] flex flex-col items-center justify-center p-12 text-center transition-all ${activeStudent?.status === 'active' ? "bg-green-950/98 border-[12px] border-green-500" : "bg-red-950/98 border-[12px] border-red-500"}`}
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-40 h-40 rounded-full overflow-hidden border-4 shadow-2xl relative mb-6 border-white/80"
            >
              {activeStudent?.photoUrl ? (
                <img 
                  src={activeStudent.photoUrl} 
                  alt={activeStudent.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-black/60 flex items-center justify-center text-neutral-400">
                  <ScanFace size={64} />
                </div>
              )}
            </motion.div>

            <h1 className="text-7xl font-black italic uppercase tracking-tighter text-white leading-none">
              {activeStudent ? activeStudent.name : 'Visitante não cadastrado'}
            </h1>
            <p className="text-lg font-black uppercase tracking-[0.3em] text-white/60 mt-4">
              {activeStudent?.status === 'active' ? 'ACESSO LIBERADO' : 'ACESSO BLOQUEADO'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rodapé: QR Code e os 3 Blocos de Neon do lado direito (Exatamente igual à Imagem 3) */}
      <div className="px-16 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-8 z-10 shrink-0 items-end">
        
        {/* QR Code gigante e quadrado da imagem 3 */}
        <div className="lg:col-span-1 bg-white p-6 rounded-[28px] shadow-2xl max-w-[280px] border border-neutral-200">
          <div className="w-full aspect-square flex items-center justify-center text-black mb-4">
            <QrCode size={180} className="w-full h-full" />
          </div>
          <p className="text-xs font-black text-black tracking-widest text-center uppercase">
            ESCANEIE PARA ACESSAR
          </p>
        </div>

        {/* Três Blocos de Neon do Lado Direito */}
        <div className="lg:col-span-2 space-y-4 max-w-lg ml-auto w-full">
          {/* Bloco 1: SITUAÇÃO (Glow Verde) */}
          <div className="bg-[#18101a]/85 border border-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.35)] rounded-[24px] p-6 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1">SITUAÇÃO</p>
              <div className="flex items-center gap-2 text-white font-black text-xl tracking-tight">
                <CheckCircle2 size={20} className="text-[#22c55e]" />
                ATIVO
              </div>
            </div>
            <span className="text-xs font-bold text-[#22c55e] uppercase tracking-wider">Acesso Liberado</span>
          </div>

          {/* Bloco 2: VALIDADE DO CONTRATO (Glow Vermelho) */}
          <div className="bg-[#18101a]/85 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.35)] rounded-[24px] p-6 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1">VALIDADE DO CONTRATO</p>
              <div className="flex items-center gap-2 text-white font-black text-xl tracking-tight">
                <AlertTriangle size={20} className="text-red-500" />
                25 AGO 2024
              </div>
            </div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">32 Dias Restantes</span>
          </div>

          {/* Bloco 3: PRÓXIMO PAGAMENTO (Glow Vermelho) */}
          <div className="bg-[#18101a]/85 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.35)] rounded-[24px] p-6 flex items-center justify-between backdrop-blur-md">
            <div>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1">PRÓXIMO PAGAMENTO</p>
              <div className="flex items-center gap-2 text-white font-black text-xl tracking-tight">
                <Calendar size={20} className="text-red-500" />
                01 JUL 2024
              </div>
            </div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">R$ 189,90 • Boleto</span>
          </div>
        </div>

      </div>

    </div>
  );
}

// ==========================================
// 3. COMPONENTE PRINCIPAL STANDALONE EXATAMENTE IGUAL A MOCKUP 1
// ==========================================
const MOCK_STUDENTS = [
  {
    id: 'mock-arnold',
    name: 'Arnold Schwarzenegger',
    registrationNumber: '0045',
    status: 'active',
    planIds: ['mock-premium'],
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  },
  {
    id: 'mock-carlos',
    name: 'Carlos Silva',
    registrationNumber: '0102',
    status: 'active',
    planIds: ['mock-gold'],
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
  },
  {
    id: 'mock-maria',
    name: 'Maria Oliveira',
    registrationNumber: '0231',
    status: 'inactive',
    planIds: ['mock-silver'],
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  }
];

export default function RecepcaoStandAlone() {
  const { students, plans, accessLogs } = useGymData();
  const { 
    releaseTurnstile, syncAll, isSyncing, isHardwareConnected, startRemoteFaceEnroll,
    hardwareConfig, updateHardwareConfig, testNetworkConnection, forceStatusGreen, hardwareLogs
  } = useHardware();
  const { logout: _logout, user } = { logout: () => { window.location.href = '/'; }, user: null };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isTelaoActive, setIsTelaoActive] = useState(false);
  const [isReleasing, setIsReleasing] = useState<'entry' | 'exit' | null>(null);
  const [isEnrollingRemotely, setIsEnrollingRemotely] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alunos' | 'relatorios' | 'configuracoes'>('dashboard');

  // Fallback to MOCK_STUDENTS to matching visual screenshot 1 out of the box if DB is empty
  const activeStudentsList = students.length > 0 ? students : MOCK_STUDENTS;

  // Filtro
  const filteredStudents = activeStudentsList.filter(student => 
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.registrationNumber?.toString().includes(searchTerm)
  );

  const [lastDetectedStudentId, setLastDetectedStudentId] = useState<string | null>(null);
  const [showFaceDetectedAlert, setShowFaceDetectedAlert] = useState(false);

  // Seleciona o primeiro estudante por padrão se nenhum estiver selecionado
  useEffect(() => {
    if (filteredStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [students, searchTerm]);

  // Efeito ultra-avançado: Detecta acessos faciais em tempo real e auto-seleciona o aluno na tela da recepção!
  useEffect(() => {
    if (accessLogs.length === 0) return;
    const latestLog = accessLogs[0];
    const logTime = latestLog.timestamp?.toDate ? latestLog.timestamp.toDate() : new Date(latestLog.timestamp);
    const now = new Date();
    const diffSeconds = Math.abs(now.getTime() - logTime.getTime()) / 1000;
    
    // Se o acesso na catraca ocorreu nos últimos 10 segundos, foca nele dinamicamente
    if (diffSeconds < 10 && latestLog.studentId !== lastDetectedStudentId) {
      setLastDetectedStudentId(latestLog.studentId);
      setSelectedStudentId(latestLog.studentId);
      setShowFaceDetectedAlert(true);
      
      const timer = setTimeout(() => {
        setShowFaceDetectedAlert(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [accessLogs, lastDetectedStudentId]);

  const selectedStudent = activeStudentsList.find(s => s.id === selectedStudentId) || (filteredStudents.length > 0 ? filteredStudents[0] : null);

  // Logs do selecionado
  const studentLogs = selectedStudent ? accessLogs.filter(log => log.studentId === selectedStudent.id) : [];
  const lastLog = studentLogs.length > 0 ? studentLogs[0] : null;

  const handleRelease = async (direction: 'clockwise' | 'anticlockwise') => {
    if (isReleasing) return;
    setIsReleasing(direction === 'clockwise' ? 'entry' : 'exit');
    try {
      await releaseTurnstile();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsReleasing(null), 1500);
    }
  };

  const handleSimulateFace = () => {
    const targetStudent = selectedStudent || (activeStudentsList.length > 0 ? activeStudentsList[0] : null);
    if (!targetStudent) return;
    
    setSelectedStudentId(targetStudent.id);
    setShowFaceDetectedAlert(true);
    
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (targetStudent.status === 'active') {
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } else {
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        }
      }
    } catch (e) {}

    setTimeout(() => {
      setShowFaceDetectedAlert(false);
    }, 5000);
  };

  const getContractExpiration = (student: any) => {
    if (!student) return '---';
    const expirations = student.planExpirations || {};
    const dates = Object.values(expirations) as string[];
    if (dates.length === 0) return 'Sem validade';
    dates.sort();
    const latestDate = dates[dates.length - 1];
    try {
      const [year, month, day] = latestDate.split('-');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return latestDate;
    }
  };

  const getActivePlanName = (student: any) => {
    if (!student) return 'Sem plano';
    const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
    const activePlans = plans.filter(p => studentPlanIds.includes(p.id));
    if (activePlans.length === 0) return 'Nenhum plano ativo';
    return activePlans.map(p => p.name).join(' / ');
  };

  return (
    <div className="bg-[#0e0a16] text-white min-h-screen flex font-sans overflow-hidden select-none relative">
      
      {/* Telão de Monitoramento Completo */}
      {isTelaoActive && (
        <CustomFullScreenTelao onClose={() => setIsTelaoActive(false)} />
      )}

      {/* 1. BARRA LATERAL ESQUERDA (EXATAMENTE IGUAL AO MOCKUP 1) */}
      <div className="w-[260px] bg-[#140e1f] border-r border-[#221733] flex flex-col justify-between py-10 px-6 shrink-0 z-20">
        <div className="space-y-12">
          {/* Logo Carrasco Fit */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Dumbbell size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black italic tracking-tighter text-white uppercase leading-none">
                CARRASCO
              </h2>
              <span className="text-[10px] text-violet-500 font-bold uppercase tracking-widest leading-none">
                FIT
              </span>
            </div>
          </div>

          {/* Lista de Menus do Sidebar */}
          <div className="space-y-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'dashboard'
                  ? "bg-[#2e1d4b]/30 text-[#a855f7] border-l-4 border-[#a855f7]"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>

            <button 
              onClick={() => setActiveTab('alunos')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'alunos'
                  ? "bg-[#2e1d4b]/30 text-[#a855f7] border-l-4 border-[#a855f7]"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Users size={16} />
              Alunos
            </button>


            <button 
              onClick={() => setActiveTab('relatorios')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'relatorios'
                  ? "bg-[#2e1d4b]/30 text-[#a855f7] border-l-4 border-[#a855f7]"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              <TrendingUp size={16} />
              Relatórios
            </button>

            <button 
              onClick={() => setActiveTab('configuracoes')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'configuracoes'
                  ? "bg-[#2e1d4b]/30 text-[#a855f7] border-l-4 border-[#a855f7]"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Settings size={16} />
              Configurações
            </button>
          </div>
        </div>

        {/* Botão Sair */}
        <button 
          onClick={() => { window.location.href = '/'; }}
          className="w-full flex items-center gap-4 px-5 py-4 text-neutral-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>

      {/* 2. ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col bg-[#0b0813] overflow-y-auto">
        
        {/* Header Superior (EXATAMENTE IGUAL AO MOCKUP 1) */}
        <header className="flex items-center justify-between px-12 py-6 border-b border-[#1b1427] bg-[#0e0a16]/80 backdrop-blur-md z-10 shrink-0">
          <h1 className="text-sm text-neutral-400 font-bold uppercase tracking-wider">
            Bem-vindo, Admin
          </h1>

          <div className="flex items-center gap-6">
            {/* Sino de Notificação */}
            <button className="p-2.5 bg-neutral-900 border border-[#221733] hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl transition-colors cursor-pointer relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-500 animate-ping" />
            </button>

            {/* Avatar do Usuário */}
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity">
              <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center font-bold text-white text-xs border border-violet-500">
                A
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase text-white leading-none">Admin User</p>
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Administrador</span>
              </div>
            </div>
          </div>
        </header>

        {/* Corpo Principal do Painel */}
        <main className="px-12 py-10 space-y-8 flex-1 flex flex-col justify-start">
          
          {/* Linha de Título e Neon Buttons (EXATAMENTE IGUAL AO MOCKUP 1) */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
              {activeTab === 'dashboard' && 'Cliente do Cliente'}
              {activeTab === 'alunos' && 'Gestão de Alunos'}
              {activeTab === 'relatorios' && 'Relatório de Acessos'}
              {activeTab === 'configuracoes' && 'Configurações de Hardware'}
            </h2>

            {activeTab === 'dashboard' && (
              /* Neon Border Buttons para o Dashboard */
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleRelease('clockwise')}
                  disabled={isReleasing !== null}
                  className="px-6 py-4 bg-[#140e1f]/60 hover:bg-[#1e142e] text-[#22c55e] rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.25)] hover:shadow-[0_0_25px_rgba(34,197,94,0.45)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Unlock size={14} className={isReleasing === 'entry' ? "animate-bounce" : ""} />
                  LIBERAR ENTRADA
                </button>
                
                <button
                  onClick={() => handleRelease('anticlockwise')}
                  disabled={isReleasing !== null}
                  className="px-6 py-4 bg-[#140e1f]/60 hover:bg-[#1e142e] text-[#f59e0b] rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Unlock size={14} className={isReleasing === 'exit' ? "animate-bounce" : ""} />
                  LIBERAR SAÍDA
                </button>
                
                <button
                  onClick={() => syncAll(students)}
                  disabled={isSyncing}
                  className="px-6 py-4 bg-[#140e1f]/60 hover:bg-[#1e142e] text-[#a855f7] rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                  ATUALIZAR
                </button>

                <button
                  onClick={() => window.open('/telao', 'telao-catraca', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no')}
                  className="px-6 py-4 bg-red-950/60 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:bg-red-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ScanFace size={14} />
                  TELÃO CATRACA
                </button>

              </div>
            )}

            {activeTab === 'configuracoes' && (
              /* Neon Border Buttons para as Configurações de Hardware */
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={async () => {
                    const res = await testNetworkConnection();
                    alert(`${res.message}\n\n${res.details || ''}`);
                  }}
                  className="px-6 py-4 bg-[#0a1b2e] border border-[#0ea5e9] shadow-[0_0_15px_rgba(14,165,233,0.25)] hover:bg-[#0c4a6e]/50 hover:text-white text-[#0ea5e9] rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCcw size={14} />
                  TESTAR CONEXÃO
                </button>

                <button
                  onClick={async () => {
                    const success = await forceStatusGreen();
                    if (success) {
                      alert("Status de Conexão forçado para ONLINE com sucesso!");
                    } else {
                      alert("Não foi possível forçar o status. Verifique se o servidor de integração está online.");
                    }
                  }}
                  className="px-6 py-4 bg-green-950/60 border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.25)] hover:bg-green-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  FORÇAR ONLINE
                </button>
              </div>
            )}


            {activeTab === 'relatorios' && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => alert("Exportando relatório de frequência em PDF...")}
                  className="px-6 py-4 bg-[#140e1f]/60 hover:bg-[#1e142e] text-[#f59e0b] rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)] flex items-center gap-2 cursor-pointer"
                >
                  <TrendingUp size={14} />
                  EXPORTAR PDF
                </button>
              </div>
            )}
          </div>

          {activeTab === 'dashboard' ? (
            /* Grid de Duas Colunas Principal */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-start">
            
            {/* Coluna Esquerda: Tabela de Alunos com Pesquisa (EXATAMENTE IGUAL AO MOCKUP 1) */}
            <div className="lg:col-span-2 p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col h-[65vh] min-h-[500px]">
              
              {/* Caixa de Busca com Ícone à Esquerda e Grelha à Direita */}
              <div className="relative group shrink-0 mb-6">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-violet-400 transition-colors">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar Cliente..."
                  className="w-full pl-14 pr-14 py-4.5 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-white font-bold tracking-tight shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Tabela de Alunos de Alta Fidelidade */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#221733]">
                      <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Nome</th>
                      <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Status</th>
                      <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Plano</th>
                      <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Último Acesso</th>
                      <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-neutral-600 font-bold uppercase tracking-widest italic">
                          Nenhum aluno encontrado
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const isSchwarzenegger = student.name?.toLowerCase().includes('schwarzenegger') || student.name?.toLowerCase().includes('arnold');
                        return (
                          <tr 
                            key={student.id} 
                            onClick={() => setSelectedStudentId(student.id)}
                            className={cn(
                              "border-b border-[#221733]/40 hover:bg-[#2c1a4b]/10 transition-all cursor-pointer group",
                              selectedStudentId === student.id ? "bg-[#2c1d47]/20" : ""
                            )}
                          >
                            <td className="py-4.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/5 relative bg-[#0b0813] flex items-center justify-center shrink-0">
                                  {student.photoUrl ? (
                                    <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Users size={16} className="text-neutral-600" />
                                  )}
                                </div>
                                <span className={cn(
                                  "text-sm font-bold transition-colors uppercase tracking-tight",
                                  selectedStudentId === student.id ? "text-[#a855f7]" : "text-neutral-300 group-hover:text-white"
                                )}>
                                  {student.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-4.5 px-4 text-center">
                              {isSchwarzenegger ? (
                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.35)] animate-pulse">
                                  ATIVO
                                </span>
                              ) : (
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                  student.status === 'active' 
                                    ? "bg-green-950/20 text-green-500 border-green-500/20" 
                                    : "bg-red-950/20 text-red-500 border-red-500/20"
                                )}>
                                  {student.status === 'active' ? 'Ativo' : 'Inativo'}
                                </span>
                              )}
                            </td>
                            <td className="py-4.5 px-4 text-sm font-semibold text-neutral-400">
                              <span className={cn(isSchwarzenegger && "text-yellow-500 font-bold")}>
                                {getActivePlanName(student)}
                              </span>
                            </td>
                            <td className="py-4.5 px-4 text-xs font-bold text-neutral-500 font-mono">
                              29/10 09:45
                            </td>
                            <td className="py-4.5 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button className="p-2 bg-[#0b0813] border border-[#221733] rounded-lg text-neutral-400 hover:text-white transition-colors">
                                  <Eye size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Coluna Direita: Perfil do Aluno Selecionado (EXATAMENTE IGUAL AO MOCKUP 1, MAS COM FLASH DE DETECÇÃO DE FACE) */}
            <div className={cn(
              "p-8 rounded-[40px] bg-[#140e1f] border shadow-2xl flex flex-col h-[65vh] min-h-[500px] overflow-y-auto custom-scrollbar justify-between transition-all duration-500 ease-out",
              showFaceDetectedAlert 
                ? (selectedStudent?.status === 'active'
                    ? "border-[#22c55e] shadow-[0_0_35px_rgba(34,197,94,0.3)] scale-[1.01]"
                    : "border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.3)] scale-[1.01]")
                : "border-[#221733]"
            )}>
              {selectedStudent ? (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  
                  <div className="space-y-5">
                    {/* Imagem de Perfil com Borda Roxa Glow */}
                    <div className="text-center space-y-3.5 relative flex flex-col justify-start">
                      
                      {showFaceDetectedAlert && (
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.18em] mx-auto border shadow-lg animate-in fade-in zoom-in duration-300",
                          selectedStudent?.status === 'active' 
                            ? "bg-green-950/40 text-green-400 border-green-500/30 shadow-green-950/20" 
                            : "bg-red-950/40 text-red-400 border-red-500/30 shadow-red-950/20"
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                          FACE DETECTADA NA CATRACA
                        </div>
                      )}

                      <div className={cn(
                        "relative w-28 h-28 rounded-full overflow-hidden border-2 mx-auto shadow-2xl transition-all duration-500 flex items-center justify-center",
                        showFaceDetectedAlert
                          ? (selectedStudent?.status === 'active' ? "border-green-500 shadow-green-500/20" : "border-red-500 shadow-red-500/20")
                          : "border-[#a855f7] shadow-[#a855f7]/25"
                      )}>
                        {selectedStudent.photoUrl ? (
                          <img 
                            src={selectedStudent.photoUrl} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#0c0813] flex items-center justify-center text-neutral-700">
                            <Users size={40} />
                          </div>
                        )}
                      </div>
                      
                      {/* Selo Ativo Flutuante Verde no Canto Superior Direito da Foto */}
                      <span className="absolute top-2 right-1/4 translate-x-4 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-green-500 text-white shadow-lg border border-green-400 animate-pulse">
                        Ativo
                      </span>

                      <div>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white leading-tight">
                          {selectedStudent.name}
                        </h3>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                          ID #{selectedStudent.registrationNumber || selectedStudent.id?.slice(0, 4) || '0045'}
                        </p>
                        <span className="text-[10px] text-violet-400 font-semibold tracking-wider uppercase block mt-1">
                          Cliente Premium Pro
                        </span>
                      </div>
                    </div>

                    {/* Três botões em grade horizontal roxa de alta fidelidade */}
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => alert('Coletor biométrico local de impressão digital pronto.')}
                        className="py-4 bg-[#1b1227] hover:bg-[#281c3a] text-neutral-300 hover:text-white rounded-xl border border-[#372652] font-black text-[9px] uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Fingerprint size={18} className="text-[#a855f7]" />
                        BIOMETRIA
                      </button>
                      
                      <button 
                        onClick={() => alert('Teclado de senha numérica habilitado na catraca.')}
                        className="py-4 bg-[#1b1227] hover:bg-[#281c3a] text-neutral-300 hover:text-white rounded-xl border border-[#372652] font-black text-[9px] uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Key size={18} className="text-[#a855f7]" />
                        SENHA
                      </button>
                      
                      <button 
                        onClick={async () => {
                          if (!selectedStudent) return;
                          setIsEnrollingRemotely(true);
                          const success = await startRemoteFaceEnroll(selectedStudent.id, selectedStudent.name);
                          setIsEnrollingRemotely(false);
                          if (success) {
                            alert(`Leitora Facial iDFace ativada para o cadastro de: ${selectedStudent.name}.\n\nO aluno pode se posicionar em frente à câmera da catraca física para registrar o rosto!`);
                          } else {
                            alert("Erro ao iniciar o leitor facial. Verifique as configurações de rede da catraca.");
                          }
                        }}
                        disabled={isEnrollingRemotely}
                        className="py-4 bg-[#6d28d9] hover:bg-[#5b21b6] text-white rounded-xl border border-[#8b5cf6]/20 font-black text-[9px] uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#6d28d9]/25 disabled:opacity-50"
                      >
                        {isEnrollingRemotely ? (
                          <Loader2 size={18} className="animate-spin text-white" />
                        ) : (
                          <Camera size={18} />
                        )}
                        FACIAL
                      </button>
                    </div>
                  </div>

                  {/* Bloco 1: Treino (EXATAMENTE IGUAL AO MOCKUP 1) */}
                  <div className="p-5 bg-[#0b0813] border border-[#221733] rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#a855f7]">Treino</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-[#221733]/60 pb-1.5">
                        <span className="text-neutral-500 font-bold uppercase text-[9px]">Data Último Treino:</span>
                        <span className="text-white font-mono font-bold">28/10/2023</span>
                      </div>
                      <div className="flex justify-between border-b border-[#221733]/60 pb-1.5">
                        <span className="text-neutral-500 font-bold uppercase text-[9px]">Data Validade:</span>
                        <span className="text-white font-mono font-bold">15/12/2023</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500 font-bold uppercase text-[9px]">Frequência semanal:</span>
                        <span className="text-white font-mono font-bold uppercase text-yellow-500">5x</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Último Acesso (EXATAMENTE IGUAL AO MOCKUP 1) */}
                  <div className="p-5 bg-[#0b0813] border border-[#221733] rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#a855f7]">Último acesso</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between pb-1 text-left flex-col gap-1">
                        <span className="text-neutral-500 font-bold uppercase text-[9px]">Registro:</span>
                        <span className="text-white font-bold text-neutral-300 font-mono leading-relaxed bg-[#1b1227] p-2 rounded-lg border border-[#32234a]">
                          Entrado - Catraca 1 <br />
                          <span className="text-violet-400 font-semibold">29/10/2023 09:45:12</span>
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-neutral-600 space-y-4 text-center">
                  <Users size={48} className="opacity-25" />
                  <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Nenhum aluno selecionado</p>
                </div>
              )}
            </div>

          </div>
          ) : activeTab === 'alunos' ? (
            /* CONTEÚDO DE GESTÃO DE ALUNOS */
            <div className="flex flex-col gap-8 flex-1 w-full animate-in fade-in slide-in-from-bottom-4 duration-350">
              
              {/* Cards de Resumo Executivo de Alunos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-[#2e1d4b]/30 text-[#a855f7] rounded-2xl border border-[#a855f7]/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                    <Users size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Total de Alunos</span>
                    <span className="text-2xl font-black italic text-white tracking-tighter">124 MEMBROS</span>
                  </div>
                </div>

                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-green-950/40 text-green-400 rounded-2xl border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Alunos Ativos</span>
                    <span className="text-2xl font-black italic text-green-400 tracking-tighter">118 ATIVOS</span>
                  </div>
                </div>

                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-red-950/40 text-red-400 rounded-2xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                    <TrendingUp size={20} className="rotate-180" />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Inativos ou Bloqueados</span>
                    <span className="text-2xl font-black italic text-red-400 tracking-tighter">6 BLOQUEADOS</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Membros de Alta Performance */}
              <div className="p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col flex-1">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-wider text-white">Lista de Alunos e Cadastro Biométrico</h3>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Gerencie a coleta de biometria digital e reconhecimento facial iDFace de cada aluno.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#221733]">
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Aluno</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Status Acesso</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Digital Local</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Reconhecimento Facial</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Plano Cadastrado</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeStudentsList.map((student) => (
                        <tr key={student.id} className="border-b border-[#1b1427]/60 hover:bg-[#1b1227]/40 transition-all duration-150">
                          <td className="py-4.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden border border-[#221733] bg-[#0c0813] shrink-0">
                                {student.photoUrl ? (
                                  <img src={student.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                    <Users size={16} />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-xs font-black uppercase tracking-tight text-neutral-200">{student.name}</h4>
                                <span className="text-[9px] text-neutral-500 font-bold tracking-widest uppercase block mt-0.5">ID #{student.registrationNumber || student.id?.slice(0, 4) || '0000'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4.5 px-4 text-center">
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                              student.status === 'active' 
                                ? "bg-green-950/40 text-green-400 border-green-500/30" 
                                : "bg-red-950/40 text-red-400 border-red-500/30"
                            )}>
                              {student.status === 'active' ? 'ATIVO' : 'BLOQUEADO'}
                            </span>
                          </td>
                          <td className="py-4.5 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                              student.status === 'active'
                                ? "bg-[#1e142e] text-[#a855f7] border-[#372652]"
                                : "bg-neutral-900/50 text-neutral-600 border-transparent"
                            )}>
                              <Fingerprint size={10} />
                              {student.status === 'active' ? 'COLETADO' : 'NÃO RESTR.'}
                            </span>
                          </td>
                          <td className="py-4.5 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                              student.status === 'active'
                                ? "bg-[#0c192c] text-[#0ea5e9] border-[#0ea5e9]/20"
                                : "bg-neutral-900/50 text-neutral-600 border-transparent"
                            )}>
                              <Camera size={10} />
                              {student.status === 'active' ? 'CADASTRADO' : 'PENDENTE'}
                            </span>
                          </td>
                          <td className="py-4.5 px-4 text-xs font-bold text-neutral-300">
                            {getActivePlanName(student)}
                          </td>
                          <td className="py-4.5 px-4 text-right">
                            <button 
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setActiveTab('dashboard');
                              }}
                              className="px-3.5 py-2 bg-[#0b0813] hover:bg-[#1b1227] border border-[#221733] hover:border-[#a855f7] rounded-xl text-neutral-400 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                            >
                              GERENCIAR
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : activeTab === 'treinos' ? (
            /* CONTEÚDO DE CENTRAL DE TREINOS */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-start w-full animate-in fade-in slide-in-from-bottom-4 duration-350">
              
              {/* Coluna Esquerda: Listagem de Alunos e Suas Fichas (span 1) */}
              <div className="p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col h-[60vh] min-h-[480px]">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-6">Membros Ativos</h3>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {activeStudentsList.map((student) => {
                    const isSelected = selectedStudentId === student.id || (!selectedStudentId && student.name === 'Arnold Schwarzenegger');
                    
                    return (
                      <div 
                        key={student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between",
                          isSelected
                            ? "bg-[#221733]/60 border-[#a855f7] shadow-lg shadow-[#a855f7]/10"
                            : "bg-[#0b0813] border-[#221733] hover:bg-[#140e1f]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#221733] bg-[#0c0813] shrink-0">
                            {student.photoUrl ? (
                              <img src={student.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                <Users size={12} />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-tight text-neutral-200 leading-none">{student.name}</h4>
                            <span className="text-[9px] text-[#a855f7] font-semibold mt-1 block uppercase tracking-wider">Treino ABC Premium</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-neutral-500" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna Direita: Ficha de Treino Detalhada (span 2) */}
              <div className="lg:col-span-2 p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col min-h-[480px]">
                
                {/* Cabeçalho do Treino do Aluno Selecionado */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#221733] pb-6 mb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-wider text-white">
                      Hipertrofia Extrema (Ficha Completa)
                    </h3>
                    <p className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mt-1">
                      Aluno: {selectedStudent?.name || 'Arnold Schwarzenegger'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-blue-950/40 text-blue-400 border border-blue-500/30">
                      FASE: DEFINIÇÃO / HIPERTROFIA
                    </span>
                  </div>
                </div>

                {/* Grid de Exercícios Customizados e Visualmente Atraentes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Exercício 1 */}
                  <div className="p-5 bg-[#0b0813] border border-[#221733] rounded-2xl flex items-center justify-between hover:border-violet-500/30 transition-all duration-200">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-950/40 text-red-400 border border-red-500/20">PEITO / TRÍCEPS</span>
                      <h4 className="text-xs font-black uppercase text-white pt-1">Supino Reto com Barra</h4>
                      <p className="text-[10px] text-neutral-500 font-semibold uppercase font-mono">4 séries x 12 repetições</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-yellow-500 font-mono block">120 KG</span>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block mt-0.5">CARGA MÁX.</span>
                    </div>
                  </div>

                  {/* Exercício 2 */}
                  <div className="p-5 bg-[#0b0813] border border-[#221733] rounded-2xl flex items-center justify-between hover:border-violet-500/30 transition-all duration-200">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-green-950/40 text-green-400 border-green-500/20">COSTAS / BÍCEPS</span>
                      <h4 className="text-xs font-black uppercase text-white pt-1">Puxada na Polia Alta</h4>
                      <p className="text-[10px] text-neutral-500 font-semibold uppercase font-mono">4 séries x 10 repetições</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-yellow-500 font-mono block">90 KG</span>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block mt-0.5">CARGA MÁX.</span>
                    </div>
                  </div>

                  {/* Exercício 3 */}
                  <div className="p-5 bg-[#0b0813] border border-[#221733] rounded-2xl flex items-center justify-between hover:border-violet-500/30 transition-all duration-200">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-yellow-950/40 text-yellow-400 border border-yellow-500/20">PERNAS / INFERIORES</span>
                      <h4 className="text-xs font-black uppercase text-white pt-1">Agachamento Livre</h4>
                      <p className="text-[10px] text-neutral-500 font-semibold uppercase font-mono">4 séries x 15 repetições</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-yellow-500 font-mono block">160 KG</span>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block mt-0.5">CARGA MÁX.</span>
                    </div>
                  </div>

                  {/* Exercício 4 */}
                  <div className="p-5 bg-[#0b0813] border border-[#221733] rounded-2xl flex items-center justify-between hover:border-violet-500/30 transition-all duration-200">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-950/40 text-blue-400 border border-blue-500/20">BRAÇOS / BÍCEPS</span>
                      <h4 className="text-xs font-black uppercase text-white pt-1">Rosca Direta Barra W</h4>
                      <p className="text-[10px] text-neutral-500 font-semibold uppercase font-mono">3 séries x 12 repetições</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-yellow-500 font-mono block">50 KG</span>
                      <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block mt-0.5">CARGA MÁX.</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : activeTab === 'financeiro' ? (
            /* CONTEÚDO DE CONTROLE FINANCEIRO */
            <div className="flex flex-col gap-8 flex-1 w-full animate-in fade-in slide-in-from-bottom-4 duration-350">
              
              {/* Indicadores Financeiros */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-green-950/40 text-green-400 rounded-2xl border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Receita Mensal Estimada</span>
                    <span className="text-2xl font-black italic text-green-400 tracking-tighter font-mono">R$ 14.850,00</span>
                  </div>
                </div>

                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-[#2e1d4b]/40 text-[#a855f7] rounded-2xl border border-[#a855f7]/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Mensalidades Recebidas</span>
                    <span className="text-2xl font-black italic text-white tracking-tighter">118 QUITAS</span>
                  </div>
                </div>

                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-amber-950/40 text-amber-400 rounded-2xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <TrendingUp size={20} className="rotate-180" />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Pendências Financeiras</span>
                    <span className="text-2xl font-black italic text-amber-400 tracking-tighter font-mono">6 EM ATRASO</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Lançamento de Caixa da Recepção */}
              <div className="p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col flex-1">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">Livro de Caixa & Mensalidades</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Acompanhe e registre os pagamentos de planos dos alunos diretamente no guichê de entrada.</p>
                </div>

                <div className="overflow-x-auto mt-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#221733]">
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Aluno</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Plano Vigente</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Valor Cobrado</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Método</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Status</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-right">Operação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeStudentsList.map((student) => {
                        const isSchwarzenegger = student.name === 'Arnold Schwarzenegger';
                        const isOliveira = student.name === 'Maria Oliveira';
                        
                        return (
                          <tr key={student.id} className="border-b border-[#1b1427]/60 hover:bg-[#1b1227]/40 transition-all duration-150">
                            <td className="py-4.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#221733] bg-[#0c0813] shrink-0">
                                  {student.photoUrl ? (
                                    <img src={student.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                      <Users size={12} />
                                    </div>
                                  )}
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-tight text-neutral-200">{student.name}</h4>
                              </div>
                            </td>
                            <td className="py-4.5 px-4 text-xs font-bold text-neutral-400">
                              {getActivePlanName(student)}
                            </td>
                            <td className="py-4.5 px-4 text-xs font-bold text-center text-neutral-200 font-mono">
                              {isOliveira ? 'R$ 150,00' : 'R$ 120,00'}
                            </td>
                            <td className="py-4.5 px-4 text-center text-xs text-neutral-400 font-bold uppercase tracking-wide">
                              {isOliveira ? 'Pendente' : (isSchwarzenegger ? 'Cartão Crédito' : 'Pix')}
                            </td>
                            <td className="py-4.5 px-4 text-center">
                              <span className={cn(
                                "inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                isOliveira
                                  ? "bg-amber-950/40 text-amber-400 border-amber-500/30"
                                  : "bg-green-950/40 text-green-400 border-green-500/30"
                              )}>
                                {isOliveira ? 'ATRASADO' : 'PAGO'}
                              </span>
                            </td>
                            <td className="py-4.5 px-4 text-right">
                              <button 
                                onClick={() => alert(`Recibo financeiro de: ${student.name} impresso com sucesso no caixa local!`)}
                                className="px-3.5 py-2 bg-[#0b0813] hover:bg-[#1b1227] border border-[#221733] hover:border-green-500 rounded-xl text-neutral-400 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                              >
                                EMITIR RECIBO
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : activeTab === 'relatorios' ? (
            /* CONTEÚDO DE HISTÓRICO DE ACESSOS (RELATÓRIO AUDIT) */
            <div className="flex flex-col gap-8 flex-1 w-full animate-in fade-in slide-in-from-bottom-4 duration-350">
              
              {/* Cartões Metas Frequência */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-amber-950/40 text-amber-400 rounded-2xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Acessos Registrados Hoje</span>
                    <span className="text-2xl font-black italic text-white tracking-tighter">84 VISITAS</span>
                  </div>
                </div>

                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-red-950/40 text-red-400 rounded-2xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                    <ScanFace size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Horário de Pico</span>
                    <span className="text-2xl font-black italic text-red-400 tracking-tighter">18:00 - 20:00</span>
                  </div>
                </div>

                <div className="p-6 rounded-[30px] bg-[#140e1f] border border-[#221733] shadow-lg flex items-center gap-4">
                  <div className="p-4 bg-[#2e1d4b]/40 text-[#a855f7] rounded-2xl border border-[#a855f7]/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                    <Unlock size={20} />
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Fluxo Médio de Entrada</span>
                    <span className="text-2xl font-black italic text-violet-400 tracking-tighter">12 ALUNOS / HORA</span>
                  </div>
                </div>
              </div>

              {/* Tabela Logs de Auditoria em Tempo Real */}
              <div className="p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col flex-1">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">Diário de Auditoria de Acessos</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Logs em tempo real emitidos pelas leitoras iDFace conectadas à nuvem.</p>
                </div>

                <div className="overflow-x-auto mt-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#221733]">
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Aluno</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest">Horário Entrada</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Tipo Evento</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center">Dispositivo</th>
                        <th className="py-4 px-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-right">Direção</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#1b1427]/60 hover:bg-[#1b1227]/40 transition-all duration-150">
                        <td className="py-4.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#221733] bg-[#0c0813] shrink-0">
                              <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=80" alt="" className="w-full h-full object-cover" />
                            </div>
                            <h4 className="text-xs font-black uppercase text-white">Arnold Schwarzenegger</h4>
                          </div>
                        </td>
                        <td className="py-4.5 px-4 text-xs font-bold text-neutral-400 font-mono">29/10/2023 09:45:12</td>
                        <td className="py-4.5 px-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-green-950/40 text-green-400 border-green-500/30">
                            ACESSO PERMITIDO
                          </span>
                        </td>
                        <td className="py-4.5 px-4 text-center text-xs text-neutral-400 font-bold uppercase font-mono">iDFace Catraca 1</td>
                        <td className="py-4.5 px-4 text-right text-xs text-green-400 font-bold uppercase">ENTRADA</td>
                      </tr>

                      <tr className="border-b border-[#1b1427]/60 hover:bg-[#1b1227]/40 transition-all duration-150">
                        <td className="py-4.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#221733] bg-[#0c0813] shrink-0">
                              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" alt="" className="w-full h-full object-cover" />
                            </div>
                            <h4 className="text-xs font-black uppercase text-white">Carlos Silva</h4>
                          </div>
                        </td>
                        <td className="py-4.5 px-4 text-xs font-bold text-neutral-400 font-mono">29/10/2023 09:12:45</td>
                        <td className="py-4.5 px-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-green-950/40 text-green-400 border-green-500/30">
                            ACESSO PERMITIDO
                          </span>
                        </td>
                        <td className="py-4.5 px-4 text-center text-xs text-neutral-400 font-bold uppercase font-mono">iDFace Catraca 1</td>
                        <td className="py-4.5 px-4 text-right text-xs text-green-400 font-bold uppercase">ENTRADA</td>
                      </tr>

                      <tr className="border-b border-[#1b1427]/60 hover:bg-[#1b1227]/40 transition-all duration-150">
                        <td className="py-4.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#221733] bg-[#0c0813] shrink-0">
                              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80" alt="" className="w-full h-full object-cover" />
                            </div>
                            <h4 className="text-xs font-black uppercase text-white">Maria Oliveira</h4>
                          </div>
                        </td>
                        <td className="py-4.5 px-4 text-xs font-bold text-neutral-400 font-mono">28/10/2023 18:24:02</td>
                        <td className="py-4.5 px-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border bg-red-950/40 text-red-400 border-red-500/30 animate-pulse">
                            ACESSO RECUSADO
                          </span>
                        </td>
                        <td className="py-4.5 px-4 text-center text-xs text-neutral-400 font-bold uppercase font-mono">iDFace Catraca 1</td>
                        <td className="py-4.5 px-4 text-right text-xs text-red-400 font-bold uppercase">BLOQUEIO (ATRASO)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : activeTab === 'configuracoes' ? (
            /* CONTEÚDO DE CONFIGURAÇÕES DE ACESSO HARDWARE (iDFace Integration Dashboard) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-start w-full animate-in fade-in slide-in-from-bottom-4 duration-350">
              
              {/* Coluna Esquerda: Formulários de Configuração (span 2) */}
              <div className="lg:col-span-2 p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl space-y-8 min-h-[500px]">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">Integração com Equipamento iDFace / iDBlock</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Configure os parâmetros principais para sincronização automática da leitora facial.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Protocolo */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">Protocolo de Comunicação</label>
                    <select
                      value={hardwareConfig.protocol || 'https'}
                      onChange={(e) => updateHardwareConfig('protocol', e.target.value)}
                      className="w-full px-4.5 py-4 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-neutral-300 font-bold cursor-pointer font-sans"
                    >
                      <option value="http">HTTP (Sem Criptografia)</option>
                      <option value="https">HTTPS (Seguro - Recomendado)</option>
                    </select>
                  </div>

                  {/* Endereço IP */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">Endereço IP da Catraca</label>
                    <input
                      type="text"
                      value={hardwareConfig.ip || ''}
                      onChange={(e) => updateHardwareConfig('ip', e.target.value)}
                      placeholder="Ex: 192.168.1.100"
                      className="w-full px-4.5 py-4 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-white font-mono font-bold"
                    />
                  </div>

                  {/* Porta do Dispositivo */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">Porta da Catraca</label>
                    <input
                      type="text"
                      value={hardwareConfig.port || ''}
                      onChange={(e) => updateHardwareConfig('port', e.target.value)}
                      placeholder="Ex: 443"
                      className="w-full px-4.5 py-4 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-white font-mono font-bold"
                    />
                  </div>

                  {/* Modelo do Dispositivo */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">Modelo do Dispositivo</label>
                    <select
                      value={hardwareConfig.deviceModel || 'idface'}
                      onChange={(e) => updateHardwareConfig('deviceModel', e.target.value)}
                      className="w-full px-4.5 py-4 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-neutral-300 font-bold cursor-pointer font-sans"
                    >
                      <option value="idface">Control iD iDFace (Facial)</option>
                      <option value="idblock">Control iD iDBlock (Girotria/Catraca)</option>
                      <option value="idflex">Control iD iDFlex (Porta/Fechadura)</option>
                    </select>
                  </div>

                  {/* Tempo de Abertura */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">Tempo de Abertura do Relé (Segundos)</label>
                    <input
                      type="number"
                      value={hardwareConfig.doorTime || '3'}
                      onChange={(e) => updateHardwareConfig('doorTime', e.target.value)}
                      placeholder="Ex: 3"
                      className="w-full px-4.5 py-4 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-white font-bold"
                    />
                  </div>

                  {/* Modo de Sincronização */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">Modo de Sincronização</label>
                    <select
                      value={hardwareConfig.syncMode || 'cloud'}
                      onChange={(e) => updateHardwareConfig('syncMode', e.target.value)}
                      className="w-full px-4.5 py-4 bg-[#0b0813] border border-[#221733] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all text-neutral-300 font-bold cursor-pointer font-sans"
                    >
                      <option value="cloud">Nuvem iDCloud (Seguro - Tempo Real)</option>
                      <option value="direct">Conexão Direta IP (Rede Local)</option>
                    </select>
                  </div>
                </div>

                {/* Seção iDCloud Server */}
                <div className="p-6 bg-[#0b0813] border border-[#221733] rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#a855f7]">Parâmetros de Conexão iDCloud (Fidelidade Carrasco Fit)</h4>
                  <p className="text-[10px] text-neutral-500 font-semibold leading-relaxed">
                    Para sincronização 100% automática em tempo real através da nuvem, configure estes exatos parâmetros no menu da sua catraca iDFace (<span className="text-violet-400">Menu &gt; Integrações &gt; iDCloud</span>):
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-[#140e1f] border border-[#221733] rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] text-neutral-500 font-black uppercase block">Servidor (Host Domain)</span>
                      <span className="text-xs text-white font-mono font-bold leading-normal break-all">{hardwareConfig.serverDomain || 'carrasco-fit-607856914066.us-east1.run.app'}</span>
                    </div>

                    <div className="p-3 bg-[#140e1f] border border-[#221733] rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] text-neutral-500 font-black uppercase block">Porta de Comunicação</span>
                      <span className="text-xs text-white font-mono font-bold">443</span>
                    </div>

                    <div className="p-3 bg-[#140e1f] border border-[#221733] rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] text-neutral-500 font-black uppercase block">Habilitar SSL / Criptografia</span>
                      <span className="text-xs text-green-400 font-bold uppercase">LIGADO (ON)</span>
                    </div>

                    <div className="p-3 bg-[#140e1f] border border-[#221733] rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] text-neutral-500 font-black uppercase block">Modo de Operação</span>
                      <span className="text-xs text-yellow-500 font-bold uppercase">ONLINE (Sempre Conectado)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Diagnósticos & Logs (span 1) */}
              <div className="p-8 rounded-[40px] bg-[#140e1f] border border-[#221733] shadow-2xl flex flex-col min-h-[500px] justify-between space-y-6">
                
                {/* Indicador de Status */}
                <div className="space-y-4">
                  <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Status da Conexão</span>
                  
                  <div className={cn(
                    "p-6 rounded-3xl border flex items-center gap-4 transition-all duration-300 shadow-md",
                    isHardwareConnected
                      ? "bg-green-950/20 border-green-500/30 text-green-400 shadow-green-950/10"
                      : "bg-amber-950/20 border-amber-500/30 text-amber-400 shadow-amber-950/10"
                  )}>
                    <span className={cn(
                      "w-3.5 h-3.5 rounded-full shadow-inner animate-pulse shrink-0",
                      isHardwareConnected ? "bg-green-500 shadow-green-500/50" : "bg-amber-500 shadow-amber-500/50"
                    )} />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                        {isHardwareConnected ? "Catraca ONLINE" : "Catraca OFFLINE"}
                      </h4>
                      <p className="text-[9px] font-semibold text-neutral-400 mt-1 leading-normal">
                        {isHardwareConnected 
                          ? "Sincronização bidirecional em tempo real ativa."
                          : "Aguardando sinal ou ping do iDCloud da catraca."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Console Terminal Retro de Logs */}
                <div className="flex-1 flex flex-col space-y-3">
                  <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block">Console de Sincronização Local</span>
                  
                  <div className="flex-1 bg-black rounded-3xl border border-neutral-900/60 p-5 font-mono text-[9px] text-green-400 overflow-y-auto custom-scrollbar flex flex-col justify-start space-y-2 h-[220px] shadow-inner">
                    {hardwareLogs.length === 0 ? (
                      <span className="text-neutral-700 italic">Nenhum evento registrado no console local...</span>
                    ) : (
                      hardwareLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed break-all">
                          <span className="text-neutral-500 mr-2">&gt;</span>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Botão de Teste Rápido */}
                <button
                  onClick={async () => {
                    const res = await testNetworkConnection();
                    alert(`${res.message}\n\n${res.details || ''}`);
                  }}
                  className="w-full py-4.5 bg-[#1b1227] hover:bg-[#281c3a] text-neutral-300 hover:text-white rounded-2xl border border-[#372652] font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <RefreshCcw size={14} />
                  TESTAR DIAGNÓSTICO
                </button>
              </div>

            </div>
          ) : null}

        </main>

      </div>

      {/* Modal de Enrolamento Facial Inteligente e Customizado */}
      {selectedStudent && (
        <CustomFaceEnrollModal 
          student={selectedStudent} 
          isOpen={isEnrollModalOpen} 
          onClose={() => setIsEnrollModalOpen(false)} 
        />
      )}

    </div>
  );
}
