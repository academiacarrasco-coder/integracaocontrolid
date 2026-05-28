import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Plans from './components/Plans';
import Classes from './components/Classes';
import Payments from './components/Payments';
import Reports from './components/Reports';
import Export from './components/Export';
import Settings from './components/Settings';
import Users from './components/Users';
import RecepcaoStandAlone from './components/RecepcaoStandAlone';
import TelaoPage from './components/TelaoPage';
import AccessControl from './components/AccessControl';
import { 
  Loader2, 
  ShieldAlert, 
  LogIn, 
  Lock, 
  ArrowRight, 
  ShieldCheck,
  AlertCircle,
  LogOut,
  Eye,
  EyeOff
} from 'lucide-react';

function Login() {
  const { user, isUnauthorized, logout, isAdminVerified, login, loginEmployee, profile, serverStatus, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha login e senha.');
      return;
    }
    setChecking(true);
    setError('');
    
    try {
      const success = await login(username, password);
      if (!success) {
        setError('Login ou senha incorretos.');
      }
    } catch (err: any) {
      console.error('Login error detail:', err);
      // Se for erro do Firebase de domínio, damos uma dica melhor
      if (err.message?.includes('unauthorized-domain')) {
        setError('Domínio não autorizado no Firebase Console.');
      } else {
        setError(err.message || 'Falha na autenticação.');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha login e senha.');
      return;
    }
    setChecking(true);
    setError('');
    
    const success = await loginEmployee(username, password);
    if (!success) {
      setError('Login ou senha incorretos.');
    }
    setChecking(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-900 p-4">
        <div className="w-full max-w-md space-y-8 bg-black p-10 rounded-[40px] border border-neutral-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400" />
          
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-yellow-400/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-yellow-400/20">
              <ShieldCheck className="text-yellow-400" size={40} />
            </div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter text-yellow-400">Acesso</h1>
            <p className="text-neutral-500 font-medium">Escolha seu método de login.</p>
          </div>

          <div className="space-y-4">
            {/* Google Login - Recommended for Admin */}
            <button
              onClick={async () => {
                setChecking(true);
                setError('');
                try {
                  const provider = new GoogleAuthProvider();
                  provider.setCustomParameters({ prompt: 'select_account' });
                  await signInWithPopup(auth, provider);
                } catch (err: any) {
                  console.error('Google Sign-in error:', err);
                  setError('Erro ao entrar com Google. Tente uma nova aba.');
                } finally {
                  setChecking(false);
                }
              }}
              disabled={checking}
              className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all shadow-xl"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Entrar com Google
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-neutral-800"></div>
              <span className="flex-shrink mx-4 text-neutral-500 text-[10px] font-black uppercase tracking-widest">ou login manual</span>
              <div className="flex-grow border-t border-neutral-800"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-4">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Seu Login"
                    className="w-full px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-center text-xl font-bold tracking-tight"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua Senha"
                    className="w-full px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-center text-xl font-bold tracking-widest pr-14"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-xl text-sm font-bold animate-pulse">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={checking}
                className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 group"
              >
                {checking ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {checking ? 'Verificando...' : 'Acesso Funcionário'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-900 p-4">
        <div className="w-full max-w-md space-y-8 bg-black p-10 rounded-[40px] border border-neutral-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400" />
          
          {serverStatus && serverStatus.status !== 'Conectado' && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-red-500 font-black text-[10px] uppercase tracking-widest">
                <AlertCircle size={14} />
                Erro no Firestore
              </div>
              <p className="text-[10px] text-neutral-400 leading-tight">
                Servidor sem permissão Firestore ({serverStatus.projectId}). 
                Não foi possível verificar se seu email está cadastrado.
              </p>
            </div>
          )}

          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-yellow-400/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-yellow-400/20">
              <ShieldAlert className="text-red-500" size={40} />
            </div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter text-red-500">Acesso Negado</h1>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl space-y-3">
            <p className="text-sm text-neutral-400 leading-relaxed text-center">
              Seu email <span className="text-white font-bold">{user.email}</span> não está cadastrado no sistema. 
              Peça ao administrador para registrar seu acesso.
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full bg-neutral-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-700 transition-all"
          >
            <LogOut size={20} />
            Tentar com outra conta
          </button>
        </div>
      </div>
    );
  }

  if (!isAdminVerified) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-900 p-4">
        <div className="w-full max-w-md space-y-8 bg-black p-10 rounded-[40px] border border-neutral-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400" />
          
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-yellow-400/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-yellow-400/20">
              <ShieldCheck className="text-yellow-400" size={40} />
            </div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter text-yellow-400">Acesso</h1>
            <p className="text-neutral-500 font-medium">Identifique-se para acessar o sistema.</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-4">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Seu Login"
                  className="w-full px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-center text-xl font-bold tracking-tight"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setUsername('')}
                  autoFocus
                />
              </div>

              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua Senha"
                  className="w-full px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-center text-xl font-bold tracking-widest pr-14"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPassword('')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-xl text-sm font-bold animate-pulse">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={checking}
              className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 group"
            >
              {checking ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {checking ? 'Verificando...' : 'Confirmar Acesso'}
              {!checking && <ArrowRight className="group-hover:translate-x-1 transition-transform" />}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full bg-neutral-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-700 transition-all"
            >
              <LogOut size={20} />
              Sair da conta
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}

function AuthenticatedApp() {
  const { user, profile, loading, isAdmin, isAdminVerified, isUnauthorized, hasPermission, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-900 text-white">
        <Loader2 className="animate-spin text-yellow-400" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout user={user} profile={profile}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={hasPermission('students') ? <Students /> : <Navigate to="/" />} />
        <Route path="/plans" element={hasPermission('plans') ? <Plans /> : <Navigate to="/" />} />
        <Route path="/classes" element={hasPermission('classes') ? <Classes /> : <Navigate to="/" />} />
        <Route path="/payments" element={hasPermission('payments') ? <Payments /> : <Navigate to="/" />} />
        <Route path="/reports" element={hasPermission('reports') ? <Reports /> : <Navigate to="/" />} />
        <Route path="/export" element={hasPermission('export') ? <Export /> : <Navigate to="/" />} />
        <Route path="/settings" element={hasPermission('settings') ? <Settings /> : <Navigate to="/" />} />
        <Route path="/users" element={isAdmin ? <Users /> : <Navigate to="/" />} />
        <Route path="/access" element={hasPermission('access') || isAdmin ? <AccessControl /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Rota pública — abre sem login (usada pelo .bat da catraca) */}
        <Route path="/recepcao" element={<RecepcaoStandAlone />} />
        {/* Telão da catraca — abre em janela separada sem login */}
        <Route path="/telao" element={<TelaoPage />} />
        {/* Todas as outras rotas exigem autenticação */}
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </Router>
  );
}
