import { db } from './firebase';
import { ControlIdClient } from './ControlIdClient';
import { Logger } from './logger';
import { ControlIdCommand } from './types';

export class CommandProcessor {
  private client: ControlIdClient;

  constructor() {
    this.client = new ControlIdClient();
  }

  async processCommand(commandId: string, cmdData: any) {
    if (!db) return;
    
    const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
    const commandsCollection = `controlIdCommands${suffix}`;
    const docRef = db.collection(commandsCollection).doc(commandId);
    
    try {
      // 1. Transação atômica para travar o status 'pending'
      const pendingCmd = await db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(docRef);
        if (!docSnapshot.exists) {
          throw new Error('Comando não encontrado no Firestore.');
        }

        const data = docSnapshot.data() as ControlIdCommand;
        
        if (data.status !== 'pending') {
          return null; // Já processado por outro worker concorrente
        }

        // Marca como processando de forma atômica
        transaction.update(docRef, {
          status: 'processing',
          processingStartedAt: new Date().toISOString()
        });

        return data;
      });

      if (!pendingCmd) {
        Logger.info(`Comando ${commandId} já foi processado ou está em andamento. Ignorando.`);
        return;
      }

      Logger.info(`Adquirido bloqueio de transação para comando [${pendingCmd.type}] (ID: ${commandId})`);

      // 2. Executa fisicamente no iDFace
      try {

        let result: any;
        if (pendingCmd.type === 'unlock') {
          Logger.info(`Executando acionamento físico de liberação na catraca...`);
          const direction = (pendingCmd.direction as "clockwise" | "anticlockwise" | "both") || 'clockwise';
          result = await this.client.unlockTurnstile(direction);
          Logger.success(`Catraca física liberada com sucesso!`);
          
          // Atualiza comando no firestore
          await docRef.update({
            status: 'success',
            processedAt: new Date().toISOString(),
            result
          });

          // Registra na auditoria de logs
          await Logger.logToFirestore(
            'unlock',
            'success',
            'Catraca física liberada com sucesso pelo agente local.',
            commandId,
            result
          );
        } else if (pendingCmd.type === 'testConnection') {
          Logger.info(`Iniciando teste de conectividade com o hardware local...`);
          const testRes = await this.client.testConnection();
          
          if (testRes.online) {
            Logger.success(`Conexão com a iDFace verificada com sucesso!`);
            
            await docRef.update({
              status: 'success',
              processedAt: new Date().toISOString(),
              result: testRes.details
            });

            await Logger.logToFirestore(
              'testConnection',
              'success',
              'Conectividade local com a iDFace validada com sucesso pelo agente.',
              commandId,
              testRes.details
            );
          } else {
            throw new Error(testRes.message || 'Falha de comunicação.');
          }
        } else {
          throw new Error(`Comando desconhecido: ${pendingCmd.type}`);
        }
      } catch (err: any) {
        Logger.error(`Erro ao executar comando físico: ${err.message}`);
        
        await docRef.update({
          status: 'error',
          processedAt: new Date().toISOString(),
          error: err.message
        });

        await Logger.logToFirestore(
          pendingCmd.type,
          'error',
          `Falha física ao executar: ${err.message}`,
          commandId
        );
      }
    } catch (transactionErr: any) {
      Logger.error(`Falha na transação do comando ${commandId}: ${transactionErr.message}`);
    }
  }
}
