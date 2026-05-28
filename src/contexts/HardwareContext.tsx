import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useGymData } from '../hooks/useGymData';
import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { authorizeUser, invalidateSession, type AuthorizePayload } from '../lib/controlIdSession';

interface HardwareContextType {
  isHardwareConnected: boolean;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  hardwareLogs: string[];
  addHardwareLog: (msg: string) => void;
  releaseTurnstile: () => Promise<boolean>;
  releaseDeviceDirect: (opts: AuthorizePayload) => Promise<{ success: boolean; message: string }>;
  updateHardwareConfig: (keyOrObj: any, value?: any) => void;
  applyAdvancedConfig: () => Promise<void>;
  syncUser: (student: any) => Promise<boolean>;
  syncAll: (students: any[]) => Promise<void>;
  enrollFace: (userId: string, imageBase64: string) => Promise<boolean>;
  getUsers: () => Promise<any[]>;
  deleteUser: (userId: string) => Promise<boolean>;
  testNetworkConnection: () => Promise<{ success: boolean; message: string; details?: string }>;
  fetchServerLogs: () => Promise<string[]>;
  forceStatusGreen: () => Promise<boolean>;
  startRemoteFaceEnroll: (studentId: string, name: string) => Promise<boolean>;
  hardwareConfig: any;
  setHardwareConfig: (config: any) => void;
  setIsHardwareConnected: (connected: boolean) => void;
}

