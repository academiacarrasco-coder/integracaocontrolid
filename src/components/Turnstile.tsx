import React, { useState, useRef, useEffect } from 'react';
import { useGymData } from '../hooks/useGymData';
import { useLocation } from 'react-router-dom';
import { useHardware } from '../contexts/HardwareContext';
import { 
  ScanFace, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  AlertCircle,
  User,
  History,
  ShieldCheck,
  Settings as SettingsIcon,
  Wifi,
  Unplug,
  Cpu,
  UserPlus,
  RefreshCw,
  Unlock,
  Lock,
  Trash2,
  Camera as CameraIcon,
  X,
  Loader2,
  ExternalLink,
  Terminal,
  Copy,
  Check,
  FileCode,
  FileDown,
  Users
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import ControlIdPanel from './ControlIdPanel';

export default function Turnstile() {
  const PRODUCTION_URL = "https://carrasco-fit-607856914066.us-east1.run.app";
  const IDFACE_DOMAIN = "carrasco-fit-607856914066.us-east1.run.app";
  const [activeTab, setActiveTab] = useState<'local' | 'idcloud'>('local');
  const { students, plans, classes, accessLogs, settings, loading } = useGymData();
  const { 
    isHardwareConnected, 
    hardwareLogs, 
    addHardwareLog, 
    releaseTurnstile, 
    updateHardwareConfig,
    applyAdvancedConfig,
    syncUser,
    syncAll,
    enrollFace,
    getUsers,
    deleteUser,
    testNetworkConnection,
    isSyncing,
    setIsSyncing,
    fetchServerLogs,
    forceStatusGreen,
    hardwareConfig, 
    setHardwareConfig,
    setIsHardwareConnected
  } = useHardware();
  const location = useLocation();
  const plansRef = useRef(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);
  
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const enrollVideoRef = useRef<HTMLVideoElement>(null);
  const cameraActiveRef = useRef(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [displayDuration, setDisplayDuration] = useState(5); // seconds
  const resultTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [hardwareLogs]);

  const [lastEventId, setLastEventId] = useState<number>(0);
  const pollingIntervalRef = useRef<any>(null);

  const [turnstileUsers, setTurnstileUsers] = useState<any[]>([]);
  const [syncingStudentId, setSyncingStudentId] = useState<string | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudent, setEnrollStudent] = useState<any>(null);
  const [enrollStep, setEnrollStep] = useState<'camera' | 'uploading' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const [serverStatus, setServerStatus] = useState<any>(null);
  const [commandQueue, setCommandQueue] = useState<{ size: number, commands: any[] }>({ size: 0, commands: [] });

  const refreshServerLogsAndStatus = async () => {
    try {
      const logs = await fetchServerLogs();
      if (Array.isArray(logs)) {
        setServerLogs(logs);
      }
      
      const statusRes = await fetch('/api/hardware/status');
      if (statusRes.ok) {
        setServerStatus(await statusRes.json());
      }

      const queueRes = await fetch('/api/hardware/queue');
      if (queueRes.ok) {
        setCommandQueue(await queueRes.json());
      }
    } catch (err) {}
  };

  const clearQueue = async () => {
    if (!confirm("Limpar todos os comandos pendentes?")) return;
    try {
      const res = await fetch('/api/hardware/queue/clear', { method: 'POST' });
      if (res.ok) {
        addHardwareLog("🧹 Fila de comandos limpa.");
        refreshServerLogsAndStatus();
      }
    } catch (err) {
      alert("Erro ao limpar fila.");
    }
  };

  const simulateHardwarePush = async () => {
    addHardwareLog("🧪 Iniciando Simulação de Conexão Hardware...");
    try {
      // Simula exatamente o que a catraca faz
      const res = await fetch('/push?sim=true', {
        method: 'POST',
        headers: {
          'User-Agent': 'iDFace/1.0.0 (Simulator)',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ })
      });
      
      if (res.ok) {
        const data = await res.json();
        addHardwareLog(`✅ SIMULAÇÃO: O servidor recebeu o sinal e respondeu.`);
        addHardwareLog(`DICA: Se aqui funciona e na catraca real não, o sinal da catraca física não está chegando na internet.`);
        if (data.endpoint !== 'ping') {
          addHardwareLog(`📦 Comando capturado na simulação: ${data.endpoint}`);
        }
      } else {
        addHardwareLog(`❌ Falha na simulação: Status ${res.status}`);
      }
    } catch (err) {
      addHardwareLog(`❌ Erro técnico na simulação: ${err instanceof Error ? err.message : 'Falha'}`);
    }
  };

  useEffect(() => {
    const interval = setInterval(refreshServerLogsAndStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [serverLogs]);

  const downloadLogs = () => {
    const header = `=== DIAGNÓSTICO TÉCNICO - CARRASCO FIT ===
Data: ${new Date().toLocaleString()}
Configuração: ${hardwareConfig.protocol}://${hardwareConfig.ip}:${hardwareConfig.port}
Modo: ${hardwareConfig.syncMode}

--- METADADOS DO HARDWARE ---
ID do Dispositivo: ${serverStatus?.deviceId || '---'}
Modelo: ${serverStatus?.model || '---'}
Firmware: ${serverStatus?.firmware || '---'}
IP na Rede: ${serverStatus?.ip || '---'}
MAC Address: ${serverStatus?.mac || '---'}
RAM Usage: ${serverStatus?.ram || '---'}
Disk Usage: ${serverStatus?.disk || '---'}

`;
    
    const hardwareSection = `--- LOGS DE OPERAÇÕES (FRONTEND) ---\n${hardwareLogs.join('\n')}\n\n`;
    const serverSection = `--- LOGS DE COMUNICAÇÃO (SERVER/PUSH) ---\n${serverLogs.join('\n')}\n`;
    
    const logContent = header + hardwareSection + serverSection;
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagnostico_idface_${format(new Date(), "yyyy-MM-dd_HHmm")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activateOption = async (url: string) => {
    setIsUpdatingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        turnstileUrl: url
      }, { merge: true });
      alert(`Sistema configurado para: ${url === 'https://push.idsecure.com.br/api' ? 'iDCloud' : 'Conexão Direta'}`);
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      alert('Erro ao salvar configuração.');
    } finally {
      setIsUpdatingSettings(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyUrl = () => {
    const url = settings?.turnstileUrl || 'https://push.idsecure.com.br/api';
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const runDiagnostic = async () => {
    addHardwareLog("Iniciando diagnóstico de rede...");
    const result = await testNetworkConnection();
    if (result.success) {
      addHardwareLog(`✅ Diagnóstico: ${result.message}`);
      if (result.details) addHardwareLog(`Info: ${result.details}`);
    } else {
      addHardwareLog(`❌ Falha no Diagnóstico: ${result.message}`);
      if (result.details) addHardwareLog(`Detalhes: ${result.details}`);
    }
  };

  const simulateTurnstile = async () => {
    const testId = settings?.registeredDeviceId || "Simulador";
    
    if (settings?.registeredDeviceId && testId === "Simulador") {
      setServerLogs(prev => [`⚠️ Aviso: Usando "Simulador" mas o servidor espera um Serial real.`, ...prev.slice(0, 49)]);
    }

    setServerLogs(prev => [`[SIMULAÇÃO] Enviando sinal de teste como "${testId}" para /push...`, ...prev.slice(0, 49)]);
    try {
      // Simulate the polling request that the turnstile makes
      await fetch(`/push?device_id=${testId}&uuid=test-uuid&model=${hardwareConfig.deviceModel}`, {
        method: 'GET',
        headers: { 
          'User-Agent': 'Control iD Turnstile Simulator',
          'X-Device-Simulation': 'true'
        }
      });
    } catch (err) {
      setServerLogs(prev => [`❌ Erro na simulação local.`, ...prev.slice(0, 49)]);
    }
  };

  const fetchTurnstileUsers = async () => {
    const users = await getUsers();
    setTurnstileUsers(users);
  };

  useEffect(() => {
    if (isHardwareConnected) {
      fetchTurnstileUsers();
    }
  }, [isHardwareConnected]);

  const handleSyncAllFromContext = () => {
    syncAll(students);
  };

  const handleClearTurnstile = async () => {
    if (!confirm("AVISO: Isso irá apagar TODOS os usuários cadastrados NA MEMÓRIA DA CATRACA. Deseja continuar?")) return;
    
    setIsSyncing(true);
    addHardwareLog("Iniciando limpeza da memória da catraca...");
    
    try {
      const loginUrl = `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`;
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: hardwareConfig.user, password: hardwareConfig.password })
      });
      if (!loginRes.ok) throw new Error("Falha no login.");
      const { session } = await loginRes.json();

      const clearUrl = `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/destroy_objects.fcgi?session=${session}`;
      const clearRes = await fetch(clearUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          object: "users"
          // No 'where' means all objects of this type
        })
      });

      if (clearRes.ok) {
        addHardwareLog("Memória da catraca limpa com sucesso!");
        alert("Memória da catraca limpa com sucesso!");
      } else {
        throw new Error("A catraca recusou o comando de limpeza.");
      }
    } catch (err: any) {
      addHardwareLog(`Erro ao limpar catraca: ${err.message}`);
      alert(`Erro ao limpar catraca: ${err.message}`);
    } finally {
      setIsSyncing(false);
      fetchTurnstileUsers();
    }
  };

  const handleEnrollFace = async () => {
    if (!enrollStudent || !capturedImage) return;
    if (!isHardwareConnected) {
      alert("A catraca não está conectada. Verifique o cabo de rede ou o IP nas configurações.");
      return;
    }
    setEnrollStep('uploading');
    const userId = enrollStudent.registrationNumber || enrollStudent.id;
    const success = await enrollFace(userId.toString(), capturedImage);
    if (success) {
      alert("Face cadastrada com sucesso!");
      setShowEnrollModal(false);
      setCapturedImage(null);
      setEnrollStep('camera');
    } else {
      setEnrollStep('camera');
    }
  };

  const capturePhoto = () => {
    const activeVideo = showEnrollModal ? enrollVideoRef.current : videoRef.current;
    if (activeVideo) {
      const canvas = document.createElement('canvas');
      const videoWidth = activeVideo.videoWidth;
      const videoHeight = activeVideo.videoHeight;
      
      // Target aspect ratio 3:4 (portrait)
      const targetRatio = 3 / 4;
      let sourceWidth = videoWidth;
      let sourceHeight = videoHeight;
      let sourceX = 0;
      let sourceY = 0;

      if (videoWidth / videoHeight > targetRatio) {
        // Source is wider than target (landscape)
        sourceWidth = videoHeight * targetRatio;
        sourceX = (videoWidth - sourceWidth) / 2;
      } else {
        // Source is taller than target
        sourceHeight = videoWidth / targetRatio;
        sourceY = (videoHeight - sourceHeight) / 2;
      }

      canvas.width = 480; // Fixed width for consistency
      canvas.height = 640; // Fixed height (3:4)
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          activeVideo, 
          sourceX, sourceY, sourceWidth, sourceHeight, 
          0, 0, canvas.width, canvas.height
        );
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
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

          canvas.width = 480;
          canvas.height = 640;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
            setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    // Polling is now handled globally in HardwareContext.tsx
    if (isHardwareConnected) {
      fetchTurnstileUsers();
    }
  }, [isHardwareConnected]);

  const handleRFIDScan = async (tag: string) => {
    // Just dispatch the event, TurnstileMonitor will pick it up and show the result
    window.dispatchEvent(new CustomEvent('rfid-scan', { detail: tag }));
  };

  const startCamera = async () => {
    if (cameraActiveRef.current || stream) return true;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("MediaDevices API not supported");
      return false;
    }

    try {
      setCameraError(null);
      let mediaStream: MediaStream;
      
      try {
        // Try with user facing mode first (standard)
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' } 
        });
      } catch (e) {
        console.warn("Facing mode 'user' failed, trying generic video...", e);
        try {
          // Fallback to absolute generic
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e2) {
          console.warn("Generic video failed, seeking any valid device...", e2);
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          
          if (videoDevices.length > 0) {
            // Try to force the first one by ID
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: { exact: videoDevices[0].deviceId } } 
              });
            } catch (e3) {
              // Last resort: try just the deviceId without 'exact'
              mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: videoDevices[0].deviceId } 
              });
            }
          } else {
            throw new Error("Câmera física não encontrada no sistema.");
          }
        }
      }

      setStream(mediaStream);
      setCameraActive(true);
      cameraActiveRef.current = true;
      return true;
    } catch (err: any) {
      console.error("Critical camera error:", err);
      let errorMsg = "Erro ao acessar câmera.";
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = "Câmera não encontrada. Conecte uma webcam.";
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = "Acesso à câmera bloqueado no navegador.";
      } else {
        errorMsg = `Erro: ${err.message || 'Câmera indisponível'}`;
      }
      setCameraError(errorMsg);
      addHardwareLog(`⚠️ ${errorMsg}`);
      return false;
    }
  };

  const handleManualStartCamera = async () => {
    const success = await startCamera();
    if (!success) {
      // Instead of alert, we'll show a message in the logs or a specific UI state
      addHardwareLog("⚠️ Câmera bloqueada. Tente abrir o sistema em uma NOVA ABA ou verifique as permissões do navegador.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    cameraActiveRef.current = false;
  };

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError') console.error("Video play error:", err);
      });
    }
  }, [cameraActive, stream]);

  useEffect(() => {
    if (showEnrollModal && stream && enrollVideoRef.current) {
      if (enrollVideoRef.current.srcObject !== stream) {
        enrollVideoRef.current.srcObject = stream;
      }
      enrollVideoRef.current.play().catch(err => {
        if (err.name !== 'AbortError') console.error("Enroll video play error:", err);
      });
    }
  }, [showEnrollModal, stream, capturedImage]);

  useEffect(() => {
    if (showEnrollModal && !stream) {
      startCamera();
    }
  }, [showEnrollModal]);

  const handleScan = async (forceCamera = false) => {
    if (!selectedStudentId) {
      alert("Para simulação, selecione um aluno na lista abaixo primeiro.");
      return;
    }

    if (!cameraActiveRef.current && !forceCamera) {
      alert("Ative a câmera primeiro para realizar o escaneamento.");
      return;
    }

    setScanning(true);
    setScanResult(null);

    // Simulate recognition delay
    setTimeout(async () => {
      try {
        const student = students.find(s => s.id === selectedStudentId);
        
        if (!student) {
          setScanResult({ success: false, message: "Aluno não encontrado." });
          setScanning(false);
          return;
        }

        const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
        const studentExpirations = student.planExpirations || {};
        const currentPlans = plansRef.current;
        const studentPlans = currentPlans.filter(p => studentPlanIds.includes(p.id));

        // Check status
        if (student.status !== 'active') {
          setScanResult({ success: false, student, message: "Acesso negado: Aluno Inativo ou com mensalidade atrasada." });
          setScanning(false);
          return;
        }

        // Check hours
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        const todayStr = format(now, 'yyyy-MM-dd');
        
        // 1. Check Plan Expiration
        let hasActivePlan = false;
        let activePlan = null;

        for (const plan of studentPlans) {
          const expirationDate = studentExpirations[plan.id];
          if (expirationDate && expirationDate >= todayStr) {
            hasActivePlan = true;
            activePlan = plan;
            break;
          }
        }

        // Special case: Corporate plans might not have expiration in the same way or are always active
        const hasCorporatePlan = studentPlans.some(p => p.isCorporate);
        if (hasCorporatePlan) hasActivePlan = true;

        // 2. Check Class Hours (Modalidades)
        const daysMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const currentDay = daysMap[now.getDay()];
        
        const studentClasses = classes.filter(cls => 
          cls.studentIds?.includes(student.id) && 
          (cls.schedule?.[currentDay] || cls.daysOfWeek?.includes(currentDay))
        );

        let allowedByClass = false;
        let activeClass = null;

        for (const cls of studentClasses) {
          const daySchedule = cls.schedule?.[currentDay];
          const startTime = daySchedule?.startTime || cls.startTime || cls.time;
          const endTime = daySchedule?.endTime || cls.endTime || '23:59';
          const window = cls.entryWindowMinutes || 0;

          if (!startTime) continue;

          // Calculate entry start time (startTime - window)
          const [h, m] = startTime.split(':').map(Number);
          const startDate = new Date(now);
          startDate.setHours(h, m - window, 0, 0);
          const entryStartTime = format(startDate, 'HH:mm');

          if (currentTime >= entryStartTime && currentTime <= endTime) {
            allowedByClass = true;
            activeClass = cls;
            break;
          }
        }

        // Access Control Logic: Must have active plan AND be within allowed hours
        if (!hasActivePlan) {
          setScanResult({ 
            success: false, 
            student, 
            message: "Acesso negado: Plano vencido ou inexistente. Por favor, regularize sua situação na recepção." 
          });
          setScanning(false);
          return;
        }

        if (!allowedByClass && !hasCorporatePlan) {
          setScanResult({ 
            success: false, 
            student, 
            message: "Acesso negado: Fora do horário permitido para suas modalidades ou sem turmas vinculadas." 
          });
          setScanning(false);
          return;
        }

        // Success - Log access
        try {
          const lastLog = accessLogs.find(l => l.studentId === student.id);
          const type = lastLog?.type === 'entry' ? 'exit' : 'entry';
          
          await addDoc(collection(db, 'accessLogs'), {
            studentId: student.id,
            timestamp: serverTimestamp(),
            type: type,
            classId: (type === 'entry' && allowedByClass && activeClass) ? activeClass.id : null
          });

          // Record attendance if it's an entry for a specific class
          if (type === 'entry' && allowedByClass && activeClass) {
            const attendanceDate = format(now, 'yyyy-MM-dd');
            const attendanceId = `${student.id}_${activeClass.id}_${attendanceDate}`;
            await setDoc(doc(db, 'attendance', attendanceId), {
              classId: activeClass.id,
              studentId: student.id,
              date: attendanceDate,
              timestamp: serverTimestamp()
            });
          }

          let successMessage = type === 'entry' ? "Entrada autorizada! Bom treino." : "Saída registrada! Até logo.";
          if (allowedByClass && activeClass && type === 'entry') {
            successMessage = `Entrada liberada para a aula: ${activeClass.name}. Bom treino!`;
          } else if (hasCorporatePlan && type === 'entry') {
            const corpPlan = studentPlans.find(p => p.isCorporate);
            successMessage = `${corpPlan?.name || 'Acesso Corporativo'} Identificado! Aguarde confirmação do funcionário.`;
          }

          setScanResult({ 
            success: true, 
            student, 
            type,
            message: successMessage 
          });

          // If hardware is configured, send release command
          if (hardwareConfig.ip) {
            releaseTurnstile();
          }

          if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
          
          // Auto-clear scan result after displayDuration
          resultTimerRef.current = setTimeout(() => {
            setScanResult(null);
          }, displayDuration * 1000);

        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'accessLogs');
        }
      } catch (error) {
        console.error('Erro no escaneamento:', error);
        setScanResult({ success: false, message: "Erro ao processar escaneamento. Tente novamente." });
      } finally {
        setScanning(false);
      }
    }, 1500);
  };

  const handleSimulateCorporate = async () => {
    if (!selectedStudentId) {
      alert("Selecione um aluno primeiro.");
      return;
    }

    setScanning(true);
    try {
      // 1. Find or create a corporate plan
      const currentPlans = plansRef.current;
      let corporatePlan = currentPlans.find(p => p.isCorporate);
      if (!corporatePlan) {
        const docRef = await addDoc(collection(db, 'plans'), {
          name: 'Plano Corporativo (Auto)',
          price: 0,
          isCorporate: true,
          durationMonths: 12
        });
        corporatePlan = { id: docRef.id, name: 'Plano Corporativo (Auto)', isCorporate: true };
      }

      // 2. Assign to student if not already
      const student = students.find(s => s.id === selectedStudentId);
      if (student) {
        const currentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
        if (!currentPlanIds.includes(corporatePlan.id)) {
          const newPlanIds = [...currentPlanIds, corporatePlan.id];
          const newExpirations = { ...(student.planExpirations || {}), [corporatePlan.id]: '2099-12-31' };
          
          await updateDoc(doc(db, 'students', student.id), {
            planIds: newPlanIds,
            planExpirations: newExpirations,
            status: 'active'
          });
        }
      }

      // 3. Trigger scan
      if (!cameraActiveRef.current) await startCamera();
      
      // Wait a bit for camera to actually start if it was off
      setTimeout(() => handleScan(true), 1000);
    } catch (error) {
      console.error('Erro na simulação corporativa:', error);
      alert("Erro ao simular acesso corporativo. Verifique sua conexão.");
      setScanning(false);
    }
  };

  useEffect(() => {
    startCamera();
    
    // Check for auto-connect parameter
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('connect') === 'true' && !isHardwareConnected) {
      testNetworkConnection();
    }

    return () => {
      stopCamera();
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  const handleRelease = async () => {
    if (!window.confirm("Confirmar liberação manual da catraca física?")) return;
    setIsReleasing(true);
    addHardwareLog("[SISTEMA] Solicitando liberação manual...");
    const success = await releaseTurnstile();
    if (success) {
      addHardwareLog(`[SISTEMA] Comando enviado. Aguardando a catraca real (${settings?.registeredDeviceId || 'não configurada'}) pollar o servidor.`);
    }
    setTimeout(() => setIsReleasing(false), 2000);
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic flex items-center justify-center gap-4">
            <span className="px-3 py-1 bg-yellow-400 text-black rounded-xl text-xl not-italic tracking-normal">iD</span>
            CONTROLE iDFace
          </h2>
          <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest">
            Sincronização Ativa via Carrasco Fit Cloud
          </p>
        </div>

        {/* Seleção de Painel */}
        <div className="flex justify-center pt-2">
          <div className="inline-flex p-1.5 bg-neutral-950/80 border border-neutral-800 rounded-2xl shadow-xl shadow-black/40 backdrop-blur-md">
            <button 
              onClick={() => setActiveTab('local')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'local' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 border-b-2 border-blue-400" 
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/40"
              )}
            >
              <Cpu size={14} />
              Agente Local (Recomendado)
            </button>
            <button 
              onClick={() => setActiveTab('idcloud')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'idcloud' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 border-b-2 border-blue-400" 
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/40"
              )}
            >
              <ShieldCheck size={14} />
              iDCloud Nuvem (Legado)
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <button 
            onClick={() => syncAll(students)}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-blue-600 text-white hover:bg-blue-400 hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] transition-all text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-blue-500/20 disabled:opacity-50 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
          >
            <RefreshCw size={20} className={cn(isSyncing && "animate-spin")} />
            Sincronizar Alunos
          </button>

          <button 
            onClick={handleRelease}
            disabled={isReleasing}
            className={cn(
              "w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] transition-all text-[11px] font-black uppercase tracking-widest shadow-2xl disabled:opacity-50 border-b-4 active:border-b-0 active:translate-y-1",
              isReleasing 
                ? "bg-yellow-400 text-black border-yellow-600 shadow-yellow-400/20" 
                : "bg-green-600 text-white border-green-800 hover:bg-green-400 hover:shadow-[0_0_25px_rgba(22,163,74,0.6)] shadow-green-500/20"
            )}
          >
            {isReleasing ? <Loader2 size={20} className="animate-spin" /> : <Unlock size={20} />}
            {isReleasing ? 'Liberando...' : 'Liberar Agora'}
          </button>

          <a 
            href={`${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip || ''}:${hardwareConfig.port || '443'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-neutral-800 text-white hover:bg-neutral-700 transition-all text-[11px] font-black uppercase tracking-widest border-b-4 border-black active:border-b-0 active:translate-y-1"
          >
            <ExternalLink size={20} />
            Portal iDFace
          </a>

          <a 
            href="https://idsecure.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-white text-black hover:bg-neutral-100 transition-all text-[11px] font-black uppercase tracking-widest border-b-4 border-neutral-300 active:border-b-0 active:translate-y-1 shadow-xl shadow-white/10"
          >
            <ShieldCheck size={20} className="text-blue-600" />
            iDCloud Portal
          </a>

          <button 
            onClick={simulateHardwarePush}
            className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800 transition-all text-[11px] font-black uppercase tracking-widest border-b-4 border-indigo-950 active:border-b-0 active:translate-y-1 shadow-xl"
          >
            <Terminal size={20} />
            Simular Catraca
          </button>

          <button 
            onClick={clearQueue}
            className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[32px] bg-red-900/50 text-red-300 hover:bg-red-800 transition-all text-[11px] font-black uppercase tracking-widest border-b-4 border-red-950 active:border-b-0 active:translate-y-1 shadow-xl"
          >
            <Trash2 size={20} />
            Limpar Fila ({commandQueue.size})
          </button>
        </div>
      </header>

      {activeTab === 'local' ? (
        <ControlIdPanel />
      ) : (
        <>
          {/* Connection Status Section */}
          <div className="bg-black rounded-[40px] border border-neutral-800 overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500">
              <Wifi size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Monitor de Conexão</h3>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Status em tempo real da iDFace</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-4 mr-4">
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest ml-1">Domínio do Servidor (Cloud)</label>
                <input
                  type="text"
                  placeholder="Ex: carrasco-fit-...run.app"
                  className="w-64 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-xs text-white"
                  value={hardwareConfig.serverDomain || 'carrasco-fit-607856914066.us-east1.run.app'}
                  onChange={(e) => updateHardwareConfig('serverDomain', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest ml-1">IP Local da Catraca</label>
                <input
                  type="text"
                  placeholder="Ex: 192.168.1.101"
                  className="w-40 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono text-xs text-white"
                  value={hardwareConfig.ip}
                  onChange={(e) => updateHardwareConfig('ip', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest ml-1">Protocolo</label>
                <div className="flex gap-1 p-1 bg-neutral-900 rounded-xl border border-neutral-800">
                  <button 
                    onClick={() => updateHardwareConfig({ protocol: 'http', port: '80' })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase",
                      hardwareConfig.protocol === 'http' ? "bg-neutral-800 text-white" : "text-neutral-600"
                    )}
                  >
                    HTTP
                  </button>
                  <button 
                    onClick={() => updateHardwareConfig({ protocol: 'https', port: '443' })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase",
                      hardwareConfig.protocol === 'https' ? "bg-blue-600 text-white" : "text-neutral-600"
                    )}
                  >
                    HTTPS
                  </button>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest ml-1">Porta</label>
                <input
                  type="text"
                  placeholder="443"
                  className="w-20 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-xs text-white"
                  value={hardwareConfig.port}
                  onChange={(e) => updateHardwareConfig('port', e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={async () => {
                const result = await testNetworkConnection();
                if (result.success) {
                  alert("✅ " + result.message + "\n\n" + (result.details || ""));
                } else {
                  alert("⚠️ MONITOR: Nenhuma conexão detectada ainda.\n\n" + 
                        "CONFIGURAÇÃO CORRETA NA CATRACA (MENU iDCLOUD):\n" +
                        "1. Modo: Modo iDCloud Personalizado\n" +
                        `2. Servidor: ${IDFACE_DOMAIN}\n` +
                        "3. Porta: 443\n" +
                        `4. SSL: Ligado (Azul)\n\n` +
                        "IMPORTANTE: Não use o link 'ais-pre...' no visor da catraca. Use exatamente o domínio acima.");
                }
              }}
              className="flex items-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 font-black uppercase tracking-widest text-[11px]"
            >
              <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
              Verificar Conexão
            </button>
            <button 
              onClick={async () => {
                if (confirm("Isso irá marcar a catraca como ONLINE no banco manualmente para testes. Deseja continuar?")) {
                  const success = await forceStatusGreen();
                  if (success) alert("Conexão forçada com sucesso!");
                }
              }}
              className="flex items-center gap-2 px-6 py-4 bg-neutral-900 hover:bg-neutral-800 text-yellow-500 rounded-2xl border border-yellow-500/30 transition-all font-black uppercase tracking-widest text-[10px]"
            >
              <Terminal size={14} />
              Forçar Verde
            </button>
            
            <div className="flex items-center gap-2 px-6 py-3 bg-neutral-900 rounded-full border border-neutral-800">
              <div className={cn(
                "w-3 h-3 rounded-full animate-pulse",
                isHardwareConnected ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]" : "bg-neutral-700"
              )} />
              <span className={cn(isHardwareConnected ? "text-green-500" : "text-neutral-500")}>
                {isHardwareConnected ? 'iDFace Conectada' : 'Aguardando Dispositivo'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={downloadLogs}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-2xl transition-all"
                title="Exportar Logs"
              >
                <FileDown size={20} />
              </button>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-2xl transition-all"
                title="Configurações"
              >
                <SettingsIcon size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-8" id="hardware-config">
          {serverStatus?.serverUrl && (
            <div className="space-y-4 mb-6">
              {/* Card para Link/Diagnóstico */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Terminal className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-blue-400/60 font-black uppercase tracking-widest mb-0.5 text-left">URL de Diagnóstico (Link Hardware)</p>
                    <p className="text-xs font-mono text-blue-300 truncate text-left">
                      {window.location.origin}/api/diag/hardware/result
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/diag/hardware/result`;
                    navigator.clipboard.writeText(url);
                    addHardwareLog(`URL de Diagnóstico copiada!`);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider"
                >
                  {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copySuccess ? 'Copiado!' : 'Copiar URL de Link'}
                </button>
                
                <div className="p-2 bg-blue-500/5 rounded-lg border border-blue-500/10 italic text-[10px] text-blue-400/80">
                  Teste de Conectividade: Use esta URL no Postman (GET ou POST) para verificar se o servidor está respondendo corretamente.
                </div>
              </div>

              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl space-y-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                      <Terminal size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-blue-400/60 font-black uppercase tracking-widest mb-0.5">Endereço do Servidor iDFace (RECOMENDADO PARA iDCLOUD)</p>
                      <p className="text-xs font-mono text-blue-300 truncate">
                        {hardwareConfig.serverDomain || 'carrasco-fit-607856914066.us-east1.run.app'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const domain = hardwareConfig.serverDomain || 'carrasco-fit-607856914066.us-east1.run.app';
                      navigator.clipboard.writeText(domain);
                      addHardwareLog(`Domínio copiado: ${domain}`);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg text-nowrap",
                      copySuccess ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                    )}
                  >
                    {copySuccess ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                    {copySuccess ? 'Copiado!' : 'Copiar Link (Recomendado)'}
                  </button>
                </div>

                <div className="pt-4 border-t border-blue-500/10 space-y-3">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-2">
                    <AlertTriangle size={12} className="text-yellow-500" />
                    Como configurar na iDFace:
                  </p>
                  <ul className="text-[10px] text-neutral-500 space-y-1 ml-4 list-disc italic">
                    <li>Menu {'>'} Configurações {'>'} iDCloud</li>
                    <li>Modo do iDCloud: <span className="text-blue-400 font-bold">Modo iDCloud Personalizado</span></li>
                    <li>Endereço do Servidor: <span className="text-white font-bold italic tracking-tighter">{hardwareConfig.serverDomain || 'carrasco-fit-607856914066.us-east1.run.app'}</span> <span className="text-red-500 font-bold">(SEM HTTP / SEM HTTPS)</span></li>
                    <li className="text-green-500 font-bold uppercase text-[9px] animate-pulse">✓ Conexão Direta (Anti-302 Error)</li>
                    <li>Porta: <input 
                        type="text" 
                        value={hardwareConfig.port} 
                        onChange={(e) => updateHardwareConfig('port', e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-blue-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 w-16"
                      /></li>
                    <li>SSL: <span className={cn("font-bold", hardwareConfig.protocol === 'https' ? "text-blue-400" : "text-neutral-500")}>
                        {hardwareConfig.protocol === 'https' ? 'LIGADO (AZUL)' : 'DESLIGADO (CINZA)'}
                      </span></li>
                    <li className="pt-2 text-[9px] text-yellow-500/80">⚠️ Nota para o Mateus: Não use o link da barra de endereço do navegador. Use apenas o domínio acima para evitar o erro de redirecionamento.</li>
                    <li>IP da Catraca: <input 
                        type="text" 
                        value={hardwareConfig.ip} 
                        onChange={(e) => updateHardwareConfig('ip', e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-neutral-300 font-mono focus:outline-none focus:ring-1 focus:ring-yellow-400 w-32"
                      /></li>
                    <li>Gateway: <span className="text-neutral-400">{hardwareConfig.ip && hardwareConfig.ip.includes('.') ? (hardwareConfig.ip.split('.').slice(0, 3).join('.') + '.1') : '192.168.1.1'}</span></li>
                    <li>DNS: <span className="text-neutral-400">192.168.1.1 / 8.8.8.8</span></li>
                    <li className="pt-2">Menu {'>'} Configurações {'>'} Rede {'>'} Parâmetros de Rede</li>
                    <li>IP: <span className="text-white font-bold italic">{hardwareConfig.ip || '192.168.1.101'}</span></li>
                    <li>Máscara: <span className="text-white font-bold italic">255.255.255.0</span></li>
                    <li>Gateway: <span className="text-white font-bold italic">{hardwareConfig.ip && hardwareConfig.ip.includes('.') ? (hardwareConfig.ip.split('.').slice(0, 3).join('.') + '.1') : '192.168.1.1'}</span></li>
                    <li>DNS Primário: <span className="text-white font-bold italic">192.168.1.1</span></li>
                    <li>Porta: <span className={cn("font-bold", hardwareConfig.protocol === 'https' ? "text-blue-400" : "text-neutral-400")}>{hardwareConfig.port}</span></li>
                    <li>SSL: <span className={cn("font-bold", hardwareConfig.protocol === 'https' ? "text-blue-400" : "text-neutral-400")}>{hardwareConfig.protocol === 'https' ? 'Ligado (Azul)' : 'Desligado (Cinza)'}</span></li>
                  </ul>
                </div>
              </div>
              
              {serverStatus?.deviceId && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl mt-4">
                  <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Serial Number</p>
                    <p className="text-xs font-mono text-white">{serverStatus?.deviceId || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Firmware</p>
                    <p className="text-xs font-mono text-white">{serverStatus?.firmware || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">MAC Address</p>
                    <p className="text-xs font-mono text-white">{serverStatus?.mac || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">IP no Dispositivo</p>
                    <p className="text-xs font-mono text-white">{serverStatus?.ip || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Uso de RAM</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500" 
                          style={{ width: `${serverStatus?.ram || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-blue-400">{serverStatus?.ram || 0}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Uso de Disco</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500" 
                          style={{ width: `${serverStatus?.disk || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-yellow-400">{serverStatus?.disk || 0}%</span>
                    </div>
                  </div>
                  <div className="space-y-1 flex items-end">
                    <button 
                      onClick={() => {
                        // Request system info via command
                        fetch('/api/hardware/command', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            verb: "POST",
                            endpoint: "get_system_information",
                            body: {},
                            contentType: "application/json"
                          })
                        });
                        addHardwareLog("📡 Solicitando informações técnicas ao hardware...");
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-[9px] font-black uppercase tracking-widest text-neutral-400 rounded-lg border border-neutral-700 transition-all"
                    >
                      Atualizar Stats
                    </button>
                  </div>
                </div>
              )}

              {serverStatus?.deviceId && (
                <div className="flex items-center justify-between px-6 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <History size={14} className="text-neutral-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Último Ping:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-white">
                      {serverStatus.secondsAgo === null ? 'Nunca visto' : 
                       serverStatus.secondsAgo < 5 ? 'Agora mesmo' : 
                       `há ${serverStatus.secondsAgo}s`}
                    </span>
                    <div className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-[9px] font-bold text-neutral-400">
                      ID: {serverStatus.deviceId}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div 
            ref={logsContainerRef}
            className="bg-black/90 rounded-3xl border border-neutral-800 p-6 h-[180px] overflow-y-auto font-mono text-[11px] space-y-1 shadow-inner custom-scrollbar"
          >
            {serverLogs.length === 0 ? (
              <p className="text-neutral-700 italic flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Monitorando atividades...
              </p>
            ) : (
              serverLogs.map((log, i) => (
                <div key={i} className={cn(
                  "py-1 border-b border-white/5 last:border-0",
                  log.includes('RECEBIDO') ? "text-blue-400" : 
                  log.includes('ERRO') ? "text-red-400" : 
                  log.includes('LIBERACAO') || log.includes('Door') ? "text-green-400 font-bold" : "text-neutral-400"
                )}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Result View */}
        <div className="h-full min-h-[300px]">
          {scanResult ? (
            <div className={cn(
              "p-8 rounded-[40px] border-2 animate-in fade-in zoom-in duration-300 h-full flex flex-col justify-center",
              scanResult.success 
                ? (scanResult.message.includes('Corporativo') ? "bg-blue-950/20 border-blue-400/20" : "bg-green-950/20 border-green-400/20") 
                : "bg-red-950/20 border-red-400/20"
            )}>
              <div className="flex flex-col items-center text-center space-y-6">
                <div className={cn(
                  "p-5 rounded-full",
                  scanResult.success 
                    ? (scanResult.message.includes('Corporativo') ? "bg-blue-900 text-blue-400" : "bg-green-900 text-green-400") 
                    : "bg-red-900 text-red-400"
                )}>
                  {scanResult.success 
                    ? (scanResult.message.includes('Corporativo') ? <ShieldCheck size={56} /> : <CheckCircle2 size={56} />) 
                    : <XCircle size={56} />}
                </div>
                
                <div className="space-y-2">
                  <h3 className={cn(
                    "text-2xl font-black uppercase italic tracking-tighter",
                    scanResult.success ? (scanResult.message.includes('Corporativo') ? "text-blue-400" : "text-green-400") : "text-red-400"
                  )}>
                    {scanResult.success ? (scanResult.message.includes('Corporativo') ? 'Check-in Bio' : 'Acesso Liberado') : 'Acesso Negado'}
                  </h3>
                  <p className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest">{scanResult.message}</p>
                </div>

                {scanResult.student && (
                  <div className="bg-black/40 p-5 rounded-3xl border border-neutral-800 w-full flex items-center gap-4">
                    <img 
                      src={scanResult.student.photoUrl || `https://picsum.photos/seed/${scanResult.student.id}/64/64`} 
                      alt="" 
                      className="w-14 h-14 rounded-full border-2 border-neutral-800"
                    />
                    <div className="text-left">
                      <p className="font-black text-white uppercase text-sm tracking-tight">{(scanResult.student.name || '').toUpperCase()}</p>
                      <p className="text-[9px] text-yellow-500 font-black uppercase tracking-widest mt-0.5">
                        {scanResult.student.status === 'active' ? 'Matrícula Ativa' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-neutral-900/20 rounded-[40px] border-2 border-dashed border-neutral-800/50 text-neutral-600 space-y-4 h-full">
              <div className="relative">
                <ScanFace size={64} className="opacity-20 translate-y-2" />
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50 animate-scan rounded-full" />
              </div>
              <p className="text-center font-black uppercase text-[10px] tracking-widest opacity-40">Aguardando Escaneamento Facial</p>
            </div>
          )}
        </div>

        {/* Recent Accesses */}
        <div className="bg-black rounded-[40px] border border-neutral-800 overflow-hidden shadow-2xl flex flex-col h-full min-h-[300px]">
          <div className="p-8 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/40">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white flex items-center gap-3">
              <History className="text-yellow-400" size={24} />
              Últimos Acessos
            </h3>
          </div>
          <div className="divide-y divide-neutral-800 flex-1 overflow-y-auto max-h-[350px]">
            {accessLogs.length === 0 ? (
              <div className="p-12 text-center text-neutral-600 italic font-bold uppercase text-[10px] tracking-widest">
                Sem registros hoje
              </div>
            ) : (
              accessLogs.slice(0, 8).map(log => {
                const student = students.find(s => s.id === log.studentId);
                return (
                  <div key={log.id} className="p-6 flex items-center justify-between hover:bg-neutral-900/30 transition-colors group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                        log.type === 'entry' ? "bg-green-500 shadow-green-500/30" : "bg-neutral-600"
                      )} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-xs text-neutral-200 uppercase tracking-tight truncate group-hover:text-white transition-colors">
                          {(student?.name || 'Visitante').toUpperCase()}
                        </span>
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                          {log.type === 'entry' ? 'Entrada Autorizada' : 'Saída'}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-yellow-500/70 font-bold whitespace-nowrap ml-4">
                      {(() => {
                        try {
                          const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                          return format(date, "HH:mm:ss");
                        } catch (e) { return "--:--:--" }
                      })()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-black rounded-[40px] border border-neutral-800 overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-900/40">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Banco de Dados iDFace</h3>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Sincronização e cadastro de faces</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSyncAllFromContext}
              disabled={isSyncing}
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-400 hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-900/40 border border-blue-400/30"
            >
              <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
              Sincronizar Tudo
            </button>
            <button 
              onClick={handleClearTurnstile}
              disabled={isSyncing}
              className="p-4 bg-neutral-900 text-neutral-500 hover:text-red-500 border border-neutral-800 rounded-2xl transition-all"
              title="Limpar Memória"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="pb-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Aluno</th>
                  <th className="pb-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Matrícula</th>
                  <th className="pb-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Status Facial</th>
                  <th className="pb-6 text-right text-[10px] font-black text-neutral-500 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {students.filter(s => {
                  const userId = s.registrationNumber || s.id;
                  const isInTurnstile = turnstileUsers.some(u => u.id.toString() === userId.toString());
                  return s.status === 'active' || isInTurnstile;
                }).slice(0, 20).map(student => {
                  const userId = student.registrationNumber || student.id;
                  const turnstileUser = turnstileUsers.find(u => u.id.toString() === userId.toString());
                  const isInactive = student.status !== 'active';
                  
                  return (
                    <tr key={student.id} className={cn(
                      "group transition-colors",
                      isInactive ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-neutral-900/30"
                    )}>
                      <td className="py-5">
                        <div className="flex items-center gap-4">
                          <img 
                            src={student.photoUrl || `https://picsum.photos/seed/${student.id}/40/40`} 
                            alt="" 
                            className="w-10 h-10 rounded-full border border-neutral-800 shadow-inner"
                          />
                          <div>
                            <span className={cn("font-black text-sm block tracking-tight uppercase italic", isInactive ? "text-red-400" : "text-white")}>
                              {(student.name || '').toUpperCase()}
                            </span>
                            {isInactive && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-red-500/70">Plano Finalizado</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-5">
                        <span className="font-mono text-xs text-neutral-400 font-bold">{userId}</span>
                      </td>
                      <td className="py-5">
                        {turnstileUser ? (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                            isInactive ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
                          )}>
                            {isInactive ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                            {isInactive ? 'Remover Face' : 'Face Gravada'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-500 text-[9px] font-black uppercase tracking-widest">
                            <Clock size={10} />
                            Sem Face
                          </span>
                        )}
                      </td>
                      <td className="py-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {!isInactive && (
                            <button 
                              onClick={() => {
                                setEnrollStudent(student);
                                setShowEnrollModal(true);
                              }}
                              className="p-3 text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-xl transition-all border border-transparent hover:border-yellow-400/20"
                              title="Cadastrar Face"
                            >
                              <CameraIcon size={18} />
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              setSyncingStudentId(student.id);
                              await syncUser(student);
                              await fetchTurnstileUsers();
                              setSyncingStudentId(null);
                            }}
                            disabled={syncingStudentId === student.id}
                            className={cn(
                              "p-3 rounded-xl transition-all disabled:opacity-50 border border-transparent",
                              isInactive 
                                ? "text-red-400/80 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20" 
                                : "text-blue-400/80 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-400/20"
                            )}
                            title={isInactive ? "Remover da Catraca" : "Sincronizar"}
                          >
                            {isInactive ? (
                              <Trash2 size={18} className={cn(syncingStudentId === student.id && "animate-spin")} />
                            ) : (
                              <RefreshCw size={18} className={cn(syncingStudentId === student.id && "animate-spin")} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {students.filter(s => {
              const userId = s.registrationNumber || s.id;
              const isInTurnstile = turnstileUsers.some(u => u.id.toString() === userId.toString());
              return s.status === 'active' || isInTurnstile;
            }).length > 20 && (
              <p className="text-[10px] text-neutral-500 mt-4 text-center uppercase font-bold">Mostrando apenas os primeiros 20 registros que requerem atenção.</p>
            )}
          </div>
        </div>
      </div>
      
      </>
      )}
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>

      {/* Local Hardware Config Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-neutral-800 flex justify-between items-center bg-black">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-yellow-400">Rede Local</h2>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Configure o acesso IP da catraca</p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-neutral-900 rounded-xl transition-colors text-neutral-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">IP da Catraca (Rede Local)</label>
                  <input
                    type="text"
                    placeholder="Ex: 192.168.15.21"
                    className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                    value={hardwareConfig.ip}
                    onChange={(e) => updateHardwareConfig('ip', e.target.value)}
                  />
                  <p className="text-[9px] text-neutral-600 uppercase font-bold px-2 italic">Dica: Olhe o IP no visor da catraca iDFace.</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-yellow-400/10">
                  <label className="text-[10px] font-black text-yellow-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <ShieldCheck size={12} />
                    Serial Number Autorizado (Segurança)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: 0M0600/003E8F"
                      className="flex-1 px-6 py-4 bg-black border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-mono text-sm"
                      value={settings?.registeredDeviceId || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        updateDoc(doc(db, 'settings', 'global'), { registeredDeviceId: val });
                      }}
                    />
                    {serverStatus?.deviceId && serverStatus.deviceId !== settings?.registeredDeviceId && (
                      <button 
                        onClick={() => updateDoc(doc(db, 'settings', 'global'), { registeredDeviceId: serverStatus.deviceId })}
                        className="px-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-[9px] font-black uppercase tracking-widest text-blue-400 hover:bg-neutral-800 transition-all"
                      >
                        Sugestão
                      </button>
                    )}
                  </div>
                  <p className="text-[8px] text-neutral-600 uppercase font-bold px-2">
                    {settings?.registeredDeviceId 
                      ? "⚠️ Apenas este equipamento poderá enviar/receber dados." 
                      : "🔓 Aberto: Qualquer equipamento pode se conectar (Instável)."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Porta</label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                      value={hardwareConfig.port}
                      onChange={(e) => updateHardwareConfig('port', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Protocolo</label>
                    <select
                      className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold appearance-none"
                      value={hardwareConfig.protocol}
                      onChange={(e) => updateHardwareConfig('protocol', e.target.value)}
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Usuário do Dispositivo</label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                    value={hardwareConfig.user}
                    onChange={(e) => updateHardwareConfig('user', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Senha do Dispositivo</label>
                  <input
                    type="password"
                    className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                    value={hardwareConfig.password}
                    onChange={(e) => updateHardwareConfig('password', e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={() => {
                    testNetworkConnection();
                    setShowSettingsModal(false);
                  }}
                  className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20"
                >
                  <Wifi size={20} />
                  Testar e Salvar
                </button>
                <p className="text-[9px] text-neutral-600 text-center uppercase font-black tracking-widest">Configurações salvas automaticamente no navegador</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Face Enrollment Modal */}
      {showEnrollModal && enrollStudent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-neutral-800 flex justify-between items-center bg-black">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-yellow-400">Cadastro de Face</h2>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Aluno: {enrollStudent.name.toUpperCase()}</p>
              </div>
              <button 
                onClick={() => {
                  setShowEnrollModal(false);
                  setCapturedImage(null);
                }}
                className="p-2 hover:bg-neutral-900 rounded-xl transition-colors text-neutral-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {enrollStep === 'camera' ? (
                <div className="space-y-6">
                  <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-2xl overflow-hidden border-2 border-neutral-800 flex items-center justify-center">
                    {cameraError ? (
                      <div className="p-8 text-center space-y-4">
                        <AlertCircle className="text-red-500 mx-auto" size={48} />
                        <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest">{cameraError}</p>
                        <div className="space-y-2">
                          <button 
                            onClick={() => window.open(window.location.href, '_blank')}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                          >
                            <ExternalLink size={14} />
                            Abrir em Nova Aba
                          </button>
                          <button 
                            onClick={() => setEnrollStep('upload')}
                            className="w-full py-3 bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neutral-700 transition-all"
                          >
                            Usar Upload de Foto
                          </button>
                        </div>
                      </div>
                    ) : capturedImage ? (
                      <img src={capturedImage} alt="Capturada" className="w-full h-full object-cover" />
                    ) : (
                      <video 
                        ref={enrollVideoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {!capturedImage && !cameraError && (
                      <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none">
                        <div className="w-full h-full border-2 border-yellow-400/30 rounded-full relative" />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    {capturedImage ? (
                      <>
                        <button 
                          onClick={() => setCapturedImage(null)}
                          className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-neutral-800 transition-all"
                        >
                          Tirar Outra
                        </button>
                        <button 
                          onClick={handleEnrollFace}
                          className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 disabled:opacity-50"
                        >
                          Confirmar e Enviar
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex flex-col gap-3">
                        <button 
                          onClick={capturePhoto}
                          className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-neutral-200 transition-all flex items-center justify-center gap-3"
                        >
                          <CameraIcon size={20} />
                          Capturar Foto
                        </button>
                        
                        <div className="relative">
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 bg-neutral-900 text-neutral-400 rounded-2xl font-black uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-3 border border-neutral-800"
                          >
                            <UserPlus size={18} />
                            Enviar Foto do Arquivo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="animate-spin text-yellow-400" size={48} />
                  <p className="text-neutral-400 font-bold uppercase tracking-widest text-sm">Enviando face para a catraca...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
