import * as fs from 'fs';
import * as path from 'path';
import { db } from './firebase';
import { Logger } from './logger';

export type StudentAccessStatus = {
  studentId: string;
  name?: string;
  isActive: boolean;
  isFinanciallyOk: boolean;
  isBlocked: boolean;
  blockReason?: string;
  validUntil?: string;
  source: "external_api" | "firebase_cache" | "local_cache";
  checkedAt: string;
};

export interface StudentStatusProvider {
  findByCredential(input: {
    credentialType: "face" | "qr_code" | "card" | "password";
    credentialValue: string;
    deviceId: string;
  }): Promise<StudentAccessStatus | null>;
  syncLocalCache(): Promise<void>;
}

// Representação interna simplificada dos alunos no cache JSON local
interface CachedStudent {
  id: string;
  name: string;
  status: string; // 'active' | 'inactive'
  turnstileId?: number;
  rfid?: string;
  cardNumber?: string;
  qrCode?: string;
  pin?: string;
  password?: string;
  isBlocked?: boolean;
  blockReason?: string;
  planIds?: string[];
  planExpirations?: Record<string, string>; // planId -> yyyy-MM-dd
}

interface CachedPlan {
  id: string;
  name: string;
  isCorporate?: boolean;
}

export class CarrascoStudentStatusProvider implements StudentStatusProvider {
  private cacheFilePath: string;

  constructor() {
    this.cacheFilePath = path.join(process.cwd(), 'local-students.json');
  }

