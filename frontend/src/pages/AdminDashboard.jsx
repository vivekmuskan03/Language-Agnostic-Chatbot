import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  const [faq, setFaq] = useState({ question: '', answer: '', category: 'general' });
  const [editingFaq, setEditingFaq] = useState(null);
  const [fileCategory, setFileCategory] = useState('general');
  const [logs, setLogs] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [ingestUrlState, setIngestUrlState] = useState({ url: '', category: 'general', title: '' });
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', category: 'events', startsAt: '', endsAt: '', image: null, imageUrl: '' });
  const [concerningConversations, setConcerningConversations] = useState([]);
  const [conversationStats, setConversationStats] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [students, setStudents] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  
  // Filter and search states
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [fileFilterCategory, setFileFilterCategory] = useState('all');
  const [faqSearchTerm, setFaqSearchTerm] = useState('');
  const [faqFilterCategory, setFaqFilterCategory] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  
  const navigate = useNavigate();

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'events', label: 'Events' },
    { value: 'fees', label: 'Fees' },
    { value: 'notices', label: 'Notices' },
    { value: 'cse', label: 'Computer Science and Engineering' },
    { value: 'ece', label: 'Electronics and Communication Engineering' },
    { value: 'me', label: 'Mechanical Engineering' },
    { value: 'ce', label: 'Civil Engineering' },
    { value: 'ee', label: 'Electrical Engineering' },
    { value: 'it', label: 'Information Technology' },
    { value: 'management', label: 'Management' },
    { value: 'pharmacy', label: 'Pharmacy' }
  ];

  const adminToken = localStorage.getItem('adminToken');

  const loadLogs = async (query = {}) => {
    try {
      const params = new URLSearchParams(query).toString();
      const res = await fetch(`${API_BASE}/admin/logs${params ? `?${params}` : ''}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    const data = await res.json();
    setLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const loadUploadedFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/files`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      console.log('Loaded files:', data.files);
      setUploadedFiles(data.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const loadFaqs = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/faqs`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setFaqs(data.faqs || []);
    } catch (error) {
      console.error('Error loading FAQs:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/students`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setStudents(data.students || []);
    } catch (e) {
      console.error('Error loading students', e);
    }
  };

  const deleteStudent = async (studentId) => {
    if (!confirm('Are you sure you want to delete this student record?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (res.ok) {
        showMessage('Student record deleted successfully', 'success');
        loadStudents();
      } else {
        const data = await res.json();
        showMessage(data.error || 'Failed to delete student record', 'error');
      }
    } catch (e) {
      showMessage('Error deleting student record: ' + e.message, 'error');
    }
  };

  useEffect(() => { 
    loadLogs(); 
    loadUploadedFiles();
    loadFaqs();
    loadEvents();
    loadConcerningConversations();
    loadConversationStats();
    loadStudents();
  }, [activeTab]);

  const showMessage = (message, type = 'success') => {
    setMsg(message);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  };

  const upload = async () => {
    if (!file) {
      showMessage('Please select a file', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', fileCategory);
      if (customFileName.trim()) {
        fd.append('customFilename', customFileName.trim());
      }
      
      const res = await fetch(`${API_BASE}/admin/upload`, { 
        method: 'POST', 
        headers: { Authorization: `Bearer ${adminToken}` },
        body: fd 
      });
      const data = await res.json();
      
      if (res.ok) {
        showMessage('File uploaded and processed successfully!', 'success');
        setFile(null);
        setCustomFileName('');
        setFileCategory('general');
        loadUploadedFiles();
      } else {
        showMessage(data.error || 'Upload failed', 'error');
      }
    } catch (error) {
      showMessage('Upload failed: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const addFaq = async () => {
    if (!faq.question || !faq.answer || !faq.category) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/faq`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }, 
        body: JSON.stringify(faq) 
      });
      const data = await res.json();
      
      if (res.ok) {
        showMessage('FAQ added successfully!', 'success');
        setFaq({ question: '', answer: '', category: 'general' });
        loadFaqs();
      } else {
        showMessage(data.error || 'Failed to add FAQ', 'error');
      }
    } catch (error) {
      showMessage('Failed to add FAQ: ' + error.message, 'error');
    }
  };

  const updateFaq = async () => {
    if (!editingFaq.question || !editingFaq.answer || !editingFaq.category) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/faqs/${editingFaq._id}`, { 
        method: 'PUT', 
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }, 
        body: JSON.stringify({
          question: editingFaq.question,
          answer: editingFaq.answer,
          category: editingFaq.category
        }) 
      });
      const data = await res.json();
      
      if (res.ok) {
        showMessage('FAQ updated successfully!', 'success');
        setEditingFaq(null);
        loadFaqs();
      } else {
        showMessage(data.error || 'Failed to update FAQ', 'error');
      }
    } catch (error) {
      showMessage('Failed to update FAQ: ' + error.message, 'error');
    }
  };

  const startEditFaq = (faqItem) => {
    setEditingFaq({ ...faqItem });
  };

  const cancelEditFaq = () => {
    setEditingFaq(null);
  };

  const deleteFaq = async (faqId) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/faqs/${faqId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (res.ok) {
        showMessage('FAQ deleted successfully!', 'success');
        loadFaqs();
      } else {
        showMessage('Failed to delete FAQ', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete FAQ: ' + error.message, 'error');
    }
  };

  const deleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (res.ok) {
        showMessage('File deleted successfully!', 'success');
        loadUploadedFiles();
      } else {
        showMessage('Failed to delete file', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete file: ' + error.message, 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  const handleTrainModel = async () => {
    try {
      setIsTraining(true);
      const response = await fetch(`${API_BASE}/admin/train-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showMessage('Model training completed successfully!', 'success');
      } else {
        showMessage(data.error || 'Failed to train model', 'error');
      }
    } catch (error) {
      console.error('Error training model:', error);
      showMessage('Error training model: ' + error.message, 'error');
    } finally {
      setIsTraining(false);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/events`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      console.error('Error loading events', e);
    }
  };

  const loadConcerningConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/concerning-conversations`, { 
        headers: { Authorization: `Bearer ${adminToken}` } 
      });
      const data = await res.json();
      setConcerningConversations(data.concerningConversations || []);
    } catch (e) {
      console.error('Error loading concerning conversations', e);
    }
  };

  const loadConversationStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/concerning-conversations-stats`, { 
        headers: { Authorization: `Bearer ${adminToken}` } 
      });
      const data = await res.json();
      setConversationStats(data);
    } catch (e) {
      console.error('Error loading conversation stats', e);
    }
  };

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.description) {
      showMessage('Please enter title and description', 'error');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', newEvent.title);
      fd.append('description', newEvent.description);
      fd.append('category', newEvent.category || 'events');
      if (newEvent.startsAt) fd.append('startsAt', newEvent.startsAt);
      if (newEvent.endsAt) fd.append('endsAt', newEvent.endsAt);
      if (newEvent.image) fd.append('image', newEvent.image);
      if (newEvent.imageUrl) fd.append('imageUrl', newEvent.imageUrl);
      const res = await fetch(`${API_BASE}/admin/events`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: fd });
      const data = await res.json();
      if (res.ok) {
        showMessage('Event created!', 'success');
        setNewEvent({ title: '', description: '', category: 'events', startsAt: '', endsAt: '', image: null, imageUrl: '' });
        loadEvents();
      } else {
        showMessage(data.error || 'Failed to create event', 'error');
      }
    } catch (e) {
      showMessage('Failed to create event: ' + e.message, 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/events/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
      if (res.ok) {
        showMessage('Event deleted', 'success');
        loadEvents();
      } else {
        showMessage('Failed to delete event', 'error');
      }
    } catch (e) {
      showMessage('Failed to delete event: ' + e.message, 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const updateConversation = async (conversationId, updates) => {
    try {
      const res = await fetch(`${API_BASE}/admin/concerning-conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}` 
        },
        body: JSON.stringify(updates)
      });
      
      if (res.ok) {
        showMessage('Conversation updated successfully!', 'success');
        loadConcerningConversations();
        setSelectedConversation(null);
        setAdminNotes('');
      } else {
        showMessage('Failed to update conversation', 'error');
      }
    } catch (e) {
      showMessage('Failed to update conversation: ' + e.message, 'error');
    }
  };

  const deleteConversation = async (conversationId) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/concerning-conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (res.ok) {
        showMessage('Conversation deleted successfully!', 'success');
        loadConcerningConversations();
        setSelectedConversation(null);
      } else {
        showMessage('Failed to delete conversation', 'error');
      }
    } catch (e) {
      showMessage('Failed to delete conversation: ' + e.message, 'error');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ff4444';
      case 'high': return '#ff8800';
      case 'medium': return '#ffaa00';
      case 'low': return '#44aa44';
      default: return '#666666';
    }
  };

  const getConcernTypeIcon = (type) => {
    switch (type) {
      case 'suicide': return '🚨';
      case 'self_harm': return '⚠️';
      case 'depression': return '😔';
      case 'anxiety': return '😰';
      case 'academic_stress': return '📚';
      default: return '💭';
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'txt': return '📃';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️';
      default: return '📁';
    }
  };

  const getCategoryLabel = (categoryValue) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  // Filter and search functions
  const filteredFiles = uploadedFiles.filter(file => {
    const searchTerm = fileSearchTerm.toLowerCase().trim();
    const fileName = (file.displayName || file.filename || file.originalName || '').toLowerCase();
    const matchesSearch = searchTerm === '' || fileName.includes(searchTerm);
    const matchesCategory = fileFilterCategory === 'all' || file.category === fileFilterCategory;
    
    // Debug logging
    if (fileSearchTerm && fileSearchTerm.length > 0) {
      console.log('Searching for:', searchTerm, 'in file:', fileName, 'matches:', matchesSearch);
    }
    
    return matchesSearch && matchesCategory;
  });

  const filteredFaqs = faqs.filter(faq => {
    const searchTerm = faqSearchTerm.toLowerCase().trim();
    const question = (faq.question || '').toLowerCase();
    const answer = (faq.answer || '').toLowerCase();
    const matchesSearch = searchTerm === '' || question.includes(searchTerm) || answer.includes(searchTerm);
    const matchesCategory = faqFilterCategory === 'all' || faq.category === faqFilterCategory;
    return matchesSearch && matchesCategory;
  });

  // Group files by category
  const filesByCategory = filteredFiles.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = [];
    }
    acc[file.category].push(file);
    return acc;
  }, {});

  // Group FAQs by category
  const faqsByCategory = filteredFaqs.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {});

  const toggleCategory = (category) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-title-section">
            <div className="admin-logo">
              <div className="logo-icon">⚙️</div>
            </div>
            <div className="admin-title">
              <h1>Admin Dashboard</h1>
              <p>Vignan University AI Management</p>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={handleLogout}>
            <span className="logout-icon">🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-nav">
        <button 
          className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 Upload Files
        </button>
        <button 
          className={`nav-tab ${activeTab === 'student-data' ? 'active' : ''}`}
          onClick={() => setActiveTab('student-data')}
        >
          👨‍🎓 Student Data
        </button>
        <button 
          className={`nav-tab ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          ❓ Manage FAQs
        </button>
        <button 
          className={`nav-tab ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => setActiveTab('url')}
        >
          🌐 Ingest URL
        </button>
        <button 
          className={`nav-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 File Library
        </button>
        <button 
            className={`nav-tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            📅 Events
          </button>
          
          <button 
            className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            📊 Chat Logs
          </button>
        <button 
          className={`nav-tab ${activeTab === 'concerning' ? 'active' : ''}`}
          onClick={() => setActiveTab('concerning')}
        >
          🚨 Concerning Conversations
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>📤 Upload Knowledge Files</h2>
              <p>Upload PDF, DOC, TXT, or image files to enhance the AI's knowledge base</p>
              
              <div className="upload-area">
                <div className="form-group">
                  <label>Select Category</label>
                  <select 
                    value={fileCategory}
                    onChange={(e) => setFileCategory(e.target.value)}
                    className="form-input"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="file-input-wrapper">
                  <input 
                    type="file" 
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="file-input"
                  />
                  <label htmlFor="file-upload" className="file-input-label">
                    <div className="upload-icon">📁</div>
                    <div className="upload-text">
                      {file ? file.name : 'Choose a file or drag it here'}
                    </div>
                    <div className="upload-subtext">Supports PDF, DOC, TXT, Images</div>
                  </label>
                </div>

                <div className="form-group">
                  <label>Custom File Name (Optional)</label>
                  <input 
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="Enter a custom name for this file..."
                    className="form-input"
                  />
                  <small className="form-help">Leave empty to use original filename</small>
                </div>

                <button 
                  className="upload-btn" 
                  onClick={upload}
                  disabled={!file || isLoading}
                >
                  {isLoading ? '⏳ Processing...' : '🚀 Upload & Process'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* URL Ingest Tab */}
        {activeTab === 'url' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>🌐 Ingest Web Article</h2>
              <p>Fetch a web page and add its content to the knowledge base</p>
              <div className="form-group">
                <label>URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/article"
                  value={ingestUrlState.url}
                  onChange={(e) => setIngestUrlState({ ...ingestUrlState, url: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Title (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Custom title to display"
                  value={ingestUrlState.title}
                  onChange={(e) => setIngestUrlState({ ...ingestUrlState, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  className="form-input"
                  value={ingestUrlState.category}
                  onChange={(e) => setIngestUrlState({ ...ingestUrlState, category: e.target.value })}
                >
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <button
                className="upload-btn"
                onClick={async () => {
                  if (!ingestUrlState.url) {
                    showMessage('Please enter a URL', 'error');
                    return;
                  }
                  setIsUrlLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/admin/ingest-url`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                      body: JSON.stringify(ingestUrlState)
                    });
                    const data = await res.json();
                    if (res.ok) {
                      showMessage(`URL ingested successfully! Items created: ${data.knowledgeItemsCreated}`, 'success');
                      setIngestUrlState({ url: '', category: 'general', title: '' });
                    } else {
                      showMessage(data.error || 'Failed to ingest URL', 'error');
                    }
                  } catch (err) {
                    showMessage('Failed to ingest URL: ' + err.message, 'error');
                  } finally {
                    setIsUrlLoading(false);
                  }
                }}
                disabled={isUrlLoading}
              >
                {isUrlLoading ? '⏳ Ingesting...' : '🚀 Ingest URL'}
              </button>
            </div>
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>❓ Manage FAQs</h2>
              <p>Add and manage frequently asked questions organized by category</p>
              
              <div className="faq-form">
                <h3>{editingFaq ? 'Edit FAQ' : 'Add New FAQ'}</h3>
                
                <div className="form-group">
                  <label>Category</label>
                  <select 
                    value={editingFaq ? editingFaq.category : faq.category}
                    onChange={(e) => {
                      if (editingFaq) {
                        setEditingFaq({...editingFaq, category: e.target.value});
                      } else {
                        setFaq({...faq, category: e.target.value});
                      }
                    }}
                    className="form-input"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Question</label>
                  <input 
                    type="text"
                    value={editingFaq ? editingFaq.question : faq.question}
                    onChange={(e) => {
                      if (editingFaq) {
                        setEditingFaq({...editingFaq, question: e.target.value});
                      } else {
                        setFaq({...faq, question: e.target.value});
                      }
                    }}
                    placeholder="Enter the question..."
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Answer</label>
                  <textarea 
                    value={editingFaq ? editingFaq.answer : faq.answer}
                    onChange={(e) => {
                      if (editingFaq) {
                        setEditingFaq({...editingFaq, answer: e.target.value});
                      } else {
                        setFaq({...faq, answer: e.target.value});
                      }
                    }}
                    placeholder="Enter the answer..."
                    className="form-textarea"
                    rows="4"
                  />
                </div>
                
                <div className="form-actions">
                  {editingFaq ? (
                    <>
                      <button className="update-faq-btn" onClick={updateFaq}>
                        💾 Update FAQ
                      </button>
                      <button className="cancel-btn" onClick={cancelEditFaq}>
                        ❌ Cancel
                      </button>
                    </>
                  ) : (
                    <button className="add-faq-btn" onClick={addFaq}>
                      ➕ Add FAQ
                    </button>
                  )}
                </div>
              </div>

              {/* FAQ Search and Filter */}
              <div className="search-filter-section">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search FAQs..."
                    value={faqSearchTerm}
                    onChange={(e) => setFaqSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  <div className="search-icon">🔍</div>
                </div>
                <div className="filter-dropdown">
                  <select
                    value={faqFilterCategory}
                    onChange={(e) => setFaqFilterCategory(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FAQ List */}
              <div className="faq-list">
                <h3>Existing FAQs ({filteredFaqs.length})</h3>
                {filteredFaqs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">❓</div>
                    <h3>{faqs.length === 0 ? 'No FAQs added yet' : 'No FAQs match your search'}</h3>
                    <p>{faqs.length === 0 ? 'Add some FAQs to get started' : 'Try adjusting your search or filter'}</p>
                  </div>
                ) : (
                  <div className="faq-categories">
                    {Object.entries(faqsByCategory).map(([category, categoryFaqs]) => (
                      <div key={category} className="category-section">
                        <div 
                          className="category-header"
                          onClick={() => toggleCategory(category)}
                        >
                          <div className="category-title">
                            <span className="category-icon">
                              {expandedCategories.has(category) ? '📂' : '📁'}
                            </span>
                            {getCategoryLabel(category)} ({categoryFaqs.length})
                          </div>
                          <div className="expand-icon">
                            {expandedCategories.has(category) ? '▼' : '▶'}
                          </div>
                        </div>
                        {expandedCategories.has(category) && (
                          <div className="category-content">
                            <div className="faq-grid">
                              {categoryFaqs.map((faqItem) => (
                                <div key={faqItem._id} className="faq-card">
                                  <div className="faq-header">
                                    <div className="faq-category">
                                      {getCategoryLabel(faqItem.category)}
                                    </div>
                                    <div className="faq-actions">
                                      <button 
                                        className="edit-btn"
                                        onClick={() => startEditFaq(faqItem)}
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button 
                                        className="delete-btn"
                                        onClick={() => deleteFaq(faqItem._id)}
                                      >
                                        🗑️ Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className="faq-question">
                                    <strong>Q:</strong> {faqItem.question}
                                  </div>
                                  <div className="faq-answer">
                                    <strong>A:</strong> {faqItem.answer}
                                  </div>
                                  <div className="faq-date">
                                    Added: {formatDate(faqItem.createdAt)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>📁 File Library</h2>
              <p>Manage uploaded knowledge files organized by category</p>
              {uploadedFiles.length > 0 && (
                <div className="search-results-info">
                  <span className="results-count">
                    {fileSearchTerm || fileFilterCategory !== 'all' 
                      ? `Showing ${filteredFiles.length} of ${uploadedFiles.length} files`
                      : `${uploadedFiles.length} files total`
                    }
                  </span>
                </div>
              )}
              
              {/* File Search and Filter */}
              <div className="search-filter-section">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={fileSearchTerm}
                    onChange={(e) => {
                      setFileSearchTerm(e.target.value);
                      console.log('Search term changed to:', e.target.value);
                    }}
                    className="search-input"
                  />
                  <div className="search-icon">🔍</div>
                </div>
                <div className="filter-dropdown">
                  <select
                    value={fileFilterCategory}
                    onChange={(e) => setFileFilterCategory(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="files-categories">
                {uploadedFiles.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <h3>No files uploaded yet</h3>
                    <p>Upload some files to get started</p>
                  </div>
                ) : Object.keys(filesByCategory).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>No files match your search</h3>
                    <p>Try adjusting your search term or filter category</p>
                    <div className="search-debug">
                      <p><strong>Search term:</strong> "{fileSearchTerm}"</p>
                      <p><strong>Filter category:</strong> {fileFilterCategory}</p>
                      <p><strong>Total files:</strong> {uploadedFiles.length}</p>
                    </div>
                  </div>
                ) : (
                  Object.entries(filesByCategory).map(([category, categoryFiles]) => (
                    <div key={category} className="category-section">
                      <div 
                        className="category-header"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="category-title">
                          <span className="category-icon">
                            {expandedCategories.has(category) ? '📂' : '📁'}
                          </span>
                          {getCategoryLabel(category)} ({categoryFiles.length})
                        </div>
                        <div className="expand-icon">
                          {expandedCategories.has(category) ? '▼' : '▶'}
                        </div>
                      </div>
                      {expandedCategories.has(category) && (
                        <div className="category-content">
                          <div className="files-grid">
                            {categoryFiles.map((file) => (
                              <div key={file._id} className="file-card">
                                <div className="file-icon">{getFileIcon(file.filename)}</div>
                                <div className="file-info">
                                  <h4>{file.displayName || file.originalName || file.filename}</h4>
                                  <p><strong>Category:</strong> {getCategoryLabel(file.category)}</p>
                                  <p>Size: {file.size} bytes</p>
                                  <p>Uploaded: {formatDate(file.uploadedAt)}</p>
                                  <p>Status: {file.status || 'Processed'}</p>
                                </div>
                                <div className="file-actions">
                                  <button 
                                    className="delete-btn"
                                    onClick={() => deleteFile(file._id)}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Student Data Tab */}
        {activeTab === 'student-data' && (
          <div className="tab-content">
            <h2>👨‍🎓 Student Data Management</h2>
            <p>Upload CSV or Excel files containing student data. The AI will use this information to provide personalized responses based on registration numbers.</p>
            
            <div className="upload-section">
              <div className="upload-actions">
                <div className="file-drop-area" 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('drag-over');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                    if (e.dataTransfer.files.length) {
                      setUploadFile(e.dataTransfer.files[0]);
                      e.currentTarget.classList.add('has-file');
                      e.currentTarget.setAttribute('data-filename', e.dataTransfer.files[0].name);
                    }
                  }}
                >
                  <div className="file-icon">
                    <i className="fas fa-file-excel"></i>
                  </div>
                  <p>Drag and drop a CSV or Excel file here</p>
                  <p className="small">or</p>
                  <input 
                    type="file" 
                    id="student-file" 
                    accept=".csv,.xlsx,.xls" 
                    style={{display: 'none'}} 
                    onChange={(e) => {
                      if (e.target.files.length) {
                        setUploadFile(e.target.files[0]);
                        document.querySelector('.file-drop-area').classList.add('has-file');
                        document.querySelector('.file-drop-area').setAttribute('data-filename', e.target.files[0].name);
                      }
                    }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => document.getElementById('student-file').click()}
                  >
                    Browse Files
                  </button>
                  <p className="small">Supports CSV, XLS, XLSX</p>
                </div>
                
                <div className="button-group">
                  <button 
                    className="btn btn-primary mt-3"
                    disabled={isUploading || !uploadFile}
                    onClick={async () => {
                      if (!uploadFile) {
                        showMessage('Please select a file to upload', 'error');
                        return;
                      }
                      
                      setIsUploading(true);
                      const formData = new FormData();
                      formData.append('file', uploadFile);
                      
                      try {
                        const res = await fetch(`${API_BASE}/admin/upload-student-data`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${adminToken}` },
                          body: formData
                        });
                        
                        const data = await res.json();
                        
                        if (res.ok) {
                          showMessage(`Student data uploaded successfully! Processed: ${data.results.total}, Created: ${data.results.created}, Updated: ${data.results.updated}`, 'success');
                          setFile(null);
                          loadUploadedFiles();
                        } else {
                          showMessage(data.error || 'Failed to upload student data', 'error');
                        }
                      } catch (e) {
                        showMessage('Error uploading student data: ' + e.message, 'error');
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Student Data'}
                  </button>
                  
                  <button 
                    className="btn btn-success mt-3 ml-2"
                    disabled={isTraining}
                    onClick={handleTrainModel}
                  >
                    {isTraining ? '⏳ Training...' : '🧠 Train Model on All Content'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="student-records mt-4">
              <h3>Student Records</h3>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Registration Number</th>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Year</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length > 0 ? (
                      students.map(student => (
                        <tr key={student._id}>
                          <td>{student.registrationNumber}</td>
                          <td>{student.name}</td>
                          <td>{student.course}</td>
                          <td>{student.year}</td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteStudent(student._id)}
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center">No student records found. Upload a CSV or Excel file to add student data.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>📅 Create Event</h2>
              <p>Add events with image, dates, and rich description. The model can reference this info.</p>
              <div className="faq-form">
                <div className="form-group">
                  <label>Title</label>
                  <input className="form-input" value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title:e.target.value})} placeholder="Hackathon 2025" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-textarea" rows="4" value={newEvent.description} onChange={e=>setNewEvent({...newEvent, description:e.target.value})} placeholder="Event description, who can participate, rewards, rules..." />
                </div>
                <div className="form-group">
                  <label>Starts At</label>
                  <input type="datetime-local" className="form-input" value={newEvent.startsAt} onChange={e=>setNewEvent({...newEvent, startsAt:e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Ends At</label>
                  <input type="datetime-local" className="form-input" value={newEvent.endsAt} onChange={e=>setNewEvent({...newEvent, endsAt:e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Image (optional)</label>
                  <input type="file" accept="image/*" className="form-input" onChange={e=>setNewEvent({...newEvent, image: e.target.files[0]})} />
                </div>
                <div className="form-group">
                  <label>Or Image URL</label>
                  <input className="form-input" placeholder="https://..." value={newEvent.imageUrl} onChange={e=>setNewEvent({...newEvent, imageUrl:e.target.value})} />
                </div>
                <button className="upload-btn" onClick={createEvent}>➕ Add Event</button>
              </div>

              <h2 style={{marginTop:'2rem'}}>🗂️ Existing Events ({events.length})</h2>
              <div className="files-grid">
                {events.map(ev => (
                  <div key={ev._id} className="file-card">
                    <div className="file-icon">🗓️</div>
                    <div className="file-info">
                      <h4>{ev.title}</h4>
                      <p><strong>When:</strong> {ev.startsAt ? formatDate(ev.startsAt) : 'TBA'}{ev.endsAt ? ` → ${formatDate(ev.endsAt)}` : ''}</p>
                      <p className="muted">{(ev.description||'').slice(0,140)}{(ev.description||'').length>140?'...':''}</p>
                    </div>
                    <div className="file-actions">
                      <button className="delete-btn" onClick={()=>deleteEvent(ev._id)}>🗑️ Delete</button>
                    </div>
                  </div>
                ))}
                {events.length===0 && (
                  <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <h3>No events yet</h3>
                    <p>Create an event to show it to users on the chat page</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>📊 Chat Logs</h2>
              <p>Monitor user conversations and AI responses</p>
              <div className="search-filter-section">
                <div className="search-bar">
                  <input type="text" placeholder="Filter by User ID" className="search-input" onBlur={(e)=>loadLogs({ userId: e.target.value })} />
                </div>
                <div className="search-bar">
                  <input type="text" placeholder="Filter by Session ID" className="search-input" onBlur={(e)=>loadLogs({ sessionId: e.target.value })} />
                </div>
              </div>
              
              <div className="logs-container">
                {logs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h3>No conversations yet</h3>
                    <p>Chat logs will appear here as users interact with the AI</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log._id} className="log-card">
                      <div className="log-header">
                        <div className="log-meta">
                          <span className="log-session">Session: {log.sessionId || 'N/A'}</span>
                          <span className="log-user">User: {log.userId}</span>
                          <span className="log-date">{formatDate(log.createdAt)}</span>
                        </div>
                      </div>
                      <div className="log-conversation">
                        {log.turns?.map((turn, i) => (
                          <div key={i} className={`log-message ${turn.role}`}>
                            <div className="message-role">
                              {turn.role === 'user' ? '👤 User' : '🤖 Assistant'}
                            </div>
                            <div className="message-content">{turn.content}</div>
                            <div className="message-time">
                              {formatDate(turn.timestamp || log.createdAt)}
                            </div>
          </div>
        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Concerning Conversations Tab */}
        {activeTab === 'concerning' && (
          <div className="admin-section">
            <div className="section-card">
              <h2>🚨 Concerning Conversations</h2>
              <p>Monitor and manage conversations where students may need support or intervention</p>
              
              {/* Stats Overview */}
              {conversationStats.total > 0 && (
                <div className="stats-overview">
                  <div className="stat-card">
                    <div className="stat-number">{conversationStats.total}</div>
                    <div className="stat-label">Total Concerns</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{conversationStats.unresolved}</div>
                    <div className="stat-label">Unresolved</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{conversationStats.followUpRequired}</div>
                    <div className="stat-label">Need Follow-up</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{conversationStats.byType?.suicide || 0}</div>
                    <div className="stat-label">Suicide Concerns</div>
                  </div>
                </div>
              )}

              {/* Conversations List */}
              <div className="conversations-list">
                {concerningConversations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💚</div>
                    <h3>No concerning conversations detected</h3>
                    <p>This is a good sign! The system will automatically flag conversations that may need attention.</p>
                  </div>
                ) : (
                  concerningConversations.map((student) => (
                    <div key={student.registrationNumber} className="conversation-group">
                      <div className="student-header">
                        <div className="student-info">
                          <h3>{student.userInfo.name || 'Unknown Student'}</h3>
                          <p><strong>Registration:</strong> {student.registrationNumber}</p>
                          <p><strong>Department:</strong> {student.userInfo.department || 'Not specified'}</p>
                          <p><strong>Course:</strong> {student.userInfo.course || 'Not specified'}</p>
                        </div>
                        <div className="student-stats">
                          <div className="stat-badge" style={{ backgroundColor: getSeverityColor(student.highestSeverity) }}>
                            {student.highestSeverity.toUpperCase()}
                          </div>
                          <div className="concern-count">{student.totalConcerns} concern{student.totalConcerns !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      
                      <div className="conversations-grid">
                        {student.conversations.map((conversation) => (
                          <div key={conversation.id} className="conversation-card">
                            <div className="conversation-header">
                              <div className="concern-type">
                                <span className="concern-icon">{getConcernTypeIcon(conversation.concernType)}</span>
                                <span className="concern-label">{conversation.concernType.replace('_', ' ').toUpperCase()}</span>
                              </div>
                              <div className="severity-badge" style={{ backgroundColor: getSeverityColor(conversation.severity) }}>
                                {conversation.severity}
                              </div>
                            </div>
                            
                            <div className="conversation-content">
                              <div className="message-section">
                                <strong>Student Message:</strong>
                                <p className="student-message">{conversation.originalMessage}</p>
                              </div>
                              
                              <div className="message-section">
                                <strong>AI Response:</strong>
                                <p className="ai-response">{conversation.aiResponse}</p>
                              </div>
                              
                              {conversation.keywords && conversation.keywords.length > 0 && (
                                <div className="keywords-section">
                                  <strong>Triggered Keywords:</strong>
                                  <div className="keywords-list">
                                    {conversation.keywords.map((keyword, idx) => (
                                      <span key={idx} className="keyword-tag">{keyword}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="conversation-footer">
                              <div className="conversation-meta">
                                <span className="conversation-date">{formatDate(conversation.createdAt)}</span>
                                <div className="conversation-status">
                                  {conversation.isResolved ? (
                                    <span className="status-resolved">✅ Resolved</span>
                                  ) : (
                                    <span className="status-pending">⏳ Pending</span>
                                  )}
                                  {conversation.followUpRequired && (
                                    <span className="follow-up-required">🔔 Follow-up Required</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="conversation-actions">
                                <button 
                                  className="action-btn view-btn"
                                  onClick={() => setSelectedConversation(conversation)}
                                >
                                  👁️ View Details
                                </button>
                                <button 
                                  className="action-btn resolve-btn"
                                  onClick={() => updateConversation(conversation.id, { isResolved: !conversation.isResolved })}
                                >
                                  {conversation.isResolved ? '↩️ Reopen' : '✅ Mark Resolved'}
                                </button>
                                <button 
                                  className="action-btn delete-btn"
                                  onClick={() => deleteConversation(conversation.id)}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Display */}
        {msg && (
          <div className={`message-toast ${msgType}`}>
            <div className="toast-icon">
              {msgType === 'success' ? '✅' : '❌'}
            </div>
            <div className="toast-message">{msg}</div>
            <button className="toast-close" onClick={() => setMsg('')}>×</button>
          </div>
        )}
      </div>
    </div>
  );
}






