import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';

// 1. Carregar Variáveis de Ambiente
dotenv.config();

// Sufixo opcional para isolar bancos de teste (ex: _test)
const FIREBASE_ENV_SUFFIX = process.env.FIREBASE_ENV_SUFFIX || '';
const COMMANDS_COLLECTION = `controlIdCommands${FIREBASE_ENV_SUFFIX}`;
const LOGS_COLLECTION = `controlIdLogs${FIREBASE_ENV_SUFFIX}`;
const DEVICES_COLLECTION = `controlIdDevices${FIREBASE_ENV_SUFFIX}`;

console.log('=== CARRASCO FIT AGENTE LOCAL DE ACESSO ===');
console.log(`Ambiente / Sufixo das coleções: "${FIREBASE_ENV_SUFFIX || '(produção)'}"`);
console.log('Iniciando agente...');

// 2. Validar e Inicializar o Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
const resolvedPath = path.resolve(serviceAccountPath);

if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ ERRO: Arquivo de conta de serviço não encontrado em: ${resolvedPath}`);
  console.error('Por favor, siga as instruções no README.md para exportar o JSON do Firebase Console e salvá-lo nesta pasta.');
  process.exit(1);
}

let app;
try {
  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin inicializado com sucesso.');
} catch (e: any) {
  console.error('❌ ERRO ao inicializar o Firebase:', e.message);
  process.exit(1);
}

const databaseId = process.env.FIREBASE_DATABASE_ID || 'carrasco-data-final';
const db = getFirestore(app, databaseId);

// 3. Configurações da Catraca obtidas do .env
const CATRACA_IP = process.env.CATRACA_IP || '192.168.1.100';
const CATRACA_PORT = process.env.CATRACA_PORT || '443';
const CATRACA_PROTOCOL = process.env.CATRACA_PROTOCOL || 'https';
const CATRACA_USER = process.env.CATRACA_USER || 'admin';
const CATRACA_PASSWORD = process.env.CATRACA_PASSWORD || 'admin';
const CATRACA_MODEL = process.env.CATRACA_MODEL || 'idface';
const CATRACA_RELEASE_ACTION = process.env.CATRACA_RELEASE_ACTION || 'sec_box';

const catracaBaseUrl = `${CATRACA_PROTOCOL}://${CATRACA_IP}:${CATRACA_PORT}`;

console.log(`Catraca configurada em: ${catracaBaseUrl}`);
console.log(`Modelo: ${CATRACA_MODEL} | Ação de Liberação: ${CATRACA_RELEASE_ACTION}`);

// 4. Instância Axios configurada para segurança (timeout e SSL autoassinado)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const turnstileClient = axios.create({
  baseURL: catracaBaseUrl,
  timeout: 5000, // Timeout estrito de 5 segundos para evitar travamentos
  httpsAgent
});

// Sanitizador de logs para ocultar tokens e senhas
function sanitizeLog(msg: string): string {
  return msg
    .replace(/session=[a-zA-Z0-9]+/g, 'session=*****')
    .replace(/"password"\s*:\s*"[^"]+"/g, '"password":"*****"')
    .replace(/"login"\s*:\s*"[^"]+"/g, '"login":"*****"');
}

function logInfo(msg: string) {
  const time = new Date().toLocaleTimeString();
  console.log(sanitizeLog(`[${time}] [INFO] ${msg}`));
}

function logError(msg: string) {
  const time = new Date().toLocaleTimeString();
  console.error(sanitizeLog(`[${time}] [ERRO] ${msg}`));
}

// Helper para gravar logs estruturados (ControlIdLog) no Firestore
async function writeControlIdLog(
  type: "testConnection" | "unlock" | "system",
  status: "success" | "error" | "info",
  message: string,
  commandId?: string,
  raw?: any
) {
  try {
    const logRef = db.collection(LOGS_COLLECTION).doc();
    const payload = {
      id: logRef.id,
      deviceId: "iface-principal",
      commandId,
      type,
      status,
      message,
      createdAt: new Date().toISOString(),
      raw: raw || null
    };
    await logRef.set(payload);
    logInfo(`[FirestoreLog] ${message}`);
  } catch (err: any) {
    logError(`Erro ao gravar log no Firestore: ${err.message}`);
  }
}

