import React, { useState } from 'react';
import { useGymData } from '../hooks/useGymData';
import { 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Users,
  Trash2, 
  Edit2, 
  XCircle,
  CheckCircle2,
  ShieldAlert,
  Search
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

const DAYS_OF_WEEK = [
  'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'
];

export default function Classes() {
  const { classes, students, loading } = useGymData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    modality: '',
    instructor: '',
    entryWindowMinutes: 30,
    schedule: {} as Record<string, { startTime: string, endTime: string }>,
    studentIds: [] as string[]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (Object.keys(formData.schedule).length === 0) {
      setErrorMessage('Por favor, selecione pelo menos um dia da semana para a aula.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    
    // Clean up formData to avoid undefined values
    const cleanData = JSON.parse(JSON.stringify(formData));

    // Create a timeout promise - increased to 60s
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 60000)
    );

    try {
      if (!auth.currentUser) {
        throw new Error('Você não está autenticado. Por favor, faça login novamente.');
      }
      
      console.log('Attempting to save class as user:', auth.currentUser.uid, 'Email:', auth.currentUser.email);
      
      const saveOperation = async () => {
        if (editingClass) {
          try {
            await updateDoc(doc(db, 'classes', editingClass.id), cleanData);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `classes/${editingClass.id}`);
          }
        } else {
          try {
            await addDoc(collection(db, 'classes'), cleanData);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'classes');
          }
        }
      };

      try {
        await Promise.race([saveOperation(), timeoutPromise]);
      } catch (error: any) {
        if (error.message === 'TIMEOUT_ERROR') {
          // If it timed out, check if the data is already in the local state
          // This is a heuristic: if the user says it saved, it means onSnapshot updated it.
          // We'll give it 2 more seconds to see if it's in the list.
          await new Promise(resolve => setTimeout(resolve, 2000));
          const savedClass = classes.find(c => c.name === formData.name && c.instructor === formData.instructor);
          if (savedClass) {
            console.log('Class found in local state after timeout, assuming success.');
          } else {
            throw new Error('Timeout: A operação está demorando mais que o esperado (60s). Verifique se a aula já aparece na lista. Se não aparecer, tente novamente.');
          }
        } else {
          throw error;
        }
      }
      
      setIsModalOpen(false);
      setEditingClass(null);
      setFormData({ 
        name: '', 
        modality: '', 
        instructor: '', 
        entryWindowMinutes: 30,
        schedule: {}, 
        studentIds: [] 
      });
    } catch (error: any) {
      console.error('Error saving class:', error);
      let displayError = error.message.includes('Timeout') 
        ? error.message 
        : 'Erro ao salvar aula. Por favor, tente novamente.';
      
      try {
        if (error.message.startsWith('{')) {
          const parsedError = JSON.parse(error.message);
          if (parsedError.error.includes('insufficient permissions')) {
            displayError = 'Você não tem permissão para realizar esta ação. Verifique se você é um administrador ou funcionário autorizado.';
          } else if (parsedError.error.includes('Quota exceeded')) {
            displayError = 'Limite de uso do banco de dados excedido. Por favor, tente novamente amanhã.';
          }
        }
      } catch (e) {
        // Not a JSON error, use default or timeout message
      }
      
      setErrorMessage(displayError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta aula?')) {
      try {
        await deleteDoc(doc(db, 'classes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
      }
    }
  };

  const handleEdit = (cls: any) => {
    setEditingClass(cls);
    
    // Migrate old data if necessary
    let schedule = cls.schedule || {};
    if (Object.keys(schedule).length === 0 && cls.daysOfWeek) {
      cls.daysOfWeek.forEach((day: string) => {
        schedule[day] = {
          startTime: cls.startTime || cls.time || '08:00',
          endTime: cls.endTime || '09:00'
        };
      });
    }

    setFormData({
      name: cls.name,
      modality: cls.modality || '',
      instructor: cls.instructor,
      entryWindowMinutes: cls.entryWindowMinutes || 30,
      schedule: schedule,
      studentIds: cls.studentIds || []
    });
    setIsModalOpen(true);
  };

  const toggleDay = (day: string) => {
    setFormData(prev => {
      const newSchedule = { ...prev.schedule };
      if (newSchedule[day]) {
        delete newSchedule[day];
      } else {
        newSchedule[day] = { startTime: '08:00', endTime: '09:00' };
      }
      return { ...prev, schedule: newSchedule };
    });
  };

  const updateDayTime = (day: string, field: 'startTime' | 'endTime', value: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value
        }
      }
    }));
  };

  const toggleStudent = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId]
    }));
  };

  const filteredClasses = classes.filter(cls => 
    (cls.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (cls.modality?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (cls.instructor?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Aulas</h2>
          <p className="text-neutral-500">Gerencie o cronograma de aulas e turmas.</p>
        </div>
        <button
          onClick={() => {
            setEditingClass(null);
            setFormData({ 
              name: '', 
              modality: '', 
              instructor: '', 
              entryWindowMinutes: 30,
              schedule: {}, 
              studentIds: [] 
            });
            setIsModalOpen(true);
          }}
          className="bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
        >
          <Plus size={18} />
          Nova Aula
        </button>
      </header>

      {/* Search Bar */}
      <div className="bg-black p-4 rounded-2xl shadow-sm border-2 border-neutral-600 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, modalidade ou professor..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredClasses.map((cls) => (
          <div key={cls.id} className="bg-black p-6 rounded-2xl shadow-sm border-2 border-neutral-600 flex flex-col justify-between group hover:border-yellow-400 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="bg-yellow-400/10 p-3 rounded-xl text-yellow-400">
                  <Calendar size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(cls)} className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(cls.id)} className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{cls.name}</h3>
                <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-1">{cls.modality}</p>
                <p className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
                  <User size={14} /> Instrutor: {cls.instructor}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {cls.schedule ? Object.entries(cls.schedule)
                  .sort(([dayA], [dayB]) => DAYS_OF_WEEK.indexOf(dayA) - DAYS_OF_WEEK.indexOf(dayB))
                  .map(([day, times]: [string, any]) => (
                  <div key={day} className="flex flex-col bg-neutral-900 border-2 border-yellow-400/30 rounded-lg px-2 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                      {day}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-mono">
                      {times.startTime}-{times.endTime}
                    </span>
                  </div>
                )) : [...(cls.daysOfWeek || [])].sort((a: string, b: string) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)).map((day: string) => (
                  <span key={day} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-neutral-900 text-yellow-400 border-2 border-yellow-400/30 rounded-lg">
                    {day}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 border-t-2 border-neutral-600">
                <div className="flex items-center gap-2 text-sm text-white font-bold">
                  <Clock size={14} className="text-yellow-400" />
                  {cls.entryWindowMinutes || 30} min liberação
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Users size={14} className="text-neutral-500" />
                  {(cls.studentIds || []).filter((id: string) => students.some(s => s.id === id)).length} alunos
                </div>
              </div>
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full p-12 text-center text-neutral-500 italic bg-black rounded-2xl border-2 border-dashed border-neutral-600">
            Nenhuma aula cadastrada.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border-2 border-neutral-600 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-neutral-900 text-white">
              <h3 className="text-xl font-bold italic uppercase tracking-tight">{editingClass ? 'Editar Aula' : 'Nova Aula'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center gap-2">
                  <ShieldAlert size={18} />
                  {errorMessage}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Nome da Aula / Turma</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Turma Manhã, Turma Avançada"
                    className="w-full px-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Modalidade</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Muay Thai, Crossfit, Zumba"
                    className="w-full px-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={formData.modality}
                    onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Instrutor</label>
                  <input
                    required
                    type="text"
                    list="instructor-list"
                    placeholder="Nome do professor"
                    className="w-full px-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  />
                  <datalist id="instructor-list">
                    {Array.from(new Set(classes.map(c => c.instructor).filter(Boolean))).map(instructor => (
                      <option key={instructor} value={instructor} />
                    ))}
                  </datalist>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Liberação de Entrada (Minutos Antes)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                      required
                      type="number"
                      placeholder="Ex: 30"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={formData.entryWindowMinutes}
                      onChange={(e) => setFormData({ ...formData, entryWindowMinutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-1 italic">
                    Define quantos minutos antes do início da aula o aluno pode entrar na academia.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-neutral-500 uppercase">Cronograma (Dias e Horários)</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        formData.schedule[day]
                          ? "bg-yellow-400 text-black border-2 border-yellow-400"
                          : "bg-neutral-900 text-neutral-500 hover:bg-neutral-800 border-2 border-neutral-600"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Individual Day Time Inputs */}
                <div className="space-y-3">
                  {(Object.entries(formData.schedule) as [string, { startTime: string, endTime: string }][]).map(([day, times]) => (
                    <div key={day} className="flex items-center gap-4 bg-neutral-900 p-3 rounded-xl border-2 border-neutral-600 animate-in slide-in-from-left-2 duration-200">
                      <span className="w-20 text-xs font-bold text-yellow-400 uppercase">{day}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 uppercase">Início</label>
                          <input 
                            type="time"
                            value={times.startTime}
                            onChange={(e) => updateDayTime(day, 'startTime', e.target.value)}
                            className="w-full bg-black border-2 border-neutral-600 rounded-lg px-2 py-1 text-xs text-white focus:border-yellow-400 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 uppercase">Fim</label>
                          <input 
                            type="time"
                            value={times.endTime}
                            onChange={(e) => updateDayTime(day, 'endTime', e.target.value)}
                            className="w-full bg-black border-2 border-neutral-600 rounded-lg px-2 py-1 text-xs text-white focus:border-yellow-400 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Alunos Matriculados</label>
                  <div className="relative w-40">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" size={10} />
                    <input 
                      type="text"
                      placeholder="Buscar aluno..."
                      className="w-full pl-6 pr-2 py-1 bg-neutral-900 border-2 border-neutral-600 rounded-lg text-[10px] text-white focus:outline-none focus:border-yellow-400"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        const studentButtons = document.querySelectorAll('.student-selection-btn');
                        studentButtons.forEach((btn: any) => {
                          const name = btn.getAttribute('data-student-name')?.toLowerCase() || '';
                          const reg = btn.getAttribute('data-student-reg')?.toLowerCase() || '';
                          if (name.includes(term) || reg.includes(term)) {
                            btn.classList.remove('hidden');
                          } else {
                            btn.classList.add('hidden');
                          }
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-neutral-900 rounded-xl border-2 border-neutral-600">
                  {students.map(student => (
                    <button
                      key={student.id}
                      type="button"
                      data-student-name={student.name}
                      data-student-reg={student.registrationNumber || ''}
                      onClick={() => toggleStudent(student.id)}
                      className={cn(
                        "student-selection-btn flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all",
                        formData.studentIds.includes(student.id)
                          ? "bg-yellow-400/10 border-2 border-yellow-400/30 text-yellow-400"
                          : "bg-black border-2 border-transparent text-neutral-500 hover:border-neutral-600"
                      )}
                    >
                      {formData.studentIds.includes(student.id) ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-neutral-500" />}
                      <span className="truncate">{(student.name || '').toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
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
                  className={cn(
                    "flex-1 px-4 py-3 bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-yellow-400/20",
                    isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-300"
                  )}
                >
                  {isSaving ? 'Salvando...' : (editingClass ? 'Salvar' : 'Criar Aula')}
                </button>
              </div>

              {/* Debug Info */}
              <div className="mt-4 pt-4 border-t border-neutral-800 text-[10px] text-neutral-600 flex justify-between items-center">
                <div className="flex gap-2">
                  <span>UID: {auth.currentUser?.uid?.substring(0, 8)}...</span>
                  <span>•</span>
                  <span>{auth.currentUser?.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isSaving ? "bg-yellow-400 animate-pulse" : "bg-green-500")} />
                  <span>{isSaving ? 'Enviando' : 'Conectado'}</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
