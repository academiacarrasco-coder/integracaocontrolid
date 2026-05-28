import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { readFileSync, appendFileSync } from "fs";
import { exec } from "child_process";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { initializeApp as initializeAppClient, getApp as getAppClient, getApps as getAppsClient } from "firebase/app";
import { initializeFirestore, getFirestore as getFirestoreClient, collection as collectionClient, getDocs as getDocsClient, getDoc as getDocClient, doc as docClient, setDoc as setDocClient, addDoc as addDocClient, updateDoc as updateDocClient, query as queryClient, where as whereClient, limit as limitClient, serverTimestamp as serverTimestampClient } from "firebase/firestore";

// --- Logging & State ---
const serverLogs: string[] = [];
const globalEvents: any[] = [];
let pendingCommands: any[] = [];
let lastDeviceStatus: any = { lastSeen: null, deviceId: null };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set('x-powered-by', false);

// --- HARDWARE DIAGNOSTIC ROUTES (ABSOLUTE PRIORITY BYPASS) ---
// ESSAS ROTAS TÊM QUE RESPONDER ANTES DE QUALQUER OUTRA COISA
app.all("/api/diag/hardware/result", (req, res) => {
  console.log(`[DIAG] HIT /result via ${req.method}`);
  res.header('Content-Type', 'text/plain'); 
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).send("OK_DIAG_V3_CARRASCO_SUCCESS");
});

app.all("/api/diag/hardware/push", (req, res) => {
  const logInfo = {
    time: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    body: req.body,
    ip: req.ip || req.headers['x-forwarded-for'],
    query: req.query
  };
  
  console.log(`[HARDWARE_PUSH] >>> RECEIVED FROM CATRACA:`, JSON.stringify(logInfo, null, 2));
  addLog(`Ping de hardware: ${logInfo.ip} via ${req.method}`);

  res.header('Content-Type', 'application/json');
  res.header('Access-Control-Allow-Origin', '*');
  
  // Control ID devices often expect specific responses or just 200 OK
  return res.status(200).json({ 
    success: true, 
    diag_code: "CARRASCO_V3_PUSH_ACK",
    server_time: new Date().toISOString()
  });
});