// 5. Helpers de Autenticação com a Catraca
async function loginTurnstile(): Promise<string> {
  try {
    const res = await turnstileClient.post('/login.fcgi', {
      login: CATRACA_USER,
      password: CATRACA_PASSWORD
    });

    if (res.status === 200 && res.data && res.data.session) {
      return res.data.session;
    }
    throw new Error('Retorno inválido da catraca no login.');
  } catch (err: any) {
    const errorMsg = err.response ? `HTTP ${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message;
    throw new Error(`Falha de autenticação na catraca: ${errorMsg}`);
  }
}

async function logoutTurnstile(session: string): Promise<void> {
  try {
    await turnstileClient.post(`/logout.fcgi?session=${session}`, {});
  } catch (err) {}
}

// 6. Rotina de Execução de Ações
async function executeRelayRelease(session: string): Promise<any> {
  // Mapeia parâmetros a enviar baseado no endpoint e modelo
  let action = CATRACA_RELEASE_ACTION;
  let parameters = '';

  if (action === 'door') {
    parameters = 'door=1';
  } else if (action === 'catra') {
    parameters = 'allow=1';
  }

  const payload = {
    actions: [{
      action,
      parameters
    }]
  };

  logInfo(`Disparando acionamento físico: ${action} (${parameters || 'sem parâmetros'})`);
  
  const res = await turnstileClient.post(`/execute_actions.fcgi?session=${session}`, payload);
  return res.data;
}

// 7. Processador do Fluxo de Comandos ControlIdCommand
async function processControlIdCommand(docId: string, cmd: any) {
  logInfo(`Iniciando processamento do comando Control iD ${cmd.type} (${docId})`);
  
  let session = '';
  try {
    // A. Autenticar no equipamento local
    logInfo('Realizando login no equipamento...');
    session = await loginTurnstile();
    logInfo('Autenticado com sucesso. Sessão estabelecida.');

    let responseData: any = null;

    // B. Tratar comando por tipo
    if (cmd.type === 'testConnection') {
      logInfo('Comando detectado: testConnection. Obtendo informações do sistema...');
      const sysInfoRes = await turnstileClient.post(`/system_information.fcgi?session=${session}`, {});
      responseData = {
        success: true,
        message: 'Conexão estabelecida com sucesso entre Agente e iDFace!',
        deviceInfo: sysInfoRes.data
      };
    } else if (cmd.type === 'unlock') {
      responseData = await executeRelayRelease(session);
    } else {
      throw new Error(`Tipo de comando desconhecido: ${cmd.type}`);
    }

    // C. Atualizar o comando no Firestore como SUCESSO
    await db.collection(COMMANDS_COLLECTION).doc(docId).update({
      status: 'success',
      result: responseData || {},
      processedAt: new Date().toISOString()
    });

    await writeControlIdLog(
      cmd.type,
      "success",
      `Comando ${cmd.type} executado com sucesso no leitor facial.`,
      docId,
      responseData
    );

    logInfo(`✅ Comando Control iD ${docId} executado e marcado como SUCCESS.`);
  } catch (err: any) {
    const errorMsg = err.message || 'Erro desconhecido durante execução.';
    logError(`Falha ao executar comando Control iD ${docId}: ${errorMsg}`);

    // Atualizar o comando no Firestore como ERRO
    await db.collection(COMMANDS_COLLECTION).doc(docId).update({
      status: 'error',
      error: errorMsg,
      processedAt: new Date().toISOString()
    });

    await writeControlIdLog(
      cmd.type,
      "error",
      `Falha ao executar comando ${cmd.type}: ${errorMsg}`,
      docId,
      { error: errorMsg }
    );
  } finally {
    if (session) {
      await logoutTurnstile(session);
      logInfo('Sessão encerrada com a catraca de forma limpa.');
    }
  }
}

// 8. Escuta Ativa do Firestore (Fila de Comandos Control iD)
function startCommandQueueListener() {
  logInfo(`Iniciando listener em tempo real da coleção "${COMMANDS_COLLECTION}"...`);

  db.collection(COMMANDS_COLLECTION)
    .where('status', '==', 'pending')
    .onSnapshot(async (snapshot) => {
      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const docId = doc.id;
        const cmd = doc.data();

        // Evitar execução duplicada de forma ATÔMICA usando transações do Firestore
        const commandRef = db.collection(COMMANDS_COLLECTION).doc(docId);

        try {
          const wasAcquired = await db.runTransaction(async (transaction) => {
            const freshDoc = await transaction.get(commandRef);
            if (!freshDoc.exists) return false;
            
            const freshData = freshDoc.data();
            if (freshData?.status !== 'pending') {
              return false; // Já capturado por outra instância ou processado
            }

            // Marca como processing antes de acionar o hardware
            transaction.update(commandRef, {
              status: 'processing',
              processingStartedAt: new Date().toISOString()
            });

            return true;
          });

          if (wasAcquired) {
            logInfo(`Bloqueio atômico adquirido para o comando Control iD: ${docId}`);
            processControlIdCommand(docId, cmd).catch(e => logError(`Erro fatal no comando ${docId}: ${e.message}`));
          } else {
            logInfo(`⚠️ Comando ${docId} ignorado (já em processamento ou concluído).`);
          }
        } catch (transErr: any) {
          logError(`Erro ao tentar adquirir transação para o comando ${docId}: ${transErr.message}`);
        }
      }
    }, (err) => {
      logError(`Erro na escuta ativa de comandos Control iD: ${err.message}`);
      setTimeout(startCommandQueueListener, 5000);
    });
}

// 9. Rotina Heartbeat (Ping de Status a cada 10 segundos)
async function performHeartbeat() {
  let session = '';
  try {
    session = await loginTurnstile();
    const sysInfoRes = await turnstileClient.post(`/system_information.fcgi?session=${session}`, {});
    const sysInfo = sysInfoRes.data;

    // Atualiza status como ONLINE no Firestore
    const payload = {
      id: 'iface-principal',
      name: 'iDFace Principal',
      model: 'iDFace',
      ip: CATRACA_IP,
      port: parseInt(CATRACA_PORT),
      protocol: CATRACA_PROTOCOL,
      status: 'online',
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        serial: sysInfo.serial || '',
        version: sysInfo.version || '',
        model: sysInfo.model || ''
      }
    };

    await db.collection(DEVICES_COLLECTION).doc('iface-principal').set(payload, { merge: true });
    logInfo(`💓 Heartbeat: Catraca ONLINE (Serial: ${sysInfo.serial || 'N/A'})`);
    
    await writeControlIdLog(
      "system",
      "info",
      `Heartbeat bem-sucedido: leitor facial ONLINE (Serial: ${sysInfo.serial || 'N/A'}).`,
      undefined,
      sysInfo
    );
  } catch (err: any) {
    logError(`💓 Heartbeat: Catraca OFFLINE ou Inalcançável. Motivo: ${err.message}`);

    const payload = {
      id: 'iface-principal',
      name: 'iDFace Principal',
      model: 'iDFace',
      ip: CATRACA_IP,
      port: parseInt(CATRACA_PORT),
      protocol: CATRACA_PROTOCOL,
      status: 'offline',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection(DEVICES_COLLECTION).doc('iface-principal').set(payload, { merge: true }).catch(() => {});
    
    await writeControlIdLog(
      "system",
      "error",
      `Falha de conexão no Heartbeat: leitor facial OFFLINE. Motivo: ${err.message}`,
      undefined,
      { error: err.message }
    );
  } finally {
    if (session) {
      await logoutTurnstile(session);
    }
  }
}

// Inicialização Principal
async function main() {
  // A. Inicializar documento de dados do leitor no Firestore se não existir
  try {
    const docRef = db.collection(DEVICES_COLLECTION).doc('iface-principal');
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      logInfo('Inicializando estrutura de dados do leitor "controlIdDevices/iface-principal" no Firestore...');
      await docRef.set({
        id: "iface-principal",
        name: "iDFace Principal",
        model: "iDFace",
        ip: CATRACA_IP,
        port: parseInt(CATRACA_PORT),
        protocol: CATRACA_PROTOCOL,
        status: "unknown",
        lastSeenAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e: any) {
    logError(`Erro ao inicializar documento de dados do leitor no Firestore: ${e.message}`);
  }

  // Inicia o listener de comandos pendentes
  startCommandQueueListener();

  // Roda heartbeat imediatamente no início
  performHeartbeat();

  // Agenda heartbeat periódico a cada 10 segundos
  setInterval(performHeartbeat, 10000);

  logInfo('Agente ativo e monitorando a nuvem. Pressione Ctrl+C para encerrar.');
}

main();
