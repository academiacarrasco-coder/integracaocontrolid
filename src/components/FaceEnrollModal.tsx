import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, RefreshCw, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useHardware } from '../contexts/HardwareContext';
import { cn } from '../lib/utils';

interface FaceEnrollModalProps {
  student: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function FaceEnrollModal({ student, isOpen, onClose }: FaceEnrollModalProps) {
  const { enrollFace, isHardwareConnected } = useHardware();
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicia a webcam local
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
      console.error('Erro ao acessar webcam:', err);
      setCameraError('Câmera física não encontrada ou permissão negada.');
    }
  };

  // Encerra a webcam
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  // Captura o frame atual da webcam e faz o crop 3:4 (retrato)
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      // Proporção retrato 3:4 exigida pelo iDFace
      const targetWidth = 480;
      const targetHeight = 640;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Recorta o centro da imagem 4:3 em modo paisagem para caber na proporção retrato 3:4
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        const sourceWidth = videoHeight * (3 / 4);
        const sourceX = (videoWidth - sourceWidth) / 2;
        
        ctx.drawImage(
          video,
          sourceX, 0, sourceWidth, videoHeight, // Origem recortada no centro
          0, 0, targetWidth, targetHeight       // Destino
        );
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  // Processa upload de arquivo local (fallback)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = 640;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Desenha a imagem cortando no centro retrato 3:4
            const targetRatio = 3 / 4;
            let sourceWidth = img.width;
            let sourceHeight = img.height;
            let sourceX = 0;
            let sourceY = 0;

            if (img.width / img.height > targetRatio) {
              sourceWidth = img.height * targetRatio;
              sourceX = (img.width - sourceWidth) / 2;
            } else {
              sourceHeight = img.width / targetRatio;
              sourceY = (img.height - sourceHeight) / 2;
            }

            ctx.drawImage(
              img, 
              sourceX, sourceY, sourceWidth, sourceHeight, 
              0, 0, 480, 640
            );
            setCapturedImage(canvas.toDataURL('image/jpeg', 0.95));
            stopCamera();
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Envia a imagem capturada para o iDFace local
  const handleEnroll = async () => {
    if (!capturedImage || !student) return;
    
    if (!isHardwareConnected) {
      alert('Aviso: O leitor iDFace está offline. O envio será armazenado em fila.');
    }

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
      console.error(err);
      alert('Falha ao enviar dados da face: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Controla o ciclo da tag <video> ao ativar a câmera
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error('Erro ao reproduzir vídeo:', err));
    }
  }, [cameraActive, stream]);

  // Limpa os recursos da webcam ao desmontar o componente
  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col md:flex-row h-[85vh] max-h-[700px]">
        
        {/* Botão de Fechar no Canto Superior Direito */}
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 z-50 p-3 bg-black/50 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Sidebar Esquerda - Novo Cadastro */}
        <div className="w-full md:w-[220px] bg-neutral-950 p-8 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col items-center justify-center shrink-0">
          <button
            onClick={startCamera}
            className="w-full py-5 bg-violet-700 hover:bg-violet-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2 text-xs border border-violet-500/20 cursor-pointer"
          >
            <RefreshCw size={14} className={cn(cameraActive && "animate-spin")} />
            NOVO
          </button>
          
          <div className="mt-8 text-center hidden md:block">
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Aluno Selecionado</p>
            <p className="font-black text-white uppercase text-sm mt-2 italic tracking-tight">{student?.name}</p>
            <p className="text-[9px] text-yellow-500 font-bold uppercase tracking-widest mt-1">Nº {student?.registrationNumber || student?.id?.slice(0,6)}</p>
          </div>
        </div>

        {/* Conteúdo Central - Preview e Captura */}
        <div className="flex-1 p-8 flex flex-col justify-between items-center bg-neutral-900/40 relative">
          
          {/* Caixa de Câmera / Preview */}
          <div className="w-full flex-1 flex items-center justify-center relative overflow-hidden bg-black border border-neutral-800 rounded-3xl max-w-[360px] max-h-[480px] aspect-[3/4]">
            
            {/* Visualizando Webcam em tempo real */}
            {cameraActive && !capturedImage && (
              <>
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover scale-x-[-1]" 
                  playsInline 
                  muted 
                />
                
                {/* Linhas de Guideline de Rosto (Overlay inteligente) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-2/3 h-2/3 border-2 border-dashed border-violet-500/60 rounded-[100px] flex items-center justify-center shadow-[0_0_0_2000px_rgba(0,0,0,0.6)]">
                    <div className="w-11/12 h-11/12 border border-dotted border-violet-400/40 rounded-[90px]" />
                  </div>
                  <span className="absolute bottom-4 left-0 w-full text-center text-[9px] text-violet-400 font-black uppercase tracking-widest animate-pulse">
                    Enquadre o rosto no centro
                  </span>
                </div>
              </>
            )}

            {/* Visualizando Imagem Capturada (Congelada) */}
            {capturedImage && (
              <img 
                src={capturedImage} 
                alt="Face Capturada" 
                className="w-full h-full object-cover" 
              />
            )}

            {/* Estado Sem Câmera (Com erro ou aguardando) */}
            {!cameraActive && !capturedImage && (
              <div className="p-8 text-center space-y-4">
                {cameraError ? (
                  <>
                    <AlertTriangle size={48} className="text-red-500 mx-auto" />
                    <p className="text-xs font-bold text-neutral-400 leading-relaxed">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <Camera size={48} className="text-neutral-700 mx-auto" />
                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Webcam Inativa</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Botões de Ação da Câmera */}
          <div className="w-full max-w-[360px] flex gap-3 mt-6">
            {cameraActive && !capturedImage ? (
              <>
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-4 bg-violet-700 hover:bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-violet-950/20 cursor-pointer"
                >
                  TIRAR FOTO
                </button>
                <button
                  onClick={stopCamera}
                  className="px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
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
                    className="w-full py-5 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-green-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {isUploading ? 'ENVIANDO BIOMETRIA...' : 'ENVIAR BIOMETRIA'}
                  </button>
                ) : null}

                {/* Upload Alternativo (Fallback) */}
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload size={12} />
                    Selecionar Arquivo
                  </button>
                  {capturedImage && (
                    <button
                      onClick={startCamera}
                      className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-xl transition-all cursor-pointer"
                    >
                      Refazer
                    </button>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/jpeg, image/png" 
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
