import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer-section" id="contact">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="footer-logo-shield">
                <div className="footer-logo-checkmark">✓</div>
              </div>
              <div className="footer-logo-text">
                <span className="footer-logo-main">Vignan</span>
                <span className="footer-logo-sub">UNIVERSITY</span>
              </div>
            </div>
            <p className="footer-description">
              Empowering students and faculty with intelligent chatbot assistance for a better university experience.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Quick Links</h4>
              <Link to="/">Home</Link>
              <Link to="/features">Features</Link>
              <Link to="/login">Student Login</Link>
              <Link to="/admin">Admin Login</Link>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <a href="#contact">Contact Us</a>
              <a href="#help">Help Center</a>
              <a href="#faq">FAQ</a>
              <a href="#privacy">Privacy Policy</a>
            </div>
            <div className="footer-column">
              <h4>Connect</h4>
              <a href="#facebook">Facebook</a>
              <a href="#twitter">Twitter</a>
              <a href="#linkedin">LinkedIn</a>
              <a href="#instagram">Instagram</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Vignan University. All rights reserved.</p>
          <p>Designed with ❤️ for better student experience</p>
        </div>
      </div>
    </footer>
  );
}


