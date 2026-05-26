import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Carrega variáveis do arquivo .env
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';

let db: admin.firestore.Firestore | null = null;

try {
  const absolutePath = path.resolve(process.cwd(), credentialsPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`\x1b[31m[FIREBASE-INIT-ERROR] Arquivo de credenciais não encontrado em: ${absolutePath}\x1b[0m`);
    console.error(`\x1b[33mPor favor, coloque o seu arquivo service-account.json na raiz do agente ou corrija a variável GOOGLE_APPLICATION_CREDENTIALS no .env.\x1b[0m`);
  } else {
    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id
    });
    
    const databaseId = process.env.FIREBASE_DATABASE_ID || 'carrasco-data-final';
    db = getFirestore(app, databaseId);
    console.log(`\x1b[32m[FIREBASE-SUCCESS] Firebase Admin SDK inicializado para o projeto: ${projectId || serviceAccount.project_id} (banco: ${databaseId})\x1b[0m`);
  }
} catch (err: any) {
  console.error(`\x1b[31m[FIREBASE-INIT-CRITICAL] Falha crítica ao carregar Firebase Admin SDK:\x1b[0m`, err.message);
}

export { db };
export { admin };
