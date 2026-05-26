import React, { useState } from 'react';
import { useGymData } from '../hooks/useGymData';
import { 
  Plus, 
  Settings, 
  Trash2, 
  Edit2, 
  Calendar, 
  DollarSign,
  XCircle,
  ShieldAlert,
  Search
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function Plans() {
  const { plans, loading } = useGymData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    isCorporate: false,
    durationDays: 30,
    durationMonths: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    // Ensure only one of durationDays or durationMonths is set if we want to be strict,
    // but here we'll just send what's in the form.
    const dataToSave = {
      name: formData.name,
      price: formData.isCorporate ? 0 : formData.price,
      isCorporate: formData.isCorporate,
      durationDays: formData.durationMonths > 0 ? null : formData.durationDays,
      durationMonths: formData.durationMonths > 0 ? formData.durationMonths : null
    };

    // Create a timeout promise - 60s
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 60000)
    );

    try {
      const saveOperation = async () => {
        if (editingPlan) {
          await updateDoc(doc(db, 'plans', editingPlan.id), dataToSave);
        } else {
          await addDoc(collection(db, 'plans'), dataToSave);
        }
      };

      try {
        await Promise.race([saveOperation(), timeoutPromise]);
      } catch (error: any) {
        if (error.message === 'TIMEOUT_ERROR') {
          // Heuristic check
          await new Promise(resolve => setTimeout(resolve, 2000));
          const savedPlan = plans.find(p => p.name === formData.name && p.price === (formData.isCorporate ? 0 : formData.price));
          if (savedPlan) {
            console.log('Plan found in local state after timeout, assuming success.');
          } else {
            throw new Error('Timeout: A operação está demorando mais que o esperado (60s). Verifique se o plano já aparece na lista.');
          }
        } else {
          throw error;
        }
      }

      setIsModalOpen(false);
      setEditingPlan(null);
      setFormData({ name: '', price: 0, isCorporate: false, durationDays: 30, durationMonths: 0 });
    } catch (error: any) {
      handleFirestoreError(error, editingPlan ? OperationType.UPDATE : OperationType.CREATE, 'plans');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este plano?')) {
      try {
        await deleteDoc(doc(db, 'plans', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `plans/${id}`);
      }
    }
  };

  const handleEdit = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price,
      isCorporate: plan.isCorporate || false,
      durationDays: plan.durationDays || (plan.durationMonths ? 0 : 30),
      durationMonths: plan.durationMonths || 0
    });
    setIsModalOpen(true);
  };

  const filteredPlans = plans.filter(plan => 
    (plan.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Planos</h2>
          <p className="text-neutral-500">Gerencie as modalidades e preços da academia.</p>
        </div>
        <button
          onClick={() => {
            setEditingPlan(null);
            setFormData({ name: '', price: 0, isCorporate: false, durationDays: 30, durationMonths: 0 });
            setIsModalOpen(true);
          }}
          className="bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
        >
          <Plus size={18} />
          Novo Plano
        </button>
      </header>

      {/* Search Bar */}
      <div className="bg-black p-4 rounded-2xl shadow-sm border-2 border-neutral-600 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome do plano..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <div key={plan.id} className={cn(
            "bg-black p-6 rounded-2xl shadow-sm border-2 flex flex-col justify-between group transition-all hover:border-yellow-400",
            plan.isCorporate ? "border-blue-500/30" : "border-neutral-600"
          )}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={cn(
                  "p-3 rounded-xl",
                  plan.isCorporate ? "bg-blue-500/10 text-blue-500" : "bg-yellow-400/10 text-yellow-400"
                )}>
                  <Settings size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(plan)} className="p-2 text-neutral-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(plan.id)} className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  {plan.isCorporate && (
                    <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Corporativo</span>
                  )}
                </div>
                <p className={cn(
                  "text-3xl font-black mt-1",
                  plan.isCorporate ? "text-blue-400" : "text-yellow-400"
                )}>
                  {plan.isCorporate ? 'ISENTO' : `R$ ${plan.price.toFixed(2)}`}
                  <span className="text-xs font-medium text-neutral-500 ml-1">
                    / {plan.isCorporate ? 'Indeterminado' : (plan.durationMonths ? (plan.durationMonths === 1 ? 'mês' : `${plan.durationMonths} meses`) : `${plan.durationDays} dias`)}
                  </span>
                </p>
              </div>
              <div className="space-y-2 pt-4 border-t-2 border-neutral-600">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Vigência</p>
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Calendar size={14} className="text-neutral-500" />
                      {plan.isCorporate ? 'Indeterminado' : (plan.durationMonths ? `${plan.durationMonths} ${plan.durationMonths === 1 ? 'mês' : 'meses'}` : `${plan.durationDays} dias`)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full p-12 text-center text-neutral-500 italic bg-black rounded-2xl border-2 border-dashed border-neutral-600">
            Nenhum plano cadastrado.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-2 border-neutral-600 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-neutral-900 text-white">
              <h3 className="text-xl font-bold italic uppercase tracking-tight">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex items-center gap-2">
                  <ShieldAlert size={16} />
                  {errorMessage}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Nome do Plano</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Mensal, Anual, VIP"
                  className="w-full px-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-2xl border-2 border-neutral-600">
                <input 
                  type="checkbox" 
                  id="isCorporate"
                  className="w-5 h-5 rounded border-2 border-neutral-600 bg-neutral-950 text-blue-500 focus:ring-blue-500/20"
                  checked={formData.isCorporate}
                  onChange={(e) => setFormData({ ...formData, isCorporate: e.target.checked })}
                />
                <label htmlFor="isCorporate" className="flex-1 cursor-pointer">
                  <p className="text-sm font-bold text-white">Plano Corporativo</p>
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tighter italic">Sem cobrança e com check-in manual</p>
                </label>
              </div>

              {!formData.isCorporate && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Preço (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                      value={isNaN(formData.price) ? '' : formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              {!formData.isCorporate ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Vigência (Duração)</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, durationMonths: 0, durationDays: 30 })}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${
                        formData.durationMonths === 0 
                          ? 'bg-yellow-400 border-yellow-400 text-black' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                      }`}
                    >
                      Dias
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, durationMonths: 1, durationDays: 0 })}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${
                        formData.durationMonths > 0 
                          ? 'bg-yellow-400 border-yellow-400 text-black' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                      }`}
                    >
                      Meses
                    </button>
                  </div>

                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    {formData.durationMonths > 0 ? (
                      <input
                        required
                        type="number"
                        min="1"
                        max="12"
                        placeholder="Quantidade de meses"
                        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                        value={isNaN(formData.durationMonths) ? '' : formData.durationMonths}
                        onChange={(e) => setFormData({ ...formData, durationMonths: parseInt(e.target.value) || 0, durationDays: 0 })}
                      />
                    ) : (
                      <input
                        required
                        type="number"
                        min="1"
                        max="365"
                        placeholder="Quantidade de dias"
                        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                        value={isNaN(formData.durationDays) ? '' : formData.durationDays}
                        onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 0, durationMonths: 0 })}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { label: '1 dia', val: 1, type: 'days' },
                      { label: '1 sem', val: 7, type: 'days' },
                      { label: '15 dias', val: 15, type: 'days' },
                      { label: '1 mês', val: 1, type: 'months' },
                      { label: '3 meses', val: 3, type: 'months' },
                      { label: '6 meses', val: 6, type: 'months' },
                      { label: '1 ano', val: 12, type: 'months' }
                    ].map(opt => (
                      <button
                        key={`${opt.type}-${opt.val}`}
                        type="button"
                        onClick={() => {
                          if (opt.type === 'months') {
                            setFormData({ ...formData, durationMonths: opt.val, durationDays: 0 });
                          } else {
                            setFormData({ ...formData, durationDays: opt.val, durationMonths: 0 });
                          }
                        }}
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border transition-all ${
                          (opt.type === 'months' && formData.durationMonths === opt.val) || (opt.type === 'days' && formData.durationDays === opt.val)
                            ? 'bg-yellow-400 border-yellow-400 text-black' 
                            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 text-blue-400">
                    <Calendar size={20} />
                    <div>
                      <p className="text-sm font-bold uppercase tracking-widest">Duração Indeterminada</p>
                      <p className="text-[10px] font-medium text-neutral-500 uppercase">Este plano não expira automaticamente.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-neutral-900 text-neutral-400 font-bold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : (editingPlan ? 'Salvar' : 'Criar Plano')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
