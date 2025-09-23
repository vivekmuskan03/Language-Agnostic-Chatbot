import Header from '../components/Header';
import Footer from '../components/Footer';
import './styles.css';

export default function Support() {
  return (
    <div className="landing">
      <Header />
      <main className="main-content">
        <section className="features-section">
          <div className="features-container">
            <h2 className="features-title">Support</h2>

            <div className="support-grid">
              <div className="support-card">
                <h4>Getting Started</h4>
                <p className="mini">Sign in, pick your language, and ask anything about courses, fees, or events.</p>
              </div>
              <div className="support-card">
                <h4>Troubleshooting</h4>
                <p className="mini">If responses are slow, check internet, refresh the page, or clear cache/storage.</p>
              </div>
              <div className="support-card">
                <h4>Voice & Mic</h4>
                <p className="mini">Allow mic permissions in the browser. Use wired headsets for best accuracy.</p>
              </div>
              <div className="support-card">
                <h4>Privacy & Data</h4>
                <p className="mini">We store chats securely; only authorized admins view logs to improve answers.</p>
              </div>
              <div className="support-card">
                <h4>Knowledge Updates</h4>
                <p className="mini">University circulars and FAQs are updated regularly by the admin team.</p>
              </div>
              <div className="support-card">
                <h4>Contact Support</h4>
                <p className="mini">Email support@vignan.example for account help, or open the chat to ask now.</p>
              </div>
            </div>

            <div className="support-cta">
              <div>
                <h4>Need more help?</h4>
                <p className="mini">Try our assistant for instant answers, or send us a quick email.</p>
              </div>
              <div className="cta-actions">
                <a href="/chat" className="cta-button primary">Open Chat</a>
                <a href="mailto:support@vignan.example" className="cta-button secondary">Email Support</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}


