import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGymData } from '../hooks/useGymData';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  UserPlus, 
  Mail, 
  Calendar, 
  CreditCard,
  Smartphone,
  Banknote,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Phone,
  Fingerprint,
  Activity,
  Loader2,
  History,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  AlertCircle,
  Camera,
  ScanFace,
  Eye,
  EyeOff,
  Cpu,
  Usb,
  RefreshCw,
  UserCircle,
  ExternalLink,
  Unlock,
  ShieldCheck,
  Users,
  Megaphone
} from 'lucide-react';
import { useHardware } from '../contexts/HardwareContext';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocFromServer, writeBatch, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

import { format, addDays, subDays, addMonths, differenceInDays, getDate, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const safeNumber = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const safeFormat = (dateStr: any, formatStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, formatStr);
  } catch (e) {
    return 'N/A';
  }
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  } else {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  }
};

const formatCEP = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
};

export default function Students() {
  const { students, plans, classes, payments, accessLogs, loading, settings, users } = useGymData();
  const { syncUser, enrollFace, isHardwareConnected, isSyncing, releaseTurnstile, hardwareConfig } = useHardware();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const [isEditExpirationModalOpen, setIsEditExpirationModalOpen] = useState(false);
  const [duplicateStudent, setDuplicateStudent] = useState<any>(null);
  const [selectedPlanForExpiration, setSelectedPlanForExpiration] = useState<any>(null);
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [chargeProportional, setChargeProportional] = useState(true);
  const [proportionalAmount, setProportionalAmount] = useState(0);

  useEffect(() => {
    if (profile?.displayName) {
      setPaymentData(prev => ({ ...prev, receivedBy: profile.displayName }));
    }
  }, [profile]);

  const [selectedStudentForFolder, setSelectedStudentForFolder] = useState<any>(null);
  const [folderTab, setFolderTab] = useState<'profile' | 'plans' | 'payments' | 'history' | 'catraca'>('profile');
  useEffect(() => {
    // Connection test removed to keep console clean
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastStudentsSent, setBroadcastStudentsSent] = useState<string[]>([]);
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([]);
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  const handleSelectAllBroadcast = () => {
    const matchingStudents = students.filter(s => s.phone && s.name.toLowerCase().includes(broadcastSearch.toLowerCase())).map(s => s.id);
    
    // If all currently matching students are selected, deselect them
    const allMatchingSelected = matchingStudents.every(id => selectedBroadcastIds.includes(id));
    
    if (allMatchingSelected && matchingStudents.length > 0) {
      setSelectedBroadcastIds(selectedBroadcastIds.filter(id => !matchingStudents.includes(id)));
    } else {
      // Select all currently matching students (keeping already selected ones that might not match search)
      const newSelected = Array.from(new Set([...selectedBroadcastIds, ...matchingStudents]));
      setSelectedBroadcastIds(newSelected);
    }
  };

  const handleToggleSelectBroadcast = (id: string) => {
    if (selectedBroadcastIds.includes(id)) {
      setSelectedBroadcastIds(selectedBroadcastIds.filter(i => i !== id));
    } else {
      setSelectedBroadcastIds([...selectedBroadcastIds, id]);
    }
  };

  const handleStartBulkSend = async () => {
    if (!broadcastMessage) {
      alert('Por favor, escreva uma mensagem antes de enviar.');
      return;
    }
    
    if (selectedBroadcastIds.length === 0) {
      alert('Selecione pelo menos um aluno.');
      return;
    }

    if (!confirm(`Isso abrirá ${selectedBroadcastIds.length} abas do WhatsApp. Certifique-se de que seu navegador permite Pop-ups. O WhatsApp pode banir seu número se você enviar mensagens em massa rapidamente. Deseja continuar?`)) {
      return;
    }

    setIsSendingBulk(true);
    const toSend = [...selectedBroadcastIds];
    
    for (let i = 0; i < toSend.length; i++) {
      const studentId = toSend[i];
      const student = students.find(s => s.id === studentId);
      if (student && student.phone) {
        const url = `https://wa.me/55${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(broadcastMessage)}`;
        window.open(url, '_blank');
        setBroadcastStudentsSent(prev => [...prev, studentId]);
        // Pequeno delay entre abas para não travar o navegador
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    setIsSendingBulk(false);
    alert('Processo concluído! Revise as abas abertas no seu WhatsApp Web.');
  };
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudent, setEnrollStudent] = useState<any>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollCapturedImage, setEnrollCapturedImage] = useState<string | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');

  // Keep streamRef in sync with stream state
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      // Stop any existing stream before starting a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedVideoDeviceId 
          ? { deviceId: selectedVideoDeviceId, aspectRatio: 3/4 }
          : { facingMode: 'user', aspectRatio: 3/4 }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraOpen(true);
      setCameraError(null);
    } catch (err: any) {
      console.warn("Primary camera attempt failed, starting deep fallback...", err);
      try {
        // Fallback 1: Any standard video
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
        setIsCameraOpen(true);
        setCameraError(null);
      } catch (fallbackErr) {
        try {
          // Fallback 2: Deep scan devices and force connection
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          if (videoDevices.length > 0) {
            let enumStream;
            try {
              enumStream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: { exact: videoDevices[0].deviceId } } 
              });
            } catch (e3) {
              enumStream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: videoDevices[0].deviceId } 
              });
            }
            setStream(enumStream);
            setIsCameraOpen(true);
            setCameraError(null);
          } else {
            throw new Error("Câmera não detectada no sistema.");
          }
        } catch (finalErr: any) {
          console.error("Critical camera failure:", finalErr);
          setCameraError(`Erro: ${finalErr.message || "Câmera indisponível"}`);
        }
      }
    }
  }, [selectedVideoDeviceId]);

  const refreshVideoDevices = async () => {
    setIsRefreshingDevices(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        alert("Seu navegador não suporta busca de dispositivos de vídeo ou está em uma conexão não segura (HTTP).");
        return;
      }

      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      // If no devices found OR labels are empty, we MUST request permission to see/access them
      if (videoInputs.length === 0 || !videoInputs[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          devices = await navigator.mediaDevices.enumerateDevices();
          videoInputs = devices.filter(device => device.kind === 'videoinput');
          // Stop the temp stream immediately
          tempStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.warn("Permission denied or no camera found", e);
          if (videoInputs.length === 0) {
            alert("Nenhuma câmera detectada. Verifique se ela está conectada e se você deu permissão no navegador.");
          }
        }
      }
      
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0) {
        if (!selectedVideoDeviceId || !videoInputs.find(d => d.deviceId === selectedVideoDeviceId)) {
          setSelectedVideoDeviceId(videoInputs[0].deviceId);
        }
        // If we are already in the camera view, we don't need an alert, 
        // but if we just searched from outside, it's good to know.
        if (!isCameraOpen) {
          alert(`${videoInputs.length} ${videoInputs.length === 1 ? 'câmera encontrada' : 'câmeras encontradas'}!`);
        }
      } else {
        alert("Nenhuma câmera encontrada. Tente reconectar o USB e clique em procurar novamente.");
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
      alert("Erro ao procurar câmeras. Verifique as configurações do seu navegador.");
    } finally {
      setIsRefreshingDevices(false);
    }
  };

  useEffect(() => {
    if (isCameraOpen) {
      refreshVideoDevices();
    }
  }, [isCameraOpen]);

  useEffect(() => {
    if (isCameraOpen && selectedVideoDeviceId) {
      // Check if the current stream is actually from the selected device
      const currentStreamDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId;
      
      // If we have a stream but it's from the wrong device, OR if we don't have a stream yet
      if (!stream || (currentStreamDeviceId && currentStreamDeviceId !== selectedVideoDeviceId)) {
        startCamera();
      }
    }
  }, [selectedVideoDeviceId, isCameraOpen, startCamera, stream]);

  useEffect(() => {
    if (isModalOpen) {
      refreshVideoDevices();
    } else {
      stopCamera();
    }
  }, [isModalOpen]);

  const [isQuickClassModalOpen, setIsQuickClassModalOpen] = useState(false);
  const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'plan' | 'class' | 'payment' | 'student' | 'removePlanFromPayment' | 'resetPlanExpiration', id: string, extraId?: string } | null>(null);
  const [securityPassword, setSecurityPassword] = useState('');

  useEffect(() => {
    if (selectedStudentForFolder) {
      const updatedStudent = students.find(s => s.id === selectedStudentForFolder.id);
      if (updatedStudent) {
        setSelectedStudentForFolder(updatedStudent);
      }
    }
  }, [students]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDocFromServer(doc(db, 'settings', 'global'));
        if (docSnap.exists()) {
          setSecurityPassword(docSnap.data().securityPassword || '');
        }
      } catch (error) {
        console.error('Error fetching security password:', error);
      }
    };
    fetchSettings();
  }, []);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  useEffect(() => {
    if (isModalOpen && !editingStudent && profile && (profile.role === 'employee' || profile.role === 'admin')) {
      const personalId = (profile as any).id || profile.uid || '';
      setFormData(prev => ({ ...prev, personalId }));
    }
  }, [isModalOpen, editingStudent, profile]);
  const [isSaving, setIsSaving] = useState(false);
  const [folderPlanSearch, setFolderPlanSearch] = useState('');
  const [folderClassSearch, setFolderClassSearch] = useState('');
  
  // Quick Class form state
  const [quickClassData, setQuickClassData] = useState({
    name: '',
    modality: '',
    instructor: '',
    schedule: {} as any,
    studentIds: [] as string[]
  });
  
  // Quick Plan form state
  const [quickPlanData, setQuickPlanData] = useState({
    name: '',
    price: 0,
    durationDays: 30,
    durationMonths: 0
  });
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    birthDate: '',
    planIds: [] as string[],
    planExpirations: {} as { [key: string]: string },
    status: 'active',
    nextPaymentDate: format(new Date(), 'yyyy-MM-dd'),
    photoUrl: '',
    classIds: [] as string[],
    rfid: '',
    registrationNumber: '',
    personalId: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: ''
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    discount: 0,
    method: 'pix',
    selectedPlans: [] as { planId: string, discount: number }[],
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    receivedBy: profile?.displayName || ''
  });

  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [editPaymentFormData, setEditPaymentFormData] = useState({
    amount: 0,
    method: 'pix',
    description: '',
    date: '',
    time: '',
    receivedBy: profile?.displayName || ''
  });

  useEffect(() => {
    if (selectedPlanForExpiration && newExpirationDate && selectedStudentForFolder) {
      const plan = plans.find(p => p.id === selectedPlanForExpiration.id);
      if (plan) {
        const oldDateStr = selectedStudentForFolder.planExpirations?.[plan.id];
        if (oldDateStr) {
          const oldDate = new Date(oldDateStr);
          const newDate = new Date(newExpirationDate);
          const diff = differenceInDays(newDate, oldDate);
          
          if (diff > 0) {
            const dailyRate = plan.price / (plan.durationMonths ? plan.durationMonths * 30 : plan.durationDays || 30);
            setProportionalAmount(Math.round(diff * dailyRate * 100) / 100);
          } else {
            setProportionalAmount(0);
          }
        }
      }
    }
  }, [newExpirationDate, selectedPlanForExpiration, selectedStudentForFolder, plans]);

  const handleUpdateExpiration = async () => {
    if (!selectedStudentForFolder || !selectedPlanForExpiration || !newExpirationDate) return;
    
    setIsSaving(true);
    try {
      const newExpirations = { ...selectedStudentForFolder.planExpirations };
      newExpirations[selectedPlanForExpiration.id] = newExpirationDate;
      
      const updateData: any = {
        planExpirations: newExpirations
      };
      
      // Re-calculate nextPaymentDate based on all recurring plans
      let earliestNextTime: number | null = null;
      Object.entries(newExpirations).forEach(([planId, expDateStr]) => {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
          const isRecurring = plan.durationMonths ? plan.durationMonths >= 1 : (plan.durationDays || 30) >= 28;
          if (isRecurring) {
            const expTime = new Date(expDateStr as string).getTime();
            if (!earliestNextTime || expTime < earliestNextTime) {
              earliestNextTime = expTime;
            }
          }
        }
      });

      if (earliestNextTime) {
        updateData.nextPaymentDate = format(new Date(earliestNextTime), 'yyyy-MM-dd');
      }
      
      await updateDoc(doc(db, 'students', selectedStudentForFolder.id), updateData);
      
      if (chargeProportional && proportionalAmount > 0) {
        const paymentRef = collection(db, 'payments');
        await addDoc(paymentRef, {
          studentId: selectedStudentForFolder.id,
          studentName: selectedStudentForFolder.name,
          amount: proportionalAmount,
          method: 'pix',
          description: `Ajuste proporcional: ${selectedPlanForExpiration.name} até ${format(new Date(newExpirationDate), 'dd/MM/yyyy')}`,
          date: new Date().toISOString(),
          status: 'paid',
          createdAt: serverTimestamp(),
          receivedBy: profile?.displayName || ''
        });
      }
      
      setIsEditExpirationModalOpen(false);
      alert('Vencimento atualizado com sucesso!');

      // Sincronização automática com a catraca
      try {
        const updatedStudent = {
          ...selectedStudentForFolder,
          ...updateData,
          planExpirations: newExpirations
        };
        syncUser(updatedStudent).catch(err => console.error('Erro na sincronização automática:', err));
      } catch (e) {}
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  const isStudentActive = (student: any) => {
    const expirations = student.planExpirations || {};
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
    
    if (studentPlanIds.length === 0) {
      if (!student.nextPaymentDate) return student.status === 'active';
      const nextPay = new Date(student.nextPaymentDate);
      nextPay.setHours(0, 0, 0, 0);
      return nextPay >= now;
    }
    
    return studentPlanIds.some(pid => {
      const exp = expirations[pid];
      if (!exp) return true;
      const expDate = new Date(exp);
      expDate.setHours(0, 0, 0, 0);
      return expDate >= now;
    });
  };

  const filteredStudents = (students || []).filter(s => 
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.registrationNumber && String(s.registrationNumber).includes(searchTerm))
  );

  useEffect(() => {
    console.log(`[Students] Total: ${students.length}, Filtrados: ${filteredStudents.length}`);
  }, [students.length, filteredStudents.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('A imagem é muito grande. Máximo 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (isCameraOpen && videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.error("Video play error:", err);
        }
      });
    }
  }, [isCameraOpen, stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas to 3:4 aspect ratio
      const targetWidth = 480;
      const targetHeight = 640;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        // Calculate cropping to maintain 3:4 from the center
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const videoAspect = videoWidth / videoHeight;
        const targetAspect = targetWidth / targetHeight;
        
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = videoWidth;
        let sourceHeight = videoHeight;
        
        if (videoAspect > targetAspect) {
          sourceWidth = videoHeight * targetAspect;
          sourceX = (videoWidth - sourceWidth) / 2;
        } else {
          sourceHeight = videoWidth / targetAspect;
          sourceY = (videoHeight - sourceHeight) / 2;
        }
        
        context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        
        if (showEnrollModal) {
          setEnrollCapturedImage(photoData);
        } else {
          setFormData({ ...formData, photoUrl: photoData });
          stopCamera();
        }
      }
    }
  };

  const handleEnrollFace = async () => {
    if (!enrollStudent || !enrollCapturedImage) return;
    
    setIsEnrolling(true);
    try {
      const success = await enrollFace(enrollStudent.id, enrollCapturedImage);
      if (success) {
        alert("Face cadastrada com sucesso na catraca!");
        setShowEnrollModal(false);
        setEnrollCapturedImage(null);
      } else {
        alert("Erro ao enviar face para a catraca.");
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("Houve um erro no processo de cadastro.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const toggleClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      classIds: prev.classIds.includes(classId)
        ? prev.classIds.filter(id => id !== classId)
        : [...prev.classIds, classId]
    }));
  };

  const togglePlan = (planId: string) => {
    setFormData(prev => {
      const isEnrolled = prev.planIds.includes(planId);
      const newPlanIds = isEnrolled
        ? prev.planIds.filter(id => id !== planId)
        : [...prev.planIds, planId];
      
      const newExpirations = { ...prev.planExpirations };
      if (isEnrolled) {
        delete newExpirations[planId];
      } else {
        const selectedPlan = plans.find(p => p.id === planId);
        if (selectedPlan) {
          if (selectedPlan.isCorporate) {
            newExpirations[planId] = '2099-12-31';
          } else {
            newExpirations[planId] = format(subDays(new Date(), 1), 'yyyy-MM-dd');
          }
        }
      }

      // Sincronizar com dados de pagamento se "Registrar Agora" estiver ativo
      if (paymentData.amount > 0 || paymentData.selectedPlans.length > 0) {
        const newSelectedPlans = newPlanIds.map(pid => ({
          planId: pid,
          discount: 0
        }));
        const total = newSelectedPlans.reduce((acc, sp) => {
          const plan = plans.find(p => p.id === sp.planId);
          return acc + (plan?.price || 0);
        }, 0);
        setPaymentData(prevPay => ({
          ...prevPay,
          amount: total,
          selectedPlans: newSelectedPlans
        }));
      }
      
      let latestNextDate = null;
      Object.values(newExpirations).forEach((exp: any) => {
        if (!latestNextDate || exp > latestNextDate) {
          latestNextDate = exp;
        }
      });
      
      return {
        ...prev,
        planIds: newPlanIds,
        planExpirations: newExpirations,
        nextPaymentDate: latestNextDate
      };
    });
  };

  const handleQuickClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClassData.name && !quickClassData.modality) return;

    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'classes'), {
        ...quickClassData,
        name: quickClassData.name || quickClassData.modality,
        createdAt: serverTimestamp()
      });
      
      // Automatically select the new class for the student
      setFormData(prev => ({
        ...prev,
        classIds: [...prev.classIds, docRef.id]
      }));
      
      setIsQuickClassModalOpen(false);
      setQuickClassData({
        name: '',
        modality: '',
        instructor: '',
        schedule: {},
        studentIds: []
      });
    } catch (error: any) {
      console.error("Error adding quick class:", error);
      alert("Erro ao criar turma rápida: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPlanData.name) return;

    setIsSaving(true);
    try {
      const dataToSave = {
        name: quickPlanData.name,
        price: quickPlanData.price,
        durationDays: quickPlanData.durationMonths > 0 ? null : quickPlanData.durationDays,
        durationMonths: quickPlanData.durationMonths > 0 ? quickPlanData.durationMonths : null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'plans'), dataToSave);
      
      // Automatically select the new plan for the student
      setFormData(prev => ({
        ...prev,
        planIds: [...prev.planIds, docRef.id]
      }));
      
      setIsQuickPlanModalOpen(false);
      setQuickPlanData({
        name: '',
        price: 0,
        durationDays: 30,
        durationMonths: 0
      });
    } catch (error: any) {
      console.error("Error adding quick plan:", error);
      alert("Erro ao criar plano rápido: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicate name
    const duplicateName = students.find(s => 
      s.name.toLowerCase() === formData.name.toLowerCase() && 
      s.id !== editingStudent?.id
    );

    if (duplicateName) {
      alert(`Já existe um aluno cadastrado com o nome "${formData.name}". Por favor, use um nome diferente ou adicione um sobrenome.`);
      return;
    }

    // Check for duplicate CPF
    if (formData.cpf) {
      const cleanCpf = formData.cpf.replace(/\D/g, '');
      if (cleanCpf) {
        const duplicateCpf = students.find(s => {
          if (!s.cpf) return false;
          const sCleanCpf = s.cpf.replace(/\D/g, '');
          return sCleanCpf === cleanCpf && s.id !== editingStudent?.id;
        });

        if (duplicateCpf) {
          setDuplicateStudent(duplicateCpf);
          return;
        }
      }
    }

    setIsSaving(true);
    
    // Create a timeout promise - increased to 60s
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 60000)
    );

    try {
      const batch = writeBatch(db);
      let studentId = editingStudent?.id;
      const { classIds, planIds, planExpirations, rfid, registrationNumber, ...studentData } = formData;

      // Limpar campos opcionais se vazios e garantir migração do planId
      let finalExpirations = { ...planExpirations };
      let finalNextPaymentDate = formData.nextPaymentDate;
      let finalStatus = formData.status;
      let finalRegistrationNumber = registrationNumber ? Number(registrationNumber) : null;
      if (finalRegistrationNumber !== null && isNaN(finalRegistrationNumber)) {
        finalRegistrationNumber = null;
      }

      // Se for novo aluno e estiver registrando pagamento, calcular expirações reais
      if (!editingStudent && paymentData.amount > 0) {
        finalStatus = 'active';
        paymentData.selectedPlans.forEach(sp => {
          const plan = plans.find(p => p.id === sp.planId);
          if (plan) {
            const expDate = plan.isCorporate 
              ? '2099-12-31'
              : (plan.durationMonths 
                ? format(addMonths(new Date(), plan.durationMonths), 'yyyy-MM-dd')
                : format(addDays(new Date(), plan.durationDays || 30), 'yyyy-MM-dd'));
            finalExpirations[sp.planId] = expDate;
            if (!plan.isCorporate && (!finalNextPaymentDate || expDate > finalNextPaymentDate)) {
              finalNextPaymentDate = expDate;
            }
          }
        });
      }

      const cleanedData: any = { 
        ...studentData, 
        planIds, 
        planExpirations: finalExpirations, 
        nextPaymentDate: finalNextPaymentDate,
        status: finalStatus,
        rfid: rfid || null,
        registrationNumber: finalRegistrationNumber,
        planId: null 
      };
      if (!cleanedData.email) delete cleanedData.email;
      if (!cleanedData.cpf) delete cleanedData.cpf;
      if (!cleanedData.photoUrl) delete cleanedData.photoUrl;

      let regNumber: number | null = null;
      if (editingStudent) {
        const studentRef = doc(db, 'students', editingStudent.id);
        batch.update(studentRef, cleanedData);
        regNumber = cleanedData.registrationNumber;
      } else {
        const studentRef = doc(collection(db, 'students'));
        studentId = studentRef.id;
        
        // Use provided registration number or find the highest one to assign the next one
        regNumber = finalRegistrationNumber;
        if (!regNumber) {
          const maxRegNumber = students.reduce((max, s) => {
            const reg = safeNumber(s.registrationNumber);
            return Math.max(max, reg);
          }, 0);
          regNumber = maxRegNumber + 1;
        }
        
        batch.set(studentRef, {
          ...cleanedData,
          registrationNumber: regNumber,
          createdAt: serverTimestamp()
        });
      }

      // Update classes enrollment in the same batch
      for (const cls of classes) {
        const isEnrolled = classIds.includes(cls.id);
        const currentStudentIds = cls.studentIds || [];
        const hasStudent = currentStudentIds.includes(studentId);

        if (isEnrolled && !hasStudent) {
          const classRef = doc(db, 'classes', cls.id);
          batch.update(classRef, {
            studentIds: [...currentStudentIds, studentId]
          });
        } else if (!isEnrolled && hasStudent) {
          const classRef = doc(db, 'classes', cls.id);
          batch.update(classRef, {
            studentIds: currentStudentIds.filter((id: string) => id !== studentId)
          });
        }
      }

      try {
        await Promise.race([batch.commit(), timeoutPromise]);
        
        // Sincronização automática com a catraca após sucesso no Firestore
        if (studentId) {
          const finalStudent = { 
            id: studentId, 
            ...cleanedData,
            planExpirations: finalExpirations,
            registrationNumber: regNumber || finalRegistrationNumber
          };
          syncUser(finalStudent).catch(err => console.error('Erro na sincronização automática:', err));
        }
      } catch (error: any) {
        if (error.message === 'TIMEOUT_ERROR') {
          // Heuristic check: see if student exists in local state
          await new Promise(resolve => setTimeout(resolve, 2000));
          const savedStudent = students.find(s => s.name === formData.name);
          if (savedStudent) {
            console.log('Aluno encontrado no estado local após timeout, assumindo sucesso.');
          } else {
            throw new Error('Timeout: A operação está demorando mais que o esperado (60s). Verifique se o aluno já aparece na lista. Se não aparecer, tente novamente.');
          }
        } else {
          throw error;
        }
      }

      if (!editingStudent && paymentData.amount > 0) {
        const paymentRef = collection(db, 'payments');
        const totalBaseAmount = paymentData.selectedPlans.reduce((acc, sp) => {
          const plan = plans.find(p => p.id === sp.planId);
          return acc + (plan?.price || 0);
        }, 0);
        
        const totalDiscount = paymentData.selectedPlans.reduce((acc, sp) => acc + (sp.discount || 0), 0);
        const finalAmount = totalBaseAmount - totalDiscount;

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const paymentDate = new Date(`${todayStr}T${format(new Date(), 'HH:mm')}:00`);
        
        await addDoc(paymentRef, {
          studentId: studentId,
          studentName: formData.name,
          amount: finalAmount > 0 ? finalAmount : Number(paymentData.amount) - Number(paymentData.discount || 0),
          originalAmount: totalBaseAmount > 0 ? totalBaseAmount : Number(paymentData.amount),
          discount: totalDiscount > 0 ? totalDiscount : Number(paymentData.discount || 0),
          method: paymentData.method,
          selectedPlans: paymentData.selectedPlans.length > 0 ? paymentData.selectedPlans.map(sp => ({
            planId: sp.planId,
            planName: plans.find(p => p.id === sp.planId)?.name || 'Plano',
            discount: sp.discount,
            price: plans.find(p => p.id === sp.planId)?.price || 0,
            startDate: todayStr,
            endDate: finalExpirations[sp.planId]
          })) : [],
          description: 'Pagamento inicial na matrícula',
          date: paymentDate.toISOString(),
          time: format(new Date(), 'HH:mm'),
          receivedBy: paymentData.receivedBy,
          status: 'paid',
          createdAt: serverTimestamp()
        });
      }

      // Trigger Webhook if configured
      const personal = users.find(u => u.id === formData.personalId);
      const targetWebhookUrl = personal?.webhookUrl || settings?.webhookUrl;

      if (targetWebhookUrl) {
        try {
          const webhookData = {
            nome: formData.name,
            cpf: formData.cpf,
            data_nascimento: formData.birthDate,
            celular: formData.phone,
            personal_nome: personal?.displayName || 'N/A',
            event: editingStudent ? 'student_updated' : 'student_registered',
            timestamp: new Date().toISOString()
          };

          fetch(targetWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookData),
            mode: 'no-cors'
          }).catch(err => console.error('Webhook error:', err));
        } catch (webhookErr) {
          console.error('Error triggering webhook:', webhookErr);
        }
      }

      // Sincronização automática com a catraca
      try {
        const finalStudentData = {
          id: editingStudent ? editingStudent.id : studentId,
          ...formData,
          status: formData.status,
          planExpirations: finalExpirations,
          nextPaymentDate: finalNextPaymentDate
        };
        syncUser(finalStudentData).catch(err => console.error('Erro na sincronização automática:', err));
      } catch (e) {}

      setIsModalOpen(false);
      setEditingStudent(null);
      setPaymentData({
        amount: 0,
        discount: 0,
        method: 'pix',
        selectedPlans: [],
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        receivedBy: profile?.displayName || ''
      });
      setFormData({ 
        name: '', 
        email: '', 
        phone: '',
        cpf: '',
        birthDate: '',
        planIds: [] as string[], 
        planExpirations: {} as { [key: string]: string },
        status: 'active', 
        nextPaymentDate: format(new Date(), 'yyyy-MM-dd'), 
        photoUrl: '',
        classIds: [] as string[],
        rfid: '',
        registrationNumber: '',
        personalId: '',
        addressZip: '',
        addressStreet: '',
        addressNumber: '',
        addressComplement: '',
        addressNeighborhood: '',
        addressCity: '',
        addressState: ''
      });
    } catch (error: any) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingAction({ type: 'student', id });
    setIsPasswordModalOpen(true);
  };

  const handleEdit = (student: any) => {
    setSearchTerm('');
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      cpf: student.cpf || '',
      birthDate: student.birthDate || '',
      planIds: student.planIds || (student.planId ? [student.planId] : []),
      planExpirations: student.planExpirations || {},
      status: student.status,
      nextPaymentDate: student.nextPaymentDate || format(new Date(), 'yyyy-MM-dd'),
      photoUrl: student.photoUrl || '',
      classIds: classes.filter(c => c.studentIds?.includes(student.id)).map(c => c.id),
      rfid: student.rfid || '',
      registrationNumber: student.registrationNumber || '',
      personalId: student.personalId || '',
      addressZip: student.addressZip || '',
      addressStreet: student.addressStreet || '',
      addressNumber: student.addressNumber || '',
      addressComplement: student.addressComplement || '',
      addressNeighborhood: student.addressNeighborhood || '',
      addressCity: student.addressCity || '',
      addressState: student.addressState || ''
    });
    setIsModalOpen(true);
  };

  const [isEditingProfileInFolder, setIsEditingProfileInFolder] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [folderProfileData, setFolderProfileData] = useState<any>(null);

  const handleSaveProfileInFolder = async () => {
    if (!selectedStudentForFolder || !folderProfileData) return;
    setFolderError('');
    
    // Check for duplicate CPF
    if (folderProfileData.cpf) {
      const cleanCpf = folderProfileData.cpf.replace(/\D/g, '');
      if (cleanCpf) {
        const duplicateCpf = students.find(s => {
          if (!s.cpf) return false;
          const sCleanCpf = s.cpf.replace(/\D/g, '');
          return sCleanCpf === cleanCpf && s.id !== selectedStudentForFolder.id;
        });

        if (duplicateCpf) {
          setFolderError(`O CPF "${folderProfileData.cpf}" já está cadastrado para o aluno "${duplicateCpf.name}".`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'students', selectedStudentForFolder.id), {
        name: folderProfileData.name,
        email: folderProfileData.email,
        phone: folderProfileData.phone,
        cpf: folderProfileData.cpf,
        birthDate: folderProfileData.birthDate,
        status: folderProfileData.status,
        nextPaymentDate: folderProfileData.nextPaymentDate,
        rfid: folderProfileData.rfid || null,
        registrationNumber: folderProfileData.registrationNumber ? safeNumber(folderProfileData.registrationNumber) : null,
        addressZip: folderProfileData.addressZip || '',
        addressStreet: folderProfileData.addressStreet || '',
        addressNumber: folderProfileData.addressNumber || '',
        addressComplement: folderProfileData.addressComplement || '',
        addressNeighborhood: folderProfileData.addressNeighborhood || '',
        addressCity: folderProfileData.addressCity || '',
        addressState: folderProfileData.addressState || ''
      });
      
      setSelectedStudentForFolder({
        ...selectedStudentForFolder,
        ...folderProfileData
      });
      setIsEditingProfileInFolder(false);
      alert('Perfil atualizado com sucesso!');

      // Sincronização automática com a catraca
      try {
        const updatedStudent = {
          ...selectedStudentForFolder,
          ...folderProfileData
        };
        syncUser(updatedStudent).catch(err => console.error('Erro na sincronização automática:', err));
      } catch (e) {}
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFolder = (student: any) => {
    setSearchTerm('');
    setSelectedStudentForFolder(student);
    setFolderProfileData({
      name: student.name,
      email: student.email || '',
      phone: student.phone || '',
      cpf: student.cpf || '',
      birthDate: student.birthDate || '',
      status: student.status,
      nextPaymentDate: student.nextPaymentDate || '',
      rfid: student.rfid || '',
      registrationNumber: student.registrationNumber || '',
      addressZip: student.addressZip || '',
      addressStreet: student.addressStreet || '',
      addressNumber: student.addressNumber || '',
      addressComplement: student.addressComplement || '',
      addressNeighborhood: student.addressNeighborhood || '',
      addressCity: student.addressCity || '',
      addressState: student.addressState || ''
    });
    setFolderTab('profile');
    setIsEditingProfileInFolder(false);
    setFolderError('');
  };

  const handlePlanClick = (student: any, planId: string) => {
    setSearchTerm('');
    handleOpenFolder(student);
    setFolderTab('payments');
    setPaymentData({
      ...paymentData,
      selectedPlans: [{ planId, discount: 0 }],
      date: format(new Date(), 'yyyy-MM-dd')
    });
  };

   const handleConfirmAction = () => {
    if (passwordInput === securityPassword || !securityPassword) {
      if (pendingAction) {
        if (pendingAction.type === 'plan') {
          handleTogglePlanInFolder(pendingAction.id, true);
        } else if (pendingAction.type === 'class') {
          handleToggleClassInFolder(pendingAction.id, true);
        } else if (pendingAction.type === 'payment') {
          executeDeletePayment(pendingAction.id);
        } else if (pendingAction.type === 'resetPlanExpiration') {
          executeResetPlanExpiration(pendingAction.id);
        } else if (pendingAction.type === 'student') {
          executeDeleteStudent(pendingAction.id);
        } else if (pendingAction.type === 'removePlanFromPayment') {
          executeRemovePlanFromPayment(pendingAction.id, pendingAction.extraId!);
        }
      }
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setPasswordError('');
      setPendingAction(null);
    } else {
      setPasswordError('Senha incorreta. Tente novamente.');
    }
  };

  const executeResetPlanExpiration = async (planId: string) => {
    if (!selectedStudentForFolder) return;
    
    try {
      // 1. Encontrar o pagamento mais recente deste aluno que contenha este plano
      const studentPaymentsForPlan = payments
        .filter(p => p.studentId === selectedStudentForFolder.id && p.status === 'paid')
        .filter(p => (p.selectedPlans?.some((sp: any) => sp.planId === planId)) || p.planId === planId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Lista de pagamentos que sobrarão para o recálculo
      let simulationPayments = payments.filter(p => p.studentId === selectedStudentForFolder.id && p.status === 'paid');

      if (studentPaymentsForPlan.length > 0) {
        const latestPaymentId = studentPaymentsForPlan[0].id;
        const paymentRef = doc(db, 'payments', latestPaymentId);
        const paymentSnap = await getDocFromServer(paymentRef);
        
        if (paymentSnap.exists()) {
          const currentPData = paymentSnap.data();
          const pSelectedPlans = currentPData.selectedPlans || (currentPData.planId ? [{ planId: currentPData.planId }] : []);
          const planToRemove = pSelectedPlans.find((p: any) => p.planId === planId);
          
          if (planToRemove) {
            const newSelectedPlans = pSelectedPlans.filter((p: any) => p.planId !== planId);
            
            if (newSelectedPlans.length === 0) {
              await deleteDoc(paymentRef);
              simulationPayments = simulationPayments.filter(p => p.id !== latestPaymentId);
            } else {
              const newOriginalAmount = (currentPData.originalAmount || 0) - (planToRemove.price || 0);
              const newDiscount = (currentPData.discount || 0) - (planToRemove.discount || 0);
              const newAmount = newOriginalAmount - newDiscount;

              await updateDoc(paymentRef, {
                selectedPlans: newSelectedPlans,
                originalAmount: newOriginalAmount,
                discount: newDiscount,
                amount: newAmount
              });
              
              simulationPayments = simulationPayments.map(p => p.id === latestPaymentId ? { ...p, selectedPlans: newSelectedPlans, amount: newAmount } : p);
            }
          }
        }
      }

      // 2. Recalcular as expirações baseadas nos pagamentos que sobraram
      const studentRef = doc(db, 'students', selectedStudentForFolder.id);
      const newExpirations: Record<string, string> = { ...(selectedStudentForFolder.planExpirations || {}) };
      
      // Limpamos a data deste plano específico para garantir que ele seja recalculado do zero
      delete newExpirations[planId];
      
      let latestNextDate: string | null = null;

      // Ordenar do mais antigo para o mais novo para reconstruir a linha do tempo de vencimentos
      const sortedPayments = [...simulationPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedPayments.forEach(p => {
        const pPlans = p.selectedPlans || (p.planId ? [{ planId: p.planId }] : []);
        pPlans.forEach((sp: any) => {
          const plan = plans.find(pl => pl.id === sp.planId);
          if (plan) {
            const nextDate = plan.durationMonths
              ? format(addMonths(new Date(p.date), plan.durationMonths), 'yyyy-MM-dd')
              : format(addDays(new Date(p.date), plan.durationDays || 30), 'yyyy-MM-dd');
            newExpirations[sp.planId] = nextDate;
          }
        });
      });

      // Recalcular o latestNextDate global do aluno
      Object.entries(newExpirations).forEach(([pid, exp]) => {
        const p = plans.find(pl => pl.id === pid);
        if (p?.isCorporate) return;
        if (!latestNextDate || (exp as string) > latestNextDate) {
          latestNextDate = exp as string;
        }
      });

      // 3. SE o plano que deletamos NÃO ficou com nenhuma data no histórico (era o único pagamento),
      // o usuário quer que ele fique com data de HOJE para ser cobrado novamente.
      if (!newExpirations[planId]) {
        newExpirations[planId] = format(new Date(), 'yyyy-MM-dd');
        if (!latestNextDate || newExpirations[planId] > latestNextDate) {
          latestNextDate = newExpirations[planId];
        }
      }

      await updateDoc(studentRef, {
        planExpirations: newExpirations,
        nextPaymentDate: latestNextDate
      });

      setSelectedStudentForFolder({
        ...selectedStudentForFolder,
        planExpirations: newExpirations,
        nextPaymentDate: latestNextDate
      });

      alert('Pagamento excluído. A validade do plano foi restaurada para o estado anterior.');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${selectedStudentForFolder.id}`);
      alert('Erro ao processar reversão: ' + error.message);
    }
  };

  const executeDeleteStudent = async (studentId: string) => {
    try {
      const batch = writeBatch(db);
      
      // Delete student document
      batch.delete(doc(db, 'students', studentId));
      
      // Remove student from all classes
      classes.forEach(cls => {
        if (cls.studentIds?.includes(studentId)) {
          const classRef = doc(db, 'classes', cls.id);
          batch.update(classRef, {
            studentIds: cls.studentIds.filter(id => id !== studentId)
          });
        }
      });

      // Delete all payments for this student
      const studentPayments = payments.filter(p => p.studentId === studentId);
      studentPayments.forEach(p => {
        batch.delete(doc(db, 'payments', p.id));
      });

      await batch.commit();
      alert('Aluno e todos os seus dados excluídos com sucesso!');
      setSelectedStudentForFolder(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'students');
      alert('Erro ao excluir aluno. Tente novamente.');
    } finally {
      setIsSaving(false);
      setPendingAction(null);
    }
  };

  const executeDeletePayment = async (paymentId: string) => {
    try {
      const paymentToDelete = payments.find(p => p.id === paymentId);
      if (!paymentToDelete || !selectedStudentForFolder) return;

      const batch = writeBatch(db);
      batch.delete(doc(db, 'payments', paymentId));

      // Roll back student's nextPaymentDate if this was the latest payment
      const studentPayments = payments
        .filter(p => p.studentId === selectedStudentForFolder.id && p.id !== paymentId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const studentRef = doc(db, 'students', selectedStudentForFolder.id);
      
      if (studentPayments.length === 0) {
        batch.update(studentRef, {
          nextPaymentDate: null,
          status: 'inactive',
          planExpirations: {}
        });
        
        setSelectedStudentForFolder({
          ...selectedStudentForFolder,
          nextPaymentDate: null,
          status: 'inactive',
          planExpirations: {}
        });
      } else {
        const newExpirations: Record<string, string> = {};
        let latestNextDate: string | null = null;

        // Reconstruir expirações baseadas nos pagamentos restantes
        // Ordenar do mais antigo para o mais novo para que o mais recente prevaleça
        const sortedPayments = [...studentPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        sortedPayments.forEach(p => {
          const pPlans = p.selectedPlans || (p.planId ? [{ planId: p.planId }] : []);
          pPlans.forEach((sp: any) => {
            const plan = plans.find(pl => pl.id === sp.planId);
            if (plan) {
              const nextDate = plan.durationMonths
                ? format(addMonths(new Date(p.date), plan.durationMonths), 'yyyy-MM-dd')
                : format(addDays(new Date(p.date), plan.durationDays || 30), 'yyyy-MM-dd');
              newExpirations[sp.planId] = nextDate;
              if (!latestNextDate || nextDate > latestNextDate) {
                latestNextDate = nextDate;
              }
            }
          });
        });

        batch.update(studentRef, {
          nextPaymentDate: latestNextDate,
          planExpirations: newExpirations
        });
        
        setSelectedStudentForFolder({
          ...selectedStudentForFolder,
          nextPaymentDate: latestNextDate,
          planExpirations: newExpirations
        });
      }

      await batch.commit();
      alert('Pagamento excluído com sucesso!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'payments');
      alert('Erro ao excluir pagamento. Tente novamente.');
    } finally {
      setIsSaving(false);
      setPendingAction(null);
    }
  };

  const executeRemovePlanFromPayment = async (paymentId: string, planId: string) => {
    try {
      const paymentRef = doc(db, 'payments', paymentId);
      const paymentSnap = await getDocFromServer(paymentRef);
      if (!paymentSnap.exists()) return;

      const paymentData = paymentSnap.data();
      const selectedPlans = paymentData.selectedPlans || [];
      const planToRemove = selectedPlans.find((p: any) => p.planId === planId);
      
      if (!planToRemove) return;

      const newSelectedPlans = selectedPlans.filter((p: any) => p.planId !== planId);
      
      if (newSelectedPlans.length === 0) {
        // Se não sobrar nenhum plano, exclui o registro de pagamento inteiro
        await executeDeletePayment(paymentId);
      } else {
        const newOriginalAmount = (paymentData.originalAmount || 0) - (planToRemove.price || 0);
        const newDiscount = (paymentData.discount || 0) - (planToRemove.discount || 0);
        const newAmount = newOriginalAmount - newDiscount;

        await updateDoc(paymentRef, {
          selectedPlans: newSelectedPlans,
          originalAmount: newOriginalAmount,
          discount: newDiscount,
          amount: newAmount
        });

        // Após remover o plano do pagamento, recalculamos as expirações do aluno
        if (selectedStudentForFolder) {
          const studentPayments = payments
            .filter(p => p.studentId === selectedStudentForFolder.id)
            .map(p => p.id === paymentId ? { ...p, selectedPlans: newSelectedPlans, amount: newAmount, originalAmount: newOriginalAmount, discount: newDiscount } : p)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const studentRef = doc(db, 'students', selectedStudentForFolder.id);
          const newExpirations: Record<string, string> = {};
          let latestNextDate: string | null = null;

          const sortedPayments = [...studentPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          sortedPayments.forEach(p => {
            const pPlans = p.selectedPlans || (p.planId ? [{ planId: p.planId }] : []);
            pPlans.forEach((sp: any) => {
              const plan = plans.find(pl => pl.id === sp.planId);
              if (plan) {
                const nextDate = plan.durationMonths
                  ? format(addMonths(new Date(p.date), plan.durationMonths), 'yyyy-MM-dd')
                  : format(addDays(new Date(p.date), plan.durationDays || 30), 'yyyy-MM-dd');
                newExpirations[sp.planId] = nextDate;
                if (!latestNextDate || nextDate > latestNextDate) {
                  latestNextDate = nextDate;
                }
              }
            });
          });

          await updateDoc(studentRef, {
            nextPaymentDate: latestNextDate,
            planExpirations: newExpirations
          });

          setSelectedStudentForFolder({
            ...selectedStudentForFolder,
            nextPaymentDate: latestNextDate,
            planExpirations: newExpirations
          });
        }
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
    }
  };

  const handleToggleClassInFolder = async (classId: string, force: boolean = false) => {
    if (!selectedStudentForFolder) return;
    
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    const isEnrolled = cls.studentIds?.includes(selectedStudentForFolder.id);
    
    if (isEnrolled && !force) {
      setPendingAction({ type: 'class', id: classId });
      setIsPasswordModalOpen(true);
      return;
    }

    const newStudentIds = isEnrolled 
      ? (cls.studentIds || []).filter(id => id !== selectedStudentForFolder.id)
      : [...(cls.studentIds || []), selectedStudentForFolder.id];

    try {
      const classRef = doc(db, 'classes', classId);
      const studentRef = doc(db, 'students', selectedStudentForFolder.id);

      const newClassIds = isEnrolled 
        ? (selectedStudentForFolder.classIds || []).filter(id => id !== classId)
        : [...(selectedStudentForFolder.classIds || []), classId];

      const batch = writeBatch(db);
      batch.update(classRef, { studentIds: newStudentIds });
      batch.update(studentRef, { classIds: newClassIds });

      await batch.commit();
      
      // Update local state for immediate feedback
      setSelectedStudentForFolder({
        ...selectedStudentForFolder,
        classIds: newClassIds
      });
      
      alert(isEnrolled ? 'Aluno removido da turma!' : 'Aluno adicionado à turma!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'classes');
      alert('Erro ao atualizar turma. Tente novamente.');
    }
  };

  const handleTogglePlanInFolder = async (planId: string, force: boolean = false) => {
    if (!selectedStudentForFolder) return;

    const currentPlanIds = selectedStudentForFolder.planIds || (selectedStudentForFolder.planId ? [selectedStudentForFolder.planId] : []);
    const isSelected = currentPlanIds.includes(planId);
    
    if (isSelected && !force) {
      setPendingAction({ type: 'plan', id: planId });
      setIsPasswordModalOpen(true);
      return;
    }

    const newPlanIds = isSelected 
      ? currentPlanIds.filter(id => id !== planId)
      : [...currentPlanIds, planId];

    const newExpirations = { ...(selectedStudentForFolder.planExpirations || {}) };
    if (!isSelected) {
      const plan = plans.find(p => p.id === planId);
      if (plan?.isCorporate) {
        newExpirations[planId] = '2099-12-31';
      } else {
        newExpirations[planId] = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      }
    } else {
      delete newExpirations[planId];
    }

    try {
      let latestNextDate = null;
      Object.entries(newExpirations).forEach(([pid, exp]: [string, any]) => {
        const plan = plans.find(p => p.id === pid);
        if (plan?.isCorporate) return;
        if (!latestNextDate || exp > latestNextDate) {
          latestNextDate = exp;
        }
      });

      const updateData: any = {
        planIds: newPlanIds,
        planExpirations: newExpirations,
        nextPaymentDate: latestNextDate
      };
      
      // Limpar planId legado se existir para evitar confusão
      if (selectedStudentForFolder.planId) {
        updateData.planId = null;
      }

      await updateDoc(doc(db, 'students', selectedStudentForFolder.id), updateData);
      
      // Se o plano foi removido, também removê-lo da seleção de pagamento atual
      if (isSelected) {
        setPaymentData(prev => ({
          ...prev,
          selectedPlans: prev.selectedPlans.filter(sp => sp.planId !== planId)
        }));
      }

      // Update local state
      setSelectedStudentForFolder({
        ...selectedStudentForFolder,
        ...updateData
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    }
  };

  const handleEditPaymentClick = (payment: any) => {
    setEditingPayment(payment);
    
    const pDate = payment.date || '';
    let displayDate = pDate;
    let displayTime = payment.time || '';
    
    if (pDate.includes('T')) {
      const d = new Date(pDate);
      displayDate = format(d, 'yyyy-MM-dd');
      displayTime = format(d, 'HH:mm');
    }

    setEditPaymentFormData({
      amount: payment.amount,
      method: payment.method,
      description: payment.description || '',
      date: displayDate,
      time: displayTime,
      receivedBy: payment.receivedBy || ''
    });
    setIsEditPaymentModalOpen(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setIsSaving(true);
    try {
      const paymentDate = new Date(`${editPaymentFormData.date}T${editPaymentFormData.time || '00:00'}:00`);
      await updateDoc(doc(db, 'payments', editingPayment.id), {
        ...editPaymentFormData,
        date: paymentDate.toISOString(),
        updatedAt: serverTimestamp()
      });
      setIsEditPaymentModalOpen(false);
      setEditingPayment(null);
      alert('Pagamento atualizado com sucesso!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${editingPayment.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    setPendingAction({ type: 'payment', id: paymentId });
    setIsPasswordModalOpen(true);
  };

  const getPlanDates = (student: any, planId: string, paymentDate: Date) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return null;

    const currentExpStr = student.planExpirations?.[planId];
    const currentExp = currentExpStr ? new Date(`${currentExpStr}T00:00:00`) : null;
    const anniversaryDay = currentExp ? getDate(currentExp) : getDate(paymentDate);
    
    // If current expiration is in the future, start from there. Otherwise start from payment date.
    const baseDate = (currentExp && currentExp > paymentDate) ? currentExp : paymentDate;

    let nextDate = plan.isCorporate 
      ? new Date('2099-12-31T00:00:00')
      : (plan.durationMonths 
        ? addMonths(baseDate, plan.durationMonths)
        : addDays(baseDate, plan.durationDays || 30));

    // If it's a monthly plan, try to preserve the anniversary day
    if (plan.durationMonths && !plan.isCorporate) {
      nextDate = setDate(nextDate, anniversaryDay);
      // If the adjustment moved it to before or equal to the base date, add another month
      if (nextDate <= baseDate) {
        nextDate = addMonths(nextDate, 1);
        nextDate = setDate(nextDate, anniversaryDay);
      }
    }

    return {
      current: currentExpStr,
      next: format(nextDate, 'yyyy-MM-dd'),
      base: format(baseDate, 'yyyy-MM-dd')
    };
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForFolder) return;

    setIsSaving(true);
    try {
      const totalBaseAmount = paymentData.selectedPlans.reduce((acc, sp) => {
        const plan = plans.find(p => p.id === sp.planId);
        return acc + (plan?.price || 0);
      }, 0);
      
      const totalDiscount = paymentData.selectedPlans.reduce((acc, sp) => acc + (sp.discount || 0), 0);
      const finalAmount = totalBaseAmount - totalDiscount;

      const paymentDate = new Date(`${paymentData.date}T${paymentData.time || '00:00'}:00`);
      
      // Calculate expirations and validity periods first
      const newExpirations = { ...(selectedStudentForFolder.planExpirations || {}) };
      const selectedPlansWithValidity = paymentData.selectedPlans.map(sp => {
        const selectedPlan = plans.find(p => p.id === sp.planId);
        if (!selectedPlan) return {
          planId: sp.planId,
          planName: 'Plano',
          discount: sp.discount,
          price: 0
        };

        const expValue = newExpirations[sp.planId];
        const currentExp = expValue ? new Date(`${expValue}T00:00:00`) : paymentDate;
        const anniversaryDay = currentExp ? getDate(currentExp) : getDate(paymentDate);
        const baseDate = currentExp > paymentDate ? currentExp : paymentDate;

        let nextDate = selectedPlan.isCorporate 
          ? new Date('2099-12-31T00:00:00')
          : (selectedPlan.durationMonths 
            ? addMonths(baseDate, selectedPlan.durationMonths)
            : addDays(baseDate, selectedPlan.durationDays || 30));

        if (selectedPlan.durationMonths && !selectedPlan.isCorporate) {
          nextDate = setDate(nextDate, anniversaryDay);
          if (nextDate <= baseDate) {
            nextDate = addMonths(nextDate, 1);
            nextDate = setDate(nextDate, anniversaryDay);
          }
        }

        const startDateStr = format(baseDate, 'yyyy-MM-dd');
        const endDateStr = format(nextDate, 'yyyy-MM-dd');
        
        newExpirations[sp.planId] = endDateStr;

        return {
          planId: sp.planId,
          planName: selectedPlan.name,
          discount: sp.discount,
          price: selectedPlan.price || 0,
          startDate: startDateStr,
          endDate: endDateStr
        };
      });

      const paymentDoc = {
        studentId: selectedStudentForFolder.id,
        studentName: selectedStudentForFolder.name,
        amount: finalAmount,
        originalAmount: totalBaseAmount,
        discount: totalDiscount,
        method: paymentData.method,
        selectedPlans: selectedPlansWithValidity,
        description: paymentData.description,
        date: paymentDate.toISOString(),
        time: paymentData.time,
        receivedBy: paymentData.receivedBy,
        status: 'paid',
        createdAt: serverTimestamp()
      };

      const paymentRef = collection(db, 'payments');
      await addDoc(paymentRef, paymentDoc);

      // Atualizar data do próximo pagamento e matrícula no plano para cada plano selecionado
      if (paymentData.selectedPlans.length > 0) {
        let earliestNextTime: number | null = null;

        Object.entries(newExpirations).forEach(([planId, expDateStr]) => {
          const plan = plans.find(p => p.id === planId);
          if (plan) {
            const isRecurring = plan.durationMonths ? plan.durationMonths >= 1 : (plan.durationDays || 30) >= 28;
            if (isRecurring) {
              const expTime = new Date(expDateStr as string).getTime();
              if (!earliestNextTime || expTime < earliestNextTime) {
                earliestNextTime = expTime;
              }
            }
          }
        });

        const finalNextPaymentDate = earliestNextTime 
          ? format(new Date(earliestNextTime), 'yyyy-MM-dd')
          : selectedStudentForFolder.nextPaymentDate;

        await updateDoc(doc(db, 'students', selectedStudentForFolder.id), {
          nextPaymentDate: finalNextPaymentDate,
          status: 'active',
          planExpirations: newExpirations,
          planId: null // Garantir que o campo legado seja limpo
        });

        // Atualizar estado local para feedback imediato na UI
        const updatedStudent = {
          ...selectedStudentForFolder,
          nextPaymentDate: finalNextPaymentDate,
          status: 'active',
          planExpirations: newExpirations,
          planId: null
        };
        setSelectedStudentForFolder(updatedStudent);

        // Sincronização automática com a catraca
        try {
          syncUser(updatedStudent).catch(err => console.error('Erro na sincronização automática:', err));
        } catch (e) {}
      }

      setPaymentData({
        amount: 0,
        discount: 0,
        method: 'pix',
        selectedPlans: [],
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        receivedBy: profile?.displayName || ''
      });
      alert('Pagamento registrado com sucesso!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight text-white">Alunos</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-lg">
                <Users size={12} className="text-neutral-500" />
                <span className="text-[10px] font-black text-white">{(students || []).length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 size={12} className="text-green-500" />
                <span className="text-[10px] font-black text-green-500">{(students || []).filter(s => s && isStudentActive(s)).length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                <XCircle size={12} className="text-red-500" />
                <span className="text-[10px] font-black text-red-500">{(students || []).filter(s => s && !isStudentActive(s)).length}</span>
              </div>
            </div>
          </div>
          <p className="text-neutral-500">Gerencie os alunos da sua academia.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBroadcastModalOpen(true)}
            className="bg-neutral-800 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-700 transition-colors border border-neutral-700"
          >
            <Megaphone size={18} />
            Propaganda
          </button>
          <button
            onClick={async () => {
              const { getDocs, collection, getFirestore } = await import('firebase/firestore');
              const { getApps } = await import('firebase/app');
              try {
                  const res = await fetch('/firebase-applet-config.json');
                  const cfg = await res.json();
                  const snap = await getDocs(collection(db, 'students'));
                  
                  let diagnosticMsg = `Banco: ${cfg.firestoreDatabaseId}\n`;
                  diagnosticMsg += `Encontrados: ${snap.size} alunos.\n`;
                  
                  if (snap.size > 0) {
                    const first = snap.docs[0].data();
                    diagnosticMsg += `\nEstrutura do 1º Aluno:\n${JSON.stringify({
                      name: first.name || first.nome || 'Ausente',
                      status: first.status || first.situacao || 'Ausente',
                      planIds: first.planIds || 'Ausente'
                    }, null, 2)}`;
                  }
                  
                  alert(diagnosticMsg);
              } catch (e: any) {
                 alert(`Erro: ${e.message}`);
              }
            }}
            className="p-2 text-neutral-400 hover:text-yellow-400 transition-colors"
            title="Diagnóstico"
          >
            <Activity size={20} />
          </button>
          <button
            onClick={() => {
              setEditingStudent(null);
              setFormData({ 
                name: '', 
                email: '', 
                phone: '',
                cpf: '',
                birthDate: '',
                planIds: [] as string[], 
                planExpirations: {} as { [key: string]: string },
                status: 'active', 
                nextPaymentDate: format(new Date(), 'yyyy-MM-dd'), 
                photoUrl: '',
                classIds: [] as string[],
                rfid: '',
                registrationNumber: '',
                personalId: '',
                addressZip: '',
                addressStreet: '',
                addressNumber: '',
                addressComplement: '',
                addressNeighborhood: '',
                addressCity: '',
                addressState: ''
              });
              setIsModalOpen(true);
            }}
            className="bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
          >
            <UserPlus size={18} />
            Novo Aluno
          </button>
        </div>
      </header>

      <div className="bg-black p-4 rounded-2xl shadow-sm border-2 border-neutral-600 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou número..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-black rounded-2xl shadow-sm border-2 border-neutral-600 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b-2 border-neutral-600">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500 w-16">#</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Aluno</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Plano</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Turmas</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Status</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Próximo Vencimento</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-neutral-700/50">
            {[...filteredStudents].sort((a, b) => {
              const numA = parseInt(String(a.registrationNumber || 0));
              const numB = parseInt(String(b.registrationNumber || 0));
              return (numB || 0) - (numA || 0);
            }).map((student) => {
              if (!student || !student.name) return null;
              return (
                <tr key={student.id} className="hover:bg-neutral-900 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="registration-number-highlight font-mono">
                      {String(student.registrationNumber || '---').padStart(4, '0')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 cursor-pointer group/name" onClick={() => handleOpenFolder(student)}>
                      <img 
                        src={student.photoUrl || `https://picsum.photos/seed/${student.id}/40/40`} 
                        alt="" 
                        className="w-10 h-10 rounded-full border border-neutral-800 object-cover group-hover/name:border-yellow-400 transition-colors"
                      />
                      <div>
                        <p className="font-bold text-sm text-white group-hover/name:text-yellow-400 transition-colors">{student.name.toUpperCase()}</p>
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                          <Mail size={10} /> {student.email || 'Sem email'}
                        </p>
                        {student.phone && (
                          <a 
                            href={`https://wa.me/55${student.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-green-500 hover:text-green-400 flex items-center gap-1 font-bold mt-0.5"
                          >
                            <Phone size={10} /> {student.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
                        const expirations = student.planExpirations || {};
                        
                        if (studentPlanIds.length === 0) {
                          return <span className="text-sm font-medium text-neutral-600 italic">Sem Plano</span>;
                        }

                        return studentPlanIds.map(pid => {
                          const plan = plans.find(p => p.id === pid);
                          const expDate = expirations[pid];
                          const isExpired = expDate ? new Date(expDate) < new Date() : false;
                          
                          return (
                            <div 
                              key={pid} 
                              className="flex flex-col cursor-pointer hover:bg-neutral-800 p-1 rounded transition-colors group/plan"
                              onClick={() => handlePlanClick(student, pid)}
                              title="Clique para cobrar este plano"
                            >
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight group-hover/plan:text-yellow-400">
                                {plan?.name || 'Plano'}
                              </span>
                              {expDate && (
                                <span className={cn(
                                  "text-[9px] font-medium flex items-center gap-1",
                                  isExpired ? "text-red-400" : "text-neutral-500"
                                )}>
                                  <Clock size={8} />
                                  Exp: {safeFormat(expDate, 'dd/MM/yy')}
                                  {isExpired && <span className="ml-1 text-[8px] font-black uppercase bg-red-500 text-white px-1 rounded animate-pulse">Cobrar</span>}
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {classes.filter(c => c.studentIds?.includes(student.id)).map(c => (
                        <span key={c.id} className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded">
                          {c.name}
                        </span>
                      ))}
                      {classes.filter(c => c.studentIds?.includes(student.id)).length === 0 && (
                        <span className="text-[8px] text-neutral-600 uppercase font-bold italic">Nenhuma</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const isActive = isStudentActive(student);
                      return (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          isActive 
                            ? "bg-green-950 text-green-400" 
                            : "bg-red-950 text-red-400"
                        )}>
                          {isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Calendar size={14} className="text-neutral-500" />
                      {(() => {
                        if (!student.nextPaymentDate) return 'N/A';
                        if (student.nextPaymentDate === '2099-12-31') return 'Indeterminado';
                        
                        // Check if all active plans are corporate
                        const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
                        const activePlans = plans.filter(p => studentPlanIds.includes(p.id));
                        const allCorporate = activePlans.length > 0 && activePlans.every(p => p.isCorporate);
                        
                        if (allCorporate) return 'Indeterminado';
                        
                        try {
                          return safeFormat(student.nextPaymentDate, 'dd/MM/yyyy');
                        } catch (e) {
                          return 'N/A';
                        }
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(student)}
                        className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 border-2 border-transparent hover:border-yellow-400 rounded-xl transition-all"
                        title="Editar Aluno"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setSearchTerm('');
                          setEditingStudent(student);
                          setFormData({
                            name: student.name || '',
                            email: student.email || '',
                            phone: student.phone || '',
                            cpf: student.cpf || '',
                            birthDate: student.birthDate || '',
                            planIds: student.planIds || (student.planId ? [student.planId] : []),
                            planExpirations: student.planExpirations || {},
                            status: student.status || 'active',
                            nextPaymentDate: student.nextPaymentDate || format(new Date(), 'yyyy-MM-dd'),
                            photoUrl: student.photoUrl || '',
                            classIds: student.classIds || [],
                            rfid: student.rfid || '',
                            registrationNumber: student.registrationNumber || '',
                            personalId: student.personalId || '',
                            addressZip: student.addressZip || '',
                            addressStreet: student.addressStreet || '',
                            addressNumber: student.addressNumber || '',
                            addressComplement: student.addressComplement || '',
                            addressNeighborhood: student.addressNeighborhood || '',
                            addressCity: student.addressCity || '',
                            addressState: student.addressState || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 border-2 border-transparent hover:border-yellow-400 rounded-xl transition-all"
                        title="Cadastrar Face"
                      >
                        <ScanFace size={16} />
                      </button>
                      {isHardwareConnected && (
                        <button 
                          onClick={() => {
                            setSearchTerm('');
                            syncUser(student);
                          }}
                          className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 border-2 border-transparent hover:border-yellow-400 rounded-xl transition-all"
                          title="Sincronizar com Catraca"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(student.id)}
                        className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 border-2 border-transparent hover:border-yellow-400 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredStudents.length === 0 && (
          <div className="p-12 text-center text-neutral-500 italic">
            Nenhum aluno encontrado.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border-2 border-neutral-600 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-neutral-900 text-white shrink-0">
              <h3 className="text-xl font-bold italic uppercase tracking-tight">{editingStudent ? 'Editar Aluno' : 'Novo Aluno'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto">
                {duplicateStudent && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
                      <AlertCircle size={18} />
                      CPF Duplicado Detectado!
                    </div>
                    <p className="text-xs text-neutral-400">
                      O CPF informado já pertence ao aluno <span className="text-white font-bold">{duplicateStudent.name.toUpperCase()}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleEdit(duplicateStudent);
                        setDuplicateStudent(null);
                      }}
                      className="w-full bg-red-500 text-white py-2 rounded-xl font-bold text-xs hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <User size={14} />
                      Abrir Cadastro de {duplicateStudent.name.split(' ')[0].toUpperCase()}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateStudent(null)}
                      className="w-full bg-neutral-800 text-neutral-400 py-2 rounded-xl font-bold text-xs hover:bg-neutral-700 transition-colors"
                    >
                      Corrigir CPF digitado
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                {/* Matrícula e Nome Completo */}
                <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Matrícula</label>
                    <div className="relative">
                      <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                      <input
                        type="number"
                        placeholder="Auto"
                        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                        value={isNaN(Number(formData.registrationNumber)) ? '' : formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Nome Completo (Obrigatório)</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                      <input
                        required
                        type="text"
                        placeholder="Digite o nome completo do aluno"
                        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Celular (Obrigatório)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      required
                      type="text"
                      placeholder="(00) 00000-0000"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    />
                    {formData.phone && formData.phone.replace(/\D/g, '').length >= 10 && (
                      <a 
                        href={`https://wa.me/55${formData.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-all flex items-center gap-1 text-[8px] font-black uppercase"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Data de Nascimento (Obrigatório)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      required
                      type="date"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">CPF</label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Tag RFID (125kHz)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                      <input
                        type="text"
                        placeholder="ID da Tag / Cartão"
                        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-mono"
                        value={formData.rfid}
                        onChange={(e) => setFormData({ ...formData, rfid: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          // @ts-ignore
                          const port = await navigator.serial.requestPort();
                          await port.open({ baudRate: 9600 });
                          const reader = port.readable.getReader();
                          const decoder = new TextDecoder();
                          
                          alert("Aproxime a tag da catraca agora...");
                          
                          while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            const text = decoder.decode(value).trim();
                            if (text) {
                              setFormData(prev => ({ ...prev, rfid: text }));
                              reader.releaseLock();
                              await port.close();
                              break;
                            }
                          }
                        } catch (err) {
                          console.error(err);
                          alert("Erro ao ler RFID. Verifique a conexão USB.");
                        }
                      }}
                      className="px-4 py-2 bg-neutral-800 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-neutral-700 transition-all flex items-center gap-2"
                    >
                      <Usb size={14} /> Ler
                    </button>
                  </div>
                </div>

                <div className="col-span-2 space-y-4 pt-4 border-t border-neutral-800">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <ExternalLink size={14} /> Endereço Completo
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">CEP</label>
                      <input
                        type="text"
                        placeholder="00000-000"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                        value={formData.addressZip}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                        onChange={async (e) => {
                          const cep = formatCEP(e.target.value);
                          setFormData({ ...formData, addressZip: cep });
                          
                          if (cep.replace(/\D/g, '').length === 8) {
                            try {
                              const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
                              const data = await res.json();
                              if (!data.erro) {
                                setFormData(prev => ({
                                  ...prev,
                                  addressZip: cep,
                                  addressStreet: data.logradouro,
                                  addressNeighborhood: data.bairro,
                                  addressCity: data.localidade,
                                  addressState: data.uf
                                }));
                              }
                            } catch (e) {
                              console.error("Erro ao buscar CEP", e);
                            }
                          }
                        }}
                      />
                    </div>
                    
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Logradouro / Rua</label>
                      <input
                        type="text"
                        placeholder="Ex: Av. Brasil"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                        value={formData.addressStreet}
                        onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Número</label>
                      <input
                        type="text"
                        placeholder="Nº"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                        value={formData.addressNumber}
                        onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Complemento</label>
                      <input
                        type="text"
                        placeholder="Apto/Bloco"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                        value={formData.addressComplement}
                        onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Bairro</label>
                      <input
                        type="text"
                        placeholder="Bairro"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                        value={formData.addressNeighborhood}
                        onChange={(e) => setFormData({ ...formData, addressNeighborhood: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Cidade</label>
                      <input
                        type="text"
                        placeholder="Cidade"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                        value={formData.addressCity}
                        onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Estado</label>
                      <input
                        type="text"
                        placeholder="UF"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm uppercase"
                        maxLength={2}
                        value={formData.addressState}
                        onChange={(e) => setFormData({ ...formData, addressState: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Planos Contratados</label>
                    <button 
                      type="button"
                      onClick={() => setIsQuickPlanModalOpen(true)}
                      className="text-[10px] font-bold text-yellow-400 uppercase flex items-center gap-1 hover:underline"
                    >
                      <Plus size={10} /> Vincular Novo Plano
                    </button>
                  </div>
                  
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                    <input 
                      type="text"
                      placeholder="Buscar plano por nome..."
                      className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        const planButtons = document.querySelectorAll('.plan-selection-btn');
                        planButtons.forEach((btn: any) => {
                          const name = btn.getAttribute('data-plan-name')?.toLowerCase() || '';
                          if (name.includes(term)) {
                            btn.classList.remove('hidden');
                          } else {
                            btn.classList.add('hidden');
                          }
                        });
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {plans.map(plan => (
                      <button
                        key={plan.id}
                        type="button"
                        data-plan-name={plan.name}
                        onClick={() => togglePlan(plan.id)}
                        className={cn(
                          "plan-selection-btn flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                          formData.planIds.includes(plan.id)
                            ? "bg-yellow-400/10 border-yellow-400 text-yellow-400"
                            : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                        )}
                      >
                        <div>
                          <p className="text-xs font-bold uppercase">{plan.name}</p>
                          <p className="text-[10px] opacity-70">R$ {plan.price.toFixed(2)}</p>
                        </div>
                        {formData.planIds.includes(plan.id) && <CheckCircle2 size={16} />}
                      </button>
                    ))}
                  </div>
                  {plans.length === 0 && (
                    <p className="text-xs text-neutral-600 italic">Nenhum plano cadastrado.</p>
                  )}
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Personal Responsável</label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <select
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white appearance-none"
                      value={formData.personalId}
                      onChange={(e) => setFormData({ ...formData, personalId: e.target.value })}
                    >
                      <option value="">Nenhum personal selecionado</option>
                      {users.filter(u => u.jobTitle?.toLowerCase().includes('personal') || u.role === 'employee' || u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Status</label>
                  <div className="relative">
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <select
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white appearance-none"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Próximo Vencimento</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      type="date"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={formData.nextPaymentDate}
                      onChange={(e) => setFormData({ ...formData, nextPaymentDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Turmas / Modalidades</label>
                    <button 
                      type="button"
                      onClick={() => setIsQuickClassModalOpen(true)}
                      className="text-[10px] font-bold text-yellow-400 uppercase flex items-center gap-1 hover:underline"
                    >
                      <Plus size={10} /> Vincular Nova Turma
                    </button>
                  </div>

                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                    <input 
                      type="text"
                      placeholder="Buscar turma por nome..."
                      className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        const classButtons = document.querySelectorAll('.class-selection-btn');
                        classButtons.forEach((btn: any) => {
                          const name = btn.getAttribute('data-class-name')?.toLowerCase() || '';
                          if (name.includes(term)) {
                            btn.classList.remove('hidden');
                          } else {
                            btn.classList.add('hidden');
                          }
                        });
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-neutral-900 rounded-xl border border-neutral-800">
                    {classes.map(cls => (
                      <button
                        key={cls.id}
                        type="button"
                        data-class-name={cls.name}
                        onClick={() => toggleClass(cls.id)}
                        className={cn(
                          "class-selection-btn flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all",
                          formData.classIds.includes(cls.id)
                            ? "bg-yellow-400/10 border border-yellow-400/20 text-yellow-400"
                            : "bg-black border border-transparent text-neutral-500 hover:border-neutral-800"
                        )}
                      >
                        {formData.classIds.includes(cls.id) ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border border-neutral-700" />}
                        <span className="flex-1">{cls.name}</span>
                      </button>
                    ))}
                    {classes.length === 0 && (
                      <p className="col-span-2 text-[10px] text-neutral-600 italic p-2">Nenhuma turma cadastrada.</p>
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Email (Opcional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                {!editingStudent && (
                  <div className="col-span-2 p-4 bg-green-950/10 border border-green-500/20 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                        <CreditCard size={14} /> Registrar Pagamento Inicial
                      </h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={paymentData.amount > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const initialPlans = formData.planIds.map(pid => ({
                                planId: pid,
                                discount: 0
                              }));
                              const total = initialPlans.reduce((acc, sp) => {
                                const plan = plans.find(p => p.id === sp.planId);
                                return acc + (plan?.price || 0);
                              }, 0);
                              setPaymentData({
                                ...paymentData,
                                amount: total,
                                selectedPlans: initialPlans
                              });
                            } else {
                              setPaymentData({ ...paymentData, amount: 0, selectedPlans: [] });
                            }
                          }}
                          className="w-4 h-4 rounded border-neutral-700 bg-black text-green-500 focus:ring-green-500"
                        />
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Registrar Agora</span>
                      </label>
                    </div>
                    
                    {paymentData.amount > 0 && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase">Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-1.5 bg-black border border-neutral-800 rounded-lg text-xs text-white focus:border-green-500 outline-none"
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase ml-1">Método de Pagamento</label>
                          <div className="flex flex-col gap-2">
                            {[
                              { id: 'pix', icon: Smartphone, label: 'PIX', active: 'text-yellow-400 border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.4)]', inactive: 'text-yellow-400/80 border-neutral-800 bg-neutral-900/50 hover:text-yellow-400 hover:border-yellow-400' },
                              { id: 'credit', icon: CreditCard, label: 'Crédito', active: 'text-pink-400 border-pink-400 bg-pink-400/20 shadow-[0_0_20px_rgba(244,114,182,0.4)]', inactive: 'text-pink-400/80 border-neutral-800 bg-neutral-900/50 hover:text-pink-400 hover:border-pink-400' },
                              { id: 'debit', icon: CreditCard, label: 'Débito', active: 'text-orange-400 border-orange-400 bg-orange-400/20 shadow-[0_0_20px_rgba(251,146,60,0.4)]', inactive: 'text-orange-400/80 border-neutral-800 bg-neutral-900/50 hover:text-orange-400 hover:border-orange-400' },
                              { id: 'recurring', icon: RefreshCw, label: 'Recorrente', active: 'text-blue-400 border-blue-400 bg-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.4)]', inactive: 'text-blue-400/80 border-neutral-800 bg-neutral-900/50 hover:text-blue-400 hover:border-blue-400' },
                              { id: 'money', icon: Banknote, label: 'Dinheiro', active: 'text-green-400 border-green-400 bg-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.4)]', inactive: 'text-green-400/80 border-neutral-800 bg-neutral-900/50 hover:text-green-400 hover:border-green-400' }
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setPaymentData({ ...paymentData, method: m.id })}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all w-full",
                                  paymentData.method === m.id ? m.active : m.inactive
                                )}
                              >
                                <m.icon size={16} className="shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wide">{m.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Foto do Aluno (Reconhecimento Facial)</label>
                  <div className="flex items-start gap-4 p-4 bg-neutral-900/50 rounded-2xl border-2 border-neutral-600">
                    <div className="relative group">
                      {isCameraOpen ? (
                        <div className="relative w-32 h-[170px] rounded-2xl overflow-hidden border-2 border-yellow-400 shadow-lg shadow-yellow-400/20 flex items-center justify-center bg-black">
                          {cameraError ? (
                            <div className="p-2 text-center space-y-2">
                              <AlertCircle className="text-red-500 mx-auto" size={24} />
                              <p className="text-[8px] text-neutral-400 font-bold uppercase leading-tight">{cameraError}</p>
                              <button 
                                type="button"
                                onClick={() => window.open(window.location.href, '_blank')}
                                className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-1"
                              >
                                <ExternalLink size={10} />
                                Nova Aba
                              </button>
                            </div>
                          ) : (
                            <>
                              <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-24 h-32 border border-white/20 rounded-xl" />
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="student-photo-upload"
                          />
                          <label 
                            htmlFor="student-photo-upload"
                            className="w-32 h-[170px] bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-yellow-400/50 hover:bg-neutral-800 transition-all group overflow-hidden"
                          >
                            {formData.photoUrl ? (
                              <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <Plus size={20} className="text-neutral-500 group-hover:text-yellow-400" />
                                <span className="text-[8px] text-neutral-500 uppercase font-bold">Upload</span>
                              </>
                            )}
                          </label>
                        </>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-[10px] text-neutral-500 leading-relaxed">
                        Capture ou carregue uma foto nítida do rosto do aluno para o sistema de reconhecimento facial. 
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {videoDevices.length > 0 && !isCameraOpen && (
                          <div className="w-full mb-1">
                            <div className="text-[9px] text-green-500 font-bold uppercase flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              {videoDevices.length} {videoDevices.length === 1 ? 'câmera detectada' : 'câmeras detectadas'}
                            </div>
                          </div>
                        )}
                        {isCameraOpen ? (
                          <>
                            {videoDevices.length > 0 && (
                              <div className="w-full mb-1 flex gap-2">
                                <select
                                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-yellow-400"
                                  value={selectedVideoDeviceId}
                                  onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                                >
                                  {videoDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                      {device.label || `Câmera ${videoDevices.indexOf(device) + 1}`}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={refreshVideoDevices}
                                  disabled={isRefreshingDevices}
                                  className="p-1.5 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white transition-colors disabled:opacity-50"
                                  title="Recarregar Câmeras"
                                >
                                  <RefreshCw size={12} className={isRefreshingDevices ? 'animate-spin' : ''} />
                                </button>
                              </div>
                            )}
                            <button 
                              type="button" 
                              onClick={capturePhoto}
                              className="bg-yellow-400 text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/10"
                            >
                              <Camera size={12} /> Capturar
                            </button>
                            <button 
                              type="button" 
                              onClick={stopCamera}
                              className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-neutral-700 transition-all"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              type="button" 
                              onClick={startCamera}
                              className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:bg-neutral-700 transition-all"
                            >
                              <Camera size={12} /> Usar Câmera
                            </button>
                            <button 
                              type="button" 
                              onClick={refreshVideoDevices}
                              disabled={isRefreshingDevices}
                              className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:bg-neutral-700 transition-all disabled:opacity-50"
                            >
                              {isRefreshingDevices ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Search size={12} />
                              )}
                              {isRefreshingDevices ? 'Procurando...' : 'Procurar Câmeras'}
                            </button>
                            <label 
                              htmlFor="student-photo-upload"
                              className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:bg-neutral-700 transition-all cursor-pointer"
                            >
                              <Plus size={12} /> Upload
                            </label>
                            {formData.photoUrl && isHardwareConnected && (
                              <button 
                                type="button" 
                                onClick={async () => {
                                  if (editingStudent) {
                                    const userId = editingStudent.registrationNumber || editingStudent.id;
                                    await enrollFace(userId.toString(), formData.photoUrl);
                                  } else {
                                    alert("Salve o aluno primeiro para enviar para a catraca.");
                                  }
                                }}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10"
                              >
                                <RefreshCw size={12} /> Enviar para Catraca
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {formData.photoUrl && !isCameraOpen && (
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, photoUrl: '' })}
                          className="text-[10px] font-bold text-red-500 uppercase mt-1 hover:underline block"
                        >
                          Remover Foto
                        </button>
                      )}
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex gap-3 shrink-0">
                {editingStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAction({ type: 'student', id: editingStudent.id });
                      setIsPasswordModalOpen(true);
                      setIsModalOpen(false);
                    }}
                    className="px-4 py-3 bg-red-500/10 text-red-500 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} /> Excluir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-neutral-900 text-neutral-400 font-bold rounded-xl hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <UserPlus size={18} />
                  )}
                  {editingStudent ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Pagamento */}
      {isEditPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black/20">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <Edit2 size={20} className="text-yellow-400" /> Editar Pagamento
              </h3>
              <button 
                onClick={() => setIsEditPaymentModalOpen(false)}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePayment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Data</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                    value={editPaymentFormData.date}
                    onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Hora</label>
                  <input
                    required
                    type="time"
                    className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                    value={editPaymentFormData.time}
                    onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Valor (R$)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                  value={editPaymentFormData.amount}
                  onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, amount: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Método de Pagamento</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'pix', icon: Smartphone, label: 'PIX', active: 'text-yellow-400 border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.4)]', inactive: 'text-yellow-400/80 border-neutral-800 bg-neutral-900/50 hover:text-yellow-400 hover:border-yellow-400' },
                    { id: 'credit', icon: CreditCard, label: 'Crédito', active: 'text-pink-400 border-pink-400 bg-pink-400/20 shadow-[0_0_20px_rgba(244,114,182,0.4)]', inactive: 'text-pink-400/80 border-neutral-800 bg-neutral-900/50 hover:text-pink-400 hover:border-pink-400' },
                    { id: 'debit', icon: CreditCard, label: 'Débito', active: 'text-orange-400 border-orange-400 bg-orange-400/20 shadow-[0_0_20px_rgba(251,146,60,0.4)]', inactive: 'text-orange-400/80 border-neutral-800 bg-neutral-900/50 hover:text-orange-400 hover:border-orange-400' },
                    { id: 'recurring', icon: RefreshCw, label: 'Recorrente', active: 'text-blue-400 border-blue-400 bg-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.4)]', inactive: 'text-blue-400/80 border-neutral-800 bg-neutral-900/50 hover:text-blue-400 hover:border-blue-400' },
                    { id: 'money', icon: Banknote, label: 'Dinheiro', active: 'text-green-400 border-green-400 bg-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.4)]', inactive: 'text-green-400/80 border-neutral-800 bg-neutral-900/50 hover:text-green-400 hover:border-green-400' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditPaymentFormData({ ...editPaymentFormData, method: m.id })}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3.5 rounded-2xl border-2 transition-all",
                        editPaymentFormData.method === m.id ? m.active : m.inactive
                      )}
                    >
                      <m.icon size={20} className="shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Funcionário</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-400 outline-none cursor-not-allowed"
                    value={editPaymentFormData.receivedBy}
                  />
                </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Descrição</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                  value={editPaymentFormData.description}
                  onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, description: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditPaymentModalOpen(false)}
                  className="flex-1 py-3 bg-neutral-800 text-white font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Folder Modal */}
      {selectedStudentForFolder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-black w-full max-w-4xl h-[85vh] flex flex-col rounded-3xl shadow-2xl border-2 border-neutral-600 animate-in fade-in zoom-in duration-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-neutral-900 text-white shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedStudentForFolder(null)}
                  className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <img 
                    src={selectedStudentForFolder.photoUrl || `https://picsum.photos/seed/${selectedStudentForFolder.id}/40/40`} 
                    alt="" 
                    className="w-12 h-12 rounded-full border-2 border-yellow-400 object-cover"
                  />
                  <div>
                    <h3 className="text-xl font-bold italic uppercase tracking-tight leading-none">{selectedStudentForFolder.name.toUpperCase()}</h3>
                    <p className="text-xs text-neutral-500 mt-1 uppercase font-bold tracking-widest">
                      Matrícula <span className="registration-number-highlight">#{String(selectedStudentForFolder.registrationNumber || '---').padStart(4, '0')}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isHardwareConnected && (
                  <button 
                    onClick={() => syncUser(selectedStudentForFolder)}
                    className="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 border border-blue-400/20"
                    title="Sincronizar com Catraca"
                  >
                    <RefreshCw size={14} /> Sincronizar Catraca
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (folderTab === 'profile') {
                      if (isEditingProfileInFolder) {
                        handleSaveProfileInFolder();
                      } else {
                        setIsEditingProfileInFolder(true);
                        setFolderError('');
                      }
                    } else {
                      handleEdit(selectedStudentForFolder);
                      setSelectedStudentForFolder(null);
                    }
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2",
                    isEditingProfileInFolder 
                      ? "bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20" 
                      : "bg-neutral-800 text-white hover:bg-neutral-700"
                  )}
                >
                  {isEditingProfileInFolder ? (
                    <>
                      <CheckCircle2 size={14} /> Salvar Perfil
                    </>
                  ) : (
                    <>
                      <Edit2 size={14} /> Editar Perfil
                    </>
                  )}
                </button>
                <button 
                  onClick={() => {
                    setPendingAction({ type: 'student', id: selectedStudentForFolder.id });
                    setIsPasswordModalOpen(true);
                  }}
                  className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                >
                  <Trash2 size={14} /> Excluir Aluno
                </button>
                <button onClick={() => setSelectedStudentForFolder(null)} className="text-neutral-500 hover:text-white transition-colors">
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b-2 border-neutral-600 bg-neutral-900/50 shrink-0">
              {[
                { id: 'profile', label: 'Resumo', icon: User },
                { id: 'plans', label: 'Planos e Turmas', icon: Activity },
                { id: 'payments', label: 'Pagamentos', icon: CreditCard },
                { id: 'catraca', label: 'Catraca (iD)', icon: ScanFace },
                { id: 'history', label: 'Frequência', icon: History },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFolderTab(tab.id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                    folderTab === tab.id 
                      ? "border-yellow-400 text-yellow-400 bg-yellow-400/5" 
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
                  )}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-black">
              {folderTab === 'profile' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-8">
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                          <User size={14} /> Informações Pessoais
                        </h4>
                        {!isEditingProfileInFolder ? (
                          <button 
                            onClick={() => {
                              setIsEditingProfileInFolder(true);
                              setFolderError('');
                            }}
                            className="text-[10px] font-bold text-yellow-400 uppercase hover:underline flex items-center gap-1"
                          >
                            <Edit2 size={10} /> Editar
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                setIsEditingProfileInFolder(false);
                                setFolderError('');
                              }}
                              className="text-[10px] font-bold text-neutral-500 uppercase hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={handleSaveProfileInFolder}
                              disabled={isSaving}
                              className="text-[10px] font-bold text-green-400 uppercase hover:text-green-300 flex items-center gap-1"
                            >
                              {isSaving ? <Loader2 className="animate-spin" size={10} /> : <CheckCircle2 size={10} />}
                              Salvar
                            </button>
                          </div>
                        )}
                      </div>

                      {folderError && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                          <AlertCircle size={16} />
                          {folderError}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Nome Completo</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.name}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, name: e.target.value.toUpperCase() })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.name.toUpperCase()}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Email</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="email"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.email}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, email: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.email || 'Não informado'}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Telefone</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.phone}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, phone: formatPhone(e.target.value) })}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium">{selectedStudentForFolder.phone || 'Não informado'}</p>
                              {selectedStudentForFolder.phone && (
                                <a 
                                  href={`https://wa.me/55${selectedStudentForFolder.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-all flex items-center gap-1 text-[8px] font-black uppercase"
                                >
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Matrícula</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="number"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={isNaN(Number(folderProfileData.registrationNumber)) ? '' : folderProfileData.registrationNumber}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, registrationNumber: e.target.value })}
                            />
                          ) : (
                            <p className="registration-number-highlight">#{String(selectedStudentForFolder.registrationNumber || '---').padStart(4, '0')}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">CPF</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.cpf}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, cpf: formatCPF(e.target.value) })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.cpf || 'Não informado'}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Tag RFID</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none font-mono"
                              value={folderProfileData.rfid}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, rfid: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-mono font-medium">{selectedStudentForFolder.rfid || 'Nenhuma tag vinculada'}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Data de Nascimento</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="date"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.birthDate}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, birthDate: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-medium">
                              {selectedStudentForFolder.birthDate ? format(new Date(selectedStudentForFolder.birthDate), 'dd/MM/yyyy') : 'Não informado'}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="pt-6 border-t border-neutral-800">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ExternalLink size={14} /> Endereço Residencial
                      </h4>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-1">
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">CEP</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.addressZip}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.preventDefault();
                              }}
                              onChange={async (e) => {
                                const cep = formatCEP(e.target.value);
                                setFolderProfileData({ ...folderProfileData, addressZip: cep });
                                if (cep.replace(/\D/g, '').length === 8) {
                                  try {
                                    const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
                                    const data = await res.json();
                                    if (!data.erro) {
                                      setFolderProfileData(prev => ({
                                        ...prev,
                                        addressZip: cep,
                                        addressStreet: data.logradouro,
                                        addressNeighborhood: data.bairro,
                                        addressCity: data.localidade,
                                        addressState: data.uf
                                      }));
                                    }
                                  } catch (e) {}
                                }
                              }}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.addressZip || '---'}</p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Logradouro / Rua</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.addressStreet}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, addressStreet: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.addressStreet || '---'}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Número</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.addressNumber}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, addressNumber: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.addressNumber || '---'}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Complemento</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.addressComplement}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, addressComplement: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.addressComplement || '---'}</p>
                          )}
                        </div>
                        <div className="col-span-1">
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Bairro</p>
                          {isEditingProfileInFolder ? (
                            <input 
                              type="text"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.addressNeighborhood}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, addressNeighborhood: e.target.value })}
                            />
                          ) : (
                            <p className="text-white font-medium">{selectedStudentForFolder.addressNeighborhood || '---'}</p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-1">Cidade / Estado</p>
                          {isEditingProfileInFolder ? (
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none"
                                value={folderProfileData.addressCity}
                                onChange={(e) => setFolderProfileData({ ...folderProfileData, addressCity: e.target.value })}
                              />
                              <input 
                                type="text"
                                maxLength={2}
                                className="w-16 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-400 outline-none uppercase"
                                value={folderProfileData.addressState}
                                onChange={(e) => setFolderProfileData({ ...folderProfileData, addressState: e.target.value.toUpperCase() })}
                              />
                            </div>
                          ) : (
                            <p className="text-white font-medium">
                              {selectedStudentForFolder.addressCity ? `${selectedStudentForFolder.addressCity} - ${selectedStudentForFolder.addressState}` : '---'}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Status e Vencimento
                      </h4>
                      <div className="flex items-center gap-4">
                        {isEditingProfileInFolder ? (
                          <div className="flex-1 space-y-1">
                            <p className="text-[10px] text-neutral-600 uppercase font-bold">Status</p>
                            <select
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-400 outline-none appearance-none"
                              value={folderProfileData.status}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, status: e.target.value })}
                            >
                              <option value="active">Ativo</option>
                              <option value="inactive">Inativo</option>
                            </select>
                          </div>
                        ) : (() => {
                            const isActive = isStudentActive(selectedStudentForFolder);
                            return (
                              <div className={cn(
                                "px-4 py-3 rounded-2xl border flex items-center gap-3",
                                isActive 
                                  ? "bg-green-950/20 border-green-500/30 text-green-400" 
                                  : "bg-red-950/20 border-red-500/30 text-red-400"
                              )}>
                                {isActive ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                <div className="flex flex-col">
                                  <p className="text-[10px] uppercase font-bold opacity-70">Matrícula</p>
                                  <p className="font-bold leading-tight">{isActive ? 'ATIVA' : 'INATIVA'}</p>
                                  {isActive && (
                                    <div className="mt-1">
                                      {(() => {
                                        const studentPlanIds = selectedStudentForFolder.planIds || (selectedStudentForFolder.planId ? [selectedStudentForFolder.planId] : []);
                                        if (studentPlanIds.length > 0) {
                                          const activePlans = plans.filter(p => studentPlanIds.includes(p.id));
                                          return activePlans.map(plan => {
                                            const expDate = selectedStudentForFolder.planExpirations?.[plan.id];
                                            return (
                                              <div key={plan.id} className="text-[10px] font-medium opacity-90">
                                                {plan.name} {expDate ? `• Exp: ${format(new Date(expDate), 'dd/MM/yy')}` : ''}
                                              </div>
                                            );
                                          });
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                        {isEditingProfileInFolder ? (
                          <div className="flex-1 space-y-1">
                            <p className="text-[10px] text-neutral-600 uppercase font-bold">Próximo Vencimento</p>
                            <input 
                              type="date"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-400 outline-none"
                              value={folderProfileData.nextPaymentDate}
                              onChange={(e) => setFolderProfileData({ ...folderProfileData, nextPaymentDate: e.target.value })}
                            />
                          </div>
                        ) : (
                          <div className="px-4 py-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 text-neutral-400 flex items-center gap-3">
                            <Calendar size={20} />
                            <div>
                              <p className="text-[10px] uppercase font-bold opacity-70">Próximo Vencimento</p>
                              <p className="font-bold text-white">
                                {selectedStudentForFolder.nextPaymentDate ? format(new Date(selectedStudentForFolder.nextPaymentDate), 'dd/MM/yyyy') : 'N/A'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    {/* SEÇÃO DE RESUMO DE ATIVIDADE */}
                    <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Resumo de Atividade</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Matrícula #</span>
                          <span className="registration-number-highlight">
                            {selectedStudentForFolder.registrationNumber || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Total de Pagamentos</span>
                          <span className="text-sm font-bold text-white">
                            {payments.filter(p => p.studentId === selectedStudentForFolder.id).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">Acessos (30 dias)</span>
                          <span className="text-sm font-bold text-white">
                            {accessLogs.filter(l => l.studentId === selectedStudentForFolder.id).length}
                          </span>
                        </div>
                        <div className="pt-4 border-t border-neutral-800">
                          <p className="text-[10px] text-neutral-600 uppercase font-bold mb-2">Último Acesso</p>
                          {accessLogs.find(l => l.studentId === selectedStudentForFolder.id) ? (
                            <p className="text-xs text-white font-medium">
                              {(() => {
                                try {
                                  const lastLog = accessLogs.find(l => l.studentId === selectedStudentForFolder.id);
                                  const date = lastLog.timestamp?.toDate ? lastLog.timestamp.toDate() : new Date(lastLog.timestamp);
                                  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                                } catch (e) {
                                  return 'Data inválida';
                                }
                              })()}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-600 italic">Nenhum registro</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {folderTab === 'plans' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    {/* SEÇÃO DE PLANOS */}
                    <section className="space-y-6">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <CreditCard size={14} className="text-yellow-400" /> Planos Ativos
                        </h4>
                        <div className="space-y-3">
                          {plans.filter(plan => {
                            const studentPlanIds = selectedStudentForFolder.planIds || (selectedStudentForFolder.planId ? [selectedStudentForFolder.planId] : []);
                            return studentPlanIds.includes(plan.id);
                          }).map(plan => {
                            const expDate = selectedStudentForFolder.planExpirations?.[plan.id];
                            const isExpired = expDate ? new Date(expDate) < new Date() : false;

                            return (
                              <div
                                key={plan.id}
                                className={cn(
                                  "w-full p-4 rounded-2xl border flex items-center justify-between group",
                                  plan.isCorporate 
                                    ? "border-blue-400/30 bg-blue-400/5 text-blue-400" 
                                    : "border-yellow-400/30 bg-yellow-400/5 text-yellow-400"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <CheckCircle2 size={18} />
                                  <div>
                                    <p className="text-sm font-bold uppercase">{plan.name}</p>
                                    {expDate && (
                                      <p className={cn(
                                        "text-[10px] font-bold uppercase tracking-widest",
                                        plan.isCorporate ? "text-blue-400" : (isExpired ? "text-red-500" : "text-green-500")
                                      )}>
                                        {plan.isCorporate 
                                          ? "Duração Indeterminada" 
                                          : (isExpired ? `Expirado em ${format(new Date(expDate), 'dd/MM/yyyy')}` : `Válido até ${format(new Date(expDate), 'dd/MM/yyyy')}`)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setSelectedPlanForExpiration(plan);
                                      setNewExpirationDate(expDate || format(new Date(), 'yyyy-MM-dd'));
                                      setIsEditExpirationModalOpen(true);
                                    }}
                                    className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                                    title="Alterar Vencimento"
                                  >
                                    <Calendar size={16} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setPendingAction({ type: 'resetPlanExpiration', id: plan.id });
                                      setIsPasswordModalOpen(true);
                                    }}
                                    className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-all"
                                    title="Excluir Pagamento Atual (Resetar Validade)"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setPaymentData({
                                        ...paymentData,
                                        selectedPlans: [{ planId: plan.id, discount: 0 }],
                                        date: format(new Date(), 'yyyy-MM-dd')
                                      });
                                      setFolderTab('payments');
                                    }}
                                    className={cn(
                                      "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                      isExpired 
                                        ? "bg-red-500 text-white hover:bg-red-400 animate-pulse" 
                                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                    )}
                                  >
                                    Cobrar
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setPendingAction({ type: 'plan', id: plan.id });
                                      setIsPasswordModalOpen(true);
                                    }}
                                    className="p-2 text-neutral-600 hover:text-red-500 transition-colors"
                                    title="Remover Plano do Aluno"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {plans.filter(plan => (selectedStudentForFolder.planIds || (selectedStudentForFolder.planId ? [selectedStudentForFolder.planId] : [])).includes(plan.id)).length === 0 && (
                            <div className="p-8 border border-dashed border-neutral-800 rounded-2xl text-center">
                              <p className="text-xs text-neutral-600 italic">Nenhum plano ativo para este aluno.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-6 border-t border-neutral-800">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <Plus size={14} /> Vincular Novo Plano
                          </h4>
                          <div className="relative w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                            <input 
                              type="text"
                              placeholder="Buscar plano..."
                              className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all"
                              value={folderPlanSearch}
                              onChange={(e) => setFolderPlanSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {plans
                            .filter(plan => !(selectedStudentForFolder.planIds || (selectedStudentForFolder.planId ? [selectedStudentForFolder.planId] : [])).includes(plan.id))
                            .filter(plan => plan.name.toLowerCase().includes(folderPlanSearch.toLowerCase()))
                            .map(plan => (
                              <button
                                key={plan.id}
                                onClick={() => handleTogglePlanInFolder(plan.id)}
                                className="w-full p-3 rounded-xl border border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-white transition-all text-left flex items-center justify-between group"
                              >
                                <div>
                                  <p className="text-xs font-bold uppercase">{plan.name}</p>
                                  <p className="text-[10px] opacity-60">
                                    R$ {plan.price.toFixed(2)} / {plan.durationMonths ? `${plan.durationMonths} ${plan.durationMonths === 1 ? 'mês' : 'meses'}` : `${plan.durationDays} dias`}
                                  </p>
                                </div>
                                <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ))}
                        </div>
                      </div>
                    </section>

                    {/* SEÇÃO DE TURMAS */}
                    <section className="space-y-6">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Activity size={14} className="text-yellow-400" /> Turmas Ativas
                        </h4>
                        <div className="space-y-3">
                          {classes.filter(cls => cls.studentIds?.includes(selectedStudentForFolder.id)).map(cls => (
                            <div
                              key={cls.id}
                              className="w-full p-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 text-yellow-400 flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircle2 size={18} />
                                <div>
                                  <p className="text-sm font-bold uppercase">{cls.name}</p>
                                  <p className="text-[10px] opacity-70">{cls.modality} • {cls.instructor || 'Sem instrutor'}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setPendingAction({ type: 'class', id: cls.id });
                                  setIsPasswordModalOpen(true);
                                }}
                                className="p-2 text-neutral-600 hover:text-red-500 transition-colors"
                                title="Remover Turma"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          {classes.filter(cls => cls.studentIds?.includes(selectedStudentForFolder.id)).length === 0 && (
                            <div className="p-8 border border-dashed border-neutral-800 rounded-2xl text-center">
                              <p className="text-xs text-neutral-600 italic">O aluno não está vinculado a nenhuma turma.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-6 border-t border-neutral-800">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <Plus size={14} /> Vincular a Nova Turma
                          </h4>
                          <div className="relative w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                            <input 
                              type="text"
                              placeholder="Buscar turma..."
                              className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all"
                              value={folderClassSearch}
                              onChange={(e) => setFolderClassSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {classes
                            .filter(cls => !cls.studentIds?.includes(selectedStudentForFolder.id))
                            .filter(cls => (cls.name?.toLowerCase() || '').includes(folderClassSearch.toLowerCase()) || (cls.modality?.toLowerCase() || '').includes(folderClassSearch.toLowerCase()))
                            .map(cls => (
                              <button
                                key={cls.id}
                                onClick={() => handleToggleClassInFolder(cls.id)}
                                className="w-full p-3 rounded-xl border border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-white transition-all text-left flex items-center justify-between group"
                              >
                                <div>
                                  <p className="text-xs font-bold uppercase">{cls.name}</p>
                                  <p className="text-[10px] opacity-60">{cls.modality} • {cls.instructor || 'Sem instrutor'}</p>
                                </div>
                                <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ))}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {folderTab === 'catraca' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-yellow-400 text-black rounded-2xl shadow-lg shadow-yellow-400/20">
                        <ScanFace size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Controle de Acesso</h3>
                          <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[8px] font-black uppercase rounded border border-neutral-700">Powered by Control iD</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Sincronização com iDFace e iDCloud</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest",
                        isHardwareConnected ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                      )}>
                        <div className={cn("w-2 h-2 rounded-full", isHardwareConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        {isHardwareConnected ? "Catraca Conectada" : "Catraca Offline"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Face Enrollment Card */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400">Reconhecimento Facial</h4>
                        {selectedStudentForFolder.photoUrl ? (
                          <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[8px] font-black uppercase rounded-md border border-green-500/20">Foto Presente</span>
                        ) : (
                          <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[8px] font-black uppercase rounded-md border border-red-500/20">Sem Foto</span>
                        )}
                      </div>
                      
                      <div className="aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-neutral-800 relative group">
                        {selectedStudentForFolder.photoUrl ? (
                          <img 
                            src={selectedStudentForFolder.photoUrl} 
                            alt="Face do Aluno" 
                            className="w-full h-full object-cover group-hover:opacity-50 transition-opacity"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-700 gap-2">
                            <Camera size={48} />
                            <p className="text-[10px] uppercase font-bold tracking-tighter">Nenhuma face cadastrada</p>
                          </div>
                        )}
                        
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEnrollStudent(selectedStudentForFolder);
                              setShowEnrollModal(true);
                            }}
                            className="px-6 py-3 bg-white text-black rounded-xl font-black uppercase tracking-widest text-xs shadow-2xl"
                          >
                            CADASTRAR FACE
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-neutral-500 italic leading-relaxed">
                        A foto será processada e enviada para a memória interna da iDFace de forma criptografada.
                      </p>
                    </div>

                    {/* RFDI / Sync Card */}
                    <div className="space-y-6">
                      <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400">Dados de Identificação</h4>
                        
                        <div className="space-y-3">
                          <div className="p-4 bg-black rounded-2xl border border-neutral-800 flex items-center justify-between">
                            <div>
                              <p className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Matrícula (UID)</p>
                              <p className="registration-number-highlight font-mono tracking-widest">{selectedStudentForFolder.registrationNumber || selectedStudentForFolder.id.slice(0, 8)}</p>
                            </div>
                            <div className="p-2 bg-neutral-900 rounded-lg text-neutral-500">
                              <Cpu size={16} />
                            </div>
                          </div>

                          <div className="p-4 bg-black rounded-2xl border border-neutral-800 flex items-center justify-between">
                            <div>
                              <p className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Código RFID / Cartão</p>
                              <p className="text-sm font-mono text-white tracking-widest">{selectedStudentForFolder.rfid || '--- --- ---'}</p>
                            </div>
                            <button 
                              onClick={() => alert('Para cadastrar RFID, aproxime o cartão da catraca e o sistema irá detectar automaticamente no monitor.')}
                              className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-yellow-400 transition-all"
                            >
                              <RefreshCw size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-xl">
                        <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500">Ações Rápidas</h4>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <button
                            onClick={() => syncUser(selectedStudentForFolder)}
                            disabled={isSyncing || !isHardwareConnected}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-blue-400 hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] transition-all disabled:opacity-50 shadow-lg shadow-blue-900/40 border border-blue-400/30"
                          >
                            {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            SINCRONIZAR AGORA
                          </button>

                          <button
                            onClick={async () => {
                              const success = await releaseTurnstile();
                              if (success) {
                                // Instead of adding to log directly, HardwareContext might handle it
                                console.log(`Liberação manual para ${selectedStudentForFolder.name}`);
                              }
                            }}
                            disabled={!isHardwareConnected}
                            className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-green-400 hover:shadow-[0_0_25px_rgba(22,163,74,0.6)] transition-all disabled:opacity-50 shadow-lg shadow-green-900/40 border border-green-400/30"
                          >
                            <Unlock size={16} />
                            LIBERAR ACESSO
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <a 
                          href={`${hardwareConfig?.protocol || 'https'}://${hardwareConfig?.ip || ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400 group-hover:text-blue-400">
                              <ExternalLink size={14} />
                            </div>
                            <span className="text-[10px] font-black uppercase text-neutral-400 group-hover:text-white">Portal iDFace Local</span>
                          </div>
                          <ArrowRight size={14} className="text-neutral-700 group-hover:text-blue-400" />
                        </a>

                        <a 
                          href="https://idsecure.com.br"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400 group-hover:text-yellow-400">
                              <ShieldCheck size={14} />
                            </div>
                            <span className="text-[10px] font-black uppercase text-neutral-400 group-hover:text-white">Portal iDCloud (Control iD)</span>
                          </div>
                          <ArrowRight size={14} className="text-neutral-700 group-hover:text-yellow-400" />
                        </a>
                      </div>

                      <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                        <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                          <ShieldCheck size={12} /> DICA DE SEGURANÇA
                        </p>
                        <p className="text-[10px] text-neutral-500 italic">
                          Mantenha os dados de face atualizados para evitar falhas no reconhecimento. Alunos com planos vencidos são bloqueados automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {folderTab === 'payments' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 space-y-6">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <History size={14} /> Histórico de Pagamentos
                    </h4>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-black/50 border-b border-neutral-800">
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Data/Hora</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Valor</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Método</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Funcionário</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Plano</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                          {payments
                            .filter(p => p.studentId === selectedStudentForFolder.id)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((payment) => (
                              <tr key={payment.id} className="hover:bg-black/20 transition-colors group">
                                <td className="px-6 py-4 text-xs text-white">
                                  <div className="flex flex-col">
                                    <span>
                                      {payment.date ? (() => {
                                        try {
                                          return format(new Date(payment.date), 'dd/MM/yyyy HH:mm');
                                        } catch (e) {
                                          return payment.date;
                                        }
                                      })() : '---'}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono">{payment.time || '--:--'}</span>
                                  </div>
                                </td>
                                <td className={cn(
                                  "px-6 py-4 text-xs font-bold",
                                  payment.method === 'pix' ? "text-yellow-400" : 
                                  payment.method === 'credit' ? "text-pink-400" : 
                                  payment.method === 'debit' ? "text-orange-400" : 
                                  payment.method === 'recurring' ? "text-blue-400" : 
                                  "text-green-400"
                                )}>
                                  R$ {(payment.amount || 0).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-xs text-neutral-400 capitalize">
                                  {payment.method === 'credit' ? 'Cartão de Crédito' : 
                                   payment.method === 'debit' ? 'Cartão de Débito' : 
                                   payment.method === 'pix' ? 'PIX' : 
                                   payment.method === 'recurring' ? 'Recorrente' : 'Dinheiro'}
                                </td>
                                <td className="px-6 py-4 text-xs text-neutral-400">
                                  {payment.receivedBy || '---'}
                                </td>
                                <td className="px-6 py-4 text-xs text-neutral-500">
                                  <div className="flex flex-wrap gap-2">
                                    {payment.selectedPlans && payment.selectedPlans.length > 0 
                                      ? payment.selectedPlans.map((sp: any) => {
                                          const isActive = (selectedStudentForFolder.planIds || []).includes(sp.planId);
                                          const expDate = selectedStudentForFolder.planExpirations?.[sp.planId];
                                          const isExpired = expDate ? new Date(expDate) < new Date() : false;
                                          const plan = plans.find(p => p.id === sp.planId);

                                          return (
                                            <div key={sp.planId} className={cn(
                                              "flex items-center gap-2 bg-neutral-800/30 px-3 py-1.5 rounded-xl border group/plan",
                                              plan?.isCorporate ? "border-blue-500/30" : "border-neutral-800"
                                            )}>
                                              <div className="flex flex-col">
                                                <span className={cn(
                                                  "font-bold uppercase text-[10px]",
                                                  plan?.isCorporate ? "text-blue-400" : "text-neutral-300"
                                                )}>{sp.planName}</span>
                                                {sp.startDate && sp.endDate && (
                                                  <span className="text-[8px] text-neutral-500 font-mono">
                                                    {format(new Date(`${sp.startDate}T00:00:00`), 'dd/MM/yy')} - {format(new Date(`${sp.endDate}T00:00:00`), 'dd/MM/yy')}
                                                  </span>
                                                )}
                                                {isActive && expDate && (
                                                  <span className={cn(
                                                    "text-[8px] font-black uppercase tracking-tighter",
                                                    plan?.isCorporate ? "text-blue-400" : (isExpired ? "text-red-500" : "text-green-500")
                                                  )}>
                                                    {plan?.isCorporate ? 'Indeterminado' : (isExpired ? 'Expirado' : 'Ativo')}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1 ml-1">
                                                <button 
                                                  onClick={() => {
                                                    setFolderTab('payments');
                                                    setPaymentData({
                                                      ...paymentData,
                                                      selectedPlans: [{ planId: sp.planId, discount: 0 }],
                                                      date: format(new Date(), 'yyyy-MM-dd')
                                                    });
                                                  }}
                                                  className="p-1 text-neutral-600 hover:text-yellow-400 transition-colors"
                                                  title="Cobrar/Renovar"
                                                >
                                                  <DollarSign size={12} />
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    setPendingAction({ type: 'removePlanFromPayment', id: payment.id, extraId: sp.planId });
                                                    setIsPasswordModalOpen(true);
                                                  }}
                                                  className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                                  title="Excluir este plano do histórico"
                                                >
                                                  <XCircle size={12} />
                                                </button>
                                                {isActive && (
                                                  <button 
                                                    onClick={() => {
                                                      setPendingAction({ type: 'plan', id: sp.planId });
                                                      setIsPasswordModalOpen(true);
                                                    }}
                                                    className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                                    title="Remover Plano Ativo"
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })
                                      : (() => {
                                          const plan = plans.find(p => p.id === payment.planId);
                                          if (!plan) return (
                                            <div className="flex items-center gap-2 bg-neutral-800/30 px-3 py-1.5 rounded-xl border border-neutral-800 group/plan">
                                              <span className="font-bold text-neutral-300 uppercase text-[10px]">Avulso</span>
                                              <button 
                                                onClick={() => {
                                                  setPendingAction({ type: 'payment', id: payment.id });
                                                  setIsPasswordModalOpen(true);
                                                }}
                                                className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                                title="Excluir este pagamento do histórico"
                                              >
                                                <XCircle size={12} />
                                              </button>
                                            </div>
                                          );
                                          const isActive = (selectedStudentForFolder.planIds || []).includes(plan.id);
                                          const expDate = selectedStudentForFolder.planExpirations?.[plan.id];
                                          const isExpired = expDate ? new Date(expDate) < new Date() : false;

                                          return (
                                            <div className="flex items-center gap-2 bg-neutral-800/30 px-3 py-1.5 rounded-xl border border-neutral-800 group/plan">
                                              <div className="flex flex-col">
                                                <span className="font-bold text-neutral-300 uppercase text-[10px]">{plan.name}</span>
                                                {isActive && expDate && (
                                                  <span className={cn(
                                                    "text-[8px] font-black uppercase tracking-tighter",
                                                    isExpired ? "text-red-500" : "text-green-500"
                                                  )}>
                                                    {isExpired ? 'Expirado' : 'Ativo'}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1 ml-1">
                                                <button 
                                                  onClick={() => {
                                                    setFolderTab('payments');
                                                    setPaymentData({
                                                      ...paymentData,
                                                      selectedPlans: [{ planId: plan.id, discount: 0 }],
                                                      date: format(new Date(), 'yyyy-MM-dd')
                                                    });
                                                  }}
                                                  className="p-1 text-neutral-600 hover:text-yellow-400 transition-colors"
                                                  title="Cobrar/Renovar"
                                                >
                                                  <DollarSign size={12} />
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    setPendingAction({ type: 'payment', id: payment.id });
                                                    setIsPasswordModalOpen(true);
                                                  }}
                                                  className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                                  title="Excluir este pagamento do histórico"
                                                >
                                                  <XCircle size={12} />
                                                </button>
                                                {isActive && (
                                                  <button 
                                                    onClick={() => {
                                                      setPendingAction({ type: 'plan', id: plan.id });
                                                      setIsPasswordModalOpen(true);
                                                    }}
                                                    className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                                    title="Remover Plano Ativo"
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                      onClick={() => handleEditPaymentClick(payment)}
                                      className="p-2 text-neutral-600 hover:text-yellow-400"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeletePayment(payment.id)}
                                      className="p-2 text-neutral-600 hover:text-red-500"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {payments.filter(p => p.studentId === selectedStudentForFolder.id).length === 0 && (
                        <div className="p-12 text-center text-neutral-600 italic">
                          Nenhum pagamento registrado.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    {/* SEÇÃO DE PLANOS VINCULADOS */}
                    <div className="bg-neutral-900 rounded-[32px] p-6 border border-neutral-800 shadow-xl">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity size={14} className="text-yellow-400" /> Selecionar Planos para Pagamento
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {Array.isArray(selectedStudentForFolder.planIds) && selectedStudentForFolder.planIds.map((planId: string) => {
                          const plan = plans.find(p => p.id === planId);
                          if (!plan) return null;
                          const isSelected = paymentData.selectedPlans.some(sp => sp.planId === planId);
                          
                          const paymentDate = new Date(`${paymentData.date}T${paymentData.time || '00:00'}:00`);
                          const planDates = getPlanDates(selectedStudentForFolder, planId, paymentDate);

                          return (
                            <div key={planId} className="relative group">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setPaymentData({
                                      ...paymentData,
                                      selectedPlans: paymentData.selectedPlans.filter(sp => sp.planId !== planId)
                                    });
                                  } else {
                                    setPaymentData({
                                      ...paymentData,
                                      selectedPlans: [...paymentData.selectedPlans, { planId, discount: 0 }]
                                    });
                                  }
                                }}
                                className={cn(
                                  "w-full p-5 rounded-2xl border transition-all text-left flex items-start gap-4",
                                  isSelected 
                                    ? "bg-yellow-400/10 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.1)]" 
                                    : "bg-black border-neutral-800 hover:border-neutral-700"
                                )}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 shrink-0",
                                  isSelected ? "bg-yellow-400 border-yellow-400" : "border-neutral-800"
                                )}>
                                  {isSelected && <CheckCircle2 size={12} className="text-black" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className={cn(
                                      "text-sm font-black uppercase italic tracking-tight truncate",
                                      isSelected ? "text-yellow-400" : "text-white"
                                    )}>{plan.name}</p>
                                    <p className="text-sm font-black text-white shrink-0">R$ {(plan.price || 0).toFixed(2)}</p>
                                  </div>
                                  
                                  {planDates && (
                                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-neutral-800/50">
                                      <div className="space-y-0.5">
                                        <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Vencimento Atual</p>
                                        <p className={cn(
                                          "text-[10px] font-black uppercase",
                                          planDates.current && new Date(`${planDates.current}T00:00:00`) < new Date() 
                                            ? "text-red-500" 
                                            : "text-neutral-400"
                                        )}>
                                          {planDates.current ? format(new Date(`${planDates.current}T00:00:00`), 'dd/MM/yyyy') : 'Nenhum'}
                                        </p>
                                      </div>
                                      <div className="space-y-0.5">
                                        <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Novo Vencimento</p>
                                        <p className="text-[10px] font-black text-green-500 uppercase">
                                          {format(new Date(`${planDates.next}T00:00:00`), 'dd/MM/yyyy')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleTogglePlanInFolder(planId)}
                                className="absolute -top-2 -right-2 p-2 bg-neutral-900 border border-neutral-800 text-neutral-600 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 z-10"
                                title="Remover este plano do aluno"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {(!Array.isArray(selectedStudentForFolder.planIds) || selectedStudentForFolder.planIds.length === 0) && (
                          <div className="p-8 text-center border-2 border-dashed border-neutral-800 rounded-2xl">
                            <p className="text-xs text-neutral-600 italic uppercase font-bold tracking-widest">Nenhum plano vinculado</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-neutral-900 rounded-[32px] p-6 border border-neutral-800 shadow-xl">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <DollarSign size={14} className="text-yellow-400" /> Registrar Pagamento
                      </h4>
                      <form onSubmit={handleRecordPayment} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Descrição / Observação</label>
                          <input
                            type="text"
                            placeholder="Opcional..."
                            className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-2xl text-xs text-white font-bold focus:border-yellow-400 outline-none transition-all"
                            value={paymentData.description}
                            onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Data</label>
                            <input
                              required
                              type="date"
                              className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-2xl text-xs text-white font-bold focus:border-yellow-400 outline-none transition-all"
                              value={paymentData.date}
                              onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Hora</label>
                            <input
                              required
                              type="time"
                              className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-2xl text-xs text-white font-bold focus:border-yellow-400 outline-none transition-all"
                              value={paymentData.time}
                              onChange={(e) => setPaymentData({ ...paymentData, time: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Funcionário Responsável</label>
                          <input
                            type="text"
                            readOnly
                            placeholder="Nome do funcionário"
                            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-400 font-bold outline-none cursor-not-allowed"
                            value={paymentData.receivedBy}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Método de Pagamento</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                  { id: 'pix', icon: Smartphone, label: 'PIX', active: 'text-yellow-400 border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.4)]', inactive: 'text-yellow-400/80 border-neutral-800 bg-neutral-900/50 hover:text-yellow-400 hover:border-yellow-400' },
                                  { id: 'credit', icon: CreditCard, label: 'Crédito', active: 'text-pink-400 border-pink-400 bg-pink-400/20 shadow-[0_0_20px_rgba(244,114,182,0.4)]', inactive: 'text-pink-400/80 border-neutral-800 bg-neutral-900/50 hover:text-pink-400 hover:border-pink-400' },
                                  { id: 'debit', icon: CreditCard, label: 'Débito', active: 'text-orange-400 border-orange-400 bg-orange-400/20 shadow-[0_0_20px_rgba(251,146,60,0.4)]', inactive: 'text-orange-400/80 border-neutral-800 bg-neutral-900/50 hover:text-orange-400 hover:border-orange-400' },
                                  { id: 'recurring', icon: RefreshCw, label: 'Recorrente', active: 'text-blue-400 border-blue-400 bg-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.4)]', inactive: 'text-blue-400/80 border-neutral-800 bg-neutral-900/50 hover:text-blue-400 hover:border-blue-400' },
                                  { id: 'money', icon: Banknote, label: 'Dinheiro', active: 'text-green-400 border-green-400 bg-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.4)]', inactive: 'text-green-400/80 border-neutral-800 bg-neutral-900/50 hover:text-green-400 hover:border-green-400' }
                                ].map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setPaymentData({ ...paymentData, method: m.id as any })}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all w-full",
                                      paymentData.method === m.id ? m.active : m.inactive
                                    )}
                                  >
                                    <m.icon size={16} className="shrink-0" />
                                    <span className="text-[10px] font-bold uppercase tracking-tight truncate">{m.label}</span>
                                  </button>
                                ))}
                            </div>
                          </div>

                          {paymentData.selectedPlans.length === 0 && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Valor Avulso</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500">R$</span>
                                <input
                                  required
                                  type="number"
                                  step="0.01"
                                  className="w-full pl-10 pr-4 py-3 bg-black border border-neutral-800 rounded-2xl text-xs text-white font-bold focus:border-yellow-400 outline-none transition-all"
                                  value={paymentData.amount}
                                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-neutral-800">
                          {/* Descontos logo acima do total */}
                          {paymentData.selectedPlans.length > 0 ? (
                            <div className="mb-4 space-y-3 p-4 bg-black/40 rounded-2xl border border-neutral-800/50">
                              <h5 className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2 px-1">Descontos nos Planos</h5>
                              <div className="grid grid-cols-1 gap-2">
                                {paymentData.selectedPlans.map((sp, idx) => {
                                  const plan = plans.find(p => p.id === sp.planId);
                                  return (
                                    <div key={sp.planId} className="flex items-center justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase truncate">{plan?.name}</p>
                                      </div>
                                      <div className="w-24 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-600">R$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="0.00"
                                          className="w-full pl-8 pr-3 py-1.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-xs text-white font-bold focus:border-yellow-400 outline-none transition-all"
                                          value={sp.discount || ''}
                                          onChange={(e) => {
                                            const newSelectedPlans = [...paymentData.selectedPlans];
                                            newSelectedPlans[idx].discount = Number(e.target.value);
                                            setPaymentData({ ...paymentData, selectedPlans: newSelectedPlans });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-black/40 rounded-2xl border border-neutral-800/50">
                              <div className="flex flex-col">
                                <h5 className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">Desconto Geral</h5>
                                <p className="text-[10px] text-neutral-600 font-bold">Abatimento no valor avulso</p>
                              </div>
                              <div className="w-24 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-600">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="w-full pl-8 pr-3 py-1.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-xs text-white font-bold focus:border-yellow-400 outline-none transition-all"
                                  value={paymentData.discount || ''}
                                  onChange={(e) => setPaymentData({ ...paymentData, discount: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mb-6 px-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">Total a Receber</span>
                              {(() => {
                                const method = paymentData.method;
                                const m = [
                                  { id: 'pix', icon: Smartphone, label: 'PIX', color: 'text-yellow-400' },
                                  { id: 'credit', icon: CreditCard, label: 'Cartão de Crédito', color: 'text-pink-400' },
                                  { id: 'debit', icon: CreditCard, label: 'Cartão de Débito', color: 'text-orange-400' },
                                  { id: 'recurring', icon: RefreshCw, label: 'Recorrente', color: 'text-blue-400' },
                                  { id: 'money', icon: Banknote, label: 'Dinheiro', color: 'text-green-400' }
                                ].find(item => item.id === method);
                                
                                if (!m) return null;
                                return (
                                  <div className={cn("flex items-center gap-1.5", m.color)}>
                                    <m.icon size={12} strokeWidth={3} />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">{m.label}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <span className={cn(
                              "text-3xl font-black italic",
                              paymentData.method === 'pix' ? "text-yellow-400" : 
                              paymentData.method === 'credit' ? "text-pink-400" : 
                              paymentData.method === 'debit' ? "text-orange-400" : 
                              paymentData.method === 'recurring' ? "text-blue-400" : 
                              "text-green-400"
                            )}>
                              R$ {(() => {
                                if (paymentData.selectedPlans.length > 0) {
                                  const total = paymentData.selectedPlans.reduce((acc, sp) => {
                                    const plan = plans.find(p => p.id === sp.planId);
                                    return acc + (plan?.price || 0) - (sp.discount || 0);
                                  }, 0);
                                  return total.toFixed(2);
                                }
                                return (Number(paymentData.amount) - Number(paymentData.discount || 0)).toFixed(2);
                              })()}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setPaymentData({
                                amount: 0,
                                discount: 0,
                                method: 'pix',
                                selectedPlans: [],
                                description: '',
                                date: format(new Date(), 'yyyy-MM-dd'),
                                time: format(new Date(), 'HH:mm'),
                                receivedBy: profile?.displayName || ''
                              })}
                              className="w-full bg-neutral-800 text-neutral-400 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-700 transition-all"
                            >
                              <XCircle size={18} />
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={isSaving}
                              className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/10 disabled:opacity-50 group"
                            >
                              {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                              {isSaving ? 'Processando...' : 'Confirmar'}
                              {!isSaving && <ArrowRight className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {folderTab === 'history' && (
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} /> Registros de Entrada Recentes
                  </h4>
                  <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/50 border-b border-neutral-800">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Data e Hora</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Status no Momento</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-neutral-500">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {accessLogs
                          .filter(l => l.studentId === selectedStudentForFolder.id)
                          .map((log) => (
                            <tr key={log.id} className="hover:bg-black/20 transition-colors">
                              <td className="px-6 py-4 text-xs text-white">
                                {(() => {
                                  try {
                                    const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                    return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
                                  } catch (e) {
                                    return 'Data inválida';
                                  }
                                })()}
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                                  log.status === 'active' ? "bg-green-950 text-green-400" : "bg-red-950 text-red-400"
                                )}>
                                  {log.status === 'active' ? 'Liberado' : 'Bloqueado'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-neutral-500 uppercase font-bold">
                                {log.method || 'Reconhecimento Facial'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {accessLogs.filter(l => l.studentId === selectedStudentForFolder.id).length === 0 && (
                      <div className="p-12 text-center text-neutral-600 italic">
                        Nenhum registro de acesso encontrado.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Class Modal */}
      {isQuickClassModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-neutral-900 w-full max-w-sm rounded-3xl shadow-2xl border border-neutral-800 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white uppercase italic">Criar Turma Rápida</h3>
              <button onClick={() => setIsQuickClassModalOpen(false)} className="text-neutral-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleQuickClassSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Modalidade / Nome</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Jiu-Jitsu, Muay Thai"
                  className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                  value={quickClassData.modality}
                  onChange={(e) => setQuickClassData({ ...quickClassData, modality: e.target.value, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Professor / Instrutor</label>
                <input
                  type="text"
                  list="instructor-suggestions"
                  placeholder="Nome do professor"
                  className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                  value={quickClassData.instructor}
                  onChange={(e) => setQuickClassData({ ...quickClassData, instructor: e.target.value })}
                />
                <datalist id="instructor-suggestions">
                  {Array.from(new Set(classes.map(c => c.instructor).filter(Boolean))).map(instructor => (
                    <option key={instructor} value={instructor} />
                  ))}
                </datalist>
              </div>
              <p className="text-[10px] text-neutral-500 italic">
                * Horários e dias podem ser editados posteriormente na aba "Aulas".
              </p>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Criando...' : 'Criar e Selecionar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Plan Modal */}
      {isQuickPlanModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-neutral-900 w-full max-w-sm rounded-3xl shadow-2xl border border-neutral-800 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white uppercase italic">Criar Plano Rápido</h3>
              <button onClick={() => setIsQuickPlanModalOpen(false)} className="text-neutral-500 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleQuickPlanSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Nome do Plano</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Mensal, Trimestral"
                  className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                  value={quickPlanData.name}
                  onChange={(e) => setQuickPlanData({ ...quickPlanData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Preço (R$)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                  value={quickPlanData.price}
                  onChange={(e) => setQuickPlanData({ ...quickPlanData, price: parseFloat(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Duração (Dias)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                    value={quickPlanData.durationDays}
                    onChange={(e) => setQuickPlanData({ ...quickPlanData, durationDays: parseInt(e.target.value), durationMonths: 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Duração (Meses)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-black border border-neutral-800 rounded-xl text-sm text-white focus:border-yellow-400 outline-none"
                    value={quickPlanData.durationMonths}
                    onChange={(e) => setQuickPlanData({ ...quickPlanData, durationMonths: parseInt(e.target.value), durationDays: 0 })}
                  />
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 italic">
                * Detalhes podem ser editados posteriormente na aba "Planos".
              </p>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Criando...' : 'Criar e Selecionar'}
              </button>
            </form>
          </div>
        </div>
      )}
       {/* Password Confirmation Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 w-full max-w-md rounded-[32px] border border-neutral-800 p-8 shadow-2xl space-y-6 animate-in zoom-in duration-200">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Confirmar Exclusão</h3>
              <p className="text-neutral-400 text-sm">Esta ação removerá o vínculo do aluno com este item. Digite sua senha de segurança para confirmar.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2">Senha de Segurança</label>
                <div className="relative group">
                  <input 
                    type={showPassword ? "text" : "password"}
                    autoFocus
                    className={cn(
                      "w-full bg-black border rounded-2xl pl-6 pr-14 py-4 text-white font-bold focus:outline-none transition-all",
                      passwordError ? "border-red-500 ring-4 ring-red-500/10" : "border-neutral-800 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10"
                    )}
                    placeholder="Digite sua senha"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmAction()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest px-2 mt-1">{passwordError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordInput('');
                    setPasswordError('');
                    setPendingAction(null);
                  }}
                  className="py-4 rounded-2xl font-bold text-neutral-400 uppercase tracking-widest hover:bg-neutral-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CADASTRO DE FACE */}
      {showEnrollModal && enrollStudent && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-xl space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-yellow-400">Cadastro Facial</h2>
              <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest">
                Aluno: <span className="text-white">{enrollStudent.name}</span>
              </p>
            </div>

            <div className="relative aspect-[3/4] bg-neutral-900 rounded-[40px] overflow-hidden border-2 border-neutral-800 shadow-2xl">
              {!enrollCapturedImage ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover scale-x-[-1]" 
                  />
                  <div className="absolute inset-x-0 bottom-10 flex justify-center px-8">
                    <button
                      onClick={capturePhoto}
                      className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-8 border-white/20 hover:scale-110 transition-transform"
                    >
                      <div className="w-14 h-14 border-4 border-black rounded-full" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img 
                    src={enrollCapturedImage} 
                    alt="Face capturada" 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="bg-yellow-400 p-4 rounded-full text-black shadow-2xl">
                      <CheckCircle2 size={48} />
                    </div>
                  </div>
                </>
              )}
              
              {/* Overlay Guideline */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-80 border-2 border-dashed border-white/30 rounded-[100px]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  if (enrollCapturedImage) {
                    setEnrollCapturedImage(null);
                  } else {
                    setShowEnrollModal(false);
                    stopCamera();
                  }
                }}
                className="py-5 bg-neutral-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-700 transition-all"
              >
                {enrollCapturedImage ? 'TENTAR NOVAMENTE' : 'CANCELAR'}
              </button>
              
              <button
                disabled={!enrollCapturedImage || isEnrolling}
                onClick={handleEnrollFace}
                className="py-5 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isEnrolling ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {isEnrolling ? 'ENVIANDO...' : 'CONFIRMAR E SINCRONIZAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALTERAR VENCIMENTO */}
      {isEditExpirationModalOpen && selectedPlanForExpiration && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <header className="flex items-center justify-between">
                <div className="bg-yellow-400/10 p-3 rounded-2xl text-yellow-400">
                  <Calendar size={24} />
                </div>
                <button 
                  onClick={() => setIsEditExpirationModalOpen(false)}
                  className="p-2 text-neutral-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </header>

              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-white">Alterar Vencimento</h3>
                <p className="text-sm text-neutral-500">
                  Ajuste a data de expiração do plano <span className="text-yellow-400 font-bold">{selectedPlanForExpiration.name}</span>.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2">Novo Vencimento</label>
                  <input
                    type="date"
                    className="w-full bg-black border border-neutral-800 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 transition-all"
                    value={newExpirationDate}
                    onChange={(e) => setNewExpirationDate(e.target.value)}
                  />
                </div>

                {proportionalAmount > 0 && (
                  <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Diferença Proporcional</span>
                      <span className="text-sm font-black text-yellow-400">R$ {proportionalAmount.toFixed(2)}</span>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={chargeProportional}
                          onChange={(e) => setChargeProportional(e.target.checked)}
                        />
                        <div className="w-10 h-6 bg-neutral-800 rounded-full peer peer-checked:bg-yellow-400 transition-all"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-all shadow-sm"></div>
                      </div>
                      <span className="text-xs font-bold text-neutral-400 group-hover:text-white transition-colors uppercase tracking-widest">Cobrar Diferença</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setIsEditExpirationModalOpen(false)}
                  className="py-4 rounded-2xl font-bold text-neutral-400 uppercase tracking-widest hover:bg-neutral-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateExpiration}
                  disabled={isSaving}
                  className="bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PROPAGANDA / BROADCAST */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl max-h-[90vh] rounded-[32px] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <header className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                <div className="bg-yellow-400 p-3 rounded-2xl text-black shadow-lg shadow-yellow-400/20">
                  <Megaphone size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Criar Propaganda</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Mande promoções para seus alunos via WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
              >
                <XCircle size={24} />
              </button>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6">
              {/* Esquerda: Editor de Mensagem */}
              <div className="flex-1 space-y-4 flex flex-col">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2">Mensagem da Promoção</label>
                  <textarea
                    className="w-full bg-black border border-neutral-800 rounded-2xl px-6 py-4 text-white text-sm min-h-[200px] focus:outline-none focus:border-yellow-400 transition-all resize-none italic"
                    placeholder="Olá! Temos uma promoção especial para você..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                  />
                  <p className="text-[10px] text-neutral-600 px-2 italic">Dica: Use uma mensagem curta e direta para evitar ser bloqueado.</p>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 mt-auto">
                    <p className="text-[10px] text-blue-400 font-black uppercase mb-1 flex items-center gap-2">
                        <AlertCircle size={12} /> Como funciona?
                    </p>
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                        Ao clicar em "Mandar WhatsApp", o sistema abrirá uma janela do WhatsApp com a mensagem preenchida. 
                        Você só precisará clicar em "Enviar" no WhatsApp. O sistema marcará o aluno como "Enviado" para seu controle.
                    </p>
                </div>
              </div>

              {/* Direita: Lista de Alunos */}
              <div className="w-full md:w-80 bg-black rounded-3xl border border-neutral-800 p-4 flex flex-col overflow-hidden">
                <div className="space-y-4 mb-4 px-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            className="rounded border-neutral-800 bg-neutral-900 text-yellow-400 focus:ring-yellow-400"
                            checked={selectedBroadcastIds.length === students.filter(s => s.phone).length && students.filter(s => s.phone).length > 0}
                            onChange={handleSelectAllBroadcast}
                          />
                          <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Selecionar Todos ({students.filter(s => s.phone).length})</h4>
                        </div>
                        <button 
                            onClick={() => {
                              setBroadcastStudentsSent([]);
                              setSelectedBroadcastIds([]);
                            }}
                            className="text-[8px] font-black text-red-500 uppercase hover:underline"
                        >
                            Reiniciar
                        </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={12} />
                      <input 
                        type="text"
                        placeholder="Buscar aluno..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-4 py-1.5 text-[10px] text-white focus:outline-none focus:border-yellow-400 transition-all uppercase font-bold"
                        value={broadcastSearch}
                        onChange={(e) => setBroadcastSearch(e.target.value)}
                      />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent pr-2">
                  {students
                    .filter(s => s.phone && s.name.toLowerCase().includes(broadcastSearch.toLowerCase()))
                    .map(student => {
                      const isSent = broadcastStudentsSent.includes(student.id);
                      const isSelected = selectedBroadcastIds.includes(student.id);
                      return (
                        <div key={student.id} className={cn(
                          "p-3 border rounded-xl flex items-center justify-between group transition-all",
                          isSelected 
                            ? "bg-yellow-400/5 border-yellow-400/20" 
                            : "bg-neutral-900/50 border-neutral-800"
                        )}>
                          <div className="flex items-center gap-3 min-w-0">
                            <input 
                              type="checkbox"
                              className="rounded border-neutral-800 bg-neutral-900 text-yellow-400 focus:ring-yellow-400"
                              checked={isSelected}
                              onChange={() => handleToggleSelectBroadcast(student.id)}
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-white truncate">{student.name.toUpperCase()}</p>
                              <p className="text-[9px] text-neutral-500 font-mono">{student.phone}</p>
                            </div>
                          </div>
                          <a
                            href={`https://wa.me/55${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(broadcastMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              if (!broadcastStudentsSent.includes(student.id)) {
                                setBroadcastStudentsSent([...broadcastStudentsSent, student.id]);
                              }
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              isSent 
                                ? "bg-blue-500 shadow-lg shadow-blue-500/20 text-white" 
                                : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                            )}
                          >
                            {isSent ? <CheckCircle2 size={14} /> : <Phone size={14} />}
                          </a>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <footer className="p-6 bg-black/40 border-t border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                        {students.slice(0, 5).map(s => (
                            <div key={s.id} className="w-6 h-6 rounded-full border-2 border-black bg-neutral-800 overflow-hidden">
                                {s.photoUrl ? (
                                    <img src={s.photoUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-500 font-bold uppercase">{s.name.toUpperCase().charAt(0)}</div>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">
                        {broadcastStudentsSent.length} de {students.filter(s => s.phone).length} enviados
                    </p>
                </div>
                <div className="flex gap-3">
                  <button
                      disabled={isSendingBulk || selectedBroadcastIds.length === 0}
                      onClick={handleStartBulkSend}
                      className={cn(
                        "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2",
                        isSendingBulk
                          ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                          : "bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
                      )}
                  >
                      {isSendingBulk ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Phone size={14} />
                          Mandar WhatsApp ({selectedBroadcastIds.length})
                        </>
                      )}
                  </button>
                  <button
                      onClick={() => setIsBroadcastModalOpen(false)}
                      className="px-8 py-3 bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neutral-700 transition-all"
                  >
                      Fechar
                  </button>
                </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
