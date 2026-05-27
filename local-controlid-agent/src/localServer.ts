import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { db, admin } from './firebase';
import { Logger } from './logger';
import { StudentStatusProvider, StudentAccessStatus } from './studentStatus';

export interface OfflineLog {
  studentId: string;
  name: string;
  timestamp: string;
  type: 'entry' | 'exit';
  status: 'success' | 'denied';
  reason?: string;
}

export class LocalServer {
  private server: http.Server | null = null;
  private port: number;
  private statusProvider: StudentStatusProvider;
  private offlineLogsPath: string;

  constructor(port: number, statusProvider: StudentStatusProvider) {
    this.port = port;
    this.statusProvider = statusProvider;
    this.offlineLogsPath = path.join(process.cwd(), 'offline-logs.json');
  }

  // Inicia o servidor HTTP nativo
  start(): void {
    this.server = http.createServer((req, res) => {
      const url = req.url || '';
      const method = req.method || 'GET';

      // Configura Headers Padrões contra CORS e Cache
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Connection', 'close');

      // Intercepta requisições OPTIONS (Pre-flight CORS)
      if (method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
      }

      // Endpoint 1: Ping / Diagnóstico Simples
      if (url === '/ping' || url === '/api/ping' || url === '/api/diag/status') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: "OK", server: "Carrasco Fit Local Agent", time: new Date().toISOString() }));
        return;
      }

      // Endpoint 2: Recebimento de Eventos / Remote Authorization (Push)
      if ((url.startsWith('/push') || url.startsWith('/api/push') || url.startsWith('/api/diag/hardware/push')) && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            
            // Log do payload bruto recebido da catraca
            Logger.info(`[LocalServer] Push recebido da catraca:`, JSON.stringify(payload));

            // Extrai a credencial baseada na estrutura de payload do Control iD
            let credentialType: "face" | "qr_code" | "card" | "password" = "face";
            let credentialValue = "";

            if (payload.user_id && !payload.identifier) {
              // Reconhecimento Facial / ID de Usuário numérico
              credentialType = "face";
              credentialValue = String(payload.user_id);
            } else if (payload.identifier) {
              // Leitor de Cartão RFID ou QR Code
              credentialValue = String(payload.identifier);
              
              // Se tiver menos de 7 caracteres numéricos, costuma ser QR Code ou matrícula digitada, caso contrário RFID
              const isOnlyDigits = /^\d+$/.test(credentialValue);
              if (isOnlyDigits && credentialValue.length > 5 && credentialValue.length < 10) {
                credentialType = "qr_code";
              } else {
                credentialType = "card";
              }
            } else if (payload.card_val) {
              // Formato alternativo de cartão
              credentialType = "card";
              credentialValue = String(payload.card_val);
            } else if (payload.password || payload.pin) {
              // PIN / Senha digitada no teclado
              credentialType = "password";
              credentialValue = String(payload.password || payload.pin);
            } else {
              // Evento genérico ou ping da catraca sem leitura física de cartão/rosto
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: "Keep-alive recebido" }));
              return;
            }

            // Invoca a verificação de status do aluno
            const accessStatus = await this.statusProvider.findByCredential({
              credentialType,
              credentialValue,
              deviceId: 'iface-principal'
            });

            // Resposta JSON para a catraca física Control iD
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');

            const releaseAction = process.env.CONTROLID_RELEASE_ACTION || 'sec_box';
            
            if (accessStatus && accessStatus.isActive) {
              // --- ALUNO AUTORIZADO ---
              Logger.success(`[LocalServer] ACESSO LIBERADO: "${accessStatus.name}" (${accessStatus.studentId})`);
              
              let responseBody = {};
              if (releaseAction === 'catra') {
                responseBody = {
                  action: "catra",
                  parameters: "allow=clockwise" // Libera rotação horário
                };
              } else {
                responseBody = {
                  action: "sec_box", // Destrava caixa de acionamento externa (iDFace)
                  parameters: ""
                };
              }

              res.end(JSON.stringify(responseBody));

              // Registra o log de sucesso
              await this.logAccess(accessStatus.studentId, accessStatus.name || 'Aluno', 'entry', 'success');
            } else {
              // --- ALUNO REJEITADO / NEGADO ---
              const reason = accessStatus?.blockReason || 'Credencial não cadastrada.';
              const studentName = accessStatus?.name || 'Não Identificado';
              Logger.warn(`[LocalServer] ACESSO NEGADO: "${studentName}" - Motivo: ${reason}`);

              // Responde com action 'none' para exibir a negação visual no painel do leitor
              res.end(JSON.stringify({
                action: "none",
                parameters: ""
              }));

              // Registra o log de negação
              if (accessStatus) {
                await this.logAccess(accessStatus.studentId, studentName, 'entry', 'denied', reason);
              } else {
                // Log de credencial completamente desconhecida
                await this.logAccess('unknown', `Desconhecido (Credencial: ${credentialValue})`, 'entry', 'denied', reason);
              }
            }

          } catch (err: any) {
            Logger.error(`[LocalServer] Erro crítico ao processar requisição do hardware:`, err.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Erro interno no servidor do agente." }));
          }
        });
        return;
      }

      // Endpoint 3: Rota padrão 404
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: "Rota não encontrada." }));
    });

    this.server.listen(this.port, () => {
      Logger.success(`[LocalServer] Servidor HTTP do Agente Local ouvindo na porta: ${this.port}`);
      Logger.info(`[LocalServer] Configure a catraca com o Push URL: http://<IP_DO_COMPUTADOR>:${this.port}/push`);
    });
  }

  // Encerra o servidor
  stop(): void {
    if (this.server) {
      this.server.close();
      Logger.warn('[LocalServer] Servidor HTTP do Agente encerrado.');
    }
  }

  // Registra o log de acesso de forma híbrida (Firestore ou offline JSON)
  private async logAccess(
    studentId: string,
    name: string,
    type: 'entry' | 'exit',
    status: 'success' | 'denied',
    reason?: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    if (db) {
      try {
        const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
        const accessLogsCollection = `accessLogs${suffix}`;

        // Envia imediatamente para o Firestore em nuvem
        await db.collection(accessLogsCollection).add({
          studentId,
          studentName: name,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          type,
          status,
          reason: reason || null,
          source: 'local_agent'
        });
        
        Logger.info(`[LocalServer][Log] Registro de acesso enviado com sucesso para a nuvem.`);
        return;
      } catch (err: any) {
        Logger.error(`[LocalServer][Log] Falha ao enviar log para a nuvem. Enfileirando localmente: ${err.message}`);
      }
    }

    // --- FALLBACK: Gravação local em arquivo JSON offline ---
    try {
      let logs: OfflineLog[] = [];
      if (fs.existsSync(this.offlineLogsPath)) {
        const fileContent = fs.readFileSync(this.offlineLogsPath, 'utf8');
        logs = JSON.parse(fileContent);
      }

      logs.push({
        studentId,
        name,
        timestamp,
        type,
        status,
        reason
      });

      fs.writeFileSync(this.offlineLogsPath, JSON.stringify(logs, null, 2), 'utf8');
      Logger.warn(`[LocalServer][OfflineLog] Acesso de "${name}" salvo localmente no buffer offline. Total acumulado: ${logs.length}`);
    } catch (err: any) {
      Logger.error(`[LocalServer][OfflineLog-Error] Falha ao salvar log em disco local: ${err.message}`);
    }
  }

  // Envia em lote todos os logs offline acumulados para a nuvem quando a conexão voltar
  async syncOfflineLogs(): Promise<void> {
    if (!db) return;
    if (!fs.existsSync(this.offlineLogsPath)) return;

    try {
      const fileContent = fs.readFileSync(this.offlineLogsPath, 'utf8');
      const logs: OfflineLog[] = JSON.parse(fileContent);

      if (logs.length === 0) return;

      Logger.info(`[LocalServer][LogSync] Conexão restabelecida! Sincronizando ${logs.length} logs offline com a nuvem...`);

      const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
      const accessLogsCollection = `accessLogs${suffix}`;

      // Envia em lotes usando Batch para performance e segurança
      const batch = db.batch();
      
      for (const log of logs) {
        const docRef = db.collection(accessLogsCollection).doc();
        batch.set(docRef, {
          studentId: log.studentId,
          studentName: log.name,
          timestamp: admin.firestore.Timestamp.fromDate(new Date(log.timestamp)),
          type: log.type,
          status: log.status,
          reason: log.reason || null,
          source: 'local_agent_offline_sync'
        });
      }

      await batch.commit();
      
      // Limpa o arquivo local de logs offline com sucesso
      fs.unlinkSync(this.offlineLogsPath);
      Logger.success(`[LocalServer][LogSync] Sincronização em lote finalizada! ${logs.length} logs importados para a nuvem.`);
    } catch (err: any) {
      Logger.error(`[LocalServer][LogSync-Fail] Falha ao processar sincronização de logs: ${err.message}`);
    }
  }
}
