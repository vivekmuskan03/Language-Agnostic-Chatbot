import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#1f2937', background: '#f8fafc' }}>
          <div style={{ maxWidth: 640, width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Something went wrong</h2>
            <p style={{ marginTop: 0, marginBottom: '1rem' }}>The page failed to load due to a runtime error. Please refresh the page. If this persists, share the browser console error with the developer.</p>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: '0.75rem', borderRadius: 8, fontSize: 12, overflowX: 'auto' }}>{String(this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