  // Gera ID Numérico a partir da String UID (Garante alinhamento estrito com o frontend)
  private getNumericId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100000000;
  }

  // Processa a validação das regras de negócios de acesso do aluno
  private evaluateAccessRules(
    student: CachedStudent,
    plans: CachedPlan[],
    source: "external_api" | "local_cache"
  ): StudentAccessStatus {
    const today = new Date().toISOString().split('T')[0]; // yyyy-MM-dd
    
    // 1. Verificação de Bloqueio Administrativo Manual
    if (student.isBlocked) {
      return {
        studentId: student.id,
        name: student.name,
        isActive: false,
        isFinanciallyOk: false,
        isBlocked: true,
        blockReason: student.blockReason || 'Bloqueio administrativo manual.',
        source,
        checkedAt: new Date().toISOString()
      };
    }

    // 2. Verificação de Status do Cadastro Geral
    if (student.status !== 'active') {
      return {
        studentId: student.id,
        name: student.name,
        isActive: false,
        isFinanciallyOk: false,
        isBlocked: false,
        blockReason: 'Cadastro inativo no sistema.',
        source,
        checkedAt: new Date().toISOString()
      };
    }

    // 3. Verificação de Planos e Vencimentos Financeiros
    const studentPlanIds = student.planIds || [];
    const expirations = student.planExpirations || {};
    
    let hasValidPlan = false;
    let maxExpiration: string | null = null;

    for (const planId of studentPlanIds) {
      const plan = plans.find(p => p.id === planId);
      const expirationDate = expirations[planId];

      if (plan?.isCorporate) {
        // Planos corporativos são válidos por padrão/bypass
        hasValidPlan = true;
        maxExpiration = '2099-12-31';
        break;
      }

      if (expirationDate) {
        if (!maxExpiration || expirationDate > maxExpiration) {
          maxExpiration = expirationDate;
        }
        if (expirationDate >= today) {
          hasValidPlan = true;
        }
      }
    }

    if (!hasValidPlan) {
      return {
        studentId: student.id,
        name: student.name,
        isActive: false,
        isFinanciallyOk: false,
        isBlocked: false,
        blockReason: maxExpiration 
          ? `Plano vencido em: ${maxExpiration}. Regularize na recepção.`
          : 'Nenhum plano ativo vinculado ao cadastro.',
        validUntil: maxExpiration || undefined,
        source,
        checkedAt: new Date().toISOString()
      };
    }

    // 4. Acesso Autorizado!
    return {
      studentId: student.id,
      name: student.name,
      isActive: true,
      isFinanciallyOk: true,
      isBlocked: false,
      validUntil: maxExpiration || undefined,
      source,
      checkedAt: new Date().toISOString()
    };
  }

  // Busca de Aluno por Credencial (Comportamento Resiliente Híbrido)
  async findByCredential(input: {
    credentialType: "face" | "qr_code" | "card" | "password";
    credentialValue: string;
    deviceId: string;
  }): Promise<StudentAccessStatus | null> {
    const { credentialType, credentialValue } = input;
    
    Logger.info(`[StudentStatusProvider] Buscando credencial [${credentialType}]: "${credentialValue}"`);

    // --- TENTATIVA 1: CONSULTA EM TEMPO REAL FIRESTORE (ONLINE) ---
    if (db) {
      try {
        const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
        const studentsCollection = `students${suffix}`;
        const plansCollection = `plans${suffix}`;
        
        let studentDocSnapshot: any = null;

        // Formula as queries dinâmicas baseadas no tipo de credencial
        if (credentialType === 'card') {
          // Busca por RFID
          const query1 = await db.collection(studentsCollection).where('rfid', '==', credentialValue).limit(1).get();
          if (!query1.empty) studentDocSnapshot = query1.docs[0];
          
          if (!studentDocSnapshot) {
            const query2 = await db.collection(studentsCollection).where('cardNumber', '==', credentialValue).limit(1).get();
            if (!query2.empty) studentDocSnapshot = query2.docs[0];
          }
        } else if (credentialType === 'qr_code') {
          // Busca por QR Code ou ID exato do Firestore
          const query1 = await db.collection(studentsCollection).where('qrCode', '==', credentialValue).limit(1).get();
          if (!query1.empty) studentDocSnapshot = query1.docs[0];
          
          if (!studentDocSnapshot) {
            // Tentativa de buscar diretamente pelo ID exato da string Firebase
            const directDoc = await db.collection(studentsCollection).doc(credentialValue).get();
            if (directDoc.exists) studentDocSnapshot = directDoc;
          }
        } else if (credentialType === 'password') {
          // Busca por Senha/PIN
          const query1 = await db.collection(studentsCollection).where('pin', '==', credentialValue).limit(1).get();
          if (!query1.empty) studentDocSnapshot = query1.docs[0];
          
          if (!studentDocSnapshot) {
            const query2 = await db.collection(studentsCollection).where('password', '==', credentialValue).limit(1).get();
            if (!query2.empty) studentDocSnapshot = query2.docs[0];
          }
        } else if (credentialType === 'face') {
          // Busca por biometria facial. A catraca retorna o ID numérico associado.
          const numericVal = parseInt(credentialValue);
          if (!isNaN(numericVal)) {
            const query = await db.collection(studentsCollection).where('turnstileId', '==', numericVal).limit(1).get();
            if (!query.empty) studentDocSnapshot = query.docs[0];
          }
          
          if (!studentDocSnapshot) {
            // Fallback para ID string puro
            const directDoc = await db.collection(studentsCollection).doc(credentialValue).get();
            if (directDoc.exists) studentDocSnapshot = directDoc;
          }
        }

        if (studentDocSnapshot) {
          const studentData = studentDocSnapshot.data() as CachedStudent;
          studentData.id = studentDocSnapshot.id;

          // Busca todos os planos associados do aluno no Firestore
          const studentPlanIds = studentData.planIds || (studentData.planIds ? [studentData.planIds] : []) as any;
          const plansList: CachedPlan[] = [];

          if (studentPlanIds.length > 0) {
            for (const planId of studentPlanIds) {
              try {
                const planDoc = await db.collection(plansCollection).doc(planId).get();
                if (planDoc.exists) {
                  const pData = planDoc.data() as CachedPlan;
                  plansList.push({
                    id: planDoc.id,
                    name: pData.name,
                    isCorporate: pData.isCorporate || false
                  });
                }
              } catch (planErr) {}
            }
          }

          Logger.success(`[StudentStatusProvider][ONLINE] Aluno localizado: "${studentData.name}"`);
          return this.evaluateAccessRules(studentData, plansList, "external_api");
        }

        Logger.warn(`[StudentStatusProvider][ONLINE] Nenhuma credencial correspondente localizada.`);
        return null;
      } catch (err: any) {
        Logger.error(`[StudentStatusProvider][ONLINE-FAIL] Falha ao consultar o Firestore. Acionando Fallback Offline: ${err.message}`);
      }
    }

    // --- TENTATIVA 2: CONSULTA NO CACHE LOCAL EM DISCO (OFFLINE) ---
    return this.findInLocalCache(credentialType, credentialValue);
  }

  // Realiza a busca linear no cache de arquivo JSON local offline
  private findInLocalCache(
    credentialType: "face" | "qr_code" | "card" | "password",
    credentialValue: string
  ): StudentAccessStatus | null {
    if (!fs.existsSync(this.cacheFilePath)) {
      Logger.error(`[StudentStatusProvider][OFFLINE-FAIL] Arquivo de cache offline nao encontrado em: ${this.cacheFilePath}`);
      return null;
    }

    try {
      const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
      const cachedStudents = (cacheData.students || []) as CachedStudent[];
      const cachedPlans = (cacheData.plans || []) as CachedPlan[];

      Logger.info(`[StudentStatusProvider][OFFLINE] Pesquisando credencial no cache local (${cachedStudents.length} alunos)...`);

      let foundStudent: CachedStudent | undefined;

      if (credentialType === 'card') {
        foundStudent = cachedStudents.find(s => s.rfid === credentialValue || s.cardNumber === credentialValue);
      } else if (credentialType === 'qr_code') {
        foundStudent = cachedStudents.find(s => s.qrCode === credentialValue || s.id === credentialValue);
      } else if (credentialType === 'password') {
        foundStudent = cachedStudents.find(s => s.pin === credentialValue || s.password === credentialValue);
      } else if (credentialType === 'face') {
        const numericVal = parseInt(credentialValue);
        if (!isNaN(numericVal)) {
          foundStudent = cachedStudents.find(s => s.turnstileId === numericVal);
        }
        if (!foundStudent) {
          foundStudent = cachedStudents.find(s => s.id === credentialValue);
        }
      }

      if (foundStudent) {
        Logger.success(`[StudentStatusProvider][OFFLINE-CACHE-HIT] Aluno localizado offline: "${foundStudent.name}"`);
        return this.evaluateAccessRules(foundStudent, cachedPlans, "local_cache");
      }

      Logger.warn(`[StudentStatusProvider][OFFLINE-CACHE-MISS] Nenhuma credencial localizada offline.`);
      return null;
    } catch (err: any) {
      Logger.error(`[StudentStatusProvider][OFFLINE-CRITICAL] Falha catastrófica ao processar arquivo de cache JSON: ${err.message}`);
      return null;
    }
  }

  // Sincroniza em disco todos os cadastros e planos de alunos a partir do Firestore
  async syncLocalCache(): Promise<void> {
    if (!db) {
      Logger.error('[StudentStatusProvider][SYNC-FAIL] Firestore desativado ou sem conexão de rede. Abortando sync de cache.');
      return;
    }

    try {
      const suffix = process.env.FIREBASE_ENV_SUFFIX || '';
      const studentsCollection = `students${suffix}`;
      const plansCollection = `plans${suffix}`;

      Logger.info('[StudentStatusProvider][SYNC] Iniciando sincronização em lote do cache local...');

      // 1. Coleta todos os Alunos do Firestore
      const studentsSnapshot = await db.collection(studentsCollection).get();
      const students: CachedStudent[] = [];

      studentsSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Garante que todo aluno tenha um turnstileId numérico para suporte a faces
        const turnstileId = data.turnstileId || this.getNumericId(doc.id);

        students.push({
          id: doc.id,
          name: data.name || 'Sem Nome',
          status: data.status || 'inactive',
          turnstileId,
          rfid: data.rfid || undefined,
          cardNumber: data.cardNumber || undefined,
          qrCode: data.qrCode || undefined,
          pin: data.pin || undefined,
          password: data.password || undefined,
          isBlocked: data.isBlocked || false,
          blockReason: data.blockReason || undefined,
          planIds: data.planIds || (data.planId ? [data.planId] : []),
          planExpirations: data.planExpirations || {}
        });
      });

      // 2. Coleta todos os Planos do Firestore
      const plansSnapshot = await db.collection(plansCollection).get();
      const plans: CachedPlan[] = [];

      plansSnapshot.forEach((doc) => {
        const data = doc.data();
        plans.push({
          id: doc.id,
          name: data.name || 'Sem Nome',
          isCorporate: data.isCorporate || false
        });
      });

      // 3. Grava no cache estruturado JSON
      const payload = {
        synchronizedAt: new Date().toISOString(),
        students,
        plans
      };

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(payload, null, 2), 'utf8');
      Logger.success(`[StudentStatusProvider][SYNC-SUCCESS] Cache offline local gravado com sucesso! (${students.length} alunos | ${plans.length} planos)`);
    } catch (err: any) {
      Logger.error(`[StudentStatusProvider][SYNC-CRITICAL-ERR] Falha ao sincronizar Firestore para cache local: ${err.message}`);
    }
  }
}