const HardwareContext = createContext<HardwareContextType | undefined>(undefined);

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useGymData();
  const [hardwareConfig, setHardwareConfig] = useState(() => {
    const savedIp = localStorage.getItem('turnstile_ip');
    const savedPort = localStorage.getItem('turnstile_port');
    
    // Filtro para ignorar lixo de configurações anteriores e definir padrão seguro
    const initialIp = (!savedIp || savedIp.startsWith('192.168.15.')) ? '192.168.1.100' : savedIp;
    const initialPort = savedPort || '443';
    const initialProtocol = localStorage.getItem('turnstile_protocol') || 'https';

    return {
      protocol: initialProtocol,
      ip: initialIp,
      port: initialPort,
      serverDomain: localStorage.getItem('turnstile_server_domain') || 'carrasco-fit-607856914066.us-east1.run.app',
      user: localStorage.getItem('turnstile_user') || 'admin',
      password: '', // Removido por segurança da LGPD/Credenciais
      session: '',
      doorTime: localStorage.getItem('turnstile_door_time') || '3',
      deviceModel: localStorage.getItem('turnstile_model') || 'idface',
      operationMode: localStorage.getItem('turnstile_mode') || '2',
      syncMode: 'cloud' // Forçado para garantir uso exclusivo de fila segura via Agente Local
    };
  });
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const [lastManualContact, setLastManualContact] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hardwareLogs, setHardwareLogs] = useState<string[]>([]);
  const [lastEventId, setLastEventId] = useState<number>(0);
  const pollingIntervalRef = useRef<any>(null);

  const addHardwareLog = (msg: string) => {
    setHardwareLogs(prev => [...prev, format(new Date(), 'HH:mm:ss') + ': ' + msg].slice(-50));
  };

  const releaseTurnstile = async () => {
    addHardwareLog("[NUVEM] Solicitando liberação física via Firestore (Unificado)...");
    try {
      const deviceModel = hardwareConfig.deviceModel || 'idface';
      let action = "door";
      let parameters = "door=1";
      
      if (deviceModel === 'idblock') {
        action = "catra";
        parameters = "allow=1";
      } else if (deviceModel === 'idface' || deviceModel === 'idflex') {
        action = "sec_box";
        parameters = "";
      }

      const cmd = {
        verb: "POST",
        endpoint: action,
        body: parameters ? { [parameters.split('=')[0]]: parseInt(parameters.split('=')[1]) || 1 } : {},
        status: 'pending',
        createdAt: serverTimestamp(),
        uuid: uuidv4()
      };

      await addDoc(collection(db, 'hardwareCommands'), cmd);
      
      // NOTIFICAR SERVIDOR (Fast-track para processamento concorrente seguro)
      try {
        fetch('/api/hardware/notify-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd)
        }).catch(() => {});
      } catch (e) {}

      addHardwareLog("✅ Comando de liberação registrado e roteado para a nuvem.");
      return true;
    } catch (err) {
      addHardwareLog(`❌ Erro ao enviar liberação: ${err instanceof Error ? err.message : 'Falha'}`);
      return false;
    }
  };

  /**
   * Libera acesso diretamente via remote_user_authorization.fcgi
   * com gerenciamento automático de sessão e retry.
   */
  const releaseDeviceDirect = async (opts: AuthorizePayload): Promise<{ success: boolean; message: string }> => {
    const cfg = {
      ip: hardwareConfig.ip,
      port: hardwareConfig.port,
      protocol: hardwareConfig.protocol || 'http',
      user: hardwareConfig.user,
      password: hardwareConfig.password
    };

    if (!cfg.ip) return { success: false, message: 'IP do dispositivo não configurado' };
    if (!cfg.password) return { success: false, message: 'Senha não configurada' };

    addHardwareLog(`[DIRETO] Liberando ${opts.userName} (${opts.terminalType})...`);
    const result = await authorizeUser(cfg, opts);

    if (result.success) {
      addHardwareLog(`✅ Liberação direta OK: ${result.message}`);
    } else {
      addHardwareLog(`❌ Falha na liberação direta: ${result.message}`);
    }
    return result;
  };

  const updateHardwareConfig = (keyOrObj: string | Record<string, any>, value?: any) => {
    if (typeof keyOrObj === 'object' && keyOrObj !== null) {
      setHardwareConfig(prev => ({ ...prev, ...keyOrObj }));
      Object.entries(keyOrObj).forEach(([k, v]) => {
        if (k === 'password') return; // Bloqueia gravação de senhas em localStorage
        localStorage.setItem(`turnstile_${k}`, String(v));
      });
    } else {
      setHardwareConfig(prev => ({ ...prev, [keyOrObj as string]: value }));
      if (keyOrObj === 'password') return; // Bloqueia gravação de senhas em localStorage
      localStorage.setItem(`turnstile_${keyOrObj as string}`, String(value));
    }
  };

  const applyAdvancedConfig = async () => {
    if (!hardwareConfig.ip) return;
    try {
      addHardwareLog("Aplicando configurações avançadas...");
      const loginRes = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`,
          method: 'POST',
          body: { login: hardwareConfig.user, password: hardwareConfig.password }
        })
      });

      if (!loginRes.ok) throw new Error(`Falha no login (Status ${loginRes.status}).`);
      const { session } = await loginRes.json();

      const configRes = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/set_configuration.fcgi?session=${session}`,
          method: 'POST',
          body: {
            general: {
              door_open_time: parseInt(hardwareConfig.doorTime) * 1000,
              online: hardwareConfig.operationMode === '2' ? 1 : 0
            }
          }
        })
      });

      if (configRes.ok) {
        addHardwareLog("Configurações aplicadas com sucesso!");
        alert("Configurações aplicadas com sucesso!");
      } else {
        throw new Error("Falha ao aplicar configurações.");
      }
    } catch (err) {
      addHardwareLog(`Erro ao aplicar config: ${err instanceof Error ? err.message : 'Falha na rede'}`);
      alert("Erro ao aplicar configurações. Verifique a conexão.");
    }
  };

  const fetchServerLogs = async () => {
    try {
      const res = await fetch('/api/hardware/server-logs');
      if (res.ok) return await res.json();
      return [];
    } catch { return []; }
  };

  const testNetworkConnection = async () => {
    if (hardwareConfig.syncMode === 'cloud') {
      addHardwareLog("[NUVEM] Verificando status da catraca no servidor...");
      try {
        const res = await fetch('/api/hardware/status?diag=true');
        const status = await res.json();
        if (status.lastSeen) {
          const lastSeen = new Date(status.lastSeen);
          const diff = (new Date().getTime() - lastSeen.getTime()) / 1000;
          if (diff < 600) { // Aumentado para 10 minutos para ser mais tolerante na primeira conexão
            addHardwareLog(`✅ Catraca ONLINE! (Vista há ${Math.round(diff)}s)`);
            setIsHardwareConnected(true);
            setLastManualContact(Date.now());

            const IDFACE_DOMAIN = "carrasco-fit-607856914066.us-east1.run.app";
            return { 
              success: true, 
              message: "Conexão Nuvem Ativa!", 
              details: `A catraca ID ${status.deviceId} está ativa no servidor.\nNo iDCloud da Catraca o endereço dever ser APENAS: ${IDFACE_DOMAIN}\nPorta: 443 | SSL: Ligado (ON)` 
            };
          } else {
            addHardwareLog(`⚠️ Catraca vista há ${Math.round(diff)}s. Pode estar offline.`);
            return { success: false, message: "Catraca Inativa", details: "A catraca conectou recentemente, mas parou de responder. Verifique o Wi-Fi dela." };
          }
        }
        addHardwareLog("❌ Nenhuma catraca conectada ao servidor ainda.");
        const IDFACE_DOMAIN = "carrasco-fit-607856914066.us-east1.run.app";
        return { 
          success: false, 
          message: "Aguardando Catraca", 
          details: `A catraca ainda não se comunicou com o servidor.\n\nNA CATRACA (MENU iDCLOUD):\n1. Modo: Modo iDCloud Personalizado\n2. Servidor: ${IDFACE_DOMAIN}\n3. Porta: 443\n4. SSL: Ligado (ON)\n\nIMPORTANTE: Verifique se o cabo de rede está conectado.` 
        };
      } catch (err) {
        return { success: false, message: "Erro no Servidor", details: "Não foi possível consultar o status no servidor." };
      }
    }

    if (!hardwareConfig.ip) {
      return { 
        success: false, 
        message: "IP não configurado", 
        details: "Informe o IP da catraca (ex: 192.168.1.102)." 
      };
    }

    addHardwareLog("--- INICIANDO DIAGNÓSTICO PROFISSIONAL ---");
    
    // Passo 1: Visibilidade de Rede
    addHardwareLog("[1/3] Testando alcance do IP...");
    const isReachable = await new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => { img.src = ""; resolve(false); }, 3000);
      img.onload = () => { clearTimeout(timeout); resolve(true); };
      img.onerror = () => { clearTimeout(timeout); resolve(true); };
      const protocol = hardwareConfig.protocol || 'https';
      const portSuffix = hardwareConfig.port && hardwareConfig.port !== '80' && hardwareConfig.port !== '443' ? `:${hardwareConfig.port}` : '';
      img.src = `${protocol}://${hardwareConfig.ip}${portSuffix}/favicon.ico?t=${Date.now()}`;
    });

    if (!isReachable) {
      addHardwareLog("❌ ERRO: Ip Inalcançável.");
      return {
        success: false,
        message: "IP Inalcançável",
        details: `O IP ${hardwareConfig.ip} não respondeu na rede. \n\n1. Verifique se o computador e a catraca estão no MESMO roteador.\n2. Verifique o cabo de rede.`
      };
    }
    addHardwareLog("✅ IP Localizado na rede!");

    // Passo 2: Login / API
    addHardwareLog("[2/3] Testando Autenticação (Login)...");
    try {
      const protocol = hardwareConfig.protocol || 'https';
      const portSuffix = hardwareConfig.port && hardwareConfig.port !== '80' && hardwareConfig.port !== '443' ? `:${hardwareConfig.port}` : '';
      const baseUrl = `${protocol}://${hardwareConfig.ip}${portSuffix}`;
      const loginUrl = `${baseUrl}/login.fcgi`;

      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: hardwareConfig.user, password: hardwareConfig.password })
      });

      if (!loginRes.ok) {
        addHardwareLog(`❌ ERRO: Login Recusado (Status ${loginRes.status}).`);
        return { 
          success: false, 
          message: "Login Falhou", 
          details: "A catraca respondeu, mas o USUÁRIO ou SENHA estão incorretos.\nVerifique as letras maiúsculas/minúsculas." 
        };
      }

      const { session } = await loginRes.json();
      addHardwareLog("✅ Login efetuado! Sessão: " + session.substring(0, 8));
      
      // Passo 3: Comandos de Status
      addHardwareLog("[3/3] Validando Sessão com Comando de Status...");
      const statusUrl = `${baseUrl}/get_configuration.fcgi?session=${session}`;
      const statusRes = await fetch(statusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ general: ["online"] })
      });

      if (statusRes.ok) {
        addHardwareLog("✅ DIAGNÓSTICO COMPLETO: Catraca 100% Operante!");
        setIsHardwareConnected(true);
        setLastManualContact(Date.now());
        setHardwareConfig(prev => ({ ...prev, session })); // Salva a sessão ativa
        return { 
          success: true, 
          message: "Catraca Configurada!", 
          details: "A comunicação entre o sistema e a catraca está perfeita." 
        };
      } else {
        throw new Error("Sessão expirou ou comando negado.");
      }
    } catch (err) {
      addHardwareLog("❌ ERRO: Bloqueio CORS ou de Segurança.");
      return {
        success: false,
        message: "Erro de Segurança (CORS)",
        details: "O navegador bloqueou a comunicação direta. \n\nSOLUÇÃO: Ative a extensão 'Allow CORS' (ícone laranja) e recarregue a página."
      };
    }
  };

  const syncUser = async (student: any) => {
    if (!hardwareConfig.ip || !isHardwareConnected) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Função para gerar um ID numérico a partir do ID string (Firebase UID)
      const getNumericId = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) % 100000000; // Garante um número positivo de até 8 dígitos
      };

      const numericId = getNumericId(student.id);

      // Save the numeric ID to Firestore so the server can identify the student later
      try {
        await updateDoc(doc(db, 'students', student.id), {
          turnstileId: numericId
        });
      } catch (e) {
        console.error("Erro ao salvar turnstileId no Firestore:", e);
      }

      // --- MODO NUVEM (PUSH) ---
      if (hardwareConfig.syncMode === 'cloud') {
        addHardwareLog(`[NUVEM] Enfileirando ${student.name} para a catraca...`);
        const cloudRes = await fetch('/api/hardware/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verb: "POST",
            endpoint: "create_objects",
            body: {
              object: "users",
              values: [{
                id: numericId,
                name: student.name,
                registration: String(numericId)
              }]
            },
            contentType: "application/json"
          })
        });
        
        if (cloudRes.ok) {
          addHardwareLog(`✅ Comando enviado para a nuvem. A catraca receberá em instantes.`);
          return true;
        } else {
          throw new Error("Falha ao enviar para a nuvem.");
        }
      }

      // --- MODO DIRETO (USB/IP) ---
      addHardwareLog(`[1/2] Autenticando ${student.name}...`);
      const loginUrl = `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`;
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: hardwareConfig.user, password: hardwareConfig.password }),
        signal: controller.signal
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error("Tempo limite no Login.");
        throw new Error(`Erro no Login: ${err.message}`);
      });

      if (!loginRes.ok) throw new Error("Falha no login.");
      const { session } = await loginRes.json();

      await new Promise(resolve => setTimeout(resolve, 2000));

      addHardwareLog(`[2/2] Enviando ${student.name} (ID: ${numericId})...`);
      
      const url = `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/set_objects.fcgi?session=${encodeURIComponent(session)}`;
      const body = JSON.stringify({
        object: "users",
        objects: [{
          id: numericId,
          name: student.name,
          registration: String(numericId)
        }]
      });

      const res: any = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json'); 
        xhr.timeout = 10000;
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ ok: true, status: xhr.status });
          } else {
            resolve({ ok: false, status: xhr.status, text: xhr.responseText });
          }
        };
        
        xhr.onerror = () => reject(new Error("Failed to fetch"));
        xhr.ontimeout = () => reject(new Error("AbortError"));
        xhr.send(body);
      }).catch(err => {
        if (err.message === "AbortError") throw new Error("Tempo limite no Envio.");
        throw new Error("BLOQUEIO DE REDE: O navegador impediu o envio. \n\nRESOLUÇÃO DEFINITIVA (Edge/Chrome): \n1. Digite flags na barra de endereço (ex: edge://flags). \n2. Procure por 'Block insecure private network requests'. \n3. Mude para 'Disabled' e reinicie.");
      });

      if (!res.ok) {
        throw new Error(`Erro na Catraca (Status ${res.status}): ${res.text || ''}`);
      }

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro na Catraca (Status ${res.status}).`);

      addHardwareLog(`✅ Aluno ${student.name} sincronizado!`);
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : 'Falha';
      addHardwareLog(`❌ ${msg}`);
      return false;
    }
  };

  const syncAll = async (students: any[]) => {
    setIsSyncing(true);
    addHardwareLog(`Iniciando sincronização em massa (${students.length} alunos)...`);
    
    if (hardwareConfig.syncMode === 'cloud') {
      try {
        // Helper to generate numeric ID
        const getNumericId = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash) % 100000000;
        };

        // Send in batches of 50 to avoid payload size limits
        const batchSize = 50;
        for (let i = 0; i < students.length; i += batchSize) {
          const batch = students.slice(i, i + batchSize);
          const objects = batch.map(student => ({
            id: getNumericId(student.id),
            name: student.name,
            registration: String(getNumericId(student.id))
          }));

          addHardwareLog(`[NUVEM] Enfileirando lote ${Math.floor(i/batchSize) + 1} (${batch.length} alunos) via Firestore...`);
          
          const cmd = {
            verb: "POST",
            endpoint: "create_objects",
            body: {
              object: "users",
              values: objects
            },
            status: 'pending',
            createdAt: serverTimestamp(),
            uuid: uuidv4()
          };
          
          await addDoc(collection(db, 'hardwareCommands'), cmd);

          // NOTIFICAR SERVIDOR (Fast-track)
          try {
            fetch('/api/hardware/notify-command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cmd)
            }).catch(() => {});
          } catch (e) {}
        }
        addHardwareLog(`✅ Sincronização em massa enfileirada com sucesso.`);
      } catch (err) {
        addHardwareLog(`❌ Erro na sincronização em massa: ${err instanceof Error ? err.message : 'Falha'}`);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    let successCount = 0;
    for (const student of students) {
      const success = await syncUser(student);
      if (success) successCount++;
      // Small delay to avoid overloading
      await new Promise(r => setTimeout(r, 100));
    }
    addHardwareLog(`Sincronização concluída: ${successCount}/${students.length} com sucesso.`);
    setIsSyncing(false);
  };

  const enrollFace = async (userId: string, imageBase64: string) => {
    if (!hardwareConfig.ip || !isHardwareConnected) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for photos

    try {
      const getNumericId = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash) % 100000000;
      };

      const numericId = getNumericId(userId);

      // --- MODO NUVEM (PUSH) ---
      if (hardwareConfig.syncMode === 'cloud') {
        addHardwareLog(`[NUVEM] Enfileirando foto de ${userId}...`);
        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const cloudRes = await fetch('/api/hardware/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verb: "POST",
            endpoint: "create_objects",
            body: {
              object: "user_faces",
              values: [{
                user_id: numericId,
                image: base64Data
              }]
            },
            contentType: "application/json"
          })
        });
        
        if (cloudRes.ok) {
          addHardwareLog(`✅ Foto enviada para a nuvem.`);
          return true;
        } else {
          throw new Error("Falha ao enviar foto para a nuvem.");
        }
      }

      addHardwareLog(`[1/2] Autenticando para foto...`);
      const loginUrl = `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`;
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: hardwareConfig.user, password: hardwareConfig.password }),
        signal: controller.signal
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error("Tempo limite esgotado no Login.");
        throw new Error(`Erro no Login: ${err.message}`);
      });

      if (!loginRes.ok) throw new Error("Falha no login.");
      const { session } = await loginRes.json();

      await new Promise(resolve => setTimeout(resolve, 1000));

      addHardwareLog(`[2/2] Enviando foto (Sessão: ${session.substring(0, 4)}...)...`);
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const url = `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/set_objects.fcgi?session=${encodeURIComponent(session)}`;
      const body = JSON.stringify({
        object: "user_faces",
        objects: [{
          user_id: numericId,
          image: base64Data
        }]
      });

      const res: any = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 20000;
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ ok: true, status: xhr.status });
          } else {
            resolve({ ok: false, status: xhr.status, text: xhr.responseText });
          }
        };
        
        xhr.onerror = () => reject(new Error("Failed to fetch"));
        xhr.ontimeout = () => reject(new Error("AbortError"));
        xhr.send(body);
      }).catch(err => {
        if (err.message === "AbortError") throw new Error("Tempo limite no Envio da Foto.");
        throw new Error("BLOQUEIO DE REDE: O navegador impediu o envio da foto.");
      });

      if (!res.ok) {
        throw new Error(`Erro na Catraca (Status ${res.status}): ${res.text || ''}`);
      }

      clearTimeout(timeoutId);
      if (res.ok) {
        addHardwareLog("✅ Rosto cadastrado com sucesso!");
        return true;
      }
      throw new Error(`Falha ao salvar rosto (Status ${res.status}).`);
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : 'Falha';
      addHardwareLog(`❌ ${msg}`);
      return false;
    }
  };

  const getUsers = async () => {
    if (!hardwareConfig.ip || !isHardwareConnected) return [];
    try {
      const loginRes = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`,
          method: 'POST',
          body: { login: hardwareConfig.user, password: hardwareConfig.password }
        })
      });

      if (!loginRes.ok) return [];
      const { session } = await loginRes.json();

      const res = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/get_objects.fcgi?session=${session}`,
          method: 'POST',
          body: { object: "users" }
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
      return [];
    } catch (err) {
      return [];
    }
  };

  const deleteUser = async (userId: string) => {
    if (!hardwareConfig.ip || !isHardwareConnected) return false;
    try {
      const loginRes = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`,
          method: 'POST',
          body: { login: hardwareConfig.user, password: hardwareConfig.password }
        })
      });

      if (!loginRes.ok) return false;
      const { session } = await loginRes.json();

      const res = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/destroy_objects.fcgi?session=${session}`,
          method: 'POST',
          body: {
            where: { users: { id: userId.slice(0, 8) } },
            object: "users"
          }
        })
      });

      return res.ok;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    // Forçar modo nuvem e iDFace para esta interface simplificada
    if (hardwareConfig.syncMode !== 'cloud' || hardwareConfig.deviceModel !== 'idface') {
      const newConfig = {
        ...hardwareConfig,
        syncMode: 'cloud',
        deviceModel: 'idface',
        operationMode: '2'
      };
      setHardwareConfig(newConfig);
      localStorage.setItem('turnstile_sync_mode', 'cloud');
      localStorage.setItem('turnstile_model', 'idface');
      localStorage.setItem('turnstile_mode', '2');
      addHardwareLog("[SISTEMA] Modo Nuvem e iDFace ativados automaticamente.");
    }
  }, []);

  const pollEvents = async () => {
    // Determine API base URL
    let apiUrl = (import.meta as any).env?.VITE_API_URL || '';
    if (!apiUrl && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('github.io'))) {
      apiUrl = 'https://carrasco-fit-607856914066.us-east1.run.app';
    }

    // 1. Always poll status from our server first to see if it's connected
    try {
      const statusRes = await fetch(`${apiUrl}/api/hardware/status`);
      if (statusRes.ok) {
        const status = await statusRes.json();
        
        if (status.secondsAgo !== null) {
          const connected = status.secondsAgo < 1800; // 30 mins
          const wasManuallyConnected = (Date.now() - lastManualContact) < 300000; // 5 mins
          const finalConnected = connected || wasManuallyConnected;

          if (finalConnected !== isHardwareConnected) {
            if (finalConnected) {
              addHardwareLog(`[SISTEMA] Status alterado para: ONLINE (${status.secondsAgo}s atrás)`);
            } else {
              addHardwareLog(`[SISTEMA] Status alterado para: OFFLINE (Sem sinal há ${status.secondsAgo}s)`);
            }
            setIsHardwareConnected(finalConnected);
          }
        } else {
          // If server knows nothing, check manual contact grace period
          const wasManuallyConnected = (Date.now() - lastManualContact) < 300000;
          if (wasManuallyConnected && !isHardwareConnected) {
            setIsHardwareConnected(true);
          } else if (!wasManuallyConnected && isHardwareConnected) {
            setIsHardwareConnected(false);
          }
        }
      }
    } catch (e) {}

    if (hardwareConfig.syncMode === 'cloud') {
      try {
        // 2. Fetch Events (Cloud mode)
        const res = await fetch(`${apiUrl}/api/hardware/events`);
        if (res.ok) {
          const events = await res.json();
          if (events && events.length > 0) {
            const latestEvent = events[events.length - 1];
            const eventTime = new Date(latestEvent.timestamp).getTime();
            if (eventTime > lastEventId) {
              setLastEventId(eventTime);
              if (latestEvent.identifier) {
                addHardwareLog(`[NUVEM] Evento detectado: ID ${latestEvent.identifier}`);
                window.dispatchEvent(new CustomEvent('rfid-scan', { detail: latestEvent.identifier }));
              }
            }
          }
        }
      } catch (e) {}
      return;
    }

    if (!hardwareConfig.ip || !isHardwareConnected) return;

    try {
      const loginRes = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/login.fcgi`,
          method: 'POST',
          body: { login: hardwareConfig.user, password: hardwareConfig.password }
        })
      });

      if (!loginRes.ok) return;
      const { session } = await loginRes.json();

      const eventsRes = await fetch('/api/turnstile/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: `${hardwareConfig.protocol || 'https'}://${hardwareConfig.ip}/get_events.fcgi?session=${session}`,
          method: 'POST',
          body: { }
        })
      });

      if (!eventsRes.ok) return;
      const { events } = await eventsRes.json();

      if (events && events.length > 0) {
        const sortedEvents = [...events].sort((a, b) => b.id - a.id);
        const latestEvent = sortedEvents[0];

        if (latestEvent.id > lastEventId) {
          const isFirstPoll = lastEventId === 0;
          setLastEventId(latestEvent.id);
          
          if (!isFirstPoll && latestEvent.identifier) {
            addHardwareLog(`Evento da Catraca: ID ${latestEvent.identifier} detectado.`);
            window.dispatchEvent(new CustomEvent('rfid-scan', { detail: latestEvent.identifier }));
          }
        }
      }
    } catch (err) {
      // Silent error for polling
    }
  };

  const forceStatusGreen = async () => {
    addHardwareLog("[DEBUG] Forçando status VERDE no servidor...");
    try {
      const res = await fetch('/api/hardware/force-green');
      if (res.ok) {
        addHardwareLog("✅ Status forçado com sucesso!");
        setIsHardwareConnected(true);
        setLastManualContact(Date.now());
        return true;
      }
      const errText = await res.text();
      throw new Error(errText || `Erro ${res.status}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      addHardwareLog(`❌ Falha ao forçar status: ${msg}`);
      return false;
    }
  };

  const startRemoteFaceEnroll = async (studentId: string, name: string) => {
    addHardwareLog(`[NUVEM] Solicitando cadastro facial remoto na catraca para o aluno: ${name}...`);
    try {
      const getNumericId = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash) % 100000000;
      };

      const numericId = getNumericId(studentId);

      // 1. Envia o comando de cadastro facial remoto
      const cmd = {
        verb: "POST",
        endpoint: "remote_enroll",
        body: {
          user_id: numericId,
          type: "face",
          save: 1
        },
        status: 'pending',
        createdAt: serverTimestamp(),
        uuid: uuidv4()
      };

      await addDoc(collection(db, 'hardwareCommands'), cmd);

      // Notifica o servidor (fast-track)
      try {
        fetch('/api/hardware/notify-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd)
        }).catch(() => {});
      } catch (e) {}

      addHardwareLog("✅ Solicitação enviada! O leitor facial da catraca entrará em modo de cadastro em instantes.");
      return true;
    } catch (err) {
      addHardwareLog(`❌ Erro ao iniciar cadastro facial na catraca: ${err instanceof Error ? err.message : 'Falha'}`);
      return false;
    }
  };

  useEffect(() => {
    // Check status immediately on mount
    pollEvents();
    
    pollingIntervalRef.current = setInterval(pollEvents, 5000); // 5s is and plenty for background status
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [hardwareConfig.ip]); // Somente reinicia se o IP mudar

  return (
    <HardwareContext.Provider value={{
      isHardwareConnected,
      isSyncing,
      setIsSyncing,
      hardwareLogs,
      addHardwareLog,
      releaseTurnstile,
      releaseDeviceDirect,
      updateHardwareConfig,
      applyAdvancedConfig,
      syncUser,
      syncAll,
      enrollFace,
      getUsers,
      deleteUser,
      testNetworkConnection,
      fetchServerLogs,
      forceStatusGreen,
      startRemoteFaceEnroll,
      hardwareConfig,
      setHardwareConfig,
      setIsHardwareConnected
    }}>
      {children}
    </HardwareContext.Provider>
  );
}

export function useHardware() {
  const context = useContext(HardwareContext);
  if (context === undefined) {
    throw new Error('useHardware must be used within a HardwareProvider');
  }
  return context;
}
