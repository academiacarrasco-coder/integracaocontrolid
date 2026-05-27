import * as os from 'os';
import { db, admin } from './firebase';
import { Logger } from './logger';
import { ControlIdClient } from './ControlIdClient';
import { CommandProcessor } from './commandProcessor';
import { CarrascoStudentStatusProvider } from './studentStatus';
import { LocalServer } from './localServer';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Suporta Node v18+ que usa 'IPv4' e versões anteriores
      const family = String(iface.family);
      if ((family === 'IPv4' || family === '4') && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function bootstrap() {
  if (!db) {
    Logger.error('Firebase Firestore não inicializado. O Agente Local será encerrado.');
    process.exit(1);
  }

  const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
  const COMMANDS_COLLECTION = `controlIdCommands${suffix}`;
  const DEVICES_COLLECTION = `controlIdDevices${suffix}`;

  Logger.info('========================================================');
  Logger.info('   INICIANDO AGENTE LOCAL CONTROL ID — CARRASCO FIT');
  Logger.info(`   Ambiente / Sufixo das coleções: "${suffix || '(produção)'}"`);
  Logger.info('========================================================');

  const client = new ControlIdClient();
  const processor = new CommandProcessor();

  // 1. Inicializa o provedor de status e o servidor local
  const provider = new CarrascoStudentStatusProvider();
  const localPort = parseInt(process.env.AGENT_PORT || '8000');
  const localServer = new LocalServer(localPort, provider);

  // Executa sincronização inicial do cache de alunos em disco
  Logger.info('Baixando dados de alunos e planos para o cache offline local...');
  await provider.syncLocalCache();

  // Inicializa o servidor HTTP de escuta da catraca
  localServer.start();

  // Configura IP e porta para provisionamento do push na catraca
  const agentIp = process.env.AGENT_IP || getLocalIpAddress();
  Logger.info(`IP do Agente Local detectado para pareamento da catraca: ${agentIp}`);

  // 2. Seeding inicial do dispositivo no Firestore se não existir
  const deviceRef = db.collection(DEVICES_COLLECTION).doc('iface-principal');
  try {
    const docSnapshot = await deviceRef.get();
    if (!docSnapshot.exists) {
      Logger.warn(`Dispositivo "iface-principal" não encontrado no Firestore (${DEVICES_COLLECTION}). Criando semeamento inicial...`);
      await deviceRef.set({
        id: 'iface-principal',
        name: 'iDFace Principal',
        model: 'iDFace',
        ip: process.env.CONTROLID_IP || '192.168.1.100',
        port: parseInt(process.env.CONTROLID_PORT || '443'),
        protocol: process.env.CONTROLID_PROTOCOL || 'https',
        status: 'unknown',
        lastSeenAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      Logger.success('Semeamento do dispositivo concluído com sucesso!');
    }
  } catch (err: any) {
    Logger.error(`Erro ao verificar semeamento inicial: ${err.message}`);
  }

  // 3. Ouvindo a fila de comandos em tempo real
  Logger.info(`Subscrevendo-se à fila de comandos ${COMMANDS_COLLECTION} no Firestore...`);
  const unsubscribeCommands = db.collection(COMMANDS_COLLECTION)
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) return;

      snapshot.docs.forEach((doc) => {
        const commandId = doc.id;
        const cmdData = doc.data();
        Logger.info(`Comando pendente identificado na fila: [${cmdData.type}] (ID: ${commandId})`);
        // Dispara processamento em background seguro com transação atômica
        processor.processCommand(commandId, cmdData);
      });
    }, (error) => {
      Logger.error(`Erro na escuta da coleção controlIdCommands: ${error.message}`);
    });

  // 4. Batimento Cardíaco (Heartbeat) - Executado a cada 10 segundos
  let isCheckingHeartbeat = false;
  let lastStatus: 'online' | 'offline' | 'unknown' = 'unknown';
  let isPushConfigured = false;

  const runHeartbeat = async () => {
    if (isCheckingHeartbeat) return;
    isCheckingHeartbeat = true;

    try {
      const pingRes = await client.testConnection();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      if (pingRes.online) {
        const info = pingRes.details || {};
        
        // Mapeia estatísticas para um objeto limpo com porcentagens de RAM e disco
        const ramPercent = info.memory ? Math.round((parseInt(info.memory.used || '0') / parseInt(info.memory.total || '1')) * 100) : 0;
        const diskPercent = info.disk ? Math.round((parseInt(info.disk.used || '0') / parseInt(info.disk.total || '1')) * 100) : 0;

        await deviceRef.update({
          status: 'online',
          lastSeenAt: timestamp,
          updatedAt: timestamp,
          details: {
            serial: info.serial || 'Desconhecido',
            version: info.version || 'Desconhecido',
            model: info.model || 'iDFace',
            ram: ramPercent,
            disk: diskPercent
          }
        });

        // Configura ou reconfigura as regras de push na catraca quando ela entra online
        if (!isPushConfigured || lastStatus !== 'online') {
          const success = await client.configurePushNotification(agentIp, localPort);
          if (success) {
            isPushConfigured = true;
          }
        }

        if (lastStatus !== 'online') {
          Logger.success(`Catraca física iDFace está ONLINE! Conexão local estabelecida.`);
          await Logger.logToFirestore(
            'system',
            'info',
            'Comunicação local restabelecida: iDFace está ONLINE e respondendo.'
          );
          lastStatus = 'online';
        }
      } else {
        await deviceRef.update({
          status: 'offline',
          updatedAt: timestamp
        });

        if (lastStatus !== 'offline') {
          Logger.warn(`Aviso: Conexão física com a iDFace falhou. Equipamento offline.`);
          await Logger.logToFirestore(
            'system',
            'error',
            `Equipamento local offline: ${pingRes.message || 'Timeout de comunicação local.'}`
          );
          lastStatus = 'offline';
          isPushConfigured = false; // Permite reconfigurar quando voltar
        }
      }
    } catch (err: any) {
      Logger.error(`Erro na execução do heartbeat: ${err.message}`);
    } finally {
      isCheckingHeartbeat = false;
    }
  };

  // Roda heartbeat imediatamente no boot
  await runHeartbeat();

  // Executa batimentos periódicos a cada 10 segundos
  const heartbeatInterval = setInterval(runHeartbeat, 10000);

  // 5. Agendadores Periódicos de Sincronização de Dados
  // A. Atualiza o cache local de alunos a cada 5 minutos
  const cacheSyncInterval = setInterval(async () => {
    await provider.syncLocalCache();
  }, 5 * 60 * 1000);

  // B. Envia logs salvos offline para a nuvem a cada 30 segundos
  const logsSyncInterval = setInterval(async () => {
    await localServer.syncOfflineLogs();
  }, 30 * 1000);

  // 6. Desligamento Limpo (Graceful Shutdown)
  const shutdown = () => {
    Logger.warn('\nEncerrando Agente Local de forma limpa...');
    clearInterval(heartbeatInterval);
    clearInterval(cacheSyncInterval);
    clearInterval(logsSyncInterval);
    localServer.stop();
    unsubscribeCommands();
    Logger.info('Subscrições do Firestore encerradas. Até mais!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  Logger.error('Erro fatal na execução do boot do Agente Local:', err);
});
