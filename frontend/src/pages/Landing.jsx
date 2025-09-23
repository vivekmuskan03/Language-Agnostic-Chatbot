import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Mascot from '../components/Mascot';
import './styles.css';

export default function Landing() {
  return (
    <div className="landing">
      <Header />

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-container">
          {/* Left Side - Text Content */}
          <div className="text-content">
            <h1 className="main-headline">
              Empower Your Learning Journey
            </h1>
            <p className="sub-headline">
              The intelligent AI assistant built for Vignan University students.
            </p>
            <div className="cta-buttons">
              <Link to="/login" className="cta-button primary">
                Get Instant Answers
              </Link>
              <Link to="#features" className="cta-button secondary">
                Explore Features
              </Link>
            </div>
          </div>

          {/* Right Side - Mascot Showcase */}
          <div className="hero-showcase">
            <Mascot />
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="features-container">
          <h2 className="features-title">Why Choose Vignan Chatbot?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🌐</div>
              <h3>Multilingual Support</h3>
              <p>Communicate in English, Hindi, Telugu, Gujarati, Tamil, and Kannada for seamless interaction.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered</h3>
              <p>Powered by advanced Gemini AI for intelligent, context-aware responses to all your queries.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎤</div>
              <h3>Voice Interaction</h3>
              <p>Speak naturally with voice input and get responses through speech synthesis technology.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📚</div>
              <h3>Knowledge Base</h3>
              <p>Continuously updated knowledge base with university information, policies, and resources.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>24/7 Available</h3>
              <p>Get instant help anytime, anywhere with our always-available chatbot assistant.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure & Private</h3>
              <p>Your conversations are secure and private, ensuring safe and confidential interactions.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Background Elements */}
      <div className="background-elements">
        <div className="bg-circle circle-1"></div>
        <div className="bg-circle circle-2"></div>
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
        <div className="bg-shape shape-4"></div>
      </div>
    </div>
  );
}


