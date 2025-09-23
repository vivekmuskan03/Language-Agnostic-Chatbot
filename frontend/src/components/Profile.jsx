import { useState, useEffect } from 'react';
import '../pages/styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Profile({ user, onClose, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    section: user?.section || '',
    year: user?.year || '',
    semester: user?.semester || '',
    academicYear: user?.academicYear || '',
    languagePreference: user?.languagePreference || 'en'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Profile updated successfully!');
        setIsEditing(false);
        onUpdate(data.user);
        // Update localStorage
        const updatedUser = { ...user, ...data.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        setMessage(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setMessage('Error updating profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
      section: user?.section || '',
      year: user?.year || '',
      semester: user?.semester || '',
      academicYear: user?.academicYear || '',
      languagePreference: user?.languagePreference || 'en'
    });
    setIsEditing(false);
    setMessage('');
  };

  return (
    <div className={`profile-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`profile-sidebar ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>👤 My Profile</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="profile-content">
          {message && (
            <div className={`profile-message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="profile-section">
            <h3>Personal Information</h3>
            <div className="profile-field">
              <label>Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="profile-input"
                />
              ) : (
                <span className="profile-value">{user?.name || 'Not provided'}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Email</label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="profile-input"
                />
              ) : (
                <span className="profile-value">{user?.email || 'Not provided'}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Phone Number</label>
              {isEditing ? (
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="profile-input"
                />
              ) : (
                <span className="profile-value">{user?.phoneNumber || 'Not provided'}</span>
              )}
            </div>
          </div>

          <div className="profile-section">
            <h3>Academic Information</h3>
            <div className="profile-field">
              <label>Registration Number</label>
              <span className="profile-value profile-readonly">{user?.registrationNumber}</span>
            </div>

            <div className="profile-field">
              <label>Course</label>
              <span className="profile-value profile-readonly">{user?.course || 'Not specified'}</span>
            </div>

            <div className="profile-field">
              <label>Branch</label>
              <span className="profile-value profile-readonly">{user?.branch || 'Not specified'}</span>
            </div>

            <div className="profile-field">
              <label>Section</label>
              {isEditing ? (
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  className="profile-input"
                  placeholder="e.g., A, B, C"
                />
              ) : (
                <span className="profile-value">{user?.section || 'Not specified'}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Year</label>
              {isEditing ? (
                <select
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  className="profile-select"
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Final Year">Final Year</option>
                </select>
              ) : (
                <span className="profile-value">{user?.year || 'Not specified'}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Semester</label>
              {isEditing ? (
                <select
                  name="semester"
                  value={formData.semester}
                  onChange={handleInputChange}
                  className="profile-select"
                >
                  <option value="">Select Semester</option>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="3rd Semester">3rd Semester</option>
                  <option value="4th Semester">4th Semester</option>
                  <option value="5th Semester">5th Semester</option>
                  <option value="6th Semester">6th Semester</option>
                  <option value="7th Semester">7th Semester</option>
                  <option value="8th Semester">8th Semester</option>
                </select>
              ) : (
                <span className="profile-value">{user?.semester || 'Not specified'}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Academic Year</label>
              {isEditing ? (
                <select
                  name="academicYear"
                  value={formData.academicYear}
                  onChange={handleInputChange}
                  className="profile-select"
                >
                  <option value="">Select Academic Year</option>
                  <option value="2024-25">2024-25</option>
                  <option value="2023-24">2023-24</option>
                  <option value="2022-23">2022-23</option>
                  <option value="2021-22">2021-22</option>
                </select>
              ) : (
                <span className="profile-value">{user?.academicYear || 'Not specified'}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Language Preference</label>
              {isEditing ? (
                <select
                  name="languagePreference"
                  value={formData.languagePreference}
                  onChange={handleInputChange}
                  className="profile-select"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="te">Telugu</option>
                  <option value="gu">Gujarati</option>
                  <option value="ta">Tamil</option>
                  <option value="kn">Kannada</option>
                </select>
              ) : (
                <span className="profile-value">
                  {formData.languagePreference === 'en' ? 'English' :
                   formData.languagePreference === 'hi' ? 'Hindi' :
                   formData.languagePreference === 'te' ? 'Telugu' :
                   formData.languagePreference === 'gu' ? 'Gujarati' :
                   formData.languagePreference === 'ta' ? 'Tamil' :
                   formData.languagePreference === 'kn' ? 'Kannada' : 'English'}
                </span>
              )}
            </div>
          </div>

          <div className="profile-actions">
            {isEditing ? (
              <>
                <button 
                  className="profile-btn save-btn" 
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : '💾 Save Changes'}
                </button>
                <button 
                  className="profile-btn cancel-btn" 
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  ❌ Cancel
                </button>
              </>
            ) : (
              <button 
                className="profile-btn edit-btn" 
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
