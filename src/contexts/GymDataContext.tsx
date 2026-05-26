import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, orderBy, limit, where, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';

interface GymDataContextType {
  students: any[];
  plans: any[];
  classes: any[];
  payments: any[];
  accessLogs: any[];
  attendance: any[];
  users: any[];
  settings: any;
  loading: boolean;
  error: Error | null;
}

const GymDataContext = createContext<GymDataContextType | undefined>(undefined);

export function GymDataProvider({ children }: { children: ReactNode }) {
  const { user, isEmployee, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isEmployee) {
      setStudents([]);
      setPlans([]);
      setClasses([]);
      setPayments([]);
      setAccessLogs([]);
      setSettings(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let collectionsLoaded = 0;
    const totalCollections = 8;

    const onInitialLoad = () => {
      collectionsLoaded++;
      if (collectionsLoaded >= totalCollections) {
        setLoading(false);
      }
    };

    // --- DATA LOADING (Stable Proxy + Optional Sync) ---
    const normalizeData = (data: any) => {
      if (!data) return data;
      const result = { ...data };
      for (const key in result) {
        const val = result[key];
        // Handle Firestore timestamps and ISO strings
        if (val && typeof val === 'object' && val.toDate && typeof val.toDate === 'function') {
          result[key] = val.toDate().toISOString();
        } else if (val && typeof val === 'object' && val._seconds) {
          result[key] = new Date(val._seconds * 1000).toISOString();
        }
      }
      return result;
    };

    const loadAllData = async () => {
      try {
        console.log('[GymData] Initializing direct client-side fetch (using getDocsFromServer)...');
        
        const fetchData = async (collectionName: string) => {
          try {
            const { getDocsFromServer, collection } = await import('firebase/firestore');
            const snap = await getDocsFromServer(collection(db, collectionName));
            const data = snap.docs.map(doc => ({ id: doc.id, ...normalizeData(doc.data()) }));
            console.log(`[GymData] Direct Loaded ${collectionName}: ${data.length}`);
            return data;
          } catch (e) {
            console.warn(`[GymData] Direct Load failed for ${collectionName}, trying proxy...`, e);
            try {
              const res = await fetch(`/api/${collectionName}/list`).catch(() => null);
              if (res && res.ok) {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  return (await res.json()).map(normalizeData);
                } else {
                  console.error(`[GymData] Proxy returned non-JSON: ${contentType}`);
                }
              }
            } catch (proxyErr) {
              console.error(`[GymData] Proxy fetch failed for ${collectionName}:`, proxyErr);
            }
            return [];
          }
        };

        const fetchSingleDoc = async (collectionName: string, docId: string) => {
          try {
            const { getDocFromServer, doc } = await import('firebase/firestore');
            const snap = await getDocFromServer(doc(db, collectionName, docId));
            if (snap.exists()) return normalizeData(snap.data());
            return null;
          } catch (e) {
            try {
              const res = await fetch(`/api/${collectionName}/${docId}`).catch(() => null);
              if (res && res.ok) {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  return normalizeData(await res.json());
                }
              }
            } catch (proxyErr) {
               console.error(`[GymData] Proxy single doc fetch failed:`, proxyErr);
            }
            return null;
          }
        };

        const [u, p, l, c, pay, att, s, std] = await Promise.all([
          fetchData('users'),
          fetchData('plans'),
          fetchData('accessLogs'),
          fetchData('classes'),
          fetchData('payments'),
          fetchData('attendance'),
          fetchSingleDoc('settings', 'global'),
          fetchData('students')
        ]);

        console.log(`[GymData] Load Finished. Students: ${std.length}, Plans: ${p.length}, Users: ${u.length}`);

        setUsers(u);
        setPlans(p);
        setAccessLogs(l);
        setClasses(c);
        setPayments(pay);
        setAttendance(att);
        setSettings(s);
        setStudents(std);

        if (u.length === 0 && std.length === 0) {
          console.warn('[GymData] Data loaded but appeared empty. Check database collections.');
        }

        setLoading(false);
      } catch (e: any) {
        console.error('Total data load failure.', e);
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      }
    };

    // Trigger full load
    loadAllData();

    // Silently disable onSnapshots logic to keep it simple but structure intact
    const unsubStudents = () => {};
    const unsubPlans = () => {};
    const unsubClasses = () => {};
    const unsubSettings = () => {};
    const unsubPayments = () => {};
    const unsubLogs = () => {};
    const unsubAttendance = () => {};
    const unsubUsers = () => {};

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    return () => {
      clearTimeout(timeout);
    };
  }, [user, isEmployee, authLoading]);

  // Removed throw error to prevent white screen of death
  // We handle errors gracefully via logs and empty states.

  return (
    <GymDataContext.Provider value={{ students, plans, classes, payments, accessLogs, attendance, users, settings, loading, error }}>
      {children}
    </GymDataContext.Provider>
  );
}

export function useGymDataContext() {
  const context = useContext(GymDataContext);
  if (context === undefined) {
    throw new Error('useGymDataContext must be used within a GymDataProvider');
  }
  return context;
}
