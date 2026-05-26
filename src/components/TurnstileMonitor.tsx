import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  ScanFace, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Lock, 
  Unlock,
  Move,
  Clock,
  Calendar,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  doc, 
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useGymData } from '../hooks/useGymData';
import { useHardware } from '../contexts/HardwareContext';

interface AccessLog {
  id: string;
  studentId: string;
  timestamp: any;
  type: 'entry' | 'exit';
  note?: string;
}

interface Student {
  id: string;
  name: string;
  photoUrl?: string;
  status: 'active' | 'inactive';
  planExpirations?: Record<string, string>;
  planIds?: string[];
}

interface Plan {
  id: string;
  name: string;
  isCorporate?: boolean;
}

interface MonitorRequest {
  id: string;
  log: AccessLog;
  student: Student | null;
  isCorporate: boolean;
  corporatePlanNames: string[];
  isReleasing: boolean;
  releaseSuccess: boolean;
  isCheckingIn: boolean;
}

export default function TurnstileMonitor() {
  console.log('TurnstileMonitor: Component rendered');
  const { plans, classes, students, accessLogs, users } = useGymData();
  const { releaseTurnstile, hardwareConfig } = useHardware();
  const [requests, setRequests] = useState<MonitorRequest[]>([]);
  const processedLogIds = useRef<Set<string>>(new Set());
  const plansRef = useRef(plans);
  const isInitialSnapshot = useRef(true);

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  // Listen for RFID/Face events from HardwareContext
  useEffect(() => {
    const handleRFIDEvent = async (e: any) => {
      const tag = e.detail;
      if (!tag) return;
      
      const student = students.find(s => s.rfid === tag || s.id === tag || s.registrationNumber?.toString() === tag?.toString());
      if (student) {
        await processScan(student, 'student');
        return;
      }

      const user = users.find(u => u.id === tag || u.username === tag);
      if (user && user.isProfessor) {
        await processScan(user, 'user');
      }
    };

    window.addEventListener('rfid-scan', handleRFIDEvent);
    return () => window.removeEventListener('rfid-scan', handleRFIDEvent);
  }, [students, users, plans, classes]);

  const processScan = async (subject: any, subjectType: 'student' | 'user' = 'student') => {
    try {
      if (subjectType === 'user') {
        // Professors always allowed if active
        if (subject.status !== 'active') return;

        const lastLog = accessLogs.find(l => l.studentId === subject.id);
        const type = lastLog?.type === 'entry' ? 'exit' : 'entry';
        
        await addDoc(collection(db, 'accessLogs'), {
          studentId: subject.id,
          timestamp: serverTimestamp(),
          type: type,
          subjectType: 'user', // Distinction
          isProfessor: true
        });

        if (hardwareConfig.ip) {
          releaseTurnstile();
        }
        return;
      }

      const student = subject;
      const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
      const studentExpirations = student.planExpirations || {};
      const currentPlans = plansRef.current;
      const studentPlans = currentPlans.filter(p => studentPlanIds.includes(p.id));

      // Check status
      if (student.status !== 'active') {
        return; // Or show a denied monitor
      }

      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const todayStr = format(now, 'yyyy-MM-dd');
      
      // 1. Check Plan Expiration
      let hasActivePlan = false;
      for (const plan of studentPlans) {
        const expirationDate = studentExpirations[plan.id];
        if (expirationDate && expirationDate >= todayStr) {
          hasActivePlan = true;
          break;
        }
      }

      const hasCorporatePlan = studentPlans.some(p => p.isCorporate);
      if (hasCorporatePlan) hasActivePlan = true;

      // 2. Check Class Hours
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

      if (!hasActivePlan || (!allowedByClass && !hasCorporatePlan)) {
        return; // Denied
      }

      // Success - Log access
      const lastLog = accessLogs.find(l => l.studentId === student.id);
      const type = lastLog?.type === 'entry' ? 'exit' : 'entry';
      
      await addDoc(collection(db, 'accessLogs'), {
        studentId: student.id,
        timestamp: serverTimestamp(),
        type: type,
        classId: (type === 'entry' && allowedByClass && activeClass) ? activeClass.id : null
      });

      // Release hardware
      if (hardwareConfig.ip) {
        releaseTurnstile();
      }

    } catch (error) {
      console.error('Error processing scan in monitor:', error);
    }
  };

  const parseDate = (dateVal: any) => {
    if (!dateVal) return new Date();
    if (typeof dateVal === 'string') return new Date(dateVal);
    if (dateVal && typeof dateVal === 'object' && typeof dateVal.toDate === 'function') return dateVal.toDate();
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // Listen for new access logs (this is what actually triggers the UI)
  useEffect(() => {
    // Monitor listener disabled temporarily to stop connection errors and log noise
    return () => {};
  }, []);

  const removeRequest = (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const updateRequest = (id: string, updates: Partial<MonitorRequest>) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleManualRelease = async (request: MonitorRequest) => {
    updateRequest(request.id, { isReleasing: true });
    try {
      // Simulate hardware communication
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the manual release
      await addDoc(collection(db, 'accessLogs'), {
        studentId: 'manual_release',
        timestamp: serverTimestamp(),
        type: 'entry',
        note: 'Liberação manual pelo funcionário'
      });

      updateRequest(request.id, { releaseSuccess: true });
      setTimeout(() => {
        removeRequest(request.id);
      }, 3000);
    } catch (error) {
      console.error('Erro ao liberar catraca:', error);
    } finally {
      updateRequest(request.id, { isReleasing: false });
    }
  };

  const handleCorporateCheckin = async (request: MonitorRequest) => {
    updateRequest(request.id, { isCheckingIn: true });
    try {
      // Simulate check-in process
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Log the check-in
      if (request.student) {
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        const currentDay = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][now.getDay()];
        
        // Check if student is in any class window right now
        const activeClass = classes.find(cls => {
          if (!cls.studentIds?.includes(request.student!.id)) return false;
          
          const daySchedule = cls.schedule?.[currentDay];
          const startTime = daySchedule?.startTime || cls.startTime || cls.time;
          const endTime = daySchedule?.endTime || cls.endTime || '23:59';
          const window = cls.entryWindowMinutes || 0;
          
          if (!startTime) return false;
          
          const [h, m] = startTime.split(':').map(Number);
          const startDate = new Date(now);
          startDate.setHours(h, m - window, 0, 0);
          const entryStartTime = format(startDate, 'HH:mm');
          
          return currentTime >= entryStartTime && currentTime <= endTime;
        });

        await addDoc(collection(db, 'accessLogs'), {
          studentId: request.student.id,
          timestamp: serverTimestamp(),
          type: 'entry',
          note: 'Check-in corporativo confirmado',
          classId: activeClass?.id || null
        });

        // Record attendance if a class was found
        if (activeClass) {
          const attendanceDate = format(now, 'yyyy-MM-dd');
          const attendanceId = `${request.student.id}_${activeClass.id}_${attendanceDate}`;
          await setDoc(doc(db, 'attendance', attendanceId), {
            classId: activeClass.id,
            studentId: request.student.id,
            date: attendanceDate,
            timestamp: serverTimestamp()
          });
        }
      }

      removeRequest(request.id);
    } catch (error) {
      console.error('Erro no check-in corporativo:', error);
    } finally {
      updateRequest(request.id, { isCheckingIn: false });
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[999]">
      {requests.map((request, index) => (
        <motion.div
          key={request.id}
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            "absolute pointer-events-auto border-2 rounded-[40px] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden transition-all duration-500",
            request.isCorporate 
              ? "bg-neutral-950 border-blue-400 ring-8 ring-blue-500/30" 
              : "bg-neutral-950 border-yellow-400/50"
          )}
          style={{ 
            width: request.isCorporate ? '25vw' : '50vw', 
            height: request.isCorporate ? 'auto' : '50vh',
            minWidth: request.isCorporate ? '350px' : '600px',
            minHeight: request.isCorporate ? '450px' : '400px',
            top: `${20 + (index * 5)}%`,
            left: `${20 + (index * 5)}%`,
            maxHeight: '90vh'
          }}
        >
          {/* Header / Drag Handle */}
          <div className={cn(
            "p-4 border-b flex items-center justify-between cursor-move group shrink-0 transition-colors",
            request.isCorporate ? "bg-blue-900/50 border-blue-500/30" : "bg-black border-neutral-800"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl",
                request.isCorporate ? "bg-blue-500/10 text-blue-500" : "bg-yellow-400/10 text-yellow-400"
              )}>
                {request.isCorporate ? <ShieldCheck size={20} /> : <ScanFace size={20} />}
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase italic tracking-widest">
                  {request.isCorporate 
                    ? (request.corporatePlanNames.length > 0 ? request.corporatePlanNames.join(' / ') : 'Check-in Corporativo')
                    : 'Monitor da Catraca'}
                </h3>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">Arraste para mover a tela</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Move size={16} className={cn(
                "transition-colors",
                request.isCorporate ? "text-neutral-700 group-hover:text-blue-400" : "text-neutral-700 group-hover:text-yellow-400"
              )} />
              {!request.isCorporate && (
                <button 
                  onClick={() => removeRequest(request.id)}
                  className="p-2 hover:bg-neutral-900 rounded-xl text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className={cn(
            "flex-1 p-6 flex gap-6 overflow-y-auto transition-colors duration-500",
            request.isCorporate ? "flex-col items-center text-center gap-4 bg-blue-900/20" : "bg-neutral-950"
          )}>
            {/* Left: Photo & Status */}
            <div className={cn(
              "flex flex-col items-center gap-4",
              request.isCorporate ? "w-full" : "w-1/3"
            )}>
              <div className="relative">
                <div className={cn(
                  "rounded-[32px] overflow-hidden border-4",
                  request.isCorporate ? "w-32 h-32 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]" : 
                  (request.student?.status === 'active' ? "w-48 h-48 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)]" : "w-48 h-48 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]")
                )}>
                  {request.student?.photoUrl ? (
                    <img 
                      src={request.student.photoUrl} 
                      alt={request.student.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-700">
                      <User size={request.isCorporate ? 40 : 80} />
                    </div>
                  )}
                </div>
                {!request.isCorporate && (
                  <div className={cn(
                    "absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-xl",
                    request.student?.status === 'active' ? "bg-green-500 text-white border-green-400" : "bg-red-500 text-white border-red-400"
                  )}>
                    {request.student?.status === 'active' ? 'Acesso Liberado' : 'Acesso Negado'}
                  </div>
                )}
              </div>

              <div className="text-center space-y-1">
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Horário de Acesso</p>
                <div className="flex items-center justify-center gap-2 text-white font-black italic text-xl">
                  <Clock size={18} className={request.isCorporate ? "text-blue-400" : "text-yellow-400"} />
                  {(() => {
                    const d = parseDate(request.log?.timestamp);
                    return isNaN(d.getTime()) ? '--:--:--' : format(d, 'HH:mm:ss');
                  })()}
                </div>
              </div>
            </div>

            {/* Right: Info & Actions */}
            <div className={cn(
              "flex flex-col justify-between",
              request.isCorporate ? "w-full flex-1" : "flex-1"
            )}>
              <div className="space-y-4">
                <div>
                  <h2 className={cn(
                    "font-black text-white italic uppercase tracking-tighter leading-none",
                    request.isCorporate ? "text-3xl" : "text-4xl"
                  )}>
                    {(request.student?.name || 'Visitante / Não Identificado').toUpperCase()}
                  </h2>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {request.isCorporate && (
                      <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                        <ShieldCheck size={12} />
                        {request.corporatePlanNames.length > 0 ? request.corporatePlanNames.join(' / ') : 'Plano Corporativo'}
                      </div>
                    )}
                    {(request.student as any)?.isProfessor && (
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Clock size={12} />
                        Ponto
                      </div>
                    )}
                    <p className="text-neutral-500 font-bold uppercase tracking-[0.2em]">
                      {(request.student as any)?.isProfessor ? 'Funcionário' : (request.student?.id ? 'Aluno Matriculado' : 'Pessoa não cadastrada')}
                    </p>
                  </div>
                </div>

                {request.student && !(request.student as any)?.isProfessor && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Planos Ativos</p>
                      <div className="space-y-1">
                        {request.isCorporate ? (
                          <div className="space-y-1">
                            {request.corporatePlanNames.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs font-bold text-blue-400">
                                <ShieldCheck size={12} />
                                {name} (Indeterminado)
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {Object.entries(request.student.planExpirations || {}).map(([planId, exp]) => (
                              <div key={planId} className="flex items-center gap-2 text-xs font-bold text-white">
                                <CheckCircle2 size={12} className="text-green-500" />
                                {exp}
                              </div>
                            ))}
                            {(!request.student.planExpirations || Object.keys(request.student.planExpirations).length === 0) && (
                              <p className="text-xs text-red-500 font-bold italic">Nenhum plano ativo</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Última Presença</p>
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <Calendar size={12} className={request.isCorporate ? "text-blue-400" : "text-yellow-400"} />
                        {format(new Date(), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </div>
                )}

                {!request.student && (
                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4">
                    <AlertCircle className="text-red-500 shrink-0" size={32} />
                    <p className="text-sm text-neutral-400 font-medium leading-relaxed">
                      Esta pessoa não foi reconhecida pelo sistema de reconhecimento facial. 
                      Verifique a identidade e libere manualmente se necessário.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-6 w-full">
                {request.isCorporate ? (
                  <div className="flex flex-col gap-3 w-full">
                    <button
                      onClick={() => handleCorporateCheckin(request)}
                      disabled={request.isCheckingIn}
                      className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 text-lg animate-pulse"
                    >
                      {request.isCheckingIn ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={24} />
                      )}
                      {request.isCheckingIn ? 'Confirmando...' : 'Confirmar Check-in'}
                    </button>
                    <button
                      onClick={() => removeRequest(request.id)}
                      className="w-full py-4 bg-neutral-900 text-neutral-500 hover:text-white rounded-2xl font-black uppercase tracking-widest border border-neutral-800 transition-all text-xs"
                    >
                      Fechar sem confirmar
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleManualRelease(request)}
                      disabled={request.isReleasing || request.releaseSuccess}
                      className={cn(
                        "flex-1 py-6 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl",
                        request.releaseSuccess 
                          ? "bg-green-500 text-white shadow-green-500/20" 
                          : "bg-yellow-400 text-black hover:bg-yellow-300 shadow-yellow-400/20"
                      )}
                    >
                      {request.isReleasing ? (
                        <Loader2 className="animate-spin" />
                      ) : request.releaseSuccess ? (
                        <CheckCircle2 />
                      ) : (
                        <Unlock />
                      )}
                      {request.isReleasing ? 'Liberando...' : request.releaseSuccess ? 'Passagem Liberada' : 'Liberar Passagem'}
                    </button>
                    
                    <button
                      onClick={() => removeRequest(request.id)}
                      className="px-8 bg-neutral-900 text-neutral-500 hover:text-white rounded-2xl font-black uppercase tracking-widest border border-neutral-800 transition-all"
                    >
                      Fechar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="bg-black/50 px-8 py-3 border-t border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                request.isCorporate ? "bg-blue-500" : "bg-green-500"
              )} />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {request.isCorporate ? 'Aguardando Confirmação Manual' : 'Conectado com a Catraca'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest italic">Carrasco Fit v2.0</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
