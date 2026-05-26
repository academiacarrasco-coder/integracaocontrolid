import React from 'react';
import { useGymData } from '../hooks/useGymData';
import { useAuth } from '../hooks/useAuth';
import { useHardware } from '../contexts/HardwareContext';
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp, 
  Calendar, 
  Clock,
  ArrowRight,
  ScanFace,
  Cake,
  PlusCircle,
  CreditCard,
  Wifi,
  RefreshCw
} from 'lucide-react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { students, classes, payments, accessLogs, loading } = useGymData();
  const { isAdmin, hasPermission } = useAuth();
  const { releaseTurnstile, isHardwareConnected, syncAll, isSyncing } = useHardware();

  const activeStudents = students.filter(s => s.status === 'active');
  const inactiveStudents = students.filter(s => s.status === 'inactive');

  const birthdayStudents = students.filter(s => {
    if (!s.birthDate) return false;
    try {
      const birthDate = typeof s.birthDate === 'string' ? parseISO(s.birthDate) : new Date(s.birthDate);
      if (isNaN(birthDate.getTime())) return false;
      const today = new Date();
      return birthDate.getMonth() === today.getMonth();
    } catch (e) {
      return false;
    }
  }).sort((a, b) => {
    const dateA = typeof a.birthDate === 'string' ? parseISO(a.birthDate) : new Date(a.birthDate);
    const dateB = typeof b.birthDate === 'string' ? parseISO(b.birthDate) : new Date(b.birthDate);
    return dateA.getDate() - dateB.getDate();
  });
  
  const thisMonthRevenue = payments
    .filter(p => {
      if (!p.date) return false;
      try {
        const date = typeof p.date === 'string' ? parseISO(p.date) : new Date(p.date);
        if (isNaN(date.getTime())) return false;
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && p.status === 'paid';
      } catch (e) {
        return false;
      }
    })
    .reduce((acc, p) => acc + (isNaN(Number(p.amount)) ? 0 : Number(p.amount)), 0);

  const stats = [
    { name: 'Total de Alunos', value: students.length, icon: Users, color: 'bg-blue-500' },
    { name: 'Alunos Ativos', value: activeStudents.length, icon: UserCheck, color: 'bg-green-500' },
    { name: 'Alunos Inativos', value: inactiveStudents.length, icon: UserX, color: 'bg-red-500' },
    { name: 'Receita (Mês)', value: `R$ ${thisMonthRevenue.toFixed(2)}`, icon: TrendingUp, color: 'bg-yellow-400 text-black', permission: 'reports' },
  ].filter(stat => !stat.permission || hasPermission(stat.permission));

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white italic uppercase">Painel</h2>
          <p className="text-neutral-500">Visão geral da sua academia hoje.</p>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          onClick={() => releaseTurnstile()}
          disabled={!isHardwareConnected}
          className={cn(
            "bg-neutral-900/50 border-2 border-neutral-600 p-4 rounded-2xl flex items-center gap-3 transition-all group",
            isHardwareConnected ? "hover:border-yellow-400 cursor-pointer" : "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all",
            isHardwareConnected ? "bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-white" : "bg-neutral-800 text-neutral-600"
          )}>
            <ScanFace size={20} />
          </div>
          <div className="text-left">
            <span className="block text-[10px] font-black uppercase tracking-widest text-white">Liberar Catraca</span>
            <span className="block text-[8px] font-bold uppercase tracking-tight text-neutral-500">
              {isHardwareConnected ? 'Online' : 'Offline'}
            </span>
          </div>
        </button>

        <button
          onClick={() => syncAll(students)}
          disabled={!isHardwareConnected || isSyncing}
          className={cn(
            "bg-neutral-900/50 border-2 border-neutral-600 p-4 rounded-2xl flex items-center gap-3 transition-all group",
            isHardwareConnected && !isSyncing ? "hover:border-yellow-400 cursor-pointer" : "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all",
            isHardwareConnected && !isSyncing ? "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white" : "bg-neutral-800 text-neutral-600"
          )}>
            <RefreshCw size={20} className={cn(isSyncing && "animate-spin")} />
          </div>
          <div className="text-left">
            <span className="block text-[10px] font-black uppercase tracking-widest text-white">Sincronizar Catraca</span>
            <span className="block text-[8px] font-bold uppercase tracking-tight text-neutral-500">
              {isSyncing ? 'Sincronizando...' : (isHardwareConnected ? 'Pronto' : 'Offline')}
            </span>
          </div>
        </button>

        <Link to="/students" className="bg-neutral-900/50 border-2 border-neutral-600 p-4 rounded-2xl flex items-center gap-3 hover:border-yellow-400 transition-all group">
          <div className="bg-yellow-400/10 p-2 rounded-xl text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black transition-all">
            <PlusCircle size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Novo Aluno</span>
        </Link>
        <Link to="/payments" className="bg-neutral-900/50 border-2 border-neutral-600 p-4 rounded-2xl flex items-center gap-3 hover:border-yellow-400 transition-all group">
          <div className="bg-yellow-400/10 p-2 rounded-xl text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black transition-all">
            <CreditCard size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Lançar Pagamento</span>
        </Link>
        <Link to="/turnstile" className="bg-neutral-900/50 border-2 border-neutral-600 p-4 rounded-2xl flex items-center gap-3 hover:border-yellow-400 transition-all group">
          <div className="bg-yellow-400/10 p-2 rounded-xl text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black transition-all">
            <ScanFace size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Abrir Catraca</span>
        </Link>
        <Link to="/turnstile?connect=true" className="bg-neutral-900/50 border-2 border-neutral-600 p-4 rounded-2xl flex items-center gap-3 hover:border-yellow-400 transition-all group">
          <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
            <Wifi size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Conectar via Modem</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-black p-6 rounded-2xl shadow-sm border-2 border-neutral-600 flex items-center gap-4 hover:border-yellow-400 transition-all cursor-default group">
            <div className={`${stat.color} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">{stat.name}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Classes */}
        <div className="bg-black rounded-2xl shadow-sm border-2 border-neutral-700 overflow-hidden">
          <div className="p-6 border-b-2 border-neutral-700 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-xs">
              <Calendar size={18} className="text-yellow-400" />
              Próximas Aulas
            </h3>
            <button className="text-[10px] font-bold text-yellow-400 hover:underline flex items-center gap-1 uppercase tracking-widest">
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y-2 divide-neutral-700">
            {classes.length > 0 ? (
              classes.slice(0, 5).map((cls) => (
                <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-neutral-900 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-neutral-900 p-2 rounded-lg text-neutral-400">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{cls.name}</p>
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">{cls.instructor} • {cls.time}</p>
                    </div>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {cls.studentIds?.slice(0, 3).map((sid: string) => (
                      <img
                        key={sid}
                        className="inline-block h-6 w-6 rounded-full ring-2 ring-black"
                        src={`https://picsum.photos/seed/${sid}/32/32`}
                        alt=""
                      />
                    ))}
                    {cls.studentIds?.length > 3 && (
                      <span className="flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-black bg-neutral-800 text-[10px] font-bold">
                        +{cls.studentIds.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-500 italic text-sm">
                Nenhuma aula agendada.
              </div>
            )}
          </div>
        </div>

        {/* Birthdays */}
        <div className="bg-black rounded-2xl shadow-sm border-2 border-neutral-700 overflow-hidden">
          <div className="p-6 border-b-2 border-neutral-700 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-xs">
              <Cake size={18} className="text-yellow-400" />
              Aniversariantes do Mês
            </h3>
            <span className="bg-yellow-400/10 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase border border-yellow-400/20">
              {birthdayStudents.length}
            </span>
          </div>
          <div className="divide-y-2 divide-neutral-700 max-h-[300px] overflow-y-auto">
            {birthdayStudents.length > 0 ? (
              birthdayStudents.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between hover:bg-neutral-900 transition-colors">
                  <div className="flex items-center gap-4">
                    <img 
                      src={student.photoUrl || `https://picsum.photos/seed/${student.id}/32/32`} 
                      alt="" 
                      className="w-8 h-8 rounded-full border border-neutral-800 object-cover"
                    />
                    <div>
                      <p className="font-bold text-sm text-white">{(student.name || '').toUpperCase()}</p>
                      <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">
                        {format(parseISO(student.birthDate), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="bg-yellow-400/10 p-2 rounded-lg text-yellow-400">
                    <Cake size={14} />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-500 italic text-sm">
                Nenhum aniversariante este mês.
              </div>
            )}
          </div>
        </div>

        {/* Recent Access */}
        <div className="bg-black rounded-2xl shadow-sm border-2 border-neutral-700 overflow-hidden">
          <div className="p-6 border-b-2 border-neutral-700 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-xs">
              <ScanFace size={18} className="text-yellow-400" />
              Acessos Recentes
            </h3>
            <button className="text-[10px] font-bold text-yellow-400 hover:underline flex items-center gap-1 uppercase tracking-widest">
              Ver log completo <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y-2 divide-neutral-700">
            {accessLogs.length > 0 ? (
              accessLogs.slice(0, 5).map((log) => {
                const student = students.find(s => s.id === log.studentId);
                return (
                  <div key={log.id} className="p-4 flex items-center justify-between hover:bg-neutral-900 transition-colors">
                    <div className="flex items-center gap-4">
                      <img 
                      src={student?.photoUrl || `https://picsum.photos/seed/${log.studentId}/32/32`} 
                      alt="" 
                      className="w-8 h-8 rounded-full border-2 border-neutral-600 object-cover"
                    />
                      <div>
                        <p className="font-bold text-sm text-white">{(student?.name || 'Aluno Desconhecido').toUpperCase()}</p>
                        <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">
                          {(() => {
                            const dateVal = log.timestamp;
                            const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
                            return isNaN(d.getTime()) ? 'Horário Indisponível' : format(d, "HH:mm 'em' dd/MM", { locale: ptBR });
                          })()}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                      log.type === 'entry' ? "bg-green-950 text-green-400" : "bg-neutral-800 text-neutral-400"
                    )}>
                      {log.type === 'entry' ? 'Entrada' : 'Saída'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-neutral-500 italic text-sm">
                Nenhum acesso registrado hoje.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
