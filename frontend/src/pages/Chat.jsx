import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';
import Profile from '../components/Profile';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [userName, setUserName] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('lang') || 'en');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChatsPanel, setShowChatsPanel] = useState(false);
  const [showTimetablePanel, setShowTimetablePanel] = useState(false);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  // Sessions and timetable
  const [currentSessionId, setCurrentSessionId] = useState(localStorage.getItem('currentSessionId') || 'default');
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sessions') || '["default"]'); } catch { return ['default']; }
  });
  const [timetableFile, setTimetableFile] = useState(null);
  const [timetableLatest, setTimetableLatest] = useState(null);


  const boxRef = useRef(null);
  const navigate = useNavigate();

  // Persist language selection and theme
  useEffect(() => { localStorage.setItem('lang', selectedLanguage); }, [selectedLanguage]);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') { root.setAttribute('data-theme', 'light'); } else { root.removeAttribute('data-theme'); }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setUserName(userData.name || 'Student');
      setUserDepartment(userData.department || userData.branch || '');
    }
    if (messages.length === 0) {
      const departmentText = userDepartment ? ` from the ${userDepartment} department` : '';
      const welcomeMsg = {
        role: 'assistant',
        content: `Hello ${userName || 'Student'}${departmentText}! 👋 Welcome to Vignan University Chat Assistant. I'm here to help you with any questions about the university, academics, admissions, or campus life. How can I assist you today?`
      };
      setMessages([welcomeMsg]);
    }
  }, [userName, userDepartment]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/admin/events`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setEvents(d.events || [])).catch(() => {});
    fetch(`${API_BASE}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: 'show my todos', sessionId: 'default' }) })
      .then(r => r.json()).then(d => {
        if (Array.isArray(d.todos) && d.todos.length) {
          const normalized = d.todos.map(t => ({ title: t.title, done: !!t.done }));
          setTodos(normalized);
          const pending = normalized.filter(t => !t.done);
          if (pending.length > 0) {
            const names = pending.slice(0, 5).map(t => t.title).join(', ');
            setMessages(m => [...m, { role: 'assistant', content: `Reminder: You have ${pending.length} task(s) pending today: ${names}.`, timestamp: new Date() }]);
          }
        } else {
          const lines = String(d.answer || '').split('\n').filter(l => /^\d+\./.test(l)).map(l => l.replace(/^\d+\.\s*/, ''));
          setTodos(lines.map(t => ({ title: t, done: false })));
        }
      }).catch(() => {});
  }, []);

  // Always start with a brand‑new chat when this page opens
  useEffect(() => {
    const id = 's-' + Date.now().toString(36);
    setCurrentSessionId(id);
    setSessions(prev => {
      const next = [id, ...prev.filter(x => x !== id)];
      localStorage.setItem('sessions', JSON.stringify(next));
      return next;
    });
    localStorage.setItem('currentSessionId', id);
    setMessages([]);
  }, []);


  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessions');
    localStorage.removeItem('currentSessionId');
    sessionStorage.removeItem('fresh_session_started');
    navigate('/');
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    setUserName(updatedUser.name || 'Student');
    setUserDepartment(updatedUser.department || updatedUser.branch || '');
  };

  const handleProfileClick = () => {
    setShowProfile(true);
  };

  const speak = (text) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = getLanguageCode(selectedLanguage);
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const getLanguageCode = (lang) => {
    const languageMap = { 'en': 'en-US', 'hi': 'hi-IN', 'te': 'te-IN', 'gu': 'gu-IN', 'ta': 'ta-IN', 'kn': 'kn-IN' };
    return languageMap[lang] || 'en-US';
  };

  const getLanguageName = (lang) => {
    const languageMap = { 'en': 'English', 'hi': 'Hindi', 'te': 'Telugu', 'gu': 'Gujarati', 'ta': 'Tamil', 'kn': 'Kannada' };
    return languageMap[lang] || 'English';
  };

  // Load current session history on change (top-level hook)
  useEffect(() => {
    localStorage.setItem('currentSessionId', currentSessionId);
    if (!sessions.includes(currentSessionId)) {
      const next = [...sessions, currentSessionId];
      setSessions(next);
      localStorage.setItem('sessions', JSON.stringify(next));
    }
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/chat/session/${currentSessionId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const history = Array.isArray(d.conversationHistory) ? d.conversationHistory : [];
        const mapped = history.map(h => ({ role: h.role, content: h.content, timestamp: h.createdAt || new Date() }));
        if (mapped.length) setMessages(mapped);
      })
      .catch(() => {});
  }, [currentSessionId]);

  useEffect(() => {
    if (showTimetablePanel) {
      (async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/user/timetable`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (res.ok) setTimetableLatest(data.latest || null);
        } catch (_) {}
      })();
    }
  }, [showTimetablePanel]);

  const newChat = () => {
    const id = 's-' + Date.now().toString(36);
    setCurrentSessionId(id);
    setMessages([]);
  };

  const uploadTimetable = async () => {
    if (!timetableFile) return;
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', timetableFile);
      const res = await fetch(`${API_BASE}/user/timetable`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessages(m => [...m, { role: 'assistant', content: '✅ Timetable uploaded. You can now ask: What\'s my schedule today?', timestamp: new Date() }]);
      setTimetableFile(null);
      // Refresh current timetable info
      try {
        const r = await fetch(`${API_BASE}/user/timetable`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (r.ok) setTimetableLatest(d.latest || null);
      } catch (_) {}
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `❌ Timetable upload failed: ${e.message}`, timestamp: new Date() }]);
    }
  };

  const deleteTimetable = async () => {
    if (!timetableLatest) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/user/timetable/${timetableLatest._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setMessages(m => [...m, { role: 'assistant', content: '🗑️ Timetable deleted. You can upload a new one anytime.', timestamp: new Date() }]);
      setTimetableLatest(null);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `❌ Delete failed: ${e.message}`, timestamp: new Date() }]);
    }
  };


  const startListening = () => {
    if (listening) { setListening(false); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Speech recognition not supported');
    const rec = new SpeechRecognition();
    rec.lang = getLanguageCode(selectedLanguage);
    rec.interimResults = false;
    rec.onresult = (e) => { const transcript = e.results[0][0].transcript; setInput((prev) => (prev ? prev + ' ' : '') + transcript); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const send = async () => {
    const content = input.trim();
    if (!content) return;

    // Check for profile-related commands
    if (content.toLowerCase().includes('profile') || content.toLowerCase().includes('my details') || content.toLowerCase().includes('show my profile') || content.toLowerCase().includes('open my profile')) {
      setShowProfile(true);
      setInput('');
      return;
    }

    const userMsg = { role: 'user', content, timestamp: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: content, sessionId: currentSessionId, language: selectedLanguage })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      const botMsg = { role: 'assistant', content: data.answer, timestamp: new Date() };
      setMessages((m) => [...m, botMsg]);
      if (Array.isArray(data.todos)) {
        const normalized = data.todos.map(t => (typeof t === 'string' ? { title: t, done: false } : { title: t.title, done: !!t.done }));
        setTodos(normalized);
      }
      if (data.userContext) {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = { ...storedUser, ...data.userContext };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        if (data.userContext.department) { setUserDepartment(data.userContext.department); }
      }
      speak(data.answer);
    } catch (e) {
      const errorMsg = { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}. Please try again.`, timestamp: new Date() };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content) => {
    if (!content || content.trim() === '') { return <p className="message-line">No content</p>; }
    const trimmedContent = content.trim();
    if (!trimmedContent.includes('\n') && !trimmedContent.startsWith('## ') && !trimmedContent.startsWith('**') && !trimmedContent.startsWith('• ') && !trimmedContent.startsWith('- ') && !/^\d+\.\s/.test(trimmedContent)) {
      return <p className="message-line">{trimmedContent}</p>;
    }
    const lines = content.split('\n');
    const formattedLines = [];
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') { formattedLines.push(<br key={`br-${index}`} />); return; }
      if (trimmedLine.startsWith('## ')) { formattedLines.push(<h3 key={index} className="message-header">{trimmedLine.substring(3)}</h3>); return; }
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) { formattedLines.push(<p key={index} className="message-line message-bold">{trimmedLine.substring(2, trimmedLine.length - 2)}</p>); return; }
      if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ')) { formattedLines.push(<div key={index} className="message-bullet"><span className="bullet-point">•</span><span className="bullet-text">{trimmedLine.substring(2)}</span></div>); return; }
      if (/^\d+\.\s/.test(trimmedLine)) { const match = trimmedLine.match(/^(\d+)\.\s(.+)/); if (match) { formattedLines.push(<div key={index} className="message-numbered"><span className="number">{match[1]}.</span><span className="numbered-text">{match[2]}</span></div>); return; } }
      formattedLines.push(<p key={index} className="message-line">{trimmedLine}</p>);
    });
    if (formattedLines.length === 0) { formattedLines.push(<p key="fallback" className="message-line">{content}</p>); }
    return formattedLines;
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <div className={`chat-page ${navOpen ? 'nav-open-layout' : ''}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-content">
          <button className="header-nav-toggle" onClick={() => setNavOpen(v => !v)} aria-label="Toggle menu" style={{ marginRight: '0.75rem' }}>
            {navOpen ? '✕' : '☰'}
          </button>

          <div className="chat-title-section">
            <div className="chat-logo">
              <div className="logo-icon">🎓</div>
            </div>
            <div className="chat-title">
              <h1>Vignan University Assistant</h1>
              <p>Hello, {userName || 'Student'}{userDepartment ? ` (${userDepartment})` : ''}!</p>

            </div>
          </div>
          <div className="header-controls">
            <div className="language-selector">
              <label htmlFor="language-select">🌐</label>
              <select
                id="language-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="language-dropdown"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="te">Telugu</option>
                <option value="gu">Gujarati</option>
                <option value="ta">Tamil</option>
                <option value="kn">Kannada</option>
              </select>
            </div>
            <button
              className="theme-toggle"
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '🌞' : '🌙'}
            </button>

            <button className="sign-out-btn" onClick={handleSignOut}>
              <span className="sign-out-icon">🚪</span>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="chat-layout">
        {/* Left navigation toggle sidebar */}
        <aside className={`sidebar-left ${navOpen ? 'nav-open' : 'nav-collapsed'}`}>
          <div className="user-nav">
            {navOpen && (
              <div className="nav-items">
                <button className="nav-item" onClick={handleProfileClick}><span>👤</span><span>My Profile</span></button>
                <button className="nav-item" onClick={() => setInput('Open settings')}><span>⚙️</span><span>Settings</span></button>
                <button className="nav-item" onClick={() => setShowChatsPanel(true)}><span>💬</span><span>Chats</span></button>
                <button className="nav-item" onClick={() => setShowTimetablePanel(true)}><span>📅</span><span>Timetable</span></button>
                <div className="nav-spacer"></div>
                <button className="nav-item danger" onClick={handleSignOut}><span>🚪</span><span>Logout</span></button>
              </div>
            )}
          </div>
        </aside>

        {/* Chat Container */}
        <main className="chat-main">
          <div className="chat-messages" ref={boxRef}>
            {messages.map((message, i) => (
              <div key={i} className={`message-container ${message.role}`}>
                <div className="message-bubble">
                  <div className="message-content">
                    {message.content ? formatMessage(message.content) : <p className="message-line">No content</p>}
                  </div>
                  <div className="message-time">{formatTime(message.timestamp)}</div>
                </div>
                <div className="message-avatar">{message.role === 'user' ? '👤' : '🤖'}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message-container assistant">
                <div className="message-bubble">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
                <div className="message-avatar">🤖</div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about Vignan University..."
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                className="chat-input-field"
                rows="1"
              />
              <div className="chat-input-actions">
                <button className={`voice-btn ${listening ? 'listening' : ''}`} onClick={startListening} title={listening ? 'Stop Listening' : `Start Voice Input (${getLanguageName(selectedLanguage)})`}>
                  {listening ? '🔴' : '🎤'}
                </button>
                <button className={`speak-btn ${isSpeaking ? 'speaking' : ''}`} onClick={() => speak(input || 'Hello')} title={isSpeaking ? 'Stop Speaking' : `Speak Text (${getLanguageName(selectedLanguage)})`}>
                  {isSpeaking ? '⏹️' : '🔊'}
                </button>
                <button className="send-btn" onClick={send} disabled={!input.trim() || isLoading} title="Send Message">
                  <span className="send-icon">✈️</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar: To‑Dos then Events */}
        <aside className="sidebar-right">
          <div className="section-card">
            <h2 style={{ marginBottom: '0.5rem' }}>✅ Today's To‑Dos</h2>
            <div className="todos-list">
              {todos.map((t, i) => (
                <div key={i} className="todo-item">{typeof t === 'string' ? t : `${t.done ? '✅' : '⬜'} ${t.title}`}</div>
              ))}
              {todos.length === 0 && <div className="muted">No items for today. Mention your homework to create tasks.</div>}
            </div>
          </div>
          <div className="section-card" style={{ marginTop: '1rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>📅 Upcoming Events</h2>
            <div className="events-list">
              {events.map(ev => (
                <button key={ev._id} className="event-item" onClick={() => setInput(`Tell me about the event: ${ev.title}.`)}>
                  <img src={(ev.imageUrl && ev.imageUrl.trim()) ? ev.imageUrl : (ev.imagePath && ev.imagePath.trim()) ? ev.imagePath : ''} alt={ev.title} className="event-thumb" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                  <div className="event-meta">
                    <div className="event-title">{ev.title}</div>
                  </div>
                </button>
              ))}
              {events.length === 0 && <div className="muted">No events yet.</div>}
            </div>
          </div>
        </aside>
      </div>

      {/* Profile Modal */}
      {showProfile && user && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Chats Panel (right drawer) */}
      {showChatsPanel && (
        <div className="profile-overlay" onClick={() => setShowChatsPanel(false)}>
          <div className="profile-sidebar" onClick={(e)=>e.stopPropagation()}>
            <div className="profile-header">
              <h2>Chats</h2>
              <button className="close-btn" onClick={() => setShowChatsPanel(false)}>✕</button>
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <h3>Sessions</h3>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                  <select value={currentSessionId} onChange={(e)=>setCurrentSessionId(e.target.value)} className="session-select">
                    {sessions.map(id => (<option key={id} value={id}>{id}</option>))}
                  </select>
                  <button className="new-chat-btn" onClick={() => { newChat(); setShowChatsPanel(false); }}>+ New</button>
                </div>
                <div style={{ display:'grid', gap:'.5rem' }}>
                  {sessions.map(id => (
                    <button key={id} className="nav-item" onClick={()=>{ setCurrentSessionId(id); setShowChatsPanel(false); }}>
                      <span>💬</span><span>{id}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timetable Panel (right drawer) */}
      {showTimetablePanel && (
        <div className="profile-overlay" onClick={() => setShowTimetablePanel(false)}>
          <div className="profile-sidebar" onClick={(e)=>e.stopPropagation()}>
            <div className="profile-header">
              <h2>Timetable</h2>
              <button className="close-btn" onClick={() => setShowTimetablePanel(false)}>✕</button>
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <h3>Current</h3>
                {timetableLatest ? (
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem', marginBottom:'.5rem'}}>
                    <div>
                      <div style={{fontWeight:600}}>{timetableLatest.displayName || timetableLatest.originalName}</div>
                      <div className="muted" style={{fontSize:'0.85rem'}}>Uploaded {new Date(timetableLatest.updatedAt || timetableLatest.createdAt).toLocaleString()}</div>
                    </div>
                    <button className="danger-btn" onClick={deleteTimetable}>Delete</button>
                  </div>
                ) : (
                  <div className="muted" style={{ marginBottom: '.5rem' }}>No timetable uploaded yet.</div>
                )}
                <hr/>
                <h3>Upload</h3>
                <input type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={(e)=>setTimetableFile(e.target.files?.[0] || null)} />
                <div style={{ marginTop: '0.5rem', display:'flex', gap:'.5rem' }}>
                  <button className="upload-btn" onClick={async()=>{ await uploadTimetable(); setShowTimetablePanel(false); }} disabled={!timetableFile}>Upload</button>
                  <button className="profile-btn" onClick={()=> setShowTimetablePanel(false)}>Close</button>
                </div>
                <div className="muted" style={{ marginTop: '0.75rem' }}>After uploading, ask: "What's my schedule today?", "Which classes today?", or "Which subjects today?"</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








