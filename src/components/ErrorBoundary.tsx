import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isFirestoreUnavailable = this.state.error?.message.includes('unavailable') || 
                                    this.state.error?.message.includes('Could not reach Cloud Firestore');

      return (
        <div className="h-screen flex items-center justify-center bg-neutral-900 p-4 font-sans uppercase italic">
          <div className="w-full max-w-md space-y-8 bg-black p-10 rounded-[40px] border border-neutral-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
            
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                {isFirestoreUnavailable ? <WifiOff className="text-red-500" size={40} /> : <ShieldAlert className="text-red-500" size={40} />}
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter text-red-500">
                {isFirestoreUnavailable ? 'Instabilidade' : 'Erro de Sistema'}
              </h1>
              <p className="text-neutral-500 font-medium normal-case not-italic">
                {isFirestoreUnavailable 
                  ? 'Não conseguimos conectar ao banco de dados. Verifique sua conexão com a internet ou tente novamente em instantes.' 
                  : 'Ocorreu um erro inesperado ao carregar o cockpit.'}
              </p>
            </div>

            <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl">
              <p className="text-[10px] text-neutral-600 font-mono break-all lowercase not-italic">
                Log: {this.state.error?.message || 'Erro desconhecido'}
              </p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full bg-red-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-400 transition-all shadow-xl shadow-red-500/20 group"
            >
              <RefreshCw className="group-hover:rotate-180 transition-transform duration-500" />
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
