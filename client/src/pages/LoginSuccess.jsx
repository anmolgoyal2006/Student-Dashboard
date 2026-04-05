import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginSuccess() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const error  = params.get('error');

    if (error || !token) {
      navigate('/login?error=google_failed');
      return;
    }

    // Decode token to get user info (no need for extra API call)
    try {
      const base64   = token.split('.')[1];
      const decoded  = JSON.parse(atob(base64));
      const user     = {
        id:    decoded.id,
        name:  decoded.name,
        email: decoded.email,
      };

      login(user, token);   // uses your existing AuthContext login function
      navigate('/');
    } catch {
      navigate('/login?error=invalid_token');
    }
  }, []);

  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'var(--bg)',
      gap:            16,
    }}>
      <div className="spinner" />
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        Signing you in with Google…
      </p>
    </div>
  );
}