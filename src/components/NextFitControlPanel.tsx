import React, { useState, useEffect } from 'react';
import { Search, Users, CheckCircle2, XCircle, RefreshCw, Unlock, Calendar, Clock, Camera, Key, Fingerprint, RefreshCcw } from 'lucide-react';
import { useGymData } from '../hooks/useGymData';
import { useHardware } from '../contexts/HardwareContext';
import FaceEnrollModal from './FaceEnrollModal';
import { format } from 'date-fns';

export default function NextFitControlPanel() {
  const { students, plans, accessLogs } = useGymData();
  const { releaseTurnstile, syncAll, isSyncing, isHardwareConnected } = useHardware();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isReleasing, setIsReleasing] = useState<'entry' | 'exit' | null>(null);

  // Filtra estudantes baseado na busca em tempo real
  const filteredStudents = students.filter(student => 
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.registrationNumber?.toString().includes(searchTerm)
  );

  // Define o primeiro estudante como selecionado por padrão se nenhum estiver selecionado
  useEffect(() => {
    if (filteredStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [students, searchTerm]);

  // Estudante atualmente selecionado
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Busca o último log de acesso do estudante selecionado
  const studentLogs = accessLogs.filter(log => log.studentId === selectedStudentId);
  const lastLog = studentLogs.length > 0 ? studentLogs[0] : null;

  // Calcula a validade do contrato (data de expiração do plano ativo)
  const getContractExpiration = (student: any) => {
    if (!student) return 'Nenhum contrato ativo';
    const expirations = student.planExpirations || {};
    const dates = Object.values(expirations) as string[];
    if (dates.length === 0) return 'Sem validade cadastrada';
    
    // Retorna a maior data de validade
    dates.sort();
    const latestDate = dates[dates.length - 1];
    
    try {
      const [year, month, day] = latestDate.split('-');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return latestDate;
    }
  };

  // Retorna o nome do plano ativo do aluno
  const getActivePlanName = (student: any) => {
    if (!student) return 'Sem plano';
    const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
    const activePlans = plans.filter(p => studentPlanIds.includes(p.id));
    if (activePlans.length === 0) return 'Nenhum plano ativo';
    return activePlans.map(p => p.name).join(' / ');
  };

  // Comanda a liberação manual pelo hardware
  const handleRelease = async (direction: 'clockwise' | 'anticlockwise') => {
    if (isReleasing) return;
    setIsReleasing(direction === 'clockwise' ? 'entry' : 'exit');
    
    try {
      const success = await releaseTurnstile();
      if (success) {
        console.log(`Manual release request sent successfully: ${direction}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsReleasing(null), 1500);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Barra de Ações Rápidas Superior */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-neutral-950/80 border border-neutral-800 rounded-[32px] shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Atalhos Operacionais</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRelease('clockwise')}
            disabled={isReleasing !== null}
            className="px-6 py-4 bg-violet-700 hover:bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-950/30 transition-all border border-violet-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Unlock size={14} className={isReleasing === 'entry' ? "animate-bounce" : ""} />
            LIBERAR ENTRADA
          </button>
          
          <button
            onClick={() => handleRelease('anticlockwise')}
            disabled={isReleasing !== null}
            className="px-6 py-4 bg-violet-700 hover:bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-950/30 transition-all border border-violet-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Unlock size={14} className={isReleasing === 'exit' ? "animate-bounce" : ""} />
            LIBERAR SAÍDA
          </button>
          
          <button
            onClick={() => syncAll(students)}
            disabled={isSyncing}
            className="px-6 py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-neutral-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            ATUALIZAR
          </button>
        </div>
      </div>

      {/* Grid Principal Layout Duas Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Busca e Lista de Alunos (65% width) */}
        <div className="lg:col-span-2 p-8 rounded-[40px] bg-black border border-neutral-800 shadow-2xl flex flex-col h-[70vh] min-h-[550px] relative overflow-hidden">
          
          {/* Caixa de Busca */}
          <div className="relative group shrink-0 mb-6">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-violet-400 transition-colors">
              <Search size={20} />
            </span>
            <input
              type="text"
              placeholder="Digite o nome ou matrícula do aluno..."
              className="w-full pl-14 pr-6 py-5 bg-neutral-950 border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-white text-base font-bold tracking-tight shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Tabela de Alunos */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-900">
                  <th className="py-4 px-4 text-[10px] text-neutral-500 font-black uppercase tracking-widest">Nome</th>
                  <th className="py-4 px-4 text-[10px] text-neutral-500 font-black uppercase tracking-widest text-right">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-12 text-center text-xs text-neutral-600 italic font-bold uppercase tracking-widest">
                      Nenhum aluno encontrado
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr 
                      key={student.id} 
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`border-b border-neutral-900/60 hover:bg-neutral-900/30 transition-all cursor-pointer group ${selectedStudentId === student.id ? "bg-violet-950/20" : ""}`}
                    >
                      <td className="py-4.5 px-4">
                        <div className="flex items-center gap-3">
                          {/* Pequena bolinha ou status */}
                          <div className={`w-2 h-2 rounded-full ${student.status === 'active' ? "bg-green-500" : "bg-red-500"}`} />
                          <span className={`text-sm font-bold transition-colors uppercase ${selectedStudentId === student.id ? "text-violet-400" : "text-neutral-300 group-hover:text-white"}`}>
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4.5 px-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${student.status === 'active' ? "bg-green-950/30 text-green-500 border-green-500/20" : "bg-red-950/30 text-red-500 border-red-500/20"}`}>
                          {student.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna Direita: Perfil do Aluno Selecionado (35% width) */}
        <div className="p-8 rounded-[40px] bg-black border border-neutral-800 shadow-2xl flex flex-col h-[70vh] min-h-[550px] overflow-y-auto shrink-0 custom-scrollbar justify-between">
          {selectedStudent ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              
              {/* Informações Básicas do Aluno */}
              <div className="space-y-4">
                <div className="text-center space-y-3 relative">
                  
                  {/* Foto Redonda do Aluno */}
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-violet-500/30 mx-auto shadow-xl">
                    {selectedStudent.photoUrl ? (
                      <img 
                        src={selectedStudent.photoUrl} 
                        alt={selectedStudent.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-700">
                        <Users size={36} />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white leading-tight">
                      {selectedStudent.name}
                    </h3>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                      Matrícula Nº {selectedStudent.registrationNumber || selectedStudent.id?.slice(0, 6)}
                    </p>
                  </div>
                </div>

                {/* Botões de Ação do Perfil (BIOMETRIA, SENHA, FACIAL) */}
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => alert('Recurso Biométrico integrado estritamente com o iDFace local.')}
                    className="py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl border border-neutral-800 font-black text-[9px] uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Fingerprint size={16} className="text-violet-500/60" />
                    BIOMETRIA
                  </button>
                  
                  <button 
                    onClick={() => alert('Senha do Usuário pode ser digitada no teclado numérico físico do iDFace.')}
                    className="py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl border border-neutral-800 font-black text-[9px] uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Key size={16} className="text-violet-500/60" />
                    SENHA
                  </button>
                  
                  <button 
                    onClick={() => setIsEnrollModalOpen(true)}
                    className="py-3 bg-violet-700 hover:bg-violet-600 text-white rounded-xl border border-violet-500/20 font-black text-[9px] uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-violet-950/20 cursor-pointer"
                  >
                    <Camera size={16} />
                    FACIAL
                  </button>
                </div>
              </div>

              {/* Seção Treino */}
              <div className="p-5 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl space-y-3">
                <h4 className="text-xs font-black italic uppercase tracking-wider text-violet-400">Treino</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-neutral-900/60 pb-1.5">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Data Último Treino:</span>
                    <span className="text-white font-mono font-bold">
                      {lastLog ? (() => {
                        try {
                          const date = lastLog.timestamp?.toDate ? lastLog.timestamp.toDate() : new Date(lastLog.timestamp);
                          return format(date, "dd/MM/yyyy");
                        } catch (e) { return 'Nenhum' }
                      })() : 'Nenhum treino hoje'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900/60 pb-1.5">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Data Validade:</span>
                    <span className="text-white font-mono font-bold">{getContractExpiration(selectedStudent)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Sessão Atual:</span>
                    <select className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500">
                      <option>Treino Geral A</option>
                      <option>Treino Geral B</option>
                      <option>Treino Geral C</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção Último Acesso */}
              <div className="p-5 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl space-y-3">
                <h4 className="text-xs font-black italic uppercase tracking-wider text-violet-400">Último acesso</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-neutral-900/60 pb-1.5">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Tipo:</span>
                    <span className="text-white font-bold uppercase font-mono">
                      {lastLog?.type === 'entry' ? 'Entrada (Livre)' : lastLog?.type === 'exit' ? 'Saída' : 'Desconhecido'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900/60 pb-1.5">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Senha:</span>
                    <span className="text-white font-mono">***</span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900/60 pb-1.5">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Plano:</span>
                    <span className="text-white font-bold max-w-[150px] truncate text-right">{getActivePlanName(selectedStudent)}</span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-900/60 pb-1.5">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Próximo Vencimento:</span>
                    <span className="text-yellow-500 font-mono font-bold">{getContractExpiration(selectedStudent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-bold uppercase text-[9px]">Mensagem:</span>
                    <span className={`font-bold ${selectedStudent.status === 'active' ? "text-green-500" : "text-red-500"}`}>
                      {selectedStudent.status === 'active' ? 'ACESSO AUTORIZADO' : 'BLOQUEADO - INATIVO'}
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

      {/* Modal de Cadastro de Biometria Facial */}
      {selectedStudent && (
        <FaceEnrollModal 
          student={selectedStudent} 
          isOpen={isEnrollModalOpen} 
          onClose={() => setIsEnrollModalOpen(false)} 
        />
      )}

    </div>
  );
}
