import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Cpu, 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Play, 
  Unlock, 
  Clock, 
  Lock, 
  AlertCircle, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Info,
  ShieldAlert
} from 'lucide-react';

export default function ControlIdPanel() {
  const { isAdmin, profile } = useAuth();
  
  // Estados da Catraca (controlIdDevices)
  const [device, setDevice] = useState<any>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);
  
  // Estados de Comandos e Logs
  const [commands, setCommands] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  // Estados de Ação
  const [testingConnection, setTestingConnection] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // 1. Escuta Ativa do Status do Equipamento
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'controlIdDevices', 'iface-principal'),
      (snapshot) => {
        if (snapshot.exists()) {
          setDevice(snapshot.data());
        }
        setLoadingDevice(false);
      },
      (error) => {
        console.error('Erro ao ler status do equipamento:', error);
        setLoadingDevice(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Escuta Ativa dos Últimos 5 Comandos
  useEffect(() => {
    const q = query(
      collection(db, 'controlIdCommands'),
      orderBy('requestedAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const cmdsList: any[] = [];
      snapshot.forEach((doc) => {
        cmdsList.push({ id: doc.id, ...doc.data() });
      });
      setCommands(cmdsList);
    });
    return () => unsub();
  }, []);

  // 3. Escuta Ativa dos Últimos 10 Logs
  useEffect(() => {
    const q = query(
      collection(db, 'controlIdLogs'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const logsList: any[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() });
      });
      setLogs(logsList);
    });
    return () => unsub();
  }, []);

  // Limpa mensagem de ação temporária
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // 4. Ação: Testar Conexão
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setActionMessage(null);
    try {
      await addDoc(collection(db, 'controlIdCommands'), {
        type: 'testConnection',
        deviceId: 'iface-principal',
        status: 'pending',
        requestedAt: new Date().toISOString()
      });
      setActionMessage({ type: 'success', text: 'Solicitação de teste enviada! Aguardando o Agente Local processar...' });
    } catch (err: any) {
      console.error(err);
      setActionMessage({ type: 'error', text: `Erro ao enviar teste: ${err.message}` });
    } finally {
      setTestingConnection(false);
    }
  };

  // 5. Ação: Liberar Catraca
  const handleRelease = async () => {
    if (!window.confirm("Deseja mesmo enviar comando físico para liberar a catraca?")) {
      return;
    }
    setReleasing(true);
    setActionMessage(null);
    try {
      await addDoc(collection(db, 'controlIdCommands'), {
        type: 'unlock',
        deviceId: 'iface-principal',
        direction: 'clockwise',
        status: 'pending',
        requestedAt: new Date().toISOString()
      });
      setActionMessage({ type: 'success', text: 'Comando de liberação enviado! A catraca abrirá em instantes.' });
    } catch (err: any) {
      console.error(err);
      setActionMessage({ type: 'error', text: `Erro ao enviar comando: ${err.message}` });
    } finally {
      setReleasing(false);
    }
  };

  // Restrição visual para Administradores
  const canAccess = isAdmin || profile?.role === 'admin';

  if (!canAccess) {
    return (
      <div className="p-8 rounded-[40px] bg-black border border-red-500/20 flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent pointer-events-none" />
        <div className="p-4 bg-red-500/10 rounded-full text-red-500 border border-red-500/20">
          <ShieldAlert size={48} className="animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Acesso Restrito</h3>
          <p className="text-xs text-neutral-400 uppercase tracking-wider max-w-md mx-auto leading-relaxed">
            O Painel do Agente Local Control iD é reservado exclusivamente para administradores do sistema.
          </p>
        </div>
        <div className="text-[10px] text-neutral-600 italic">
          Pendência: Autenticação avançada pendente no checklist de implantação física.
        </div>
      </div>
    );
  }

  // Fallbacks estruturados caso o agente local ainda não tenha rodado
  const devName = device?.name || 'iDFace Principal';
  const devModel = device?.model || 'iDFace';
  const devIp = device?.ip || '192.168.1.100';
  const devPort = device?.port || 443;
  const devProtocol = device?.protocol || 'https';
  const devStatus = device?.status || 'unknown';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Mensagem Temporária de Feedback */}
      {actionMessage && (
        <div className={cn(
          "p-4 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center gap-3 animate-in slide-in-from-top duration-300",
          actionMessage.type === 'success' 
            ? "bg-green-950/20 border-green-500/20 text-green-400" 
            : "bg-red-950/20 border-red-500/20 text-red-400"
        )}>
          {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Grid Superior - Informações de Conectividade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card Principal do Equipamento */}
        <div className="md:col-span-2 p-8 rounded-[36px] bg-neutral-950 border border-neutral-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-neutral-800/20 pointer-events-none">
            <Cpu size={120} />
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/15">
                <Cpu size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{devName}</h3>
                <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">{devModel} - API REST Nativa</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-900">
              <div className="space-y-1">
                <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">IP do Hardware</span>
                <span className="font-mono text-xs text-white font-bold">{devIp}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Porta / Protocolo</span>
                <span className="font-mono text-xs text-blue-400 font-bold uppercase">{devPort} ({devProtocol})</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Último Batimento</span>
                <span className="font-mono text-xs text-neutral-400 font-bold">
                  {device?.lastSeenAt ? (() => {
                    try {
                      const d = device.lastSeenAt.toDate ? device.lastSeenAt.toDate() : new Date(device.lastSeenAt);
                      return format(d, "dd/MM 'às' HH:mm:ss", { locale: ptBR });
                    } catch (e) { return 'Formato inválido' }
                  })() : 'Nenhum ping registrado'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block">Número de Série</span>
                <span className="font-mono text-xs text-neutral-300 font-bold">
                  {device?.details?.serial || 'Aguardando agente...'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-900 flex items-center gap-3">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full",
              devStatus === 'online' ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse" : 
              devStatus === 'offline' ? "bg-red-500 animate-pulse" : "bg-yellow-500"
            )} />
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest font-mono",
              devStatus === 'online' ? "text-green-500" : 
              devStatus === 'offline' ? "text-red-500" : "text-yellow-500"
            )}>
              Dispositivo {devStatus === 'online' ? 'Online' : devStatus === 'offline' ? 'Offline' : 'Estado Desconhecido'}
            </span>
          </div>
        </div>

        {/* Card de Ações Rápidas */}
        <div className="p-8 rounded-[36px] bg-neutral-950 border border-neutral-800 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-black italic uppercase tracking-wider text-white">Comandos Rápidos</h4>
            <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold">
              Dispare ações instantâneas que serão processadas pelo Agente Local na recepção.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || releasing}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl transition-all border border-neutral-800 text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(testingConnection && "animate-spin")} />
              Testar Conexão
            </button>

            <button
              onClick={handleRelease}
              disabled={releasing || testingConnection}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/10 disabled:opacity-50"
            >
              {releasing ? <RefreshCw size={16} className="animate-spin" /> : <Unlock size={16} />}
              Liberar Catraca
            </button>
          </div>

          {/* Aviso Arquitetural Obrigatório */}
          <div className="p-3.5 bg-neutral-900/50 border border-neutral-800/60 rounded-2xl flex gap-3">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[9px] text-neutral-500 leading-normal font-semibold">
              A comunicação com a catraca é feita por um agente local instalado na academia. O frontend não se conecta diretamente a IPs locais.
            </p>
          </div>
        </div>

      </div>

      {/* Grid Inferior - Fila de Comandos e Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Tabela de Comandos */}
        <div className="p-8 rounded-[40px] bg-black border border-neutral-800 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-6 border-b border-neutral-900 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-900 rounded-xl text-neutral-400">
                <Clock size={16} />
              </div>
              <div>
                <h4 className="text-sm font-black italic uppercase text-white">Comandos Recentes</h4>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Fila de controle Firestore</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {commands.length === 0 ? (
              <p className="text-[10px] text-neutral-700 italic py-4">Nenhum comando enfileirado recentemente.</p>
            ) : (
              commands.map((cmd) => (
                <div key={cmd.id} className="p-4 bg-neutral-950 border border-neutral-900 rounded-2xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-white">
                        {cmd.type === 'unlock' ? 'Liberação' : cmd.type === 'testConnection' ? 'Teste de Rede' : cmd.type}
                      </span>
                      <span className="text-[8px] font-mono text-neutral-600">ID: {cmd.id.slice(0, 8)}</span>
                    </div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider">
                      {cmd.requestedAt ? format(new Date(cmd.requestedAt), "HH:mm:ss - dd/MM", { locale: ptBR }) : 'Sem data'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      cmd.status === 'success' ? "bg-green-500/10 text-green-500 border-green-500/25" :
                      cmd.status === 'processing' ? "bg-blue-500/10 text-blue-500 border-blue-500/25 animate-pulse" :
                      cmd.status === 'error' ? "bg-red-500/10 text-red-500 border-red-500/25" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/25"
                    )}>
                      {cmd.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Console de Logs Diagnósticos */}
        <div className="p-8 rounded-[40px] bg-black border border-neutral-800 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-6 border-b border-neutral-900 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-900 rounded-xl text-neutral-400">
                <Terminal size={16} />
              </div>
              <div>
                <h4 className="text-sm font-black italic uppercase text-white">Logs do Agente Local</h4>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Auditoria e Conexão em tempo real</p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-950/80 rounded-2xl border border-neutral-900 p-4 h-[300px] overflow-y-auto font-mono text-[10px] space-y-2.5 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-neutral-700 italic flex items-center gap-2">
                <RefreshCw size={10} className="animate-spin" />
                Aguardando logs do agente local...
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="py-1.5 border-b border-neutral-900/40 last:border-0 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className={cn(
                      "font-semibold leading-normal",
                      log.status === 'success' ? "text-green-400" :
                      log.status === 'error' ? "text-red-400 font-bold" : "text-neutral-400"
                    )}>
                      <span className="text-neutral-600 mr-1.5">[{log.type.toUpperCase()}]</span>
                      {log.message}
                    </p>
                    {log.raw && (
                      <pre className="text-[8px] text-neutral-600 bg-neutral-950/20 p-2 rounded-lg max-h-[80px] overflow-y-auto">
                        {JSON.stringify(log.raw, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-[8px] text-neutral-600 whitespace-nowrap pt-0.5">
                    {log.createdAt ? format(new Date(log.createdAt), "HH:mm:ss", { locale: ptBR }) : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
