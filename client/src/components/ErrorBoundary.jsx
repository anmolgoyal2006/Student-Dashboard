import { Component } from 'react';

// Catches uncaught render errors anywhere below it so a single bad component
// doesn't white-screen the whole app for the user.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign('/dashboard');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 24,
          background: '#0b0b0b',
          color: '#f5f5f5',
        }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong.</h2>
          <p style={{ marginBottom: 20, color: '#94a3b8' }}>
            An unexpected error occurred. You can try reloading the page.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
