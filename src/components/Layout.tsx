import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CreditCard, 
  ScanFace, 
  BarChart3, 
  LogOut,
  Settings as SettingsIcon,
  Download,
  ShieldCheck,
  Dumbbell,
  ExternalLink,
  User as UserIcon2,
  Loader2,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Unlock
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { UserProfile, useAuth } from '../hooks/useAuth';
import { useGymData } from '../hooks/useGymData';
import { useHardware } from '../contexts/HardwareContext';
import TurnstileMonitor from './TurnstileMonitor';
import { 
  Usb,
  Unplug,
  RefreshCw,
  Wifi
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  profile: UserProfile | null;
}

const navItems = [
  { name: 'Painel', path: '/', icon: LayoutDashboard, adminOnly: false, permission: 'dashboard' },
  { name: 'Alunos', path: '/students', icon: Users, adminOnly: false, permission: 'students' },
  { name: 'Planos', path: '/plans', icon: SettingsIcon, adminOnly: true, permission: 'plans' },
  { name: 'Aulas', path: '/classes', icon: Calendar, adminOnly: false, permission: 'classes' },
  { name: 'Cobranças', path: '/payments', icon: CreditCard, adminOnly: false, permission: 'payments' },
  { name: 'Catraca (Facial)', path: '/turnstile', icon: ScanFace, adminOnly: false, permission: 'turnstile' },
  { name: 'Relatórios', path: '/reports', icon: BarChart3, adminOnly: true, permission: 'reports' },
  { name: 'Exportar', path: '/export', icon: Download, adminOnly: true, permission: 'export' },
  { name: 'Funcionários', path: '/users', icon: ShieldCheck, adminOnly: true, permission: 'users' },
  { name: 'Configurações', path: '/settings', icon: SettingsIcon, adminOnly: true, permission: 'settings' },
];

