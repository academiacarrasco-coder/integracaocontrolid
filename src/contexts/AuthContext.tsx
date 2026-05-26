import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, User, signOut, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email?: string;
  username?: string;
  password?: string;
  displayName: string;
  role: 'admin' | 'employee';
  jobTitle?: string;
  phone?: string;
  cpf?: string;
  photoURL: string;
  status?: 'active' | 'pending';
  isProfessor?: boolean;
  permissions?: string[];
  webhookUrl?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  masterProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isAdminVerified: boolean;
  isEmployee: boolean;
  isUnauthorized: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  loginEmployee: (username: string, password: string) => Promise<boolean>;
  logoutEmployee: () => void;
  verifyAdmin: (password: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  serverStatus: { status: string; error: string; projectId: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [masterProfile, setMasterProfile] = useState<UserProfile | null>(null);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ status: string; error: string; projectId: string } | null>(null);

  const fetchWithFallback = async (path: string, options?: RequestInit) => {
    const urls = [
      path,
      `https://carrasco-fit-607856914066.us-east1.run.app${path}`
    ];
    
    for (const url of urls) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
      } catch (e) {
        console.warn(`Fetch fallback fail for ${url}:`, e);
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetchWithFallback('/api/diag/status', { mode: 'cors', credentials: 'omit' });
      if (res) {
        const data = await res.json();
        if (data?.database) {
          setServerStatus(data.database);
          return;
        }
      }
      setServerStatus({ status: 'Indisponível', error: 'Falha total na conexão', projectId: 'N/A' });
    };

    fetchStatus();

    // We no longer load from localStorage to ensure password is requested on every refresh
    setIsVerified(false);
  }, []);

  useEffect(() => {
    // Safety timeout to prevent infinite loading
    const safetyTimer = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('Auth loading safety timeout hit');
        return false;
      });
    }, 8000);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth State Changed:', firebaseUser?.email || 'No user');
      clearTimeout(safetyTimer);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);
      setIsUnauthorized(false);
      
      if (firebaseUser) {
        setIsVerified(true); // Se logou via Firebase (Google), já está verificado
      }
      
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          let userData: UserProfile | null = null;
          
          // --- TENTATIVA 1: Firestore Direto (Rápido se funcionar) ---
          try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) userData = docSnap.data() as UserProfile;
          } catch (e) {
            console.warn('Firestore direto offline, tentando Proxy...');
          }

          // --- TENTATIVA 2: Server API (Fallback robusto) ---
          if (!userData) {
            try {
              const res = await fetchWithFallback(`/api/users/profile/${firebaseUser.uid}`);
              if (res && res.ok) userData = await res.json();
            } catch (e) {
              console.error('Server API Fallback falhou também.');
            }
          }

          // --- TENTATIVA 3: Fallback de Emergência (Para Admin) ---
          if (!userData && firebaseUser.email === 'academiacarrasco@gmail.com') {
            userData = { 
              uid: firebaseUser.uid, 
              email: firebaseUser.email || '', 
              displayName: 'Admin Carrasco', 
              role: 'admin', 
              photoURL: firebaseUser.photoURL || '',
              status: 'active' 
            };
          }

          if (userData) {
            setMasterProfile(userData);
            if (!activeProfile) setActiveProfile(userData);
            setLoading(false);
          } else {
            // Se realmente não achou nada, tenta buscar por e-mail antes de desistir
            try {
              const res = await fetchWithFallback(`/api/users/profile/by-email?email=${firebaseUser.email}`);
              if (res && res.ok) {
                userData = await res.json();
                if (userData) {
                   setMasterProfile(userData);
                   setActiveProfile(userData);
                   setLoading(false);
                   return;
                }
              }
            } catch (e) {
              console.warn('Busca por e-mail falhou.');
            }

            if (firebaseUser.email === 'academiacarrasco@gmail.com') {
              const masterAdmin = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: 'Admin Carrasco',
                photoURL: '',
                role: 'admin' as const,
                status: 'active' as const
              };
              setMasterProfile(masterAdmin);
              setActiveProfile(masterAdmin);
              setLoading(false);
              console.log('[Auth] Master Admin bypass active');
            } else {
              setIsUnauthorized(true);
              setLoading(false);
            }
          }
        } else {
          setMasterProfile(null);
          setActiveProfile(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error in onAuthStateChanged:', err);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const cleanUsername = username?.trim();
      const cleanPassword = password?.trim();
      
      // Detecção de URL base para quando o app está no Vercel chamando o Cloud Run
      let apiUrl = (import.meta as any).env?.VITE_API_URL || '';
      
      // Se estiver no Vercel e não tiver API_URL configurada, tenta usar o link direto do Google Cloud
      if (!apiUrl && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('github.io'))) {
        apiUrl = 'https://carrasco-fit-607856914066.us-east1.run.app';
      }
      
      console.log('Login attempt at:', apiUrl ? apiUrl : 'Local Server');
      
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
      }).catch((e) => {
        console.error('Fetch error during login:', e);
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou se o endereço da API está correto.');
      });

      if (response && response.ok) {
        const { token, profile: userProfile } = await response.json();
        console.log('Login API success, profile:', userProfile);
        try {
          if (!auth) throw new Error('Firebase Auth não inicializado');
          
          if (token && token !== "emergency-local-token") {
            try {
              await signInWithCustomToken(auth, token);
              console.log('Firebase Auth success');
            } catch (authErr: any) {
              console.error('Firebase Auth error (non-blocking):', authErr);
              // Não bloqueamos se o domínio não estiver autorizado, usamos o modo de emergência
              if (authErr.code === 'auth/unauthorized-domain') {
                 console.warn('Domínio não autorizado no Firebase. Continuando em modo local.');
              }
            }
          } else {
            console.warn('Usando token de emergência local ou token ausente');
          }
          
          if (userProfile) {
            setActiveProfile(userProfile);
            setIsVerified(true);
            return true;
          }
          throw new Error('Perfil de usuário não retornado pelo servidor.');
        } catch (authError: any) {
          console.error('Login internal error:', authError);
          // MODO DE EMERGÊNCIA: Se já validamos a senha no server, deixamos entrar localmente
          if (userProfile) {
            setActiveProfile(userProfile);
            setIsVerified(true);
            return true;
          }
          throw authError;
        }
      } else if (response) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido no servidor' }));
        const errorMessage = errorData.error || errorData.details || 'Falha na autenticação';
        throw new Error(errorMessage);
      }
      return false;
    } catch (error: any) {
      console.error('Login process failure:', error);
      // Propagamos o erro para o componente Login mostrar na tela
      throw error;
    }
  };

  const loginEmployee = async (username: string, password: string): Promise<boolean> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), where('password', '==', password));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const employeeData = querySnapshot.docs[0].data() as UserProfile;
        setActiveProfile(employeeData);
        setIsVerified(true);
        return true;
      }

      // Fallback for master admin if no password set in document or document not found by username
      if (user?.email === 'academiacarrasco@gmail.com' && username === 'admin' && password === '13262413') {
        setActiveProfile(masterProfile);
        setIsVerified(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error logging in employee:', error);
      return false;
    }
  };

  const verifyAdmin = async (password: string): Promise<boolean> => {
    // This is now used for the per-user password verification
    if (activeProfile && activeProfile.password === password) {
      setIsVerified(true);
      return true;
    }
    
    // Fallback for master admin if no password set in document
    if (user?.email === 'academiacarrasco@gmail.com' && password === '13262413') {
      setIsVerified(true);
      return true;
    }

    return false;
  };

  const logoutEmployee = () => {
    setActiveProfile(masterProfile);
    setIsVerified(false);
  };

  const logout = async () => {
    setIsVerified(false);
    await signOut(auth);
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    if (!activeProfile) return false;
    
    try {
      const userDocRef = doc(db, 'users', (activeProfile as any).id || activeProfile.uid || activeProfile.username);
      await updateDoc(userDocRef, { password: newPassword });
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  };

  const isAdmin = (!!user || !!activeProfile) && activeProfile?.role === 'admin' && isVerified;
  const isEmployee = (!!user || !!activeProfile) && (activeProfile?.role === 'employee' || activeProfile?.role === 'admin') && !isUnauthorized && isVerified;

  const hasPermission = (permission: string) => {
    if (isAdmin) return true;
    return activeProfile?.permissions?.includes(permission) || false;
  };

  const isAuthenticated = (!!user || !!activeProfile) && isVerified && !isUnauthorized;

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile: activeProfile, 
      masterProfile, 
      loading, 
      isAdmin, 
      isAdminVerified: isVerified,
      isEmployee, 
      isUnauthorized, 
      hasPermission,
      isAuthenticated,
      logout,
      login,
      loginEmployee,
      logoutEmployee,
      verifyAdmin,
      updatePassword,
      serverStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
