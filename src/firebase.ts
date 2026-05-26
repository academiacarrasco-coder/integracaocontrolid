import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc, initializeFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// --- SUPRESSÃO DE LOGS DE REDE DO FIREBASE ---
// O SDK às vezes ignora o LogLevel para erros de conexão. Interceptamos para limpar o console.
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  const msg = String(args[0] || '');
  if (msg.includes('@firebase/firestore') || msg.includes('code=unavailable') || (args[1] && String(args[1]).includes('code=unavailable'))) {
    return; 
  }
  originalError.apply(console, args);
};

console.warn = (...args) => {
  const msg = String(args[0] || '');
  if (msg.includes('@firebase/firestore') || msg.includes('WebChannelConnection') || msg.includes('transport errored')) {
    return;
  }
  originalWarn.apply(console, args);
};

setLogLevel('error');

const appConfig = {
  ...firebaseConfig,
  databaseId: firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId
};

const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId;

console.log('Firebase initialized with project:', firebaseConfig.projectId, 'Database:', dbId || 'default');

// Initialize Firestore with explicit settings to avoid Listen NOT_FOUND errors
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false, // Força sem detecção
}, dbId);

// Removed terminate/getFirestore imports as we use initFS now

// Removed diagnostics to reduce log noise
export const resetFirestore = async () => {
  // Utility for emergency use
};

export const auth = getAuth(app);

// Error handling for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  // Se for erro de conexão indisponível, logamos de forma suave
  if (errorMsg.includes('unavailable') || errorMsg.includes('offline')) {
    console.warn(`[Firestore Offline] ${operationType} em ${path}`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Removed testConnection to avoid extra Listen or getDoc calls on boot
export {};
