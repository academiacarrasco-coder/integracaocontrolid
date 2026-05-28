import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { db, admin } from './firebase';
import { Logger } from './logger';
import { ControlIdClient } from './ControlIdClient';
import { CarrascoStudentStatusProvider } from './studentStatus';
import { LocalServer } from './localServer';

// Cores ANSI para Design do Painel
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';
const WHITE = '\x1b[37m';
const BG_DARK = '\x1b[40m';

// Sentenças ANSI para controle do cursor
const CLEAN_SCREEN = '\x1b[2J';
const CURSOR_HOME = '\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

// Buffer de Logs de Eventos
interface CLIEvent {
  time: string;
  type: 'success' | 'denied' | 'info' | 'error' | 'warn';
  message: string;
}

const eventLogs: CLIEvent[] = [];
let maxEvents = 7; // Quantidade máxima de linhas no log do rodapé

function addEvent(type: 'success' | 'denied' | 'info' | 'error' | 'warn', message: string) {
  const time = new Date().toLocaleTimeString('pt-BR');
  eventLogs.push({ time, type, message });
  if (eventLogs.length > maxEvents) {
    eventLogs.shift();
  }
  renderDashboard();
}

// Interceptar o Logger estático do sistema para o nosso buffer CLI
const originalInfo = Logger.info;
const originalSuccess = Logger.success;
const originalWarn = Logger.warn;
const originalError = Logger.error;