app.all("/api/diag/status", (req, res) => {
  console.log(`[DIAG] HIT /status via ${req.method}`);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({
    status: "ONLINE",
    message: "DIAGNOSTICO_OPERANTE_V3",
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Removed duplicate diagnostic status routes

const addLog = (msg: string) => {
  const time = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const logMsg = `[${time}] ${msg}`;
  serverLogs.push(logMsg);
  if (serverLogs.length > 500) serverLogs.shift();
  console.log(logMsg);
  try { appendFileSync("debug.log", logMsg + "\n"); } catch(e) {}
};

// --- MATEUS / DIAGNOSTIC ROUTES (VITAL) ---
// Definimos no topo

// --- Specific Hardware Routes Handler ---
async function handleHardware(req: express.Request, res: express.Response) {
  const method = req.method;
  const path = req.path.toLowerCase();
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const remoteIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || "").split(',')[0].replace('::ffff:', '');
  const isSim = req.query.sim === 'true';

  addLog(`[HARDWARE-IO] ${method} ${req.path} | Remote: ${remoteIp}`);

  // Standard Hardware Response Headers (Anti-302)
  res.removeHeader('Location'); 
  res.removeHeader('Set-Cookie');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.header('X-Mateus-Safeguard', 'Active');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Connection', 'close'); 
  res.header('Content-Type', 'application/json');

  if (path === '/ping' || path.includes('ping')) return res.status(200).json({ status: "OK" });

  if (path === '/result' || path.includes('result')) {
    if (req.body && req.body.uuid) {
      addLog(`[HW-RESULT] Confirmed: ${req.body.uuid}`);
      if (dbClient) {
        updateDocClient(docClient(dbClient, 'hardwareCommands', req.body.uuid), {
          status: req.body.error ? 'error' : 'completed',
          completedAt: serverTimestampClient()
        }).catch(() => {});
      } else if (dbAdmin) {
        dbAdmin.collection('hardwareCommands').doc(req.body.uuid).update({ 
          status: req.body.error ? 'error' : 'completed', 
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    }
    return res.status(200).json({ status: 1, message: "OK" });
  }

  if (path === '/push' || path.includes('push')) {
    if (pendingCommands.length > 0) {
      const cmd = pendingCommands.shift();
      addLog(`[HW-PUSH] 📤 Sending (Memory): ${cmd.endpoint}`);
      if (dbAdmin && cmd.uuid) {
        dbAdmin.collection('hardwareCommands').doc(cmd.uuid).update({ 
          status: 'processing', deliveredAt: admin.firestore.FieldValue.serverTimestamp() 
        }).catch(() => {});
      }
      return res.status(200).json({ verb: cmd.verb || "POST", endpoint: cmd.endpoint, body: cmd.body });
    }

    if (dbClient) {
      try {
        const q = queryClient(collectionClient(dbClient, 'hardwareCommands'), whereClient('status', '==', 'pending'), limitClient(1));
        const snapshot = await getDocsClient(q);
        if (!snapshot.empty) {
          const d = snapshot.docs[0];
          const cmd = d.data();
          addLog(`[HW-PUSH] 📤 Sending (Client DB): ${cmd.endpoint}`);
          await updateDocClient(d.ref, { status: 'processing', deliveredAt: serverTimestampClient() });
          return res.status(200).json({ verb: cmd.verb || "POST", endpoint: cmd.endpoint, body: cmd.body });
        }
      } catch (e) {}
    } else if (dbAdmin) {
      try {
        const snapshot = await dbAdmin.collection('hardwareCommands')
          .where('status', '==', 'pending').orderBy('createdAt', 'asc').limit(1).get();
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const cmd = doc.data();
          addLog(`[HW-PUSH] 📤 Sending (Firestore Admin): ${cmd.endpoint}`);
          await doc.ref.update({ status: 'processing', deliveredAt: admin.firestore.FieldValue.serverTimestamp() });
          return res.status(200).json({ verb: cmd.verb || "POST", endpoint: cmd.endpoint, body: cmd.body });
        }
      } catch (e) {}
    }

    return res.status(200).json({ verb: "POST", endpoint: "ping", body: {} }); 
  }

  return res.status(200).json({ status: "OK", fallback: true });
}

// --- CRITICAL HARDWARE BYPASS (Anti-302) ---
// This must run BEFORE any other middleware or routes
app.use((req, res, next) => {
  const path = req.path.toLowerCase();
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isHardware = ua.includes('idface') || ua.includes('control id') || path.includes('.fcgi') || path.includes('/push') || path.includes('/result');

  if (isHardware || path.includes('/api/diag/')) {
    // Disable all potential redirects
    res.removeHeader('Location');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    // Ensure 200 OK for hardware even if not found yet (will be handled by late routes)
    // but we don't return here, we let it flow to specific handlers
    addLog(`[HW-DEBUG] Incoming (Bypass Active): ${req.method} ${req.path}`);
  }
  next();
});

app.set('x-powered-by', false); 
const PORT = 3000;

// --- HARDWARE ROUTES (TOP PRIORITY) ---
// Proxy para evitar CORS em chamadas locais (quando o servidor está rodando localmente)
// ou para debug de chamadas externas.
app.post("/api/turnstile/proxy", async (req, res) => {
  const { target, method, body, headers: customHeaders } = req.body;
  if (!target) return res.status(400).json({ error: "Target URL missing" });

  addLog(`[PROXY] ${method || 'GET'} -> ${target}`);

  try {
    const response = await fetch(target, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...customHeaders
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error: any) {
    addLog(`[PROXY-ERROR] ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Outras rotas de hardware (iDFace)
app.all("/push", handleHardware);
app.all("/result", handleHardware);
app.all("/ping", handleHardware);
app.all("/*.fcgi", handleHardware);
app.all("/api/push", handleHardware); 
app.all("/api/result", handleHardware);

// --- Mock Data for Emergency Fallback ---
const mockDb: any = {
  users: [
    { id: 'admin-1', username: 'admin', password: '123', displayName: 'Admin Carrasco', role: 'admin', email: 'academiacarrasco@gmail.com' },
    { id: 'emp-1', username: 'funcionario', password: '123', displayName: 'Funcionario Teste', role: 'employee' }
  ],
  students: [
    { id: 'std-1', name: 'Aluno de Teste 1 (MOCK)', email: 'aluno1@teste.com', status: 'active', planIds: ['plan-1'], planExpirations: { 'plan-1': '2099-12-31' } },
    { id: 'std-2', name: 'Aluno de Teste 2 (MOCK)', email: 'aluno2@teste.com', status: 'active', planIds: ['plan-2'], planExpirations: { 'plan-2': '2023-01-01' } }
  ],
  plans: [
    { id: 'plan-1', name: 'Mensal VIP', price: 150 },
    { id: 'plan-2', name: 'Trimestral Promo', price: 400 }
  ],
  classes: [
    { id: 'cls-1', name: 'Muay Thai', instructor: 'Mestre Silva', schedule: { 'Segunda': { startTime: '19:00', endTime: '20:30' } } }
  ],
  settings: {
    global: { gymName: 'Carrasco Fit (MODO EMERGÊNCIA)', logoUrl: '' }
  },
  payments: [],
  attendance: [],
  accessLogs: []
};

// 2. Firebase Setup
let dbClient: any = null;
let dbAdmin: any = null; // We keep this for tokens if possible
let dbStatus = "Desconectado";
let dbError = "";

async function setupFirebase() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const cfg = JSON.parse(readFileSync(configPath, 'utf8'));

    // 1. Initialize Client SDK on Server (Reliable with API Key)
    if (getAppsClient().length === 0) {
      initializeAppClient(cfg);
    }
    
    // Forçar Long Polling para evitar erros de gRPC (INTERNAL/UNAVAILABLE) com roteadores Mercusys/Firewalls
    // IMPORTANTE: Passar o databaseId para evitar erro NOT_FOUND
    dbClient = initializeFirestore(getAppClient(), {
      experimentalForceLongPolling: true,
    }, cfg.firestoreDatabaseId === '(default)' ? undefined : cfg.firestoreDatabaseId);
    
    dbStatus = `Conectado (Client/${cfg.firestoreDatabaseId})`;
    addLog(`[System] Client SDK pronto para DB: ${cfg.firestoreDatabaseId} (Modo: Long Polling)`);

    // Inicializar o documento de dados do leitor "controlIdDevices/iface-principal" no Firestore se não existir
    try {
      const docRef = docClient(dbClient, 'controlIdDevices', 'iface-principal');
      const d = await getDocClient(docRef);
      if (!d.exists()) {
        addLog("[System] Inicializando estrutura de dados do leitor 'controlIdDevices/iface-principal' no Firestore...");
        await setDocClient(docRef, {
          id: "iface-principal",
          name: "iDFace Principal",
          model: "iDFace",
          ip: "192.168.1.100",
          port: 443,
          protocol: "https",
          status: "unknown",
          lastSeenAt: null,
          updatedAt: serverTimestampClient()
        });
      }
    } catch (e: any) {
      addLog(`[System] Erro ao inicializar documento de dados do leitor no Firestore: ${e.message}`);
    }

    // 2. Try Admin SDK (Optional, might fail)
    try {
      if (admin.apps.length > 0) await admin.apps[0]!.delete();
      admin.initializeApp({ projectId: cfg.projectId });
      // Note: We don't log the errors for each DB here anymore to avoid noise
      dbAdmin = admin.firestore();
    } catch (e) {
      dbAdmin = null;
    }

  } catch (err: any) {
    dbStatus = "Erro de Configuração";
    dbError = err.message;
    addLog(`[System] ⚠️ Falha na configuração: ${err.message}`);
  }
}

// Debug endpoint
app.get("/api/debug/db", (req, res) => {
  res.json({
    status: dbStatus,
    error: dbError,
    projectId: admin.apps.length ? admin.apps[0]!.options.projectId : 'Not Init',
    databaseId: dbAdmin ? (dbAdmin as any)._databaseId : 'None',
    logs: serverLogs.slice(-20)
  });
});

// --- API Routes Registration (Move out of setupFirebase to avoid race conditions) ---

// Helper to fetch data from Firestore (Client SDK or Admin)
const getData = async (collectionName: string) => {
  try {
    if (dbClient) {
       const snap = await getDocsClient(collectionClient(dbClient, collectionName));
       addLog(`[DB-SUCCESS] Loaded ${snap.size} from ${collectionName} (Client)`);
       return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    if (dbAdmin) {
      const snap = await dbAdmin.collection(collectionName).get();
      addLog(`[DB-SUCCESS] Loaded ${snap.size} from ${collectionName} (Admin)`);
      return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }
  } catch (e: any) {
    addLog(`[DB-READ-ERR] ${collectionName}: ${e.message}`);
  }

  // Tenta via REST API como último suspiro
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents/${collectionName}?key=${cfg.apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
        const data: any = await res.json();
        if (data.documents) {
          addLog(`[REST-SUCCESS] Encontrados ${data.documents.length} itens via REST`);
          return data.documents.map((doc: any) => {
             const fields = doc.fields || {};
             const item: any = { id: doc.name.split('/').pop() };
             for (const key in fields) {
               const valObj = fields[key];
               const type = Object.keys(valObj)[0];
               item[key] = valObj[type];
               if (type === 'integerValue') item[key] = parseInt(valObj[type]);
               if (type === 'doubleValue') item[key] = parseFloat(valObj[type]);
             }
             return item;
          });
        }
    }
  } catch (restErr) {}
  
  addLog(`[MOCK] Serving ${collectionName} from memory`);
  return mockDb[collectionName] || [];
};

// Rota para buscar perfil do usuário ignorando erros de rede do cliente
app.get("/api/users/profile/:uid", async (req, res) => {
  try {
    if (dbAdmin) {
      const userDoc = await dbAdmin.collection('users').doc(req.params.uid).get();
      if (userDoc.exists) return res.json(userDoc.data());
    }
    const mockUser = mockDb.users.find((u: any) => u.id === req.params.uid || u.username === req.params.uid);
    if (mockUser) return res.json(mockUser);
    res.status(404).json({ error: "Usuário não encontrado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para buscar perfil por e-mail (fallback adicional)
app.get("/api/users/profile/by-email", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (dbAdmin) {
      const snap = await dbAdmin.collection('users').where('email', '==', email).limit(1).get();
      if (!snap.empty) return res.json(snap.docs[0].data());
    }
    const mockUser = mockDb.users.find((u: any) => u.email === email);
    if (mockUser) return res.json(mockUser);
    res.status(404).json({ error: "Usuário não encontrado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para buscar todos os usuários (estudantes/professores)
app.get("/api/users/list", async (req, res) => {
  res.json(await getData('users'));
});

// Rota para buscar planos
app.get("/api/plans/list", async (req, res) => {
  res.json(await getData('plans'));
});

// Rota para buscar aulas
app.get("/api/classes/list", async (req, res) => {
  res.json(await getData('classes'));
});

// Rota para buscar pagamentos
app.get("/api/payments/list", async (req, res) => {
  res.json(await getData('payments'));
});

// Rota para buscar presenças
app.get("/api/attendance/list", async (req, res) => {
  res.json(await getData('attendance'));
});

// Rota para buscar configurações
app.get("/api/settings/global", async (req, res) => {
  if (dbAdmin) {
    try {
      const doc = await dbAdmin.collection('settings').doc('global').get();
      if (doc.exists) return res.json(doc.data());
    } catch {}
  }
  res.json(mockDb.settings.global);
});

// Rota para buscar estudantes
app.get("/api/students/list", async (req, res) => {
  res.json(await getData('students'));
});

// Rota para buscar logs de acesso recente (alias para compatibilidade)
app.get("/api/accessLogs/list", async (req, res) => {
  res.json(await getData('accessLogs'));
});

// Rota para buscar logs de acesso recente
app.get("/api/logs/recent", async (req, res) => {
  res.json(await getData('accessLogs'));
});

setupFirebase();

// --- API de Acesso da Catraca (Hardware Local) ---
app.post("/api/catraca/acesso", async (req, res) => {
  const { id, rfid, key } = req.body;
  const identifier = id || rfid;

  addLog(`[CATRACA] Tentativa de acesso para ID: ${identifier}`);

  // Segurança básica: Recomendado definir VITE_CATRACA_KEY no .env
  const secretKey = process.env.CATRACA_API_KEY || "carrasco_safe_2024";
  if (key !== secretKey) {
    addLog(`[CATRACA] ❌ Chave de API inválida`);
    return res.status(401).json({ liberado: false, motivo: "erro_autenticacao" });
  }

  if (!identifier) {
    return res.status(400).json({ liberado: false, motivo: "id_ausente" });
  }

  if (!dbClient && !dbAdmin) {
    addLog(`[CATRACA] ❌ Firestore não inicializado`);
    return res.status(503).json({ liberado: false, motivo: "erro_servidor" });
  }

  try {
    // Busca o aluno por RFID ou número de matrícula na coleção "students"
    let student: any = null;
    let studentId: string | null = null;
    
    if (dbClient) {
      // Tenta por RFID
      const qRfid = queryClient(collectionClient(dbClient, 'students'), whereClient('rfid', '==', String(identifier)), limitClient(1));
      const resRfid = await getDocsClient(qRfid);
      
      if (!resRfid.empty) {
        student = resRfid.docs[0].data();
        studentId = resRfid.docs[0].id;
      } else {
        // Tenta por matrícula (como número)
        const idNum = parseInt(String(identifier));
        if (!isNaN(idNum)) {
          const qMatNum = queryClient(collectionClient(dbClient, 'students'), whereClient('registrationNumber', '==', idNum), limitClient(1));
          const resMatNum = await getDocsClient(qMatNum);
          if (!resMatNum.empty) {
            student = resMatNum.docs[0].data();
            studentId = resMatNum.docs[0].id;
          }
        }
        
        // Se ainda não achou, tenta por matrícula (como string)
        if (!student) {
          const qMatStr = queryClient(collectionClient(dbClient, 'students'), whereClient('registrationNumber', '==', String(identifier)), limitClient(1));
          const resMatStr = await getDocsClient(qMatStr);
          if (!resMatStr.empty) {
            student = resMatStr.docs[0].data();
            studentId = resMatStr.docs[0].id;
          }
        }
      }
    } else if (dbAdmin) {
      const snapRfid = await dbAdmin.collection('students').where('rfid', '==', String(identifier)).limit(1).get();
      if (!snapRfid.empty) {
        student = snapRfid.docs[0].data();
        studentId = snapRfid.docs[0].id;
      } else {
        const snapMatricula = await dbAdmin.collection('students').where('registrationNumber', 'in', [parseInt(String(identifier)) || 0, String(identifier)]).limit(1).get();
        if (!snapMatricula.empty) {
          student = snapMatricula.docs[0].data();
          studentId = snapMatricula.docs[0].id;
        }
      }
    }

    if (!student) {
      addLog(`[CATRACA] ❌ Aluno não encontrado: ${identifier}`);
      return res.json({ liberado: false, motivo: "nao_encontrado" });
    }
    
    addLog(`[CATRACA-DEBUG] Aluno encontrado: ${JSON.stringify(student)}`);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    let isLiberado = true;
    let motivo = "ok";

    // Verificação de Planos
    // Verifica se existe algum plano que NÃO esteja vencido
    const expirations = student.planExpirations || {};
    const planIds = student.planIds || [];

    if (planIds.length === 0) {
      isLiberado = false;
      motivo = "sem_plano_ativo";
    } else {
      // Verifica se PELO MENOS UM plano está em dia
      const hasValidPlan = planIds.some((pId: string) => {
        const expDate = expirations[pId];
        return expDate && expDate >= todayStr;
      });

      if (!hasValidPlan) {
        isLiberado = false;
        motivo = "plano_vencido";
      }
    }

    // Se for admin, sempre libera (cortesia)
    if (student.role === 'admin') {
      isLiberado = true;
      motivo = "acesso_admin";
    }

    // Registrar Log de Acesso
    const accessLog = {
      userId: studentId,
      userName: student.name || student.displayName || "Sem Nome",
      rfid: student.rfid || "",
      method: "catraca_api",
      granted: isLiberado,
      motivo: motivo,
      timestamp: dbClient ? serverTimestampClient() : admin.firestore.FieldValue.serverTimestamp()
    };

    if (dbClient) {
      addDocClient(collectionClient(dbClient, 'accessLogs'), accessLog).catch(() => {});
    } else if (dbAdmin) {
      dbAdmin.collection('accessLogs').add(accessLog).catch(() => {});
    }

    addLog(`[CATRACA] ${isLiberado ? "✅ LIBERADO" : "❌ BLOQUEADO"}: ${student.name || student.displayName} (${motivo})`);

    return res.json({ 
      liberado: isLiberado, 
      nome: student.name || student.displayName,
      motivo: motivo,
      expiracao: isLiberado ? "vencimento_ok" : "verificar_financeiro"
    });

  } catch (error: any) {
    addLog(`[CATRACA] ❌ Erro interno: ${error.message}`);
    return res.status(500).json({ liberado: false, motivo: "erro_interno" });
  }
});

// Diagnostic Route for Firestore
app.get("/api/diag/db-test", async (req, res) => {
  if (!dbClient && !dbAdmin) return res.status(500).json({ error: "DB not initialized" });
  try {
    const payload = { _last_test: new Date().toISOString() };
    if (dbClient) {
      await setDocClient(docClient(dbClient, 'settings', 'hardware_status'), payload, { merge: true });
    } else {
      await dbAdmin.collection('settings').doc('hardware_status').set(payload, { merge: true });
    }
    res.json({ success: true, message: "Gravado com sucesso no Firestore!" });
  } catch (e: any) {
    addLog(`[DIAG-ERRO] Falha write Firestore: ${e.message}`);
    res.status(500).json({ error: e.message, code: e.code, stack: e.stack });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const cleanUsername = username?.trim();
    const cleanPassword = password?.trim();
    addLog(`[AUTH] Tentativa de login: "${cleanUsername}"`);
    
    // Fallback para admin mestre HARDCODED (Sempre funciona, independente do DB)
    if (cleanUsername === 'admin' && cleanPassword === '13262413') {
      addLog(`[AUTH] ✓ Senha Mestre Detectada`);
      const masterProfile = {
        uid: 'master-admin',
        displayName: 'Carrasco Admin',
        role: 'admin',
        username: 'admin',
        photoURL: 'https://cdn-icons-png.flaticon.com/512/6024/6024190.png'
      };
      
      try {
        const token = await admin.auth().createCustomToken('master-admin');
        return res.json({
          token,
          profile: masterProfile
        });
      } catch (tokenErr: any) {
        addLog(`[AUTH] ⚠️ Login Mestre em modo de emergência: ${tokenErr.message}`);
        return res.json({
          token: "emergency-local-token",
          profile: masterProfile,
          warning: "Modo emergência ativado"
        });
      }
    }

    // Permitimos o login manual mesmo que o teste de escrita do BD tenha falhado
    if (!dbClient && !dbAdmin) {
      addLog(`[AUTH] ❌ Falha: DB não inicializado`);
      return res.status(503).json({ 
        error: "Servidor de banco de dados não inicializado.",
      });
    }

    let userData: any = null;
    let userId: string | null = null;

    if (dbClient) {
      const q = queryClient(collectionClient(dbClient, 'users'), whereClient('username', '==', cleanUsername), whereClient('password', '==', cleanPassword), limitClient(1));
      const snap = await getDocsClient(q);
      if (!snap.empty) {
        userData = snap.docs[0].data();
        userId = snap.docs[0].id;
      }
    } else if (dbAdmin) {
      const q = await dbAdmin.collection('users').where('username', '==', cleanUsername).where('password', '==', cleanPassword).limit(1).get();
      if (!q.empty) {
        userData = q.docs[0].data();
        userId = q.docs[0].id;
      }
    }

    if (!userData || !userId) {
      addLog(`[AUTH] ❌ Login falhou para: ${cleanUsername}`);
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    addLog(`[AUTH] ✓ Login bem sucedido: ${cleanUsername} (${userId})`);
    
    try {
      // Custom token requires Admin SDK. Fallback to mock token if admin is down.
      const token = dbAdmin ? await admin.auth().createCustomToken(userId) : "emergency-local-token-" + userId;
      res.json({
        token,
        profile: {
          uid: userId,
          ...userData
        },
        warning: dbAdmin ? undefined : "Modo de compatibilidade: Token gerado localmente."
      });
    } catch (tokenErr: any) {
      addLog(`[AUTH] ⚠️ Login bem sucedido, mas erro ao gerar token Firebase: ${tokenErr.message}`);
      // Permitimos o login retornando o perfil e um aviso de erro, o cliente tratará como modo de emergência
      res.json({
        token: "emergency-local-token",
        profile: {
          uid: userId,
          ...userData
        },
        warning: "Modo de emergência: Token Firebase não pôde ser gerado."
      });
    }
  } catch (err: any) {
    addLog(`[AUTH] ❌ ERRO CRÍTICO no login: ${err.message}`);
    res.status(500).json({ error: "Erro interno no servidor de autenticação", details: err.message });
  }
});

// Client Error Logger
app.post('/api/log/client-error', (req, res) => {
  const { error, stack, userAgent } = req.body;
  addLog(`[CLIENT-ERROR] ${error} | UA: ${userAgent?.substring(0, 50)}`);
  if (stack) addLog(`[CLIENT-STACK] ${stack.substring(0, 200)}...`);
  res.sendStatus(200);
});

// Diagnostic Route for Hardware
app.get("/api/diag/hardware-link", (req, res) => {
  const host = req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const PRODUCTION_URL = "https://carrasco-fit-607856914066.us-east1.run.app";
  const isProduction = host.includes('run.app');
  const currentUrl = `${proto}://${host}`;

  addLog(`[DIAG] Hardware link check via ${currentUrl} | Produção: ${isProduction}`);
  
  res.header('X-Hardware-Link', 'Active');
  res.json({
    status: "OPERANTE",
    message: "Servidor Carrasco Fit Cloud detectado e operante.",
    environment: {
      url: currentUrl,
      official_url: PRODUCTION_URL,
      mode: isProduction ? "PRODUÇÃO (CLOUD RUN)" : "DESENVOLVIMENTO",
      details: isProduction 
        ? "Ambiente limpo de redirecionamentos. Pronto para comunicação com iDFace." 
        : `Ambiente de Preview detectado. Use a URL oficial para o hardware: ${PRODUCTION_URL}`
    },
    config_hardware: {
      server_url: PRODUCTION_URL,
      port: 443,
      endpoints: ["/push", "/api/push"],
      hardware_link_mode: true
    },
    server_time: new Date().toISOString()
  });
});

// 3. API Routes
app.get("/api/hardware/status", async (req, res) => {
  let status: any = {};
  
  // Sempre tenta ler o status real gravado pelo Agente Local no Firestore
  try {
    if (dbClient) {
      const d = await getDocClient(docClient(dbClient, 'controlIdDevices', 'iface-principal'));
      if (d.exists()) status = d.data();
    } else if (dbAdmin) {
      const doc = await dbAdmin.collection('controlIdDevices').doc('iface-principal').get();
      if (doc.exists) status = doc.data();
    }
  } catch (err: any) {
    addLog(`[HARDWARE-STATUS-ERRO] Falha ao ler Firestore: ${err.message}`);
  }

  // Mapear lastSeenAt (Firestore Timestamp) para lastSeen (ISO String) para compatibilidade retroativa com a UI
  if (status.lastSeenAt) {
    try {
      const date = status.lastSeenAt.toDate ? status.lastSeenAt.toDate() : new Date(status.lastSeenAt);
      status.lastSeen = date.toISOString();
    } catch (e) {}
  }

  // Fallback para o status local em memória (caso esteja rodando localmente)
  if (!status.lastSeen) {
    status = { ...lastDeviceStatus };
  }

  const now = new Date();
  const secondsAgo = status.lastSeen ? Math.floor((now.getTime() - new Date(status.lastSeen).getTime()) / 1000) : null;
  
  // URL Oficial de Produção (Cloud Run)
  const PRODUCTION_DOMAIN = "carrasco-fit-607856914066.us-east1.run.app";
  const serverUrl = `https://${PRODUCTION_DOMAIN}`; 
  
  res.json({ 
    ...status, 
    secondsAgo, 
    serverUrl, 
    isProduction: req.headers.host?.includes('run.app')
  });
});

app.get("/api/hardware/force-green", async (req, res) => {
  addLog(`[MANUAL] Forçando status VERDE via API.`);
  lastDeviceStatus = {
    lastSeen: new Date().toISOString(),
    deviceId: "Manual-Test",
    serial: "MANUAL",
    ip: "0.0.0.0",
    secondsAgo: 0
  };
  try {
    if (dbClient) {
      await setDocClient(docClient(dbClient, 'settings', 'hardware_status'), lastDeviceStatus, { merge: true });
      addLog(`[DB] Status forçado gravado (Client).`);
    } else if (dbAdmin) {
      await dbAdmin.collection('settings').doc('hardware_status').set(lastDeviceStatus, { merge: true });
      addLog(`[DB] Status forçado gravado (Admin).`);
    }
    res.send("<h1>Status forçado para VERDE. Verifique o Cockpit.</h1>");
  } catch (e: any) {
    addLog(`[DB-ERRO] Falha force-green: ${e.message}`);
    res.status(500).send(`Erro: ${e.message}`);
  }
});

app.get("/api/hardware/events", (req, res) => res.json(globalEvents));
app.get("/api/hardware/server-logs", (req, res) => res.json(serverLogs));

app.get("/api/hardware/queue", (req, res) => {
  res.json({
    size: pendingCommands.length,
    commands: pendingCommands.map(c => ({ endpoint: c.endpoint, uuid: c.uuid, createdAt: c.createdAt }))
  });
});

app.post("/api/hardware/queue/clear", (req, res) => {
  const count = pendingCommands.length;
  pendingCommands = [];
  addLog(`[System] Fila de comandos limpa manualmente (${count} removidos).`);
  res.json({ success: true, removed: count });
});

app.post("/api/hardware/notify-command", async (req, res) => {
  const uuid = req.body.uuid || Math.random().toString(36).substring(7);
  const cmd = { ...req.body, status: 'pending', createdAt: new Date(), uuid };
  pendingCommands.push(cmd);
  addLog(`[HARDWARE-CMD] ➕ Novo comando enfileirado: ${cmd.endpoint} (${uuid})`);
  if (dbClient) {
    setDocClient(docClient(dbClient, 'hardwareCommands', uuid), cmd).catch(() => {});
  } else if (dbAdmin) {
    dbAdmin.collection('hardwareCommands').doc(uuid).set(cmd).catch(() => {});
  }
  res.json({ success: true });
});

app.post("/api/hardware/command", async (req, res) => {
  const uuid = req.body.uuid || Math.random().toString(36).substring(7);
  const cmd = { ...req.body, status: 'pending', createdAt: new Date(), uuid };
  pendingCommands.push(cmd);
  addLog(`[HARDWARE-CMD] ➕ Comando de Sincronização: ${cmd.endpoint} (${uuid})`);
  if (dbClient) {
    setDocClient(docClient(dbClient, 'hardwareCommands', uuid), cmd).catch(() => {});
  } else if (dbAdmin) {
    dbAdmin.collection('hardwareCommands').doc(uuid).set(cmd).catch(() => {});
  }
  res.json({ success: true });
});

app.post("/result", async (req, res) => {
  const { endpoint, error, uuid } = req.body;
  addLog(`[Result] ${endpoint} (${uuid}): ${error || 'SUCESSO'}`);
  if (dbAdmin && uuid) {
     await dbAdmin.collection('hardwareCommands').doc(uuid).update({ 
       status: error ? 'error' : 'completed', 
       completedAt: admin.firestore.FieldValue.serverTimestamp()
     }).catch(() => {});
  }
  res.status(200).end();
});

// --- Rota: Lançar o .bat da catraca ---
app.post('/api/launch-bat', (req, res) => {
  const batPath = path.join(process.cwd(), 'iniciar-recepcao.bat');
  addLog(`[CATRACA-BAT] Executando: ${batPath}`);

  // Abre o .bat em uma janela independente (sem bloquear o servidor)
  exec(`start "" "${batPath}"`, { shell: 'cmd.exe' }, (err) => {
    if (err) {
      addLog(`[CATRACA-BAT] ❌ Erro: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
    addLog(`[CATRACA-BAT] ✅ Iniciado com sucesso`);
    res.json({ success: true, message: 'Catraca iniciada com sucesso!' });
  });
});

// 4. Vite/Static serving
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    addLog("[System] Modo Desenvolvimento (Vite)");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      
      app.use(vite.middlewares);
    } catch (e: any) {
      addLog(`[System] Erro ao iniciar Vite: ${e.message}. Usando fallback estático.`);
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
    }
  } else {
    addLog("[System] Modo Produção (Static)");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // Don't intercept API routes or hardware routes
      const p = req.path.toLowerCase();
      if (p.startsWith('/api/') || p === '/push' || p === '/result' || p.includes('ping') || p.endsWith('.fcgi')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 5. Start listening
  addLog("[System] Executando app.listen...");
  app.listen(PORT, "0.0.0.0", () => {
    addLog(`[System] Carrasco Cloud v3 ON na porta ${PORT}`);
  });
}

startApp();

export default app;
