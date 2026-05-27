import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    Sentry.withScope((scope) => {
      scope.setExtra('react', errorInfo);
      Sentry.captureException(error);
    });
  }

  public render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) return fallback;

      return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-1 border border-danger/20 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <h1 className="text-xl font-bold text-main mb-2">Something went wrong</h1>
            <p className="text-sm text-ghost mb-8 leading-relaxed">
              An unexpected error occurred. Our team has been notified.
              <code className="block mt-4 p-2 bg-surface-base rounded text-danger text-[10px] font-mono break-all">
                {error?.message}
              </code>
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary/90 text-surface-base rounded-xl font-bold transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 w-full py-3 bg-surface-2 hover:bg-surface-2/80 text-main rounded-xl font-bold transition-all border border-border-subtle"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
