import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import API from '../api/axios';

export default function RiskAlertsCard() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/risks')
      .then(res => setAlerts(res.data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!alerts.length) return null;

  return (
    <div style={{
      background: '#13161f', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.07)', padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <AlertTriangle size={16} color="#ef4444" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Risk Alerts</span>
      </div>
      {alerts.slice(0, 4).map((a, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '10px 0', borderBottom: i < alerts.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginTop: 4, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e2e8f0' }}>{a.title}</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{a.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
