import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[BTal] ErrorBoundary:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--btal-bg, #0a0e0c)',
          color: 'var(--btal-t-1, #f0f4f0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 12px', fontWeight: 800 }}>
          Algo ha salido mal
        </h1>
        <p style={{ color: 'var(--btal-t-2, #aab3a8)', margin: '0 0 24px', fontSize: '0.92rem' }}>
          Recarga la página para intentarlo de nuevo.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            background: 'var(--btal-lime, #b5f037)',
            color: '#0a0e0c',
            border: 'none',
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Recargar
        </button>
      </div>
    );
  }
}
