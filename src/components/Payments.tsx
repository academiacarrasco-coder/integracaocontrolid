import React, { useState } from 'react';
import { useGymData } from '../hooks/useGymData';
import { useAuth } from '../hooks/useAuth';
import { useHardware } from '../contexts/HardwareContext';
import { 
  Plus, 
  CreditCard, 
  DollarSign, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  XCircle,
  Calendar,
  User,
  Trash2,
  Filter,
  ChevronDown,
  Check,
  FileText,
  Smartphone,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { format, addDays, addMonths, getDate, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Payments() {
  const { payments, students, plans, loading } = useGymData();
  const { profile } = useAuth();
  const { syncUser } = useHardware();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlanId, setFilterPlanId] = useState('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'custom' | 'all'>('all');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: '',
    amount: 0,
    fee: 0,
    status: 'paid',
    method: 'pix',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    planIds: [] as string[]
  });

  const filteredPayments = payments.filter(p => {
    const student = students.find(s => s.id === p.studentId);
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = (
      (student?.name || '').toLowerCase().includes(searchLower) ||
      String(student?.registrationNumber || '').toLowerCase().includes(searchLower)
    );

    const matchesPlan = filterPlanId === 'all' || (p.planIds || []).includes(filterPlanId);

    const paymentDate = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    const paymentDayStr = format(paymentDate, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = paymentDayStr === todayStr;
    } else if (dateFilter === 'yesterday') {
      matchesDate = paymentDayStr === yesterdayStr;
    } else if (dateFilter === 'custom') {
      matchesDate = paymentDayStr >= startDate && paymentDayStr <= endDate;
    }

    return matchesSearch && matchesPlan && matchesDate;
  }).sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  const stats = filteredPayments.reduce((acc: any, p) => {
    if (p.status !== 'paid') return acc;
    const method = p.method || 'outro';
    acc[method] = (acc[method] || 0) + p.amount;
    acc.total += p.amount;
    return acc;
  }, { money: 0, pix: 0, credit: 0, debit: 0, recurring: 0, outro: 0, total: 0 });

  const printDetailedReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const startStr = dateFilter === 'custom' ? format(new Date(startDate), 'dd/MM/yyyy') : 
                   dateFilter === 'today' ? format(new Date(), 'dd/MM/yyyy') :
                   dateFilter === 'yesterday' ? format(addDays(new Date(), -1), 'dd/MM/yyyy') : 'Todo o período';
    
    const endStr = dateFilter === 'custom' ? format(new Date(endDate), 'dd/MM/yyyy') : startStr;

    const tableRows = filteredPayments.map(p => {
      const student = students.find(s => s.id === p.studentId);
      const dateVal = p.date;
      const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      return `
        <tr>
          <td>${isNaN(d.getTime()) ? 'N/A' : format(d, 'dd/MM/yyyy HH:mm')}</td>
          <td>${(student?.name || 'N/A').toUpperCase()}</td>
          <td style="text-transform: uppercase;">${
            p.method === 'credit' ? 'CRÉDITO' : 
            p.method === 'debit' ? 'DÉBITO' : 
            p.method === 'pix' ? 'PIX' : 
            p.method === 'recurring' ? 'RECORRENTE' : 
            p.method === 'money' ? 'DINHEIRO' : 'OUTRO'
          }</td>
          <td style="text-align: right;">R$ ${p.amount.toFixed(2)}</td>
          <td style="text-align: right;">R$ ${(p.fee || 0).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">R$ ${(p.netAmount || p.amount).toFixed(2)}</td>
          <td>${p.recordedByName || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Detalhado de Cobranças</title>
          <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: sans-serif; color: #333; line-height: 1.4; padding: 20px; }
            h1 { text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 20px; font-size: 20px; }
            .header-info { margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-box { border: 1px solid #eee; padding: 10px; border-radius: 8px; }
            .label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: bold; }
            .value { font-size: 14px; font-weight: bold; display: block; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #eee; padding: 8px; text-align: left; font-size: 10px; }
            th { background: #f9f9f9; text-transform: uppercase; font-size: 8px; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
            .summary-item { background: #f9f9f9; padding: 10px; border-radius: 8px; text-align: center; }
            .footer { margin-top: 50px; font-size: 9px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Relatório Detalhado de Cobranças</h1>
          <div class="header-info">
            <div class="info-box">
              <span class="label">Período</span>
              <span class="value">${startStr} ${dateFilter === 'custom' ? 'até ' + endStr : ''}</span>
            </div>
            <div class="info-box">
              <span class="label">Total Geral Bruto</span>
              <span class="value">R$ ${stats.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <span class="label">Dinheiro</span>
              <span class="value">R$ ${stats.money.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">PIX</span>
              <span class="value">R$ ${stats.pix.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Crédito</span>
              <span class="value">R$ ${stats.credit.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Débito</span>
              <span class="value">R$ ${stats.debit.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Recorrente</span>
              <span class="value">R$ ${stats.recurring.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Outros</span>
              <span class="value">R$ ${stats.outro.toFixed(2)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Aluno</th>
                <th>Método</th>
                <th style="text-align: right;">Bruto</th>
                <th style="text-align: right;">Custo</th>
                <th style="text-align: right;">Líquido</th>
                <th>Registrado Por</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} - Carrasco Fit
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paymentDate = new Date(`${formData.date}T${formData.time || '00:00'}:00`);
      
      await addDoc(collection(db, 'payments'), {
        ...formData,
        amount: Number(formData.amount),
        fee: Number(formData.fee),
        netAmount: Number(formData.amount) - Number(formData.fee),
        date: paymentDate.toISOString(),
        recordedBy: profile?.uid || 'unknown',
        recordedByName: profile?.displayName || 'Sistema',
        receivedBy: profile?.displayName || 'Sistema',
        createdAt: serverTimestamp()
      });
      
      // Update student next payment date if it's a new payment
      if (formData.status === 'paid') {
        const student = students.find(s => s.id === formData.studentId);
        if (student) {
          const studentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
          const studentExpirations = { ...(student.planExpirations || {}) };
          
          // Update expirations for the plans being paid
          const plansToUpdate = formData.planIds.length > 0 ? formData.planIds : studentPlanIds;
          
          plansToUpdate.forEach(pid => {
            const plan = plans.find(p => p.id === pid);
            if (plan) {
            const expValue = studentExpirations[pid];
            const currentExp = expValue ? new Date(`${expValue}T00:00:00`) : paymentDate;
            const anniversaryDay = currentExp ? getDate(currentExp) : getDate(paymentDate);
            const baseDate = currentExp > paymentDate ? currentExp : paymentDate;

            let nextDate = plan.isCorporate 
              ? new Date('2099-12-31T00:00:00')
              : (plan.durationMonths 
                ? addMonths(baseDate, plan.durationMonths)
                : addDays(baseDate, plan.durationDays || 30));

            // If it's a monthly plan, try to preserve the anniversary day
            if (plan.durationMonths && !plan.isCorporate) {
              nextDate = setDate(nextDate, anniversaryDay);
              if (nextDate <= baseDate) {
                nextDate = addMonths(nextDate, 1);
                nextDate = setDate(nextDate, anniversaryDay);
              }
            }
            
            studentExpirations[pid] = nextDate.toISOString().split('T')[0];
            }
          });

          // Calculate overall nextPaymentDate as the earliest expiration among recurring plans (>= 28 days or >= 1 month)
          const recurringExpirations = Object.entries(studentExpirations)
            .filter(([pid]) => {
              const plan = plans.find(p => p.id === pid);
              if (plan?.isCorporate) return false;
              return plan?.durationMonths ? plan.durationMonths >= 1 : (plan?.durationDays || 30) >= 28;
            })
            .map(([_, d]) => new Date(d as string).getTime());

          const earliestExp = recurringExpirations.length > 0 
            ? new Date(Math.min(...recurringExpirations)) 
            : null;

          await updateDoc(doc(db, 'students', student.id), {
            planExpirations: studentExpirations,
            nextPaymentDate: earliestExp ? earliestExp.toISOString().split('T')[0] : null,
            status: 'active'
          });

          // Sync with hardware
          try {
            syncUser({
              ...student,
              planExpirations: studentExpirations,
              nextPaymentDate: earliestExp ? earliestExp.toISOString().split('T')[0] : null,
              status: 'active'
            }).catch(e => console.error('Auto-sync error:', e));
          } catch (e) {}
        }
      }

      setIsModalOpen(false);
      setFormData({ studentId: '', amount: 0, fee: 0, status: 'paid', method: 'pix', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), planIds: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'payments', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${id}`);
    }
  };

  const handleRemovePlanFromStudent = async (studentId: string, planId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      
      const currentPlanIds = student.planIds || (student.planId ? [student.planId] : []);
      const newPlanIds = currentPlanIds.filter((id: string) => id !== planId);
      const newExpirations = { ...(student.planExpirations || {}) };
      delete newExpirations[planId];
      
      await updateDoc(doc(db, 'students', studentId), {
        planIds: newPlanIds,
        planExpirations: newExpirations
      });

      // Sync with hardware
      try {
        syncUser({
          ...student,
          planIds: newPlanIds,
          planExpirations: newExpirations
        }).catch(e => console.error('Auto-sync error:', e));
      } catch (e) {}
      
      // Update local form data if the removed plan was selected
      const updatedSelectedPlanIds = formData.planIds.filter(id => id !== planId);
      const newAmount = plans
        .filter(p => updatedSelectedPlanIds.includes(p.id))
        .reduce((sum, p) => sum + p.price, 0);
      setFormData(prev => ({ ...prev, planIds: updatedSelectedPlanIds, amount: newAmount }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const getPlanDates = (planId: string) => {
    const student = students.find(s => s.id === formData.studentId);
    const plan = plans.find(p => p.id === planId);
    if (!student || !plan) return null;

    const paymentDate = new Date(`${formData.date}T${formData.time || '00:00'}:00`);
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
      current: currentExp,
      next: nextDate,
      base: baseDate
    };
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white italic uppercase tracking-tighter">Cobranças</h2>
          <p className="text-neutral-500">Gerencie as mensalidades e pagamentos dos alunos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={printDetailedReport}
            className="p-2.5 bg-neutral-900 text-white rounded-xl border-2 border-neutral-800 hover:border-yellow-400 transition-all shadow-lg flex items-center gap-2 group"
            title="Relatório Detalhado"
          >
            <FileText size={18} className="text-neutral-500 group-hover:text-yellow-400 transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Relatório Detalhado</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-yellow-400 text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
          >
            <Plus size={18} />
            Registrar Pagamento
          </button>
        </div>
      </header>

      <div className="bg-black p-4 rounded-2xl shadow-sm border-2 border-neutral-600 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou número do aluno..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={cn(
                "w-full md:w-64 px-4 py-2 bg-neutral-900 border-2 rounded-xl flex items-center justify-between transition-all text-sm font-medium",
                filterPlanId !== 'all' ? "border-yellow-400/50 text-yellow-400" : "border-neutral-600 text-white hover:border-neutral-500"
              )}
            >
              <div className="flex items-center gap-2">
                <Filter size={16} />
                <span className="truncate">
                  {filterPlanId === 'all' ? 'Todos os Planos' : plans.find(p => p.id === filterPlanId)?.name || 'Todos os Planos'}
                </span>
              </div>
              <ChevronDown size={14} className={cn("transition-transform", isFilterDropdownOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isFilterDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsFilterDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-full md:w-64 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setFilterPlanId('all');
                        setIsFilterDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest flex items-center justify-between hover:bg-neutral-800 transition-colors",
                        filterPlanId === 'all' ? "text-yellow-400" : "text-neutral-400"
                      )}
                    >
                      Todos os Planos
                      {filterPlanId === 'all' && <Check size={14} />}
                    </button>
                    <div className="h-px bg-neutral-800 my-1" />
                    <div className="max-h-60 overflow-y-auto">
                      {plans.map(plan => (
                        <button
                          key={plan.id}
                          onClick={() => {
                            setFilterPlanId(plan.id);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest flex items-center justify-between hover:bg-neutral-800 transition-colors",
                            filterPlanId === plan.id ? "text-yellow-400" : "text-neutral-400"
                          )}
                        >
                          {plan.name}
                          {filterPlanId === plan.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'today', label: 'Hoje' },
              { id: 'yesterday', label: 'Ontem' },
              { id: 'custom', label: 'Período' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateFilter(opt.id as any)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-2",
                  dateFilter === opt.id 
                    ? "bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-400/20" 
                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {dateFilter === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-4"
              >
                <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
                  <input
                    type="date"
                    className="bg-transparent text-white text-[10px] font-bold uppercase focus:outline-none"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-neutral-600 text-[10px] font-bold">ATÉ</span>
                  <input
                    type="date"
                    className="bg-transparent text-white text-[10px] font-bold uppercase focus:outline-none"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-neutral-800">
          {[
            { label: 'Dinheiro', value: stats.money, color: 'text-green-400', icon: Banknote },
            { label: 'PIX', value: stats.pix, color: 'text-yellow-400', icon: Smartphone },
            { label: 'Crédito', value: stats.credit, color: 'text-pink-400', icon: CreditCard },
            { label: 'Débito', value: stats.debit, color: 'text-orange-400', icon: CreditCard },
            { label: 'Recorrente', value: stats.recurring, color: 'text-blue-400', icon: RefreshCw },
            { label: 'Outros', value: stats.outro, color: 'text-neutral-400', icon: DollarSign }
          ].map((item, idx) => (
            <div key={idx} className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800 flex flex-col items-center justify-center gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">{item.label}</span>
              <div className="flex items-center gap-2">
                <item.icon size={12} className={item.color} />
                <span className={cn("text-xs font-black", item.color)}>R$ {item.value.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-black rounded-2xl shadow-sm border-2 border-neutral-600 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b-2 border-neutral-600">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Aluno</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Valor Bruto</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Custo</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Líquido</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Método</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Data</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Registrado Por</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Status</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-neutral-700/50">
            {filteredPayments.map((payment) => {
              const student = students.find(s => s.id === payment.studentId);
              return (
                <tr key={payment.id} className="hover:bg-neutral-900 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                        <CreditCard size={16} />
                      </div>
                      <p className="font-bold text-sm text-white">{(student?.name || 'Aluno Desconhecido').toUpperCase()}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className={cn(
                      "text-sm font-bold",
                      payment.method === 'pix' ? "text-yellow-400" : 
                      payment.method === 'credit' ? "text-pink-400" : 
                      payment.method === 'debit' ? "text-orange-400" : 
                      payment.method === 'recurring' ? "text-blue-400" : 
                      "text-green-400"
                    )}>R$ {payment.amount.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-red-400">R$ {(payment.fee || 0).toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className={cn(
                      "text-sm font-bold",
                      payment.method === 'pix' ? "text-yellow-400" : 
                      payment.method === 'credit' ? "text-pink-400" : 
                      payment.method === 'debit' ? "text-orange-400" : 
                      payment.method === 'recurring' ? "text-blue-400" : 
                      "text-green-400"
                    )}>
                      R$ {(payment.netAmount || payment.amount).toFixed(2)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-neutral-400 capitalize">
                      {payment.method === 'credit' ? 'Cartão de Crédito' : 
                       payment.method === 'debit' ? 'Cartão de Débito' : 
                       payment.method === 'pix' ? 'PIX' : 
                       payment.method === 'recurring' ? 'Recorrente' : 'Dinheiro'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Calendar size={14} className="text-neutral-500" />
                      {(() => {
                        const dateVal = payment.date;
                        const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
                        return isNaN(d.getTime()) ? 'Data Inválida' : format(d, 'dd/MM/yyyy HH:mm');
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <User size={12} />
                      {payment.recordedByName || 'Sistema'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      payment.status === 'paid' ? "bg-green-950 text-green-400" : 
                      payment.status === 'pending' ? "bg-yellow-950 text-yellow-400" : 
                      "bg-red-950 text-red-400"
                    )}>
                      {payment.status === 'paid' ? <CheckCircle2 size={10} /> : 
                       payment.status === 'pending' ? <Clock size={10} /> : 
                       <AlertCircle size={10} />}
                      {payment.status === 'paid' ? 'Pago' : 
                       payment.status === 'pending' ? 'Pendente' : 
                       'Atrasado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <select
                      className="text-xs bg-neutral-900 border-2 border-neutral-600 text-white rounded-lg px-2 py-1 focus:ring-0 cursor-pointer hover:border-yellow-400 focus:border-yellow-400 transition-all outline-none appearance-none"
                      value={payment.status}
                      onChange={(e) => handleStatusChange(payment.id, e.target.value)}
                    >
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="overdue">Atrasado</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPayments.length === 0 && (
          <div className="p-12 text-center text-neutral-500 italic">
            Nenhum pagamento registrado.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-2 border-neutral-600 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-2 border-neutral-600 flex items-center justify-between bg-neutral-900 text-white">
              <h3 className="text-xl font-bold italic uppercase tracking-tight">Registrar Pagamento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Aluno</label>
                <select
                  required
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                  value={formData.studentId}
                  onChange={(e) => {
                    const student = students.find(s => s.id === e.target.value);
                    const studentPlanIds = student?.planIds || (student?.planId ? [student.planId] : []);
                    const studentPlans = plans.filter(p => studentPlanIds.includes(p.id));
                    const totalAmount = studentPlans.reduce((sum, p) => sum + p.price, 0);
                    
                    setFormData({ 
                      ...formData, 
                      studentId: e.target.value,
                      amount: totalAmount,
                      planIds: studentPlanIds
                    });
                  }}
                >
                  <option value="">Selecione o aluno</option>
                  {students.map(s => <option key={s.id} value={s.id}>{(s.name || '').toUpperCase()}</option>)}
                </select>
              </div>

              {formData.studentId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Planos sendo pagos</label>
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
                  <div className="space-y-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                    {(() => {
                      const student = students.find(s => s.id === formData.studentId);
                      const studentPlanIds = student?.planIds || (student?.planId ? [student.planId] : []);
                      
                      return plans.filter(p => studentPlanIds.includes(p.id)).map(plan => {
                        const dates = getPlanDates(plan.id);
                        const isSelected = formData.planIds.includes(plan.id);
                        
                        return (
                          <div 
                            key={plan.id} 
                            className={cn(
                              "p-3 rounded-2xl border transition-all space-y-2",
                              isSelected 
                                ? "bg-yellow-400/10 border-yellow-400/50 shadow-sm" 
                                : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  const newPlanIds = isSelected
                                    ? formData.planIds.filter(id => id !== plan.id)
                                    : [...formData.planIds, plan.id];
                                  
                                  const newAmount = plans
                                    .filter(p => newPlanIds.includes(p.id))
                                    .reduce((sum, p) => sum + p.price, 0);
                                  
                                  setFormData({ ...formData, planIds: newPlanIds, amount: newAmount });
                                }}
                                className="flex items-center gap-3 flex-1 text-left"
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                  isSelected ? "bg-yellow-400 border-yellow-400" : "border-neutral-700"
                                )}>
                                  {isSelected && <CheckCircle2 size={12} className="text-black" />}
                                </div>
                                <div>
                                  <p className={cn("text-sm font-bold", isSelected ? "text-white" : "text-neutral-400")}>
                                    {plan.name}
                                  </p>
                                  <p className="text-[10px] text-yellow-400 font-bold uppercase">
                                    R$ {plan.price.toFixed(2)}
                                  </p>
                                </div>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleRemovePlanFromStudent(formData.studentId, plan.id)}
                                className="p-2 text-neutral-600 hover:text-red-400 transition-colors"
                                title="Remover este plano do aluno"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {isSelected && dates && (
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-yellow-400/20">
                                <div className="space-y-0.5">
                                  <p className="text-[9px] text-neutral-500 uppercase font-bold">Vencimento Atual</p>
                                  <p className="text-xs text-white font-medium">
                                    {dates.current ? format(dates.current, 'dd/MM/yyyy') : 'N/A'}
                                  </p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[9px] text-yellow-500 uppercase font-bold">Novo Vencimento</p>
                                  <p className="text-xs text-yellow-400 font-bold">
                                    {plan.isCorporate ? 'Indeterminado' : format(dates.next, 'dd/MM/yyyy')}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Valor Bruto (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={isNaN(formData.amount) ? '' : formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Custo de Cobrança (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={isNaN(formData.fee) ? '' : formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) })}
                  />
                </div>
                <p className="text-[10px] text-neutral-500 uppercase font-bold px-2">
                  Valor líquido: R$ {(isNaN(formData.amount - formData.fee) ? 0 : (formData.amount - formData.fee)).toFixed(2)}
                </p>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Método de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pix', icon: Smartphone, label: 'PIX', active: 'text-yellow-400 border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.4)]', inactive: 'text-yellow-400/80 border-neutral-800 bg-neutral-900/50 hover:text-yellow-400 hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(250,204,21,0.2)]' },
                    { id: 'credit', icon: CreditCard, label: 'Crédito', active: 'text-pink-400 border-pink-400 bg-pink-400/20 shadow-[0_0_20px_rgba(244,114,182,0.4)]', inactive: 'text-pink-400/80 border-neutral-800 bg-neutral-900/50 hover:text-pink-400 hover:border-pink-400 hover:shadow-[0_0_15px_rgba(244,114,182,0.2)]' },
                    { id: 'debit', icon: CreditCard, label: 'Débito', active: 'text-orange-400 border-orange-400 bg-orange-400/20 shadow-[0_0_20px_rgba(251,146,60,0.4)]', inactive: 'text-orange-400/80 border-neutral-800 bg-neutral-900/50 hover:text-orange-400 hover:border-orange-400 hover:shadow-[0_0_15px_rgba(251,146,60,0.2)]' },
                    { id: 'recurring', icon: RefreshCw, label: 'Recorrente', active: 'text-blue-400 border-blue-400 bg-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.4)]', inactive: 'text-blue-400/80 border-neutral-800 bg-neutral-900/50 hover:text-blue-400 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(96,165,250,0.2)]' },
                    { id: 'money', icon: Banknote, label: 'Dinheiro', active: 'text-green-400 border-green-400 bg-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.4)]', inactive: 'text-green-400/80 border-neutral-800 bg-neutral-900/50 hover:text-green-400 hover:border-green-400 hover:shadow-[0_0_15px_rgba(74,222,128,0.2)]' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, method: m.id })}
                      className={cn(
                        "flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all w-full",
                        formData.method === m.id ? m.active : m.inactive
                      )}
                    >
                      <m.icon size={18} className="shrink-0" />
                      <span className="text-[10px] font-black uppercase italic tracking-tight truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Data</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Hora</label>
                  <input
                    required
                    type="time"
                    className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Status</label>
                <select
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                  <option value="overdue">Atrasado</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase">Funcionário</label>
                <input
                  type="text"
                  readOnly
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-400 outline-none cursor-not-allowed"
                  value={profile?.displayName || 'Sistema'}
                />
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
                  className="flex-1 px-4 py-3 bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
                >
                  Salvar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
