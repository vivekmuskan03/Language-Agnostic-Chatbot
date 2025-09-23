import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './styles.css';
import Mascot from '../components/Mascot';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ registrationNumber: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      nav('/chat');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="auth-page">
      {/* Header */}
      <header className="auth-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-placeholder">
              <div className="logo-shield">
                <div className="logo-emblem">V</div>
              </div>
              <div className="logo-text">
                <span className="logo-main">Vigan AI</span>
              </div>
            </div>
          </div>
          <nav className="navigation">
            <Link to="/" className="nav-link">Home</Link>
            <a href="#features" className="nav-link">Features</a>
            <a href="#support" className="nav-link">Support</a>
          </nav>
          <div className="header-buttons">
            <Link to="/login" className="btn-student">Student Login</Link>
            <Link to="/admin" className="btn-admin">Admin Login</Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="auth-main">
        <div className="auth-container">
          {/* Login Form */}
          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="form-header">
                <h1 className="form-title">Log In to Vignan AI</h1>
                <p className="form-subtitle">Welcome back! Please sign in to continue.</p>
              </div>
              
              <form onSubmit={submit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Registration Number</label>
                  <div className="input-container">
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter your registration number"
                      value={form.registrationNumber} 
                      onChange={(e)=>setForm({...form, registrationNumber:e.target.value})} 
                      required 
                    />
                    <div className="input-icon">🎓</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-container">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="form-input" 
                      placeholder="Enter your password"
                      value={form.password} 
                      onChange={(e)=>setForm({...form, password:e.target.value})} 
                      required 
                    />
                    <button 
                      type="button" 
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="submit-button">
                  LOGIN
                </button>

                <div className="form-footer">
                  <p className="signup-link">
                    Don't have an account? <Link to="/signup" className="link">Sign Up</Link>
                  </p>
                </div>
              </form>
            </div>
          </div>

          {/* Mascot Illustration */}
          <div className="auth-illustration">
            <Mascot />
          </div>
        </div>
      </main>
    </div>
  );
}