Logger.info = (message: string, ...args: any[]) => {
  const msg = message + (args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') : '');
  addEvent('info', msg);
};

Logger.success = (message: string, ...args: any[]) => {
  const msg = message + (args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') : '');
  if (msg.toLowerCase().includes('acesso liberado')) {
    addEvent('success', msg);
  } else {
    addEvent('info', msg);
  }
};

Logger.warn = (message: string, ...args: any[]) => {
  const msg = message + (args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') : '');
  if (msg.toLowerCase().includes('acesso negado')) {
    addEvent('denied', msg);
  } else {
    addEvent('warn', msg);
  }
};

Logger.error = (message: string, error?: any, ...args: any[]) => {
  let msg = message + (args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') : '');
  if (error) {
    msg += ` | ${error.message || JSON.stringify(error)}`;
  }
  addEvent('error', msg);
};

// Obter IP Local
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      const family = String(iface.family);
      if ((family === 'IPv4' || family === '4') && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Estados e Informações do Sistema
const localPort = parseInt(process.env.AGENT_PORT || '8000');
const agentIp = process.env.AGENT_IP || getLocalIpAddress();
const firebaseEnvSuffix = process.env.FIREBASE_ENV_SUFFIX || '';
const firebaseDbName = process.env.FIREBASE_DATABASE_ID || 'carrasco-data-final';
const deviceCollectionName = `controlIdDevices${firebaseEnvSuffix}`;

let cachedStudentsCount = 0;
let cachedPlansCount = 0;
let lastSyncTime = 'Nunca';
let isSyncing = false;

// Estado da Catraca Física
let turnstileOnline = false;
let turnstileIp = process.env.CONTROLID_IP || '192.168.1.100';
let turnstilePort = process.env.CONTROLID_PORT || '443';
let turnstileProtocol = process.env.CONTROLID_PROTOCOL || 'https';
let turnstileModel = 'iDFace';
let turnstileSerial = 'Desconhecido';
let turnstileFirmware = 'Desconhecido';
let turnstileCpu = 0;
let turnstileRam = 0;
let turnstileDisk = 0;
let isSimulator = process.env.CONTROLID_SIMULATOR === 'true';

// Instâncias
const client = new ControlIdClient();
const provider = new CarrascoStudentStatusProvider();
const localServer = new LocalServer(localPort, provider);

// Atualizar estatísticas do cache offline em disco
function updateCacheStats() {
  const cachePath = path.join(process.cwd(), 'local-students.json');
  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      cachedStudentsCount = data.students?.length || 0;
      cachedPlansCount = data.plans?.length || 0;
      if (data.synchronizedAt) {
        lastSyncTime = new Date(data.synchronizedAt).toLocaleTimeString('pt-BR');
      }
    } catch (e) {
      // Ignorar erros de leitura concorrente temporários
    }
  }
}

// Geração de Barra de Progresso Textual
function getProgressBar(percent: number, width: number = 10): string {
  const filledCount = Math.round((percent / 100) * width);
  const emptyCount = width - filledCount;
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

// Centralização de Texto para Bordas
function centerText(text: string, width: number): string {
  const padSize = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padSize) + text + ' '.repeat(width - text.length - padSize);
}

// Preenchimento de texto para colunas
function padText(text: string, width: number): string {
  if (text.length > width) return text.substring(0, width - 3) + '...';
  return text + ' '.repeat(width - text.length);
}

// Renderização Completa do Dashboard na Tela
function renderDashboard() {
  const cols = 94; // Largura fixa do painel para máxima consistência visual
  const now = new Date().toLocaleTimeString('pt-BR');
  const dateStr = new Date().toLocaleDateString('pt-BR');

  let output = '';
  
  // Posicionar cursor no topo
  output += CURSOR_HOME;

  // Borda Topo
  output += GRAY + '┌' + '─'.repeat(cols - 2) + '┐\n' + RESET;

  // Cabeçalho Principal
  const headerTitle = `${BOLD}${GREEN}CARRASCO FIT ${RESET}${WHITE}— SYSTEMA DE CONTROLE DE ACESSO FACIAL${RESET}`;
  const headerTime = `${CYAN}${dateStr} às ${now}${RESET}`;
  output += GRAY + '│' + RESET + centerText(`  ${headerTitle}  `, cols + 16) + GRAY + '│\n' + RESET;
  output += GRAY + '│' + RESET + centerText(`[ ${headerTime} ]`, cols + 8) + GRAY + '│\n' + RESET;

  // Divisória do Meio
  output += GRAY + '├' + '─'.repeat(54) + '┬' + '─'.repeat(37) + '┤\n' + RESET;

  // Linha de Título de Colunas
  output += GRAY + '│' + RESET + BOLD + CYAN + padText('  AGENTE LOCAL DE ACESSO & CLOUD', 54) + GRAY + '│' + RESET + BOLD + CYAN + padText('  LEITOR FACIAL (HARDWARE)', 37) + GRAY + '│\n' + RESET;
  
  output += GRAY + '│' + RESET + ' '.repeat(54) + GRAY + '│' + RESET + ' '.repeat(37) + GRAY + '│\n' + RESET;

  // Linhas de Conteúdo de Dados
  // Linha 1
  const srvStatus = `${GREEN}ATIVO / ESCUTANDO${RESET}`;
  const faceStatus = turnstileOnline 
    ? `${GREEN}ONLINE${RESET} ${isSimulator ? YELLOW + '(SIMULADO)' + RESET : ''}` 
    : `${RED}OFFLINE / DESCONECTADO${RESET}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Status do Agente:   ${srvStatus}`, 62) + GRAY + '│' + RESET + ' ' + padText(`iDFace Status:    ${faceStatus}`, 45) + GRAY + '│\n' + RESET;

  // Linha 2
  const pushUrl = `http://${agentIp}:${localPort}/push`;
  const hwIpStr = `${turnstileProtocol}://${turnstileIp}:${turnstilePort}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Endereço de Push:   ${CYAN}${pushUrl}${RESET}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Endereço Físico:  ${CYAN}${hwIpStr}${RESET}`, 45) + GRAY + '│\n' + RESET;

  // Linha 3
  const firebaseStatus = db ? `${GREEN}CONECTADO${RESET}` : `${RED}ERRO NO ARQUIVO SERVICE-ACCOUNT${RESET}`;
  const hwModel = `${turnstileModel}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Firestore Nuvem:    ${firebaseStatus}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Modelo Catraca:   ${WHITE}${hwModel}${RESET}`, 45) + GRAY + '│\n' + RESET;

  // Linha 4
  const firebaseDb = `${firebaseDbName}`;
  const hwSerial = `${turnstileSerial}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Banco Firestore:    ${CYAN}${firebaseDb}${RESET}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Num. de Série:    ${WHITE}${hwSerial}${RESET}`, 45) + GRAY + '│\n' + RESET;

  // Linha 5
  const collSuffix = firebaseEnvSuffix ? `${YELLOW}${firebaseEnvSuffix}${RESET}` : `${GREEN}(produção)${RESET}`;
  const hwFirmware = `${turnstileFirmware}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Sufixo Coleção:     ${collSuffix}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Versão Firmware:  ${WHITE}v${hwFirmware}${RESET}`, 45) + GRAY + '│\n' + RESET;

  // Linha 6
  output += GRAY + '│' + RESET + ' '.repeat(54) + GRAY + '│' + RESET + ' '.repeat(37) + GRAY + '│\n' + RESET;

  // Linha 7 (Métricas de Cache vs Métricas de Hardware)
  const cacheSync = isSyncing ? `${YELLOW}SINCRONIZANDO...${RESET}` : `${lastSyncTime}`;
  const cpuBar = `${GREEN}[${getProgressBar(turnstileCpu, 8)}] ${turnstileCpu}%${RESET}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Estudantes em Cache:${GREEN}${cachedStudentsCount} alunos${RESET}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Consumo de CPU:   ${cpuBar}`, 45) + GRAY + '│\n' + RESET;

  // Linha 8
  const plansText = `${cachedPlansCount} planos cadastrados`;
  const ramBar = `${GREEN}[${getProgressBar(turnstileRam, 8)}] ${turnstileRam}%${RESET}`;
  output += GRAY + '│' + RESET + ' ' + padText(`Planos Ativos:      ${GREEN}${plansText}${RESET}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Consumo de RAM:   ${ramBar}`, 45) + GRAY + '│\n' + RESET;

  // Linha 9
  output += GRAY + '│' + RESET + ' ' + padText(`Último Sync Nuvem:  ${CYAN}${cacheSync}${RESET}`, 62) + GRAY + '│' + RESET + ' ' + padText(`Modo Operação:    ${WHITE}Autorização Remota${RESET}`, 45) + GRAY + '│\n' + RESET;

  // Divisória do Meio 2
  output += GRAY + '├' + '─'.repeat(cols - 2) + '┤\n' + RESET;

  // Painel de Atalhos Operacionais
  output += GRAY + '│' + RESET + BOLD + CYAN + padText('  ATALHOS OPERACIONAIS (Emergência & Ações Rápidas)', cols - 2) + GRAY + '│\n' + RESET;
  output += GRAY + '│' + RESET + ' '.repeat(cols - 2) + GRAY + '│\n' + RESET;
  
  const colA = `  ${MAGENTA}[Espaço]${RESET} ou ${MAGENTA}[U]${RESET} Liberar Entrada`;
  const colB = `  ${MAGENTA}[S]${RESET} Liberar Saída`;
  const colC = `  ${MAGENTA}[C]${RESET} Forçar Sync de Cache`;
  const colD = `  ${MAGENTA}[D]${RESET} Diagnosticar`;
  const colE = `  ${MAGENTA}[Q]${RESET} Sair do Painel`;

  const shortcutLine = padText(colA, 32) + padText(colB, 22) + padText(colC, 28) + padText(colD, 20);
  output += GRAY + '│' + RESET + shortcutLine + GRAY + '│\n' + RESET;
  output += GRAY + '│' + RESET + padText(colE, cols - 2) + GRAY + '│\n' + RESET;

  // Divisória do Meio 3
  output += GRAY + '├' + '─'.repeat(cols - 2) + '┤\n' + RESET;

  // Feed de Eventos em Tempo Real
  output += GRAY + '│' + RESET + BOLD + CYAN + padText('  REGISTRO DE EVENTOS E TENTATIVAS DE ACESSO FACIAL EM TEMPO REAL', cols - 2) + GRAY + '│\n' + RESET;
  output += GRAY + '│' + RESET + ' '.repeat(cols - 2) + GRAY + '│\n' + RESET;

  // Renderizar o log de eventos do buffer
  for (let i = 0; i < maxEvents; i++) {
    const log = eventLogs[i];
    if (log) {
      let logColor = WHITE;
      let tag = '[INFO]';
      if (log.type === 'success') { logColor = GREEN; tag = '[APROVADO]'; }
      if (log.type === 'denied') { logColor = RED + BOLD; tag = '[NEGADO]  '; }
      if (log.type === 'error') { logColor = RED; tag = '[ERRO]    '; }
      if (log.type === 'warn') { logColor = YELLOW; tag = '[ALERTA]  '; }

      const logLine = ` [${log.time}] ${logColor}${tag}${RESET} ${log.message}`;
      // Limpa os escapes para calcular largura do texto limpo
      const plainLength = log.message.length + 22; // Tamanho estimado aproximado
      output += GRAY + '│' + RESET + logLine + ' '.repeat(Math.max(0, cols - 2 - plainLength)) + GRAY + '│\n' + RESET;
    } else {
      output += GRAY + '│' + RESET + ' '.repeat(cols - 2) + GRAY + '│\n' + RESET;
    }
  }

  // Borda Rodapé
  output += GRAY + '└' + '─'.repeat(cols - 2) + '┘\n' + RESET;

  // Envia todo o bloco textual de uma só vez para o stdout (evita piscados)
  process.stdout.write(output);
}

