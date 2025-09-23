const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Todo = require('../models/Todo');
const File = require('../models/File');
const KnowledgeItem = require('../models/KnowledgeItem');
const { extractFromPdf, extractFromDocx, extractFromImage, createKnowledgeItems } = require('../services/extract');
const { updateVectorStore } = require('../services/learningIntegration');

async function getPreferences(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ preferences: user.preferences || {}, languagePreference: user.languagePreference });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function updatePreferences(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { responseStyle, answerLength, defaultLanguage } = req.body || {};
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.preferences = { ...user.preferences, ...(responseStyle ? { responseStyle } : {}), ...(answerLength ? { answerLength } : {}), ...(defaultLanguage ? { defaultLanguage } : {}) };
    if (defaultLanguage) user.languagePreference = defaultLanguage;
    await user.save();
    res.json({ ok: true, preferences: user.preferences });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function listTodos(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const now = new Date();
    const todos = await Todo.find({ userId, expiresAt: { $gte: now } }).sort({ createdAt: -1 }).lean();
    res.json({ todos: todos.map(t => ({ id: t._id, title: t.title, done: !!t.isCompleted })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function createTodo(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title required' });
    const expires = new Date();
    expires.setDate(expires.getDate() + 1);
    expires.setHours(0,0,0,0);
    const todo = await Todo.create({ userId, title: String(title).slice(0, 120), description, expiresAt: expires });
    res.json({ ok: true, id: todo._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function completeTodo(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { todoId } = req.params;
    await Todo.updateOne({ _id: todoId, userId }, { $set: { isCompleted: true } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function deleteTodo(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { todoId } = req.params;
    await Todo.deleteOne({ _id: todoId, userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name,
      email,
      phoneNumber,
      section,
      year,
      semester,
      academicYear,
      languagePreference
    } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update allowed fields (excluding registrationNumber, course, branch)
    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (section) user.section = section;
    if (year) user.year = year;
    if (semester) user.semester = semester;
    if (academicYear) user.academicYear = academicYear;
    if (languagePreference) user.languagePreference = languagePreference;

    await user.save();

    res.json({
      ok: true,
      user: {
        id: user._id,
        registrationNumber: user.registrationNumber,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        course: user.course,
        branch: user.branch,
        section: user.section,
        year: user.year,
        semester: user.semester,
        academicYear: user.academicYear,
        languagePreference: user.languagePreference
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


// Upload user timetable (PDF, DOCX, images)
async function uploadUserTimetable(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required' });

    // Create File record tagged as timetable
    const displayName = file.originalname;
    const fileRecord = await File.create({
      filename: file.filename,
      originalName: file.originalname,
      displayName,
      size: file.size,
      mimeType: file.mimetype,
      filePath: file.path,
      category: 'timetable',
      status: 'processing',
      uploadedBy: String(userId)
    });

    // Extract text based on extension
    const ext = path.extname(file.originalname).toLowerCase();
    let extracted;
    if (ext === '.pdf') {
      extracted = await extractFromPdf(file.path);
    } else if (ext === '.docx') {
      extracted = await extractFromDocx(file.path);
    } else if (['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff'].includes(ext)) {
      extracted = await extractFromImage(file.path);
    } else {
      fileRecord.status = 'error';
      await fileRecord.save();
      return res.status(400).json({ error: 'Unsupported file type for timetable. Please upload PDF, DOCX, or image.' });
    }

    if (!extracted || !extracted.rawText || extracted.rawText.trim().length < 20) {
      fileRecord.status = 'error';
      await fileRecord.save();
      return res.status(400).json({ error: 'Could not extract readable timetable text. Try a clearer file or PDF.' });
    }

    // Save extracted text
    fileRecord.extractedText = extracted.rawText;
    fileRecord.status = 'processed';
    await fileRecord.save();

    // Create knowledge items tagged for this user as timetable for semantic recall
    const items = await createKnowledgeItems(extracted, file.mimetype, file.originalname);
    const enriched = items.map(i => ({
      ...i,
      metadata: { ...(i.metadata||{}), category: 'timetable', userId: String(userId) },
      sourceType: i.sourceType || (ext.replace('.', '') || 'text'),
      sourceName: i.sourceName || file.originalname
    }));
    const saved = await KnowledgeItem.insertMany(enriched);

    // Nudge vector store to rebuild on next request
    try { updateVectorStore('knowledge'); } catch (_) {}

    return res.json({ ok: true, fileId: fileRecord._id, knowledgeItemsCreated: saved.length });
  } catch (e) {
    console.error('Timetable upload error:', e);
    return res.status(500).json({ error: e.message });
  }
}


// Get current user's timetable files (latest first)
async function getUserTimetable(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const files = await File.find({ uploadedBy: String(userId), category: 'timetable' })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ files, latest: files[0] || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Delete a timetable file for the current user (and associated knowledge)
async function deleteUserTimetable(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { fileId } = req.params;
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.category !== 'timetable' || String(file.uploadedBy) !== String(userId)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    // Remove physical file
    try { if (file.filePath) fs.unlinkSync(file.filePath); } catch (_) {}

    // Delete knowledge items for this user's timetable
    await KnowledgeItem.deleteMany({ 'metadata.userId': String(userId), 'metadata.category': 'timetable' });

    // Delete File record
    await File.deleteOne({ _id: file._id });

    try { updateVectorStore('knowledge'); } catch (_) {}

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

module.exports = { getPreferences, updatePreferences, listTodos, createTodo, completeTodo, deleteTodo, updateProfile, uploadUserTimetable, getUserTimetable, deleteUserTimetable };