export default function Layout({ children, user, profile }: LayoutProps) {
  const location = useLocation();
  const { settings, students } = useGymData();
  const { isHardwareConnected, releaseTurnstile, syncAll, isSyncing } = useHardware();
  const { loginEmployee, logoutEmployee, masterProfile, logout, updatePassword, hasPermission } = useAuth();
  const [showSwitchModal, setShowSwitchModal] = React.useState(false);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [loginData, setLoginData] = React.useState({ username: '', password: '' });
  const [newPassword, setNewPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleSwitchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    const success = await loginEmployee(loginData.username, loginData.password);
    if (success) {
      setShowSwitchModal(false);
      setLoginData({ username: '', password: '' });
    } else {
      setLoginError('Login ou senha incorretos.');
    }
    setIsLoggingIn(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setPasswordError('Digite a nova senha.');
      return;
    }
    setIsUpdating(true);
    setPasswordError('');
    
    const success = await updatePassword(newPassword);
    if (success) {
      setShowPasswordModal(false);
      setNewPassword('');
      alert('Senha alterada com sucesso!');
    } else {
      setPasswordError('Erro ao alterar senha.');
    }
    setIsUpdating(false);
  };

  const handleLogoutEmployee = () => {
    logoutEmployee();
    setShowSwitchModal(false);
  };

  // URLs Oficiais
  const TRAINING_APP_URL = "https://carrascofit-app.vercel.app";
  const PRODUCTION_URL = "https://carrasco-fit-607856914066.us-east1.run.app";

  const isProduction = window.location.hostname.includes('run.app');

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* Sidebar */}
      <aside className="w-64 bg-black text-white flex flex-col border-r-2 border-neutral-600">
        <div className="p-6 border-b-2 border-neutral-600 flex flex-col items-center relative">
          {isProduction && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[7px] font-black uppercase text-green-500 tracking-tighter shadow-sm animate-pulse">
              <ShieldCheck size={8} /> Produção
            </div>
          )}
          {!isProduction && (
            <a 
              href={PRODUCTION_URL}
              className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-400 text-black text-[7px] font-black uppercase tracking-tighter hover:scale-105 transition-transform"
            >
              Acessar Produção <ExternalLink size={8} />
            </a>
          )}
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto mb-4 object-contain" />
          ) : (
            <div className="h-16 w-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-black font-black text-2xl mb-4 italic">
              CF
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-yellow-400 italic uppercase">
            {settings?.gymName || 'CARRASCO FIT'}
          </h1>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">SISTEMA DE GESTÃO</p>
          
          {/* Single Switch User Button at Top */}
          <button
            onClick={() => setShowSwitchModal(true)}
            className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 text-[9px] font-black uppercase tracking-widest border-2 border-yellow-400/30 hover:border-yellow-400 hover:bg-yellow-400 hover:text-black transition-all"
          >
            <UserIcon2 size={12} />
            Trocar Funcionário
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.filter(item => {
            if (item.permission === 'dashboard') return true;
            return hasPermission(item.permission);
          }).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-bold uppercase tracking-tight relative group border-2",
                location.pathname === item.path
                  ? "bg-yellow-400 text-black border-yellow-400 shadow-lg shadow-yellow-400/20 scale-[1.02]"
                  : "text-neutral-500 bg-black border-transparent hover:border-yellow-400 hover:text-yellow-400"
              )}
            >
              <item.icon size={18} />
              {item.name}
              {item.path === '/turnstile' && (
                <div className={cn(
                  "absolute right-4 w-2 h-2 rounded-full",
                  isHardwareConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                )} />
              )}
            </Link>
          ))}

          {/* Hardware Quick Status/Connect */}
          <div className="mt-4 px-4 py-3 bg-neutral-900/30 rounded-xl border-2 border-neutral-600 hover:border-yellow-400 transition-all group/hw cursor-default">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wifi size={14} className={isHardwareConnected ? "text-green-500" : "text-neutral-600"} />
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Hardware</span>
              </div>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isHardwareConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              )} />
            </div>
            {!isHardwareConnected ? (
              <Link 
                to="/turnstile#hardware-config"
                className="block w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-[8px] font-black uppercase tracking-widest text-center rounded-lg transition-all"
              >
                Configurar Conexão
              </Link>
            ) : (
              <>
                <button 
                  onClick={() => releaseTurnstile()}
                  className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-[8px] font-black uppercase tracking-widest text-center rounded-lg transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                >
                  <Unlock size={10} />
                  Liberar Agora
                </button>
                <button 
                  onClick={() => syncAll(students)}
                  disabled={isSyncing}
                  className="w-full mt-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest text-center rounded-lg transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={10} className={cn(isSyncing && "animate-spin")} />
                  Sincronizar
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="p-4 border-t-2 border-neutral-700 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900/50 rounded-xl border-2 border-neutral-600">
            <img 
              src={profile?.photoURL || 'https://picsum.photos/seed/user/100/100'} 
              alt="User" 
              className="w-8 h-8 rounded-full border-2 border-neutral-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-white">{profile?.displayName}</p>
              <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">
                {profile?.jobTitle || (profile?.role === 'admin' ? 'Administrador' : 'Funcionário')}
              </p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2.5 bg-neutral-900/50 border-2 border-neutral-600 text-neutral-500 hover:text-yellow-400 hover:border-yellow-400/50 hover:bg-yellow-400/5 rounded-xl transition-all group"
              title="Alterar Minha Senha"
            >
              <KeyRound size={16} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {profile?.role === 'admin' && (
            <Link
              to="/users?add=true"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-yellow-400/10 text-yellow-400 border-2 border-yellow-400/30 hover:bg-yellow-400 hover:text-black transition-all group shadow-lg shadow-yellow-400/5"
            >
              <ShieldCheck size={16} className="group-hover:scale-110 transition-transform" />
              Cadastrar Funcionário
            </Link>
          )}

          {/* Botão para App de Treino */}
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <a
              href={TRAINING_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 px-4 py-4 text-[10px] font-black text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-yellow-400/10"
            >
              <Dumbbell size={16} />
              App de Treino
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b-2 border-neutral-600 bg-black/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500 italic">
              {navItems.find(item => item.path === location.pathname)?.name || 'Carrasco Fit'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {isHardwareConnected && (
              <button
                onClick={() => releaseTurnstile()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20"
              >
                <Unlock size={14} />
                Liberar Catraca
              </button>
            )}
            {!isHardwareConnected && (
              <Link
                to="/turnstile#hardware-config"
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-2 border-neutral-600 text-neutral-500 hover:text-white hover:border-yellow-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Wifi size={14} />
                Modem Offline
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 text-white relative">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-yellow-400/5 blur-[120px] pointer-events-none" />
          {children}
        </main>
      </div>

      {/* Monitor da Catraca (Sobreposto) */}
      <TurnstileMonitor />

      {/* Switch User Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border-2 border-neutral-600 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="p-8 border-b-2 border-neutral-600 flex justify-between items-center bg-black">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-yellow-400">Trocar Usuário</h2>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Acesse sua conta interna</p>
              </div>
              <button 
                onClick={() => setShowSwitchModal(false)}
                className="p-2 hover:bg-neutral-900 rounded-xl transition-colors text-neutral-500"
              >
                <LogOut size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSwitchUser} className="p-8 space-y-6">
              {loginError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase flex items-center gap-3 animate-pulse">
                  <ShieldAlert size={18} />
                  {loginError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Login</label>
                  <div className="relative">
                    <UserIcon2 className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                      type="text"
                      required
                      placeholder="Seu login"
                      className="w-full pl-12 pr-6 py-4 bg-black border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Senha</label>
                  <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Sua senha"
                      className="w-full pl-12 pr-14 py-4 bg-black border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold tracking-widest"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {isLoggingIn ? 'Verificando...' : 'Entrar'}
              </button>

              <div className="pt-4 flex flex-col gap-3">
                {profile?.uid !== masterProfile?.uid && (
                  <button
                    type="button"
                    onClick={handleLogoutEmployee}
                    className="w-full py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Voltar para Administrador
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full py-4 text-[10px] font-black text-red-500/50 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut size={12} />
                  Sair do Sistema (Google)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border-2 border-neutral-600 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="p-8 border-b-2 border-neutral-600 flex justify-between items-center bg-black">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-yellow-400">Alterar Senha</h2>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Defina sua nova senha de acesso</p>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="p-2 hover:bg-neutral-900 rounded-xl transition-colors text-neutral-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
              {passwordError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase flex items-center gap-3">
                  <ShieldAlert size={18} />
                  {passwordError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-2">Nova Senha</label>
                  <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Mínimo 4 caracteres"
                      className="w-full pl-12 pr-14 py-4 bg-black border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold tracking-widest"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {isUpdating ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
