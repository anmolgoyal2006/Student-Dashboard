
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from '../../context/ToastContext';
import EmptyState from '../../components/EmptyState';
import { Lock, Trophy, TrendingUp, Clock, RefreshCw, AlertCircle, Activity, Users, Copy, CheckCircle, XCircle } from 'lucide-react';
import { adminService } from '../../services/apiServices';

export default function AdminOpportunities() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState(null);

  const fetchDashboard = async () => {
    try {
      const { data } = await adminService.getDashboard();
      setDashboardStats(data.stats);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const triggerCollectors = async () => {
    try {
      setRefreshing(true);
      const { data } = await adminService.triggerCollectors();
      toast.success(data.message);
      // Refetch dashboard after a delay to show new logs
      setTimeout(fetchDashboard, 5000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger collectors.');
    } finally {
      setRefreshing(false);
    }
  };

  const triggerReminders = async () => {
    try {
      setSendingReminders(true);
      const { data } = await adminService.triggerReminders();
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger reminders.');
    } finally {
      setSendingReminders(false);
    }
  };

  const checkDuplicates = async () => {
    try {
      setCheckingDuplicates(true);
      const { data } = await adminService.runDuplicates();
      setDuplicates(data);
      if (data.duplicatesFound > 0) {
        toast.warning(`Found ${data.duplicatesFound} potential duplicate(s)!`);
      } else {
        toast.success('No duplicates found!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check duplicates.');
    } finally {
      setCheckingDuplicates(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (user?.role !== 'teacher') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Lock size={32} style={{ color: 'var(--color-accent)' }} />
        <p style={{ fontWeight: 600 }}>Access denied — teachers only.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="spinner" />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Monitor collectors and event stats</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={checkDuplicates}
            disabled={checkingDuplicates}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-warning)' }}
          >
            <Copy size={16} className={checkingDuplicates ? 'animate-spin' : ''} />
            {checkingDuplicates ? 'Checking…' : 'Check Duplicates'}
          </button>
          <button
            onClick={triggerReminders}
            disabled={sendingReminders}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-accent)' }}
          >
            <AlertCircle size={16} className={sendingReminders ? 'animate-spin' : ''} />
            {sendingReminders ? 'Sending…' : 'Check Reminders'}
          </button>
          <button
            onClick={triggerCollectors}
            disabled={refreshing}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Collecting…' : 'Manual Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: 24,
        gap: 24,
        marginTop: 12
      }}>
        <button
          onClick={() => navigate('/admin')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: location.pathname === '/admin' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            borderBottom: location.pathname === '/admin' ? '2px solid var(--color-accent)' : '2px solid transparent',
            fontSize: 13.5,
            fontWeight: location.pathname === '/admin' ? 500 : 400,
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={15} />
          User Management
        </button>
        <button
          onClick={() => navigate('/admin/opportunities')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: location.pathname === '/admin/opportunities' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            borderBottom: location.pathname === '/admin/opportunities' ? '2px solid var(--color-accent)' : '2px solid transparent',
            fontSize: 13.5,
            fontWeight: location.pathname === '/admin/opportunities' ? 500 : 400,
            transition: 'all 0.15s ease'
          }}
        >
          <Trophy size={15} />
          Opportunities
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 mb-4">
        <StatCard 
          icon={<Trophy size={16} />} 
          value={dashboardStats?.totalEvents || 0} 
          label="Total Events" 
          color="var(--color-accent)" 
        />
        {Object.entries(dashboardStats?.eventsBySource || {}).map(([source, count]) => (
          <StatCard 
            key={source}
            icon={<Activity size={16} />} 
            value={count} 
            label={`${source.charAt(0).toUpperCase() + source.slice(1)} Events`} 
            color={source === 'unstop' ? 'var(--color-success)' : 'var(--color-warning)'} 
          />
        ))}
      </div>

      <div className="grid-2 mb-4">
        {/* Last Run Info */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} style={{ color: 'var(--color-accent)' }} />
            Last Collector Run
          </div>
          {dashboardStats?.lastRunTime ? (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {new Date(dashboardStats.lastRunTime).toLocaleString()}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>No runs yet</div>
          )}
        </div>

        {/* Failed Collectors */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} />
            Failed Collectors
          </div>
          {(dashboardStats?.failedCollectors?.length || 0) === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>All collectors healthy!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dashboardStats.failedCollectors.map(log => (
                <div key={log._id} style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                  {log.lastRun.collectorName}: {log.lastRun.errorMessage}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Runs */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={16} style={{ color: 'var(--color-accent)' }} />
          Recent Collector Runs
        </div>
        {(dashboardStats?.lastRuns?.length || 0) === 0 ? (
          <EmptyState 
            title="No runs found"
            subtitle="No collector runs have been logged yet."
          />
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Collector', 'Status', 'Events', 'Duration', 'Started'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboardStats.lastRuns.map(run => (
                  <tr key={run._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {run.collectorName}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: run.status === 'success'
                          ? 'rgba(34,197,94,0.15)' : run.status === 'failed'
                          ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
                        color: run.status === 'success'
                          ? 'var(--color-success)' : run.status === 'failed'
                          ? 'var(--color-danger)' : 'var(--color-warning)',
                        textTransform: 'capitalize'
                      }}>
                        {run.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {run.eventCount}
                    </td>
                    <td style={tdStyle}>
                      {run.duration ? `${Math.round(run.duration / 1000)}s` : '—'}
                    </td>
                    <td style={tdStyle}>
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Duplicates Results */}
      {duplicates && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Copy size={16} style={{ color: duplicates.duplicatesFound > 0 ? 'var(--color-warning)' : 'var(--color-success)' }} />
            Duplicate Detection Results
          </div>
          
          {duplicates.duplicatesFound === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 }}>
              <CheckCircle size={40} style={{ color: 'var(--color-success)' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>No duplicates found!</p>
                <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0 0' }}>All events appear to be unique.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--color-warning)', fontSize: 14, margin: 0 }}>
                Found {duplicates.duplicatesFound} potential duplicate pair(s). Review them carefully.
              </p>
              
              {duplicates.duplicates.map((dup, idx) => (
                <div key={idx} style={{ 
                  background: 'rgba(251,191,36,0.05)', 
                  border: '1px solid rgba(251,191,36,0.2)', 
                  borderRadius: 8, 
                  padding: 16 
                }}>
                  <div style={{ 
                    fontSize: 12, 
                    color: 'var(--color-warning)', 
                    fontWeight: 600, 
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {dup.reason}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      borderRadius: 6, 
                      padding: 12 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ 
                          fontSize: 11, 
                          fontWeight: 600, 
                          color: 'var(--color-text-tertiary)',
                          textTransform: 'uppercase'
                        }}>
                          Event A
                        </span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px 0' }}>{dup.eventA.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>
                        {dup.eventA.source} • {dup.eventA.sourceEventId}
                      </p>
                    </div>
                    
                    <div style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      borderRadius: 6, 
                      padding: 12 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ 
                          fontSize: 11, 
                          fontWeight: 600, 
                          color: 'var(--color-text-tertiary)',
                          textTransform: 'uppercase'
                        }}>
                          Event B
                        </span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px 0' }}>{dup.eventB.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>
                        {dup.eventB.source} • {dup.eventB.sourceEventId}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <div className="card stat-card">
      <span className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</span>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const thStyle = {
  padding: '10px 12px', textAlign: 'left',
  color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '10px 12px', verticalAlign: 'middle',
};
