import React, { useState, useRef, useEffect } from 'react';
import { useHardware } from '../contexts/HardwareContext';
import { useGymData } from '../hooks/useGymData';
import {
  Search,
  Unlock,
  Lock,
  UserCheck,
  UserX,
  DoorOpen,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  ChevronRight,
  Clock,
  Power,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuthorizePayload } from '../lib/controlIdSession';

interface AccessLog {
  id: string;
  studentName: string;
  time: Date;
  success: boolean;
  message: string;
  terminalType: string;
}

export default function AccessControl() {
  const { releaseDeviceDirect, hardwareConfig, isHardwareConnected, addHardwareLog } = useHardware();
  const { students } = useGymData();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchFeedback, setLaunchFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logs, setLogs] = useState<AccessLog[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-clear feedback after 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    if (!launchFeedback) return;
    const t = setTimeout(() => setLaunchFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [launchFeedback]);

  const handleLaunchBat = async () => {
    setLaunching(true);
    setLaunchFeedback(null);
    try {
      const res = await fetch('/api/launch-bat', { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (res.ok && data.success !== false) {
        setLaunchFeedback({ type: 'success', text: '✅ Catraca iniciada! Aguarde a conexão...' });
      } else {
        setLaunchFeedback({ type: 'error', text: `❌ Erro: ${data.error || 'Falha ao iniciar'}` });
      }
    } catch (e: any) {
      setLaunchFeedback({ type: 'error', text: `❌ Erro: ${e.message}` });
    } finally {
      setLaunching(false);
    }
  };

  // Filter students by name or CPF
  const filtered = query.trim().length >= 2
    ? (students ?? []).filter((s: any) =>
        s.name?.toLowerCase().includes(query.toLowerCase()) ||
        s.cpf?.includes(query)
      ).slice(0, 8)
    : [];

  // Derive student status using real Firestore fields
  function getStudentStatus(student: any): { ok: boolean; label: string; detail: string } {
    if (!student) return { ok: false, label: 'Sem dados', detail: '' };

    // Primary check: status field
    if (student.status === 'inactive') {
      return { ok: false, label: 'Inativo', detail: 'Aluno sem plano ativo ou inadimplente.' };
    }

    // Secondary check: nextPaymentDate (date the plan expires / next payment is due)
    if (student.nextPaymentDate) {
      const due = new Date(student.nextPaymentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Special case: indeterminate plan
      if (student.nextPaymentDate === '2099-12-31') {
        return { ok: true, label: 'Ativo (Indeterminado)', detail: 'Plano sem data de vencimento.' };
      }

      const daysLeft = differenceInDays(due, today);

      if (daysLeft < 0) {
        return {
          ok: false,
          label: 'Vencido',
          detail: `Vencido há ${Math.abs(daysLeft)} dia(s). Vencimento: ${format(due, 'dd/MM/yyyy', { locale: ptBR })}`,
        };
      }

      if (daysLeft <= 5) {
        return {
          ok: true,
          label: 'Vence em breve',
          detail: `Válido até ${format(due, 'dd/MM/yyyy', { locale: ptBR })} (${daysLeft} dia(s) restantes)`,
        };
      }

      return {
        ok: true,
        label: 'Ativo',
        detail: `Válido até ${format(due, 'dd/MM/yyyy', { locale: ptBR })} (${daysLeft} dia(s) restantes)`,
      };
    }

    // Fallback: trust status field
    if (student.status === 'active') {
      return { ok: true, label: 'Ativo', detail: 'Plano ativo.' };
    }

    return { ok: false, label: 'Sem plano', detail: 'Nenhum plano ativo encontrado.' };
  }

  // Determine terminal type from config
  function getTerminalType(): AuthorizePayload['terminalType'] {
    const model = hardwareConfig.deviceModel || 'idface';
    if (model === 'idblock') return 'catra';
    if (model === 'door') return 'door';
    if (model === 'sec_box') return 'sec_box';
    if (model === 'open_collector') return 'open_collector';
    return 'sec_box'; // iDFace default
  }

  const handleRelease = async (student: any) => {
    const status = getStudentStatus(student);

    if (!status.ok) {
      setFeedback({ type: 'error', text: `Acesso negado: ${status.label} — ${status.detail}` });
      addLog(student.name, false, `Negado: ${status.label}`, getTerminalType());
      return;
    }

    setReleasing(true);
    setFeedback(null);

    const terminalType = getTerminalType();
    const opts: AuthorizePayload = {
      userName: student.name,
      terminalType,
      catراRotation: hardwareConfig.rotation || 'R',
    };

    const result = await releaseDeviceDirect(opts);

    setReleasing(false);

    if (result.success) {
      setFeedback({ type: 'success', text: `✅ ${student.name} liberado(a)!` });
      addLog(student.name, true, result.message, terminalType);
    } else {
      setFeedback({ type: 'error', text: `❌ Falha: ${result.message}` });
      addLog(student.name, false, result.message, terminalType);
    }
  };

  function addLog(name: string, success: boolean, message: string, terminalType: string) {
    setLogs(prev => [
      { id: crypto.randomUUID(), studentName: name, time: new Date(), success, message, terminalType },
      ...prev,
    ].slice(0, 20));
  }

  const selectedStatus = selected ? getStudentStatus(selected) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
            Controle de Acesso
          </h2>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
            Liberação manual vinculada ao aluno
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border',
          isHardwareConnected
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        )}>
          {isHardwareConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isHardwareConnected ? 'Dispositivo Online' : 'Dispositivo Offline'}
        </div>
      </div>

      {/* INICIAR CATRACA Button */}
      <div className="space-y-3">
        <button
          onClick={handleLaunchBat}
          disabled={launching}
          className={cn(
            'w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl font-black uppercase tracking-widest text-sm transition-all duration-200 border',
            isHardwareConnected
              ? 'bg-neutral-900 border-green-500/30 text-green-400 cursor-default'
              : 'bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 border-green-500/40 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/30 active:scale-[0.99]',
            launching && 'opacity-70 cursor-wait'
          )}
        >
          {launching ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isHardwareConnected ? (
            <Zap size={20} className="fill-green-400" />
          ) : (
            <Power size={20} />
          )}
          <div className="text-left">
            <p className="leading-none">
              {isHardwareConnected ? 'Catraca Online' : launching ? 'Iniciando...' : 'Iniciar Catraca'}
            </p>
            <p className={cn(
              'text-[9px] font-normal normal-case tracking-wider mt-0.5',
              isHardwareConnected ? 'text-green-500/70' : 'text-green-200/60'
            )}>
              {isHardwareConnected ? 'Conexão estabelecida com sucesso' : 'Executar iniciar-recepcao.bat'}
            </p>
          </div>
        </button>

        {launchFeedback && (
          <div className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-bold animate-in slide-in-from-top duration-300',
            launchFeedback.type === 'success'
              ? 'bg-green-950/40 border-green-500/20 text-green-400'
              : 'bg-red-950/40 border-red-500/20 text-red-400'
          )}>
            {launchFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {launchFeedback.text}
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={cn(
          'flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-bold animate-in slide-in-from-top duration-300',
          feedback.type === 'success'
            ? 'bg-green-950/30 border-green-500/25 text-green-400'
            : 'bg-red-950/30 border-red-500/25 text-red-400'
        )}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Search + Student Card */}
        <div className="space-y-4">

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar aluno por nome ou CPF..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              className="w-full pl-10 pr-4 py-4 bg-neutral-950 border border-neutral-800 rounded-2xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              autoFocus
            />
          </div>

          {/* Dropdown results */}
          {filtered.length > 0 && !selected && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
              {filtered.map((s: any) => {
                const st = getStudentStatus(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s); setQuery(s.name); }}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-neutral-900 transition-colors border-b border-neutral-900 last:border-0"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black',
                        st.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      )}>
                        {s.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{s.name}</p>
                        <p className="text-[9px] text-neutral-500 uppercase tracking-wider">{st.label}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-neutral-600" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Student Card */}
          {selected && selectedStatus && (
            <div className={cn(
              'p-6 rounded-[28px] border relative overflow-hidden',
              selectedStatus.ok
                ? 'bg-neutral-950 border-green-500/20'
                : 'bg-neutral-950 border-red-500/20'
            )}>
              {/* Glow */}
              <div className={cn(
                'absolute inset-0 pointer-events-none',
                selectedStatus.ok
                  ? 'bg-gradient-to-br from-green-500/5 to-transparent'
                  : 'bg-gradient-to-br from-red-500/5 to-transparent'
              )} />

              {/* Card estilo recepção — inspirado na imagem de referência */}
              <div className="relative">
                {/* Faixa superior com avatar centralizado */}
                <div className={cn(
                  'rounded-2xl pt-8 pb-5 px-6 flex flex-col items-center text-center',
                  selectedStatus.ok
                    ? 'bg-gradient-to-br from-neutral-800 to-neutral-900'
                    : 'bg-gradient-to-br from-neutral-800 to-neutral-900'
                )}>
                  {/* Avatar circular */}
                  <div className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-4 shadow-xl mb-3',
                    selectedStatus.ok
                      ? 'bg-gradient-to-br from-green-700 to-green-900 border-green-500/40 text-white'
                      : 'bg-gradient-to-br from-red-800 to-red-950 border-red-500/30 text-white'
                  )}>
                    {selected.photoURL ? (
                      <img src={selected.photoURL} alt={selected.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      selected.name?.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Nome */}
                  <p className="text-xl font-black text-white leading-tight truncate w-full">{selected.name}</p>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-4 mt-4 w-full text-left">
                    <div>
                      <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Nome</p>
                      <p className="text-xs text-white font-semibold mt-0.5 truncate">{selected.name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Vencimento</p>
                      <p className={cn(
                        'text-xs font-semibold mt-0.5',
                        selectedStatus.ok ? 'text-white' : 'text-red-400'
                      )}>
                        {selected.nextPaymentDate && selected.nextPaymentDate !== '2099-12-31'
                          ? format(new Date(selected.nextPaymentDate), 'dd/MM/yyyy')
                          : selected.nextPaymentDate === '2099-12-31' ? 'Indeterminado' : '—'}
                      </p>
                    </div>
                    {selected.cpf && (
                      <div>
                        <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">CPF</p>
                        <p className="text-xs text-neutral-300 font-mono mt-0.5">{selected.cpf}</p>
                      </div>
                    )}
                    {selected.phone && (
                      <div>
                        <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Telefone</p>
                        <p className="text-xs text-neutral-300 mt-0.5">{selected.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner de status — ACESSO LIBERADO / BLOQUEADO */}
                <div className={cn(
                  'flex items-center justify-center gap-2.5 py-3.5 rounded-b-[28px] font-black uppercase tracking-[0.2em] text-sm',
                  selectedStatus.ok
                    ? 'bg-green-500 text-white'
                    : 'bg-red-600 text-white'
                )}>
                  {selectedStatus.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {selectedStatus.ok ? 'Acesso Liberado' : 'Acesso Bloqueado'}
                </div>
              </div>

              {/* Release Button */}
              <div className="mt-5 relative">
                {selectedStatus.ok ? (
                  <button
                    onClick={() => handleRelease(selected)}
                    disabled={releasing}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-green-500/10"
                  >
                    {releasing ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <DoorOpen size={18} />
                    )}
                    {releasing ? 'Liberando...' : 'Liberar Acesso'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-red-900/30 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase tracking-widest text-sm cursor-not-allowed opacity-80"
                  >
                    <Lock size={18} />
                    Acesso Bloqueado
                  </button>
                )}
              </div>

              {/* Override for admin */}
              {!selectedStatus.ok && (
                <button
                  onClick={() => handleRelease({ ...selected, _override: true, dueDate: null, planExpiry: new Date(Date.now() + 86400000).toISOString() })}
                  disabled={releasing}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  <ShieldAlert size={12} />
                  Liberar com override (admin)
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selected && query.trim().length >= 2 && filtered.length === 0 && (
            <div className="p-8 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
              <p className="text-neutral-500 text-sm">Nenhum aluno encontrado para "{query}"</p>
            </div>
          )}

          {/* Config info strip */}
          <div className="px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center gap-3 text-[9px] text-neutral-600 font-mono">
            <span className="text-neutral-500 font-bold uppercase tracking-widest">Terminal:</span>
            <span>{hardwareConfig.deviceModel?.toUpperCase() || 'IDFACE'}</span>
            <span className="mx-1 text-neutral-700">•</span>
            <span className="text-neutral-500 font-bold uppercase tracking-widest">IP:</span>
            <span>{hardwareConfig.ip || '—'}</span>
            <span className="mx-1 text-neutral-700">•</span>
            <span className="text-neutral-500 font-bold uppercase tracking-widest">Tipo:</span>
            <span>{getTerminalType()}</span>
          </div>
        </div>

        {/* RIGHT: Access Log */}
        <div className="p-6 rounded-[28px] bg-black border border-neutral-800 flex flex-col">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-neutral-900">
            <div className="p-2 bg-neutral-900 rounded-xl text-neutral-400">
              <Clock size={14} />
            </div>
            <div>
              <h4 className="text-sm font-black italic uppercase text-white">Log de Acessos</h4>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Sessão atual</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[460px] pr-1">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-neutral-700">
                <Unlock size={24} className="mb-2 opacity-30" />
                <p className="text-[10px] uppercase tracking-widest">Nenhum acesso registrado ainda</p>
              </div>
            ) : (
              logs.map(log => (
                <div
                  key={log.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border',
                    log.success
                      ? 'bg-green-950/20 border-green-500/15'
                      : 'bg-red-950/20 border-red-500/15'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                    log.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  )}>
                    {log.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{log.studentName}</p>
                    <p className="text-[9px] text-neutral-500 truncate">{log.message}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] font-mono text-neutral-500">
                      {format(log.time, 'HH:mm:ss')}
                    </p>
                    <p className="text-[8px] uppercase tracking-wider text-neutral-700">{log.terminalType}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
