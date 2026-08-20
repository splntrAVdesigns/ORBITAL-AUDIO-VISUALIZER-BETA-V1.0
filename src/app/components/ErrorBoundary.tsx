/**
 * ORBITAL Error Boundary Component
 * Extracted from App.tsx for better code organization
 * Provides crash resilience and graceful error handling
 */

import { Component } from 'react';
import { markUserRequestedReload } from '../runtime/crashTelemetry';

export class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ORBITAL Error Boundary caught error:', error, errorInfo);
    // Optional: Send to error tracking service (e.g., Sentry)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0e17 0%, #1a1e24 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            filter: 'drop-shadow(0 0 20px #1E90FF)'
          }}>
            ⚠️
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#1E90FF'
          }}>
            ORBITAL encountered an unexpected error
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#a0a0a0',
            marginBottom: '2rem',
            maxWidth: '500px'
          }}>
            Something went wrong while running the visualizer. This has been logged for debugging.
          </p>
          <button
            onClick={() => { markUserRequestedReload('user-reload'); window.location.reload(); }}
            style={{
              padding: '12px 32px',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#fff',
              background: 'linear-gradient(135deg, #1E90FF 0%, #00BFFF 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30, 144, 255, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 144, 255, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 144, 255, 0.4)';
            }}
          >
            Reload ORBITAL
          </button>
          {this.state.error && (
            <details style={{ marginTop: '2rem', maxWidth: '600px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: '#808080', fontSize: '0.875rem' }}>
                Technical Details
              </summary>
              <pre style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#0a0e17',
                borderRadius: '4px',
                fontSize: '0.75rem',
                color: '#ff6b6b',
                overflowX: 'auto'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
