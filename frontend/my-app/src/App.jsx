import React, { useState, useEffect } from 'react';
import { Sparkles, Wallet, LogIn, UserCheck, ShieldAlert } from 'lucide-react';
import Dashboard from './components/Dashboard';
import CSVImportWizard from './components/CSVImportWizard';
import { API_BASE_URL } from './config';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [importActive, setImportActive] = useState(false);
  
  // Login form state
  const [username, setUsername] = useState('Rohan'); // Default helper selection
  const [password, setPassword] = useState('flatmate123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validate session on load
  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/status/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        fetchGroup(token);
      } else {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const fetchGroup = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/`, {
        headers: { 'Authorization': `Token ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setGroupId(data[0].id);
        } else {
          // If no groups, auto-create a default group
          createDefaultGroup(authToken);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createDefaultGroup = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'Flat 404 Shared Expenses' })
      });
      if (response.ok) {
        const data = await response.json();
        setGroupId(data.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error("Invalid username or password. Seeding defaults use 'flatmate123'");
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      fetchGroup(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setGroupId(null);
    setImportActive(false);
  };

  // Helper select profile to login instantly
  const quickLogin = (uname) => {
    setUsername(uname);
    setPassword('flatmate123');
  };

  // Render Login Card
  const renderLogin = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90vh', padding: '16px' }}>
      
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '40px 32px' }}>
        
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'var(--accent-glow)', padding: '12px', borderRadius: '16px', border: '1px solid var(--accent)', display: 'inline-flex' }}>
            <Wallet size={36} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: '1.8rem', margin: '8px 0 0' }}>Flat 404 Shared Expenses</h1>
          <p style={{ fontSize: '0.85rem' }}>Login to sync flatmate accounts and manage balances.</p>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center', textAlign: 'left' }}>
            <ShieldAlert size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Flatmate Username</label>
            <input 
              type="text" 
              className="form-control" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Password</label>
            <input 
              type="password" 
              className="form-control" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? "Authenticating..." : "Login"} <LogIn size={16} />
          </button>
        </form>

        {/* Quick select profile list */}
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '12px', textAlign: 'center' }}>
            <Sparkles size={12} className="icon" /> Quick Profile Selector
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'].map(name => (
              <button 
                key={name}
                className="btn btn-secondary" 
                style={{ padding: '6px 4px', fontSize: '0.8rem', background: username === name ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.03)', borderColor: username === name ? 'var(--accent)' : 'var(--panel-border)' }}
                onClick={() => quickLogin(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="app-container">
      {!token || !user ? (
        renderLogin()
      ) : importActive ? (
        <CSVImportWizard 
          groupId={groupId} 
          token={token} 
          onImportSuccess={() => setImportActive(false)} 
          onCancel={() => setImportActive(false)} 
        />
      ) : (
        <Dashboard 
          groupId={groupId} 
          token={token} 
          user={user} 
          onLogout={handleLogout} 
          onTriggerImport={() => setImportActive(true)} 
        />
      )}
    </div>
  );
}
