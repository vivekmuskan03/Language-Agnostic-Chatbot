import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './styles.css';
import Mascot from '../components/Mascot';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Signup() {
  const nav = useNavigate();
  const [form, setForm] = useState({ 
    registrationNumber: '', 
    password: '', 
    name: '', 
    email: '',
    phoneNumber: '',
    course: '',
    branch: '',
    section: '',
    year: '',
    languagePreference: 'en',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          registrationNumber: form.registrationNumber,
          password: form.password,
          name: form.name,
          email: form.email,
          phoneNumber: form.phoneNumber,
          course: form.course,
          branch: form.branch,
          section: form.section,
          year: form.year,
          languagePreference: form.languagePreference
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      nav('/login');
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
          {/* Signup Form */}
          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="form-header">
                <h1 className="form-title">Sign Up for Vignan AI</h1>
                <p className="form-subtitle">Join our intelligent learning community today!</p>
              </div>
              
              <form onSubmit={submit} className="auth-form">
                <div className="form-columns">
                  <div className="form-column">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <div className="input-container">
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Enter your full name"
                          value={form.name} 
                          onChange={(e)=>setForm({...form, name:e.target.value})} 
                          required 
                        />
                        <div className="input-icon">👤</div>
                      </div>
                    </div>

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
                      <label className="form-label">Email</label>
                      <div className="input-container">
                        <input 
                          type="email" 
                          className="form-input" 
                          placeholder="Enter your email address"
                          value={form.email || ''} 
                          onChange={(e)=>setForm({...form, email:e.target.value})} 
                        />
                        <div className="input-icon">📧</div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <div className="input-container">
                        <input 
                          type="tel" 
                          className="form-input" 
                          placeholder="Enter your phone number"
                          value={form.phoneNumber || ''} 
                          onChange={(e)=>setForm({...form, phoneNumber:e.target.value})} 
                        />
                        <div className="input-icon">📱</div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <div className="input-container">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          className="form-input" 
                          placeholder="Create a strong password"
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

                    <div className="form-group">
                      <label className="form-label">Confirm Password</label>
                      <div className="input-container">
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          className="form-input" 
                          placeholder="Confirm your password"
                          value={form.confirmPassword} 
                          onChange={(e)=>setForm({...form, confirmPassword:e.target.value})} 
                          required 
                        />
                        <button 
                          type="button" 
                          className="password-toggle"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-column">
                    <div className="form-group">
                      <label className="form-label">Course</label>
                      <div className="input-container">
                        <select 
                          className="form-select" 
                          value={form.course} 
                          onChange={(e)=>setForm({...form, course:e.target.value})}
                        >
                          <option value="">Select Course</option>
                          <option value="B.Tech">B.Tech</option>
                          <option value="M.Tech">M.Tech</option>
                          <option value="MBA">MBA</option>
                          <option value="B.Pharm">B.Pharm</option>
                          <option value="M.Pharm">M.Pharm</option>
                          <option value="BBA">BBA</option>
                          <option value="BCA">BCA</option>
                          <option value="MCA">MCA</option>
                        </select>
                        <div className="input-icon">🎓</div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Branch</label>
                      <div className="input-container">
                        <select 
                          className="form-select" 
                          value={form.branch} 
                          onChange={(e)=>setForm({...form, branch:e.target.value})}
                        >
                          <option value="">Select Branch</option>
                          <option value="Computer Science Engineering">Computer Science Engineering</option>
                          <option value="Electronics and Communication Engineering">Electronics and Communication Engineering</option>
                          <option value="Mechanical Engineering">Mechanical Engineering</option>
                          <option value="Civil Engineering">Civil Engineering</option>
                          <option value="Electrical Engineering">Electrical Engineering</option>
                          <option value="Information Technology">Information Technology</option>
                          <option value="Management">Management</option>
                          <option value="Pharmacy">Pharmacy</option>
                        </select>
                        <div className="input-icon">🏛️</div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Section</label>
                      <div className="input-container">
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g., A, B, C"
                          value={form.section || ''} 
                          onChange={(e)=>setForm({...form, section:e.target.value})} 
                        />
                        <div className="input-icon">📚</div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Year</label>
                      <div className="input-container">
                        <select 
                          className="form-select" 
                          value={form.year} 
                          onChange={(e)=>setForm({...form, year:e.target.value})}
                        >
                          <option value="">Select Year</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="Final Year">Final Year</option>
                        </select>
                        <div className="input-icon">📅</div>
                      </div>
                    </div>


                    <div className="form-group">
                      <label className="form-label">Preferred Language</label>
                      <div className="input-container">
                        <select 
                          className="form-select" 
                          value={form.languagePreference} 
                          onChange={(e)=>setForm({...form, languagePreference:e.target.value})}
                        >
                          <option value="en">English</option>
                          <option value="hi">Hindi</option>
                          <option value="te">Telugu</option>
                          <option value="gu">Gujarati</option>
                          <option value="ta">Tamil</option>
                          <option value="kn">Kannada</option>
                        </select>
                        <div className="input-icon">🌐</div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="submit-button">
                  SIGN UP
                </button>

                <div className="form-footer">
                  <p className="signup-link">
                    Already have an account? <Link to="/login" className="link">Log In</Link>
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