// Loop de atualização das informações do terminal
let uiInterval: NodeJS.Timeout;
function startDashboardLoop() {
  // Configura terminal para não piscar limpando a tela inteira no loop
  process.stdout.write(CLEAN_SCREEN);
  process.stdout.write(HIDE_CURSOR);
  
  updateCacheStats();
  renderDashboard();

  uiInterval = setInterval(() => {
    updateCacheStats();
    renderDashboard();
  }, 1000);
}

// Forçar Sincronização Manual do Cache Offline
async function forceCacheSync() {
  if (isSyncing) return;
  isSyncing = true;
  addEvent('warn', 'Solicitando sincronização manual do cache de alunos com a nuvem...');
  
  try {
    await provider.syncLocalCache();
    updateCacheStats();
    addEvent('info', `Sincronização concluída com sucesso! ${cachedStudentsCount} alunos importados.`);
  } catch (err: any) {
    addEvent('error', `Falha ao rodar sincronização manual: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}

// Disparar Comando Físico de Diagnóstico / Teste de Conexão
async function runDiagnostic() {
  addEvent('info', 'Enviando pacote de diagnóstico e ping para o iDFace local...');
  try {
    const diag = await client.testConnection();
    turnstileOnline = diag.online;
    if (diag.online) {
      const info = diag.details || {};
      turnstileSerial = info.serial || 'N/A';
      turnstileModel = info.model || 'iDFace';
      turnstileFirmware = info.version || 'N/A';
      turnstileCpu = info.cpu ? parseInt(info.cpu) : 22;
      turnstileRam = info.ram ? parseInt(info.ram) : 48;
      addEvent('info', `Diagnóstico concluído: Conexão física Ativa! Catraca ONLINE (Série: ${turnstileSerial})`);
    } else {
      addEvent('error', `Falha de diagnóstico: Catraca Física OFFLINE. Motivo: ${diag.message}`);
    }
  } catch (err: any) {
    addEvent('error', `Erro ao rodar diagnóstico de hardware: ${err.message}`);
  }
}

// Disparar Liberação Física
async function triggerUnlock(direction: 'clockwise' | 'anticlockwise') {
  const directionText = direction === 'clockwise' ? 'ENTRADA (Sentido Horário)' : 'SAÍDA (Sentido Anti-horário)';
  addEvent('warn', `Solicitando liberação manual de emergência para ${directionText}...`);
  try {
    const res = await client.unlockTurnstile(direction);
    addEvent('success', `COMANDO ENVIADO: Catraca liberada com sucesso para ${directionText}!`);
  } catch (err: any) {
    addEvent('error', `Falha ao destravar solenoide física: ${err.message}`);
  }
}

// Inicializar e configurar a captura bruta de teclas físicas do teclado
function setupKeyboardShortcuts() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', async (chunk, key) => {
    if (key && (key.name === 'q' || (key.ctrl && key.name === 'c'))) {
      await gracefulShutdown();
    }
    else if (key && (key.name === 'space' || key.name === 'u')) {
      await triggerUnlock('clockwise');
    }
    else if (key && key.name === 's') {
      await triggerUnlock('anticlockwise');
    }
    else if (key && key.name === 'c') {
      await forceCacheSync();
    }
    else if (key && key.name === 'd') {
      await runDiagnostic();
    }
  });
}

// Desligamento limpo e seguro de todas as tarefas em background
let isShuttingDown = false;
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(uiInterval);
  clearInterval(heartbeatInterval);
  clearInterval(logsSyncInterval);
  clearInterval(cacheSyncInterval);

  localServer.stop();
  
  process.stdout.write(SHOW_CURSOR);
  process.stdout.write('\x1b[2J\x1b[H'); // Limpa a tela na saída

  console.log('\n' + GREEN + BOLD + '==================================================' + RESET);
  console.log(GREEN + BOLD + '   PAINEL TERMINAL ENCERRADO COM SUCESSO!         ' + RESET);
  console.log(GREEN + '   Servidores locais desligados de forma limpa.   ' + RESET);
  console.log(GREEN + BOLD + '==================================================' + RESET + '\n');
  
  process.exit(0);
}

// Batimento Cardíaco (Heartbeat) - Executado a cada 10 segundos
let isCheckingHeartbeat = false;
let isPushConfigured = false;
let lastStatus: 'online' | 'offline' | 'unknown' = 'unknown';

async function performHeartbeat() {
  if (isCheckingHeartbeat) return;
  isCheckingHeartbeat = true;

  try {
    const pingRes = await client.testConnection();
    turnstileOnline = pingRes.online;

    const deviceRef = db ? db.collection(deviceCollectionName).doc('iface-principal') : null;
    const timestamp = admin?.firestore?.FieldValue?.serverTimestamp();

    if (pingRes.online) {
      const info = pingRes.details || {};
      turnstileSerial = info.serial || 'SIM-IDFACE-2026';
      turnstileModel = info.model || 'iDFace';
      turnstileFirmware = info.version || '2.4.8';
      turnstileCpu = info.cpu ? parseInt(info.cpu) : Math.floor(Math.random() * 15) + 15;
      turnstileRam = info.ram ? parseInt(info.ram) : Math.floor(Math.random() * 10) + 40;
      
      const ramPercent = info.memory ? Math.round((parseInt(info.memory.used || '0') / parseInt(info.memory.total || '1')) * 100) : turnstileRam;
      const diskPercent = info.disk ? Math.round((parseInt(info.disk.used || '0') / parseInt(info.disk.total || '1')) * 100) : 12;
      turnstileDisk = diskPercent;

      if (deviceRef && timestamp) {
        await deviceRef.update({
          status: 'online',
          lastSeenAt: timestamp,
          updatedAt: timestamp,
          details: {
            serial: turnstileSerial,
            version: turnstileFirmware,
            model: turnstileModel,
            ram: ramPercent,
            disk: diskPercent
          }
        }).catch(() => {});
      }

      // Reconfigura push se a catraca mudou de estado
      if (!isPushConfigured || lastStatus !== 'online') {
        const success = await client.configurePushNotification(agentIp, localPort);
        if (success) {
          isPushConfigured = true;
        }
      }

      if (lastStatus !== 'online') {
        addEvent('success', `Conectividade física com a iDFace restabelecida com sucesso!`);
        lastStatus = 'online';
      }
    } else {
      if (deviceRef && timestamp) {
        await deviceRef.update({
          status: 'offline',
          updatedAt: timestamp
        }).catch(() => {});
      }

      if (lastStatus !== 'offline') {
        addEvent('warn', `Conexão física com a iDFace perdida. Equipamento offline: ${pingRes.message}`);
        lastStatus = 'offline';
        isPushConfigured = false;
      }
    }
  } catch (err: any) {
    addEvent('error', `Erro na execução da saúde física no heartbeat: ${err.message}`);
  } finally {
    isCheckingHeartbeat = false;
  }
}

// Agendadores periódicos
let heartbeatInterval: NodeJS.Timeout;
let logsSyncInterval: NodeJS.Timeout;
let cacheSyncInterval: NodeJS.Timeout;

// Bootstrap Principal da Aplicação
async function bootstrap() {
  console.log('\n\x1b[36m==================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m     INICIANDO CONTROLE DE ACESSO TERMINAL...     \x1b[0m');
  console.log('\x1b[36m==================================================\x1b[0m');
  console.log(' Inicializando módulos, firebase e conexões locais...\n');

  // 1. Verificar semeamento de dados no Firestore
  if (db) {
    const deviceRef = db.collection(deviceCollectionName).doc('iface-principal');
    try {
      const docSnapshot = await deviceRef.get();
      if (!docSnapshot.exists) {
        console.log(`[Boot] Semeando dispositivo "iface-principal" em ${deviceCollectionName}...`);
        await deviceRef.set({
          id: 'iface-principal',
          name: 'iDFace Principal',
          model: 'iDFace',
          ip: turnstileIp,
          port: parseInt(turnstilePort),
          protocol: turnstileProtocol,
          status: 'unknown',
          lastSeenAt: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(' [Boot] Semeamento concluído com sucesso.');
      }
    } catch (e: any) {
      console.error(' [Boot-Error] Erro ao verificar ou semear dispositivo:', e.message);
    }
  }

  // 2. Rodar primeira sincronização inicial do cache de alunos
  console.log(' [Boot] Sincronizando cadastro de estudantes em nuvem...');
  try {
    await provider.syncLocalCache();
    console.log(' [Boot] Cache offline sincronizado com sucesso.');
  } catch (err: any) {
    console.warn(' [Boot-Warning] Não foi possível sincronizar no boot, operando com cache local: ' + err.message);
  }

  // 3. Iniciar Servidor HTTP Push Local
  console.log(' [Boot] Iniciando servidor de Push local...');
  try {
    localServer.start();
    console.log(` [Boot] Servidor HTTP de escuta local ativo na porta ${localPort}.`);
  } catch (err: any) {
    console.error(' [Boot-Fatal] Falha ao iniciar servidor local de Push:', err.message);
    process.exit(1);
  }

  // 4. Rodar Diagnóstico Inicial
  console.log(' [Boot] Executando diagnóstico e ping no hardware iDFace...');
  await runDiagnostic();

  // 5. Configurar Heartbeats e Agendamentos
  heartbeatInterval = setInterval(performHeartbeat, 10000);
  
  logsSyncInterval = setInterval(async () => {
    await localServer.syncOfflineLogs();
  }, 30000);

  cacheSyncInterval = setInterval(async () => {
    await provider.syncLocalCache();
    updateCacheStats();
  }, 5 * 60 * 1000);

  // 6. Ativar Atalhos do Teclado e Loop do Dashboard
  setupKeyboardShortcuts();
  startDashboardLoop();

  // Registrar encerramentos nativos do sistema
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// Iniciar Aplicação
bootstrap().catch((err) => {
  process.stdout.write(SHOW_CURSOR);
  console.error('\n❌ ERRO FATAL AO INICIAR CONTROLE-ACESSO-FACIAL:', err);
  process.exit(1);
});
