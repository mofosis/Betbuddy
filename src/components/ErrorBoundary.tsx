import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      let errorMessage = "Etwas ist schief gelaufen.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) {
            errorMessage = `Fehler: ${parsed.error} (${parsed.operationType} auf ${parsed.path})`;
          }
        }
      } catch (e) {
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="min-h-[100dvh] bg-app-bg flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-4xl font-bold text-app-accent mb-4">Ups!</h1>
          <p className="text-app-text/60 mb-8 max-w-md">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-app-accent hover:opacity-90 text-app-bg rounded-xl transition-colors font-medium"
          >
            App neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
