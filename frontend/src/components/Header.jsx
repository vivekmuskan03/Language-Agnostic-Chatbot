import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Header() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = now.toLocaleDateString();

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-placeholder">
            <div className="logo-shield">
              <div className="logo-emblem">V</div>
            </div>
            <div className="logo-text">
              <span className="logo-main">Vignan AI</span>
            </div>
          </div>
        </div>
        <nav className="navigation">
          <Link to="/" className="nav-link active">Home</Link>
          <Link to="/features" className="nav-link">Features</Link>
          <Link to="/support" className="nav-link">Support</Link>
        </nav>
        <div className="header-buttons">
          <div className="navbar-clock" title={dateString}>{timeString}</div>
          <Link to="/login" className="btn-student">Student Login</Link>
          <Link to="/admin" className="btn-admin">Admin Login</Link>
        </div>
      </div>
    </header>
  );
}


