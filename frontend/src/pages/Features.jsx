import Header from '../components/Header';
import Footer from '../components/Footer';
import './styles.css';

export default function Features() {
  return (
    <div className="landing">
      <Header />
      <main className="main-content">
        <section className="features-section">
          <div className="features-container">
            <h2 className="features-title">All Features</h2>

            {/* Stats bar */}
            <div className="feature-stats">
              <div className="stat">
                <span className="stat-value">10k+</span>
                <span className="stat-label">Students assisted</span>
              </div>
              <div className="stat">
                <span className="stat-value">6+</span>
                <span className="stat-label">Languages supported</span>
              </div>
              <div className="stat">
                <span className="stat-value">99.9%</span>
                <span className="stat-label">Uptime</span>
              </div>
              <div className="stat">
                <span className="stat-value">24/7</span>
                <span className="stat-label">Smart support</span>
              </div>
            </div>

            {/* Primary feature grid */}
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">✅</div>
                <h3>Smart To‑Do</h3>
                <p>Create tasks, set reminders, and track deadlines effortlessly.</p>
                <ul className="feature-list">
                  <li>Auto-prioritized tasks</li>
                  <li>One‑tap reminders</li>
                  <li>Calendar sync</li>
                </ul>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h3>Personalized</h3>
                <p>Understands your courses, schedule, and past interactions.</p>
                <ul className="feature-list">
                  <li>Adaptive responses</li>
                  <li>Context memory</li>
                  <li>Role‑aware guidance</li>
                </ul>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🌐</div>
                <h3>Multilingual</h3>
                <p>Communicate in 6+ Indian languages with seamless switching.</p>
                <ul className="feature-list">
                  <li>Instant translation</li>
                  <li>Mixed‑language chat</li>
                  <li>Locale‑aware formatting</li>
                </ul>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📚</div>
                <h3>Knowledge Base</h3>
                <p>Always‑updated university information and resources.</p>
                <ul className="feature-list">
                  <li>Policies & circulars</li>
                  <li>Events & notices</li>
                  <li>FAQs curated by admins</li>
                </ul>
              </div>
            </div>

            {/* Benefits strip */}
            <div className="benefits">
              <div className="benefit"><span>⚡</span><p>Fast, accurate answers</p></div>
              <div className="benefit"><span>🔒</span><p>Privacy‑first by design</p></div>
              <div className="benefit"><span>🧭</span><p>Guides you step‑by‑step</p></div>
              <div className="benefit"><span>📈</span><p>Keeps improving weekly</p></div>
            </div>

            {/* How it works */}
            <div className="how-it-works">
              <h3 className="section-title">How it works</h3>
              <div className="steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <h4>Ask anything</h4>
                  <p>From timetable to fees, placements, or study tips.</p>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <h4>AI finds answers</h4>
                  <p>Searches curated knowledge and real‑time sources.</p>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <h4>Take action</h4>
                  <p>Create todos, set reminders, or open links instantly.</p>
                </div>
              </div>
            </div>

            {/* Detailed feature rows */}
            <div className="feature-rows">
              <div className="row-card">
                <div className="row-icon">🔔</div>
                <div className="row-content">
                  <h4>Smart Reminders</h4>
                  <p>Never miss deadlines with context‑aware nudges for exams, dues, and events.</p>
                </div>
              </div>
              <div className="row-card">
                <div className="row-icon">🗂️</div>
                <div className="row-content">
                  <h4>Organized Resources</h4>
                  <p>Find syllabi, circulars, and department contacts in one place.</p>
                </div>
              </div>
              <div className="row-card">
                <div className="row-icon">🛡️</div>
                <div className="row-content">
                  <h4>Secure by Default</h4>
                  <p>Your chats stay private. We use role‑based access and encryption.</p>
                </div>
              </div>
            </div>

            {/* FAQ mini section */}
            <div className="mini-faq">
              <h3 className="section-title">Quick FAQs</h3>
              <div className="faq-grid-mini">
                <div className="faq-mini-card">
                  <h5>Can I use it on mobile?</h5>
                  <p>Yes, the UI is fully responsive and touch‑friendly.</p>
                </div>
                <div className="faq-mini-card">
                  <h5>Does it support Telugu/Hindi?</h5>
                  <p>Yes, you can switch languages anytime during chat.</p>
                </div>
                <div className="faq-mini-card">
                  <h5>Who updates the info?</h5>
                  <p>Admins maintain an official, versioned knowledge base.</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="cta-banner">
              <div>
                <h3>Ready to try Vignan AI?</h3>
                <p>Sign in and ask your first question. It’s that simple.</p>
              </div>
              <div className="cta-actions">
                <a href="/login" className="cta-button primary"><span className="button-icon">🚀</span>Get Started</a>
                <a href="/features" className="cta-button secondary">See Demo</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}


