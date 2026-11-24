import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = 'Ocorreu um erro inesperado ao carregar a biblioteca.';
    const raw = error?.message || '';
    if (raw.includes('Quota exceeded')) {
      friendly =
        'A cota diária gratuita do banco de dados Firestore foi atingida. Tente novamente amanhã ou ouça os contos em cache local.';
    } else if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
      friendly =
        'Permissão negada ao acessar o banco de dados. Recarregue a página ou entre novamente com sua conta Google.';
    }
    return { hasError: true, message: friendly };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught application error:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#101216] text-[#14171F] dark:text-[#EAECEF] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#181B21] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h1 className="font-editorial text-lg font-semibold">
                  Algo interrompeu a leitura
                </h1>
                <p className="text-sm text-[#5A6474] dark:text-[#9AA4B2] mt-1 leading-relaxed">
                  {this.state.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-sm font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Recarregar Voz &amp; Folha</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
