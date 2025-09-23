const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

async function studentSignup(req, res) {
  try {
    const { 
      registrationNumber, 
      password, 
      name, 
      email,
      phoneNumber,
      course,
      branch,
      section,
      year,
      semester,
      academicYear,
      languagePreference 
    } = req.body;
    
    if (!registrationNumber || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const exists = await User.findOne({ registrationNumber });
    if (exists) return res.status(409).json({ error: 'User already exists with this registration number' });
    
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ 
      registrationNumber, 
      passwordHash, 
      name,
      email,
      phoneNumber,
      course,
      branch,
      section,
      year,
      semester,
      academicYear,
      languagePreference 
    });
    
    return res.json({ 
      id: user._id, 
      registrationNumber: user.registrationNumber,
      name: user.name,
      message: 'Account created successfully! Please login to continue.'
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function studentLogin(req, res) {
  try {
    const { registrationNumber, password } = req.body;
    const user = await User.findOne({ registrationNumber });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Get additional student data from uploaded CSV/Excel if available
    const studentData = await Student.findOne({ registrationNumber });
    
    const token = jwt.sign({ userId: user._id, role: 'student' }, process.env.JWT_SECRET || 'devsecret', {
      expiresIn: '7d',
    });
    
    // Prepare user data, prioritizing CSV/Excel data if available
    const userData = {
      id: user._id,
      registrationNumber: user.registrationNumber,
      name: studentData?.name || user.name,
      email: studentData?.email || user.email,
      phoneNumber: user.phoneNumber,
      course: studentData?.course || user.course,
      branch: user.branch,
      section: user.section,
      year: user.year,
      semester: studentData?.semester || user.semester,
      academicYear: user.academicYear,
      department: studentData?.department || null,
      batch: studentData?.batch || null,
      languagePreference: user.languagePreference
    };
    
    // Add any additional data from CSV/Excel to the response
    if (studentData && studentData.additionalData) {
      userData.additionalData = Object.fromEntries(studentData.additionalData);
    }
    
    return res.json({ 
      token, 
      user: userData
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function adminLogin(req, res) {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1d' });
    return res.json({ token, admin: { username } });
  }
  return res.status(401).json({ error: 'Invalid admin credentials' });
}

module.exports = { studentSignup, studentLogin, adminLogin };


