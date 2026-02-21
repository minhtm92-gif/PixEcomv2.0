'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback — if omitted, uses the default crash screen */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches unhandled errors in the component tree
 * and shows a recoverable fallback UI instead of a white screen.
 *
 * Must be a class component (React requirement for error boundaries).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-red-400" />
            </div>

            <h2 className="text-lg font-semibold text-foreground mb-2">
              Something went wrong
            </h2>

            <p className="text-sm text-muted-foreground mb-6">
              An unexpected error occurred. You can try again or reload the page.
            </p>

            {/* Error detail (dev-friendly, collapsed) */}
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-muted/50 border border-border rounded-lg text-xs text-red-400 overflow-auto max-h-32 font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RotateCcw size={14} />
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
