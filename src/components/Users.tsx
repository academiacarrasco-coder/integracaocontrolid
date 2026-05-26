import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Shield, 
  User, 
  Mail, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert,
  Search,
  Plus,
  Loader2,
  X,
  Edit2,
  Camera,
  ScanFace,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../hooks/useAuth';
import { useHardware } from '../contexts/HardwareContext';

export default function Users() {
  const location = useLocation();
  const { syncUser, enrollFace, isHardwareConnected } = useHardware();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Camera state for face enrollment
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enrollStep, setEnrollStep] = useState<'camera' | 'uploading'>('camera');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);

  // Keep streamRef in sync with stream state
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('add') === 'true') {
      setShowAddModal(true);
    }
  }, [location]);

  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    displayName: '',
    jobTitle: '',
    phone: '',
    cpf: '',
    role: 'employee' as 'admin' | 'employee',
    isProfessor: false,
    permissions: [] as string[],
    webhookUrl: ''
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Initial load from Firestore Direct (Robust)
    const loadData = async () => {
      try {
        const { getDocsFromServer, collection } = await import('firebase/firestore');
        const snap = await getDocsFromServer(collection(db, 'users'));
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserProfile & { id: string }));
        setUsers(data);
        setLoading(false);
      } catch (e) {
        console.warn('Users direct load failed, trying proxy...');
        try {
          const res = await fetch('/api/users/list');
          if (res.ok) {
            const data = await res.json();
            setUsers(data);
          }
        } catch (proxyErr) {
          console.error('Users proxy load also failed');
        }
        setLoading(false);
      }
    };

    loadData();
    return () => {};
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password || !newUserData.displayName) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    
    // Check if username already exists
    const existingUser = users.find(u => u.username === newUserData.username);
    if (existingUser) {
      setError('Este Login já está em uso.');
      return;
    }
    
    setAdding(true);
    setError('');
    try {
      await addDoc(collection(db, 'users'), {
        ...newUserData,
        status: 'active', // Active by default for internal login
        createdAt: serverTimestamp(),
        photoURL: capturedImage || '',
        uid: '' // No Firebase UID for internal users
      });
      setShowAddModal(false);
      setCapturedImage(null);
      setNewUserData({ username: '', password: '', displayName: '', jobTitle: '', phone: '', cpf: '', role: 'employee', isProfessor: false, permissions: [], webhookUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      setError('Erro ao cadastrar usuário.');
    } finally {
      setAdding(false);
    }
  };

  const setPreset = (role: 'admin' | 'employee', permissions: string[]) => {
    setNewUserData({ ...newUserData, role, permissions });
  };

  const toggleNewUserPermission = (permId: string) => {
    const current = newUserData.permissions;
    const next = current.includes(permId)
      ? current.filter(p => p !== permId)
      : [...current, permId];
    setNewUserData({ ...newUserData, permissions: next });
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'employee') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdateJobTitle = async (uid: string, newTitle: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { jobTitle: newTitle });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdateUsername = async (uid: string, newUsername: string) => {
    if (!newUsername) return;
    try {
      await updateDoc(doc(db, 'users', uid), { username: newUsername });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdatePassword = async (uid: string, newPassword: string) => {
    if (!newPassword) return;
    try {
      await updateDoc(doc(db, 'users', uid), { password: newPassword });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser({ ...user });
    setCapturedImage(null);
    setIsCameraOpen(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.displayName || !editingUser.username) return;

    setIsSaving(true);
    try {
      const { id, ...updateData } = editingUser;
      if (capturedImage) {
        updateData.photoURL = capturedImage;
      }
      await updateDoc(doc(db, 'users', id), updateData);
      setShowEditModal(false);
      setEditingUser(null);
      setCapturedImage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.id}`);
    } finally {
      setIsSaving(false);
    }
  };

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
          // Fallback 2: Deep scan devices
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
        return;
      }

      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      if (videoInputs.length === 0 || !videoInputs[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          devices = await navigator.mediaDevices.enumerateDevices();
          videoInputs = devices.filter(device => device.kind === 'videoinput');
          tempStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.warn("Permission denied or no camera found", e);
        }
      }
      
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0) {
        if (!selectedVideoDeviceId || !videoInputs.find(d => d.deviceId === selectedVideoDeviceId)) {
          setSelectedVideoDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    } finally {
      setIsRefreshingDevices(false);
    }
  };

  useEffect(() => {
    if (showAddModal || showEditModal) {
      refreshVideoDevices();
    } else {
      stopCamera();
      setCapturedImage(null);
    }
  }, [showAddModal, showEditModal, stopCamera]);

  useEffect(() => {
    if (isCameraOpen && selectedVideoDeviceId) {
      const currentStreamDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId;
      if (!stream || (currentStreamDeviceId && currentStreamDeviceId !== selectedVideoDeviceId)) {
        startCamera();
      }
    }
  }, [selectedVideoDeviceId, isCameraOpen, startCamera, stream]);

  useEffect(() => {
    if (isCameraOpen) {
      refreshVideoDevices();
    }
  }, [isCameraOpen]);

  useEffect(() => {
    if (isCameraOpen && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError') console.error("Video play error:", err);
      });
    }
  }, [isCameraOpen, stream, capturedImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      
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
          videoRef.current, 
          sourceX, sourceY, sourceWidth, sourceHeight, 
          0, 0, canvas.width, canvas.height
        );
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
        stopCamera();
      }
    }
  };

  const handleEnrollFace = async () => {
    if (!editingUser || !capturedImage) return;
    if (!isHardwareConnected) {
      alert("A catraca não está conectada. Verifique a conexão USB ou IP nas configurações.");
      return;
    }
    setEnrollStep('uploading');
    const userId = editingUser.id;
    const success = await enrollFace(userId, capturedImage);
    if (success) {
      alert("Face cadastrada com sucesso!");
      setCapturedImage(null);
      setIsCameraOpen(false);
      setEnrollStep('camera');
    } else {
      setEnrollStep('camera');
    }
  };

  const togglePermission = async (user: UserProfile & { id: string }, permission: string) => {
    const currentPermissions = user.permissions || [];
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter(p => p !== permission)
      : [...currentPermissions, permission];
    
    try {
      await updateDoc(doc(db, 'users', user.id), { permissions: newPermissions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const availablePermissions = [
    { id: 'students', label: 'Alunos' },
    { id: 'plans', label: 'Planos' },
    { id: 'classes', label: 'Aulas' },
    { id: 'payments', label: 'Pagamentos' },
    { id: 'turnstile', label: 'Catraca' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'export', label: 'Exportar' },
    { id: 'settings', label: 'Configurações' },
  ];

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm('Tem certeza que deseja remover este acesso?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.cpf?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-neutral-500 italic">Carregando usuários...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white italic uppercase">Gestão de Funcionários</h2>
          <p className="text-neutral-500">Controle quem pode acessar o sistema e quais são suas permissões.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-yellow-400 text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/10"
        >
          <Plus size={20} />
          Cadastrar Funcionário
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
        <input
          type="text"
          placeholder="Buscar por nome, login, email ou CPF..."
          className="w-full pl-12 pr-4 py-4 bg-black border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <div key={(user as any).id || user.uid || user.username} className="bg-black rounded-3xl border-2 border-neutral-600 overflow-hidden group hover:border-yellow-400 transition-all">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random`} 
                      alt={user.displayName} 
                      className="w-12 h-12 rounded-2xl border-2 border-neutral-600 object-cover"
                    />
                    {user.status === 'pending' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-black animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{user.displayName || 'Aguardando Login'}</h3>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-tighter">
                        {user.jobTitle || 'Cargo não definido'}
                      </p>
                      {user.isProfessor && (
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 size={10} /> Ponto
                        </p>
                      )}
                      <p className="text-xs text-neutral-500 flex items-center gap-1">
                        <User size={12} />
                        {user.username || user.email || ''}
                      </p>
                      {user.cpf && (
                        <p className="text-[9px] text-neutral-600 font-mono flex items-center gap-1">
                          <span className="opacity-50">CPF:</span> {user.cpf}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEditUser(user)}
                    className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-xl transition-all"
                    title="Editar Funcionário"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setEditingUser(user);
                      setShowEditModal(true);
                      // Auto-start camera if needed or just let the modal handle it
                    }}
                    className="p-2 text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                    title="Cadastrar Face"
                  >
                    <ScanFace size={18} />
                  </button>
                  {isHardwareConnected && (
                    <button 
                      onClick={() => syncUser(user)}
                      className="p-2 text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                      title="Sincronizar com Catraca"
                    >
                      <RefreshCw size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteUser((user as any).id || user.uid)}
                    className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Excluir Acesso"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-neutral-600">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Nível de Acesso</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRoleChange((user as any).id || user.uid, 'admin')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border-2",
                      user.role === 'admin'
                        ? "bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                        : "bg-neutral-900 border-neutral-600 text-neutral-500 hover:border-neutral-500"
                    )}
                  >
                    <ShieldCheck size={14} />
                    Admin
                  </button>
                  <button
                    onClick={() => handleRoleChange((user as any).id || user.uid, 'employee')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border-2",
                      user.role === 'employee'
                        ? "bg-white border-white text-black shadow-lg shadow-white/10"
                        : "bg-neutral-900 border-neutral-600 text-neutral-500 hover:border-neutral-500"
                    )}
                  >
                    <User size={14} />
                    Funcionário
                  </button>
                </div>
              </div>

              {user.role === 'employee' && (
                <div className="pt-4 border-t-2 border-neutral-600">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3 block">Permissões de Acesso</label>
                  <div className="flex flex-wrap gap-2">
                    {availablePermissions.map((perm) => (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(user as UserProfile & { id: string }, perm.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border-2",
                          user.permissions?.includes(perm.id)
                            ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400"
                            : "bg-neutral-900 border-neutral-600 text-neutral-500 hover:border-neutral-500"
                        )}
                      >
                        {perm.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-3 bg-neutral-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {user.role === 'admin' ? (
                  <>
                    <ShieldAlert size={12} className="text-yellow-400" />
                    <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Acesso Total</span>
                  </>
                ) : (
                  <>
                    <Shield size={12} className="text-neutral-500" />
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Acesso Restrito</span>
                  </>
                )}
              </div>
              {user.status === 'pending' && (
                <span className="text-[9px] font-black bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">Pendente</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border-2 border-neutral-600 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-black">
              <h3 className="text-xl font-bold text-white uppercase italic tracking-tight">Novo Acesso</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="max-h-[80vh] overflow-y-auto">
              {/* Face Enrollment Section */}
              <div className="bg-black p-8 flex flex-col space-y-6 border-b border-neutral-800">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Camera size={14} /> Biometria Facial (Opcional)
                  </h4>
                  <p className="text-[9px] text-neutral-600 font-bold uppercase leading-tight">Capture ou carregue uma foto nítida do rosto para o reconhecimento facial.</p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800">
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
                              className="w-full py-1.5 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-1"
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
                          id="user-photo-upload"
                        />
                        <label 
                          htmlFor="user-photo-upload"
                          className="w-32 h-[170px] bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-yellow-400/50 hover:bg-neutral-800 transition-all group overflow-hidden"
                        >
                          {capturedImage ? (
                            <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
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
                            htmlFor="user-photo-upload"
                            className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:bg-neutral-700 transition-all cursor-pointer"
                          >
                            <Plus size={12} /> Upload
                          </label>
                        </>
                      )}
                    </div>
                    {capturedImage && !isCameraOpen && (
                      <button 
                        type="button" 
                        onClick={() => setCapturedImage(null)}
                        className="text-[10px] font-bold text-red-500 uppercase mt-1 hover:underline block"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddUser} className="p-8 space-y-6">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase flex items-center gap-2">
                  <ShieldAlert size={14} />
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Login de Acesso</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: joao.silva"
                    className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Senha</label>
                    <button 
                      type="button"
                      onClick={() => {
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                        let pass = '';
                        for(let i=0; i<6; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
                        setNewUserData({ ...newUserData, password: pass });
                      }}
                      className="text-[9px] font-bold text-yellow-400 hover:underline uppercase tracking-tighter"
                    >
                      Gerar Senha
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Senha"
                    className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Professor (Controle de Ponto)</label>
                  <button
                    type="button"
                    onClick={() => setNewUserData({ ...newUserData, isProfessor: !newUserData.isProfessor, jobTitle: !newUserData.isProfessor ? 'Professor' : newUserData.jobTitle })}
                    className={cn(
                      "w-full py-3 rounded-xl text-[10px] font-bold transition-all border-2 flex items-center justify-center gap-2",
                      newUserData.isProfessor ? "bg-blue-600/20 border-blue-600 text-blue-400 shadow-lg shadow-blue-600/10" : "bg-black border-neutral-600 text-neutral-500"
                    )}
                  >
                    <Clock size={14} />
                    {newUserData.isProfessor ? 'Sim, Ponto' : 'Não'}
                  </button>
                  <p className="text-[8px] text-neutral-600 font-bold uppercase">Define se o funcionário será usado para controle de ponto.</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do funcionário"
                  className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                  value={newUserData.displayName}
                  onChange={(e) => setNewUserData({ ...newUserData, displayName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Cargo / Função</label>
                  <input
                    type="text"
                    placeholder="Ex: Instrutor"
                    className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={newUserData.jobTitle}
                    onChange={(e) => setNewUserData({ ...newUserData, jobTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">CPF</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={newUserData.cpf}
                    onChange={(e) => setNewUserData({ ...newUserData, cpf: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Nível de Acesso & Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreset('admin', [])}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-bold transition-all border-2",
                      newUserData.role === 'admin' ? "bg-yellow-400 border-yellow-400 text-black" : "bg-black border-neutral-600 text-neutral-500"
                    )}
                  >
                    Gerente (Total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset('employee', ['students', 'payments', 'classes', 'turnstile'])}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-bold transition-all border-2",
                      newUserData.role === 'employee' && newUserData.permissions.length > 0 ? "bg-white border-white text-black" : "bg-black border-neutral-600 text-neutral-500"
                    )}
                  >
                    Recepcionista
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset('employee', [])}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-bold transition-all border-2",
                      newUserData.role === 'employee' && newUserData.permissions.length === 0 ? "bg-white border-white text-black" : "bg-black border-neutral-600 text-neutral-500"
                    )}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {newUserData.role === 'employee' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Permissões Manuais</label>
                  <div className="flex flex-wrap gap-2">
                    {availablePermissions.map((perm) => (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => toggleNewUserPermission(perm.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border-2",
                          newUserData.permissions.includes(perm.id)
                            ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400"
                            : "bg-black border-neutral-600 text-neutral-500 hover:border-neutral-500"
                        )}
                      >
                        {perm.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Link de Integração (App de Treino)</label>
                <input
                  type="url"
                  placeholder="https://seu-app.com/api/personal-link"
                  className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                  value={newUserData.webhookUrl}
                  onChange={(e) => setNewUserData({ ...newUserData, webhookUrl: e.target.value })}
                />
                <p className="text-[9px] text-neutral-600 font-bold uppercase">Link individual fornecido pelo app de treino para este personal.</p>
              </div>

              <button
                type="submit"
                disabled={adding}
                className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all disabled:opacity-50"
              >
                {adding ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                {adding ? 'Cadastrando...' : 'Confirmar Cadastro'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border-2 border-neutral-600 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-black">
              <div>
                <h3 className="text-xl font-bold text-white uppercase italic tracking-tight">Editar Funcionário</h3>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">ID: {editingUser.id}</p>
              </div>
              <button onClick={() => {
                setShowEditModal(false);
                stopCamera();
              }} className="text-neutral-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="max-h-[80vh] overflow-y-auto">
              {/* Face Enrollment Section - Now at the Top for better visibility */}
              <div className="bg-black p-8 flex flex-col space-y-6 border-b border-neutral-800">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Camera size={14} /> Biometria Facial
                  </h4>
                  <p className="text-[9px] text-neutral-600 font-bold uppercase leading-tight">Capture ou carregue uma foto nítida do rosto para o reconhecimento facial.</p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800">
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
                              className="w-full py-1.5 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-1"
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
                          id="edit-user-photo-upload"
                        />
                        <label 
                          htmlFor="edit-user-photo-upload"
                          className="w-32 h-[170px] bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-yellow-400/50 hover:bg-neutral-800 transition-all group overflow-hidden"
                        >
                          {capturedImage ? (
                            <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
                          ) : editingUser.photoURL ? (
                            <img src={editingUser.photoURL} alt="Preview" className="w-full h-full object-cover" />
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
                            htmlFor="edit-user-photo-upload"
                            className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:bg-neutral-700 transition-all cursor-pointer"
                          >
                            <Plus size={12} /> Upload
                          </label>
                          {capturedImage && isHardwareConnected && (
                            <button 
                              type="button" 
                              onClick={handleEnrollFace}
                              disabled={enrollStep === 'uploading'}
                              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10 disabled:opacity-50"
                            >
                              {enrollStep === 'uploading' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              {enrollStep === 'uploading' ? 'Enviando...' : 'Enviar para Catraca'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {capturedImage && !isCameraOpen && (
                      <button 
                        type="button" 
                        onClick={() => setCapturedImage(null)}
                        className="text-[10px] font-bold text-red-500 uppercase mt-1 hover:underline block"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Section */}
              <div className="p-8 space-y-6">
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Nome Completo</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                      value={editingUser.displayName}
                      onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Login</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-black border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                        value={editingUser.username}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Senha</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-mono"
                        value={editingUser.password}
                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Cargo</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                        value={editingUser.jobTitle}
                        onChange={(e) => setEditingUser({ ...editingUser, jobTitle: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">CPF</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                        value={editingUser.cpf || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, cpf: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Telefone</label>
                      <input
                        type="tel"
                        className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                        value={editingUser.phone}
                        onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Professor (Controle de Ponto)</label>
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, isProfessor: !editingUser.isProfessor })}
                      className={cn(
                        "w-full py-3 rounded-xl text-[10px] font-bold transition-all border-2 flex items-center justify-center gap-2",
                        editingUser.isProfessor ? "bg-blue-600/20 border-blue-600 text-blue-400 shadow-lg shadow-blue-600/10" : "bg-black border-neutral-600 text-neutral-500"
                      )}
                    >
                      <Clock size={14} />
                      {editingUser.isProfessor ? 'Sim, Ponto' : 'Não'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Link de Integração (App de Treino)</label>
                    <input
                      type="url"
                      placeholder="https://seu-app.com/api/personal-link"
                      className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={editingUser.webhookUrl || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, webhookUrl: e.target.value })}
                    />
                    <p className="text-[9px] text-neutral-600 font-bold uppercase">Link individual fornecido pelo app de treino para este personal.</p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-yellow-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>

                {isHardwareConnected && (
                  <div className="pt-4 border-t border-neutral-800">
                    <button 
                      onClick={() => syncUser(editingUser)}
                      className="w-full py-3 bg-neutral-800 text-neutral-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-700 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={12} />
                      Sincronizar Dados na Catraca
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredUsers.length === 0 && (
        <div className="p-12 text-center text-neutral-500 italic bg-black rounded-3xl border border-dashed border-neutral-800">
          Nenhum usuário encontrado.
        </div>
      )}
    </div>
  );
}
