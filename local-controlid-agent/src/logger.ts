import { db } from './firebase';
import { ControlIdLog } from './types';

export class Logger {
  private static getTimestamp(): string {
    return new Date().toLocaleTimeString('pt-BR');
  }

  static info(message: string, ...args: any[]) {
    console.log(`\x1b[36m[INFO][${this.getTimestamp()}]\x1b[0m ${message}`, ...args);
  }

  static success(message: string, ...args: any[]) {
    console.log(`\x1b[32m[SUCCESS][${this.getTimestamp()}]\x1b[0m ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.log(`\x1b[33m[WARN][${this.getTimestamp()}]\x1b[0m ${message}`, ...args);
  }

  static error(message: string, error?: any, ...args: any[]) {
    console.error(`\x1b[31m[ERROR][${this.getTimestamp()}]\x1b[0m ${message}`, ...args);
    if (error) {
      console.error(`\x1b[90m`, error, `\x1b[0m`);
    }
  }

  static async logToFirestore(
    type: "testConnection" | "unlock" | "system",
    status: "success" | "error" | "info",
    message: string,
    commandId?: string,
    raw?: any
  ) {
    try {
      if (!db) return;
      
      const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
      const logsCollection = `controlIdLogs${suffix}`;
      
      const logData: ControlIdLog = {
        deviceId: 'iface-principal',
        commandId: commandId || null,
        type,
        status,
        message,
        createdAt: new Date().toISOString(),
        raw: raw || null
      };
      await db.collection(logsCollection).add(logData);
    } catch (err: any) {
      console.error(`\x1b[31m[LOGGER-FIRESTORE-ERR] Não foi possível persistir o log no Firestore:\x1b[0m`, err.message);
    }
  }
}
