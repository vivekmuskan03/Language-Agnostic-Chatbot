const fs = require('fs');
const path = require('path');
const KnowledgeItem = require('../models/KnowledgeItem');
const { upsertKnowledge } = require('../services/langchainKnowledge');
const FAQ = require('../models/FAQ');
const File = require('../models/File');
const Event = require('../models/Event');
const ConcerningConversation = require('../models/ConcerningConversation');
const User = require('../models/User');
const Student = require('../models/Student');
const { upsertEventIntoStore } = require('../services/langchainEvents');
const { extractFromPdf, extractFromDocx, extractFromImage, extractFromUrl, createKnowledgeItems } = require('../services/extract');
const { embedText } = require('../services/gemini');
const { updateVectorStore } = require('../services/learningIntegration');
const { processStudentDataFile, saveStudentData, trainModelOnStudentData } = require('../services/studentDataProcessor');

async function uploadAndIngest(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required' });
    
    // Get category and custom filename from request body or default to 'general'
    const { category = 'general', customFilename } = req.body;
    
    // Use custom filename if provided, otherwise use original name
    const displayName = customFilename || file.originalname;
    
    // Create file record
    const fileRecord = await File.create({
      filename: file.filename,
      originalName: file.originalname,
      displayName: displayName,
      size: file.size,
      mimeType: file.mimetype,
      filePath: file.path,
      category,
      status: 'processing'
    });

    try {
      const filePath = file.path;
      const ext = path.extname(file.originalname).toLowerCase();
      let text = '';
      
      // Extract text based on file type using enhanced extraction
      let extractedData = null;
      if (ext === '.pdf') {
        extractedData = await extractFromPdf(filePath);
      } else if (ext === '.docx') {
        extractedData = await extractFromDocx(filePath);
      } else if (['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff'].includes(ext)) {
        extractedData = await extractFromImage(filePath);
      } else if (ext === '.txt') {
        const text = fs.readFileSync(filePath, 'utf8');
        extractedData = {
          rawText: text,
          sections: [{ type: 'general', content: text, title: 'Text Document' }],
          metadata: { extractedAt: new Date().toISOString() }
        };
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      if (!extractedData || !extractedData.rawText || extractedData.rawText.trim().length === 0) {
        throw new Error('No text could be extracted from the file');
      }

      // Update file record with extracted text
      fileRecord.extractedText = extractedData.rawText;
      fileRecord.status = 'processed';
      await fileRecord.save();

      // Create knowledge items using enhanced extraction
      const knowledgeItems = await createKnowledgeItems(extractedData, file.mimetype, file.originalname);
      
      if (knowledgeItems.length === 0) {
        throw new Error('Could not create knowledge items from file');
      }

      // Save all knowledge items to database
      const savedItems = await KnowledgeItem.insertMany(knowledgeItems);
      try { for (const it of savedItems) { await upsertKnowledge(it); } } catch (e) { console.error('LangChain upsert knowledge (upload):', e.message); }

      // Update file record with knowledge item IDs
      fileRecord.knowledgeItemIds = savedItems.map(item => item._id);
      await fileRecord.save();

      // Ensure the retriever store used in chat is refreshed
      try { updateVectorStore('knowledge'); } catch (_) {}

      res.json({ 
        ok: true, 
        fileId: fileRecord._id,
        extractedTextLength: extractedData.rawText.length,
        knowledgeItemsCreated: savedItems.length,
        sections: extractedData.sections.length
      });
    } catch (extractError) {
      fileRecord.status = 'error';
      await fileRecord.save();
      throw extractError;
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Upload and process student data from CSV or Excel file
 */
async function uploadStudentData(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required' });
    
    // Get file extension
    const ext = path.extname(file.originalname).toLowerCase();
    let fileType;
    
    if (ext === '.csv') {
      fileType = 'csv';
    } else if (['.xlsx', '.xls'].includes(ext)) {
      fileType = 'excel';
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload CSV or Excel file.' });
    }
    
    // Create file record
    const fileRecord = await File.create({
      filename: file.filename,
      originalName: file.originalname,
      displayName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      filePath: file.path,
      category: 'student-data',
      status: 'processing'
    });
    
    try {
      // Process the student data file
      const studentData = await processStudentDataFile(file.path, fileType);
      
      if (!studentData || studentData.length === 0) {
        throw new Error('No student data could be extracted from the file');
      }
      
      // Save student data to database
      const results = await saveStudentData(studentData);
      
      // Train AI model on student data
      const trainingData = studentData.map(student => ({
        registrationNumber: student.registrationNumber,
        studentInfo: student
      }));
      
      // Train the model asynchronously (don't wait for completion)
      trainModelOnStudentData(trainingData)
        .then(success => {
          if (success) {
            console.log('Successfully trained model on student data');
            // Update the file record to indicate successful training
            fileRecord.status = 'processed';
            fileRecord.metadata = fileRecord.metadata || {};
            fileRecord.metadata.aiTrained = true;
            fileRecord.save().catch(err => console.error('Error updating file record:', err));
          } else {
            console.error('Failed to train model on student data');
            fileRecord.status = 'processed';
            fileRecord.metadata = fileRecord.metadata || {};
            fileRecord.metadata.aiTrained = false;
            fileRecord.save().catch(err => console.error('Error updating file record:', err));
          }
          console.log(`AI model training ${success ? 'completed successfully' : 'failed'}`);
        })
        .catch(err => {
          console.error('Error during AI model training:', err);
        });
      
      // Update file record
      fileRecord.status = 'processed';
      fileRecord.metadata = {
        studentsProcessed: results.total,
        studentsCreated: results.created,
        studentsUpdated: results.updated,
        studentsFailed: results.failed,
        aiTrainingInitiated: true
      };
      await fileRecord.save();
      
      res.json({
        ok: true,
        fileId: fileRecord._id,
        results: results,
        aiTrainingInitiated: true
      });
    } catch (processError) {
      fileRecord.status = 'error';
      fileRecord.metadata = { error: processError.message };
      await fileRecord.save();
      throw processError;
    }
  } catch (e) {
      console.error('Student data upload error:', e);
      res.status(500).json({ error: e.message });
  }
}

/**
 * Get all students
 */
async function getAllStudents(req, res) {
  try {
    const students = await Student.find({}).sort({ registrationNumber: 1 });
    res.json({ students });
  } catch (e) {
    console.error('Get all students error:', e);
    res.status(500).json({ error: e.message });
  }
}

async function addFaq(req, res) {
  try {
    const { question, answer, category } = req.body;
    if (!question || !answer || !category) return res.status(400).json({ error: 'Missing fields' });
    
    const embedding = await embedText(question + '\n' + answer);
    
    // Create FAQ record
    const faq = await FAQ.create({ 
      question, 
      answer, 
      category,
      embedding, 
      language: 'en' 
    });
    
    // Create knowledge item for retrieval
    const knowledgeItem = await KnowledgeItem.create({
      title: `FAQ: ${question}`,
      content: answer,
      sourceType: 'faq',
      sourceName: 'admin',
      embedding,
      language: 'en',
    });
    try { await upsertKnowledge(knowledgeItem); } catch (e) { console.error('LangChain upsert knowledge (faq add):', e.message); }
    
    // Link FAQ to knowledge item
    faq.knowledgeItemId = knowledgeItem._id;
    await faq.save();
    
    res.json({ ok: true, id: faq._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function listChats(req, res) {
  const ChatLog = require('../models/ChatLog');
  const { userId, sessionId, groupByUser } = req.query || {};
  const filter = {};
  if (userId) filter.userId = userId;
  if (sessionId) filter.sessionId = sessionId;

  if (String(groupByUser) === 'true') {
    // Group conversations by user with latest session info
    const agg = await ChatLog.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $limit: 1000 },
      {
        $group: {
          _id: '$userId',
          sessions: { $push: { sessionId: '$sessionId', createdAt: '$createdAt', turns: '$turns' } },
          lastAt: { $first: '$createdAt' }
        }
      },
      { $sort: { lastAt: -1 } }
    ]);
    return res.json({ groups: agg });
  }

  const logs = await ChatLog.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ logs });
}

// Get all uploaded files
async function getFiles(req, res) {
  try {
    const files = await File.find().sort({ uploadedAt: -1 }).lean();
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Get all FAQs
async function getFaqs(req, res) {
  try {
    const faqs = await FAQ.find().sort({ createdAt: -1 }).lean();
    res.json({ faqs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Update FAQ
async function updateFaq(req, res) {
  try {
    const { faqId } = req.params;
    const { question, answer, category } = req.body;
    
    if (!question || !answer || !category) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    
    const faq = await FAQ.findById(faqId);
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    // Update FAQ record
    faq.question = question;
    faq.answer = answer;
    faq.category = category;
    
    // Update embedding for the new content
    const embedding = await embedText(question + '\n' + answer);
    faq.embedding = embedding;
    
    await faq.save();

    // Update associated knowledge item
    if (faq.knowledgeItemId) {
      const updated = await KnowledgeItem.findByIdAndUpdate(faq.knowledgeItemId, {
        title: `FAQ: ${question}`,
        content: answer,
        embedding: embedding
      });
      try { if (updated) await upsertKnowledge({ _id: faq.knowledgeItemId, title: `FAQ: ${question}`, content: answer, sourceType: 'faq' }); } catch (e) { console.error('LangChain upsert knowledge (faq update):', e.message); }
    }

    res.json({ ok: true, message: 'FAQ updated successfully', faq });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Delete FAQ and its knowledge item
async function deleteFaq(req, res) {
  try {
    const { faqId } = req.params;
    
    const faq = await FAQ.findById(faqId);
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    // Delete associated knowledge item
    if (faq.knowledgeItemId) {
      await KnowledgeItem.findByIdAndDelete(faq.knowledgeItemId);
    }

    // Delete FAQ record
    await FAQ.findByIdAndDelete(faqId);

    res.json({ ok: true, message: 'FAQ deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Delete a file and its associated knowledge items
async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;
    
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete associated knowledge items
    if (file.knowledgeItems && file.knowledgeItems.length > 0) {
      await KnowledgeItem.deleteMany({ _id: { $in: file.knowledgeItems } });
    }

    // Delete physical file
    try {
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
    } catch (fileError) {
      console.error('Error deleting physical file:', fileError);
    }

    // Delete file record
    await File.findByIdAndDelete(fileId);

    res.json({ ok: true, message: 'File deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Get file details with extracted text
async function getFileDetails(req, res) {
  try {
    const { fileId } = req.params;
    const file = await File.findById(fileId).populate('knowledgeItems');
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Reprocess a file (extract text again)
async function reprocessFile(req, res) {
  try {
    const { fileId } = req.params;
    const file = await File.findById(fileId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    file.status = 'processing';
    await file.save();

    try {
      const ext = path.extname(file.originalName).toLowerCase();

      // Re-extract using enhanced extractors (object with rawText/sections)
      let extractedData = null;
      if (ext === '.pdf') {
        extractedData = await extractFromPdf(file.filePath);
      } else if (ext === '.docx') {
        extractedData = await extractFromDocx(file.filePath);
      } else if (['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff'].includes(ext)) {
        extractedData = await extractFromImage(file.filePath);
      } else if (ext === '.txt') {
        const t = fs.readFileSync(file.filePath, 'utf8');
        extractedData = { rawText: t, sections: [{ type: 'general', content: t, title: 'Text' }], metadata: { extractedAt: new Date().toISOString() } };
      }

      const text = extractedData?.rawText || '';
      if (!text || text.trim().length === 0) {
        throw new Error('No text could be extracted from the file');
      }

      // Delete old knowledge items
      if (file.knowledgeItems && file.knowledgeItems.length > 0) {
        await KnowledgeItem.deleteMany({ _id: { $in: file.knowledgeItems } });
      }

      // Create new knowledge items via unified creator
      const items = await createKnowledgeItems(extractedData, file.mimeType || ext.replace('.', '') || 'text', file.originalName);
      const saved = await KnowledgeItem.insertMany(items.map(i => ({ ...i, sourceFile: file._id })));

      file.extractedText = text;
      file.knowledgeItems = saved.map(d => d._id);
      file.status = 'processed';
      await file.save();

      try { updateVectorStore('knowledge'); } catch (_) {}

      res.json({ 
        ok: true, 
        extractedTextLength: text.length,
        knowledgeItemsCreated: knowledgeItems.length
      });
    } catch (extractError) {
      file.status = 'error';
      await file.save();
      throw extractError;
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Ingest a URL and create knowledge items
async function ingestUrl(req, res) {
  try {
    const { url, category = 'general', title } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    const extracted = await extractFromUrl(url);
    if (!extracted.rawText || extracted.rawText.length < 50) {
      return res.status(400).json({ error: 'Could not extract meaningful text from URL' });
    }

    const items = await createKnowledgeItems(extracted, 'url', title || url);
    const saved = await KnowledgeItem.insertMany(items.map(i => ({ ...i, category })));
    try { for (const it of saved) { await upsertKnowledge(it); } } catch (e) { console.error('LangChain upsert knowledge (url):', e.message); }
    try { updateVectorStore('knowledge'); } catch (_) {}

    res.json({ ok: true, knowledgeItemsCreated: saved.length });
  } catch (e) {
    console.error('Ingest URL error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Create an event with optional image (handled by multer at route level)
async function createEvent(req, res) {
  try {
    const { title, description, category = 'general', startsAt, endsAt, imageUrl } = req.body || {};
    if (!title || !description) return res.status(400).json({ error: 'Title and description required' });
    const record = await Event.create({
      title,
      description,
      category,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      imageUrl: imageUrl || undefined,
      imagePath: req.file?.path ? `/api/uploads/${path.basename(req.file.path)}` : undefined
    });
    // Also create a knowledge item so model can reference event details
    try {
      const content = `Event: ${title}\n\nDescription: ${description}\n\nCategory: ${category}\n${startsAt ? `Starts: ${new Date(startsAt).toISOString()}\n` : ''}${endsAt ? `Ends: ${new Date(endsAt).toISOString()}\n` : ''}${(imageUrl || req.file?.path) ? `Image: ${(imageUrl || req.file?.path)}\n` : ''}`;
      const embedding = await embedText(content);
      await KnowledgeItem.create({
        title: `Event: ${title}`,
        content,
        sourceType: 'event',
        sourceName: 'admin',
        embedding,
        language: 'en'
      });
    } catch (embedErr) {
      console.error('Event knowledge create error:', embedErr.message);
    }
    // Upsert into LangChain vector store for retrieval
    try { await upsertEventIntoStore(record); } catch (e) { console.error('LangChain upsert event error:', e.message); }
    res.json({ ok: true, id: record._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function listEvents(_req, res) {
  try {
    const events = await Event.find().sort({ createdAt: -1 }).lean();
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function deleteEvent(req, res) {
  try {
    const { eventId } = req.params;
    await Event.findByIdAndDelete(eventId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Get all concerning conversations grouped by registration number
async function getConcerningConversations(req, res) {
  try {
    const { concernType, severity, isResolved, followUpRequired } = req.query;
    
    const filter = {};
    if (concernType) filter.concernType = concernType;
    if (severity) filter.severity = severity;
    if (isResolved !== undefined) filter.isResolved = isResolved === 'true';
    if (followUpRequired !== undefined) filter.followUpRequired = followUpRequired === 'true';
    
    // Get concerning conversations grouped by registration number
    const conversations = await ConcerningConversation.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$registrationNumber',
          conversations: {
            $push: {
              id: '$_id',
              concernType: '$concernType',
              severity: '$severity',
              originalMessage: '$originalMessage',
              aiResponse: '$aiResponse',
              keywords: '$keywords',
              isResolved: '$isResolved',
              followUpRequired: '$followUpRequired',
              adminNotes: '$adminNotes',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt'
            }
          },
          latestConcern: { $first: '$concernType' },
          highestSeverity: { $max: '$severity' },
          totalConcerns: { $sum: 1 },
          lastActivity: { $first: '$createdAt' }
        }
      },
      { $sort: { lastActivity: -1 } }
    ]);
    
    // Get user information for each registration number
    const registrationNumbers = conversations.map(c => c._id);
    const users = await User.find({ registrationNumber: { $in: registrationNumbers } })
      .select('registrationNumber name department course year')
      .lean();
    
    const userMap = {};
    users.forEach(user => {
      userMap[user.registrationNumber] = user;
    });
    
    // Combine user info with conversations
    const result = conversations.map(conv => ({
      registrationNumber: conv._id,
      userInfo: userMap[conv._id] || { registrationNumber: conv._id },
      conversations: conv.conversations,
      latestConcern: conv.latestConcern,
      highestSeverity: conv.highestSeverity,
      totalConcerns: conv.totalConcerns,
      lastActivity: conv.lastActivity
    }));
    
    res.json({ concerningConversations: result });
  } catch (e) {
    console.error('Get concerning conversations error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Get detailed conversation for a specific concerning conversation
async function getConcerningConversationDetails(req, res) {
  try {
    const { conversationId } = req.params;
    
    const conversation = await ConcerningConversation.findById(conversationId)
      .populate('userId', 'registrationNumber name department course year')
      .lean();
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({ conversation });
  } catch (e) {
    console.error('Get concerning conversation details error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Update concerning conversation (mark as resolved, add admin notes, etc.)
async function updateConcerningConversation(req, res) {
  try {
    const { conversationId } = req.params;
    const { isResolved, followUpRequired, adminNotes } = req.body;
    
    const updateData = {};
    if (isResolved !== undefined) updateData.isResolved = isResolved;
    if (followUpRequired !== undefined) updateData.followUpRequired = followUpRequired;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    updateData.updatedAt = new Date();
    
    const conversation = await ConcerningConversation.findByIdAndUpdate(
      conversationId,
      updateData,
      { new: true }
    );
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({ 
      ok: true, 
      message: 'Conversation updated successfully',
      conversation 
    });
  } catch (e) {
    console.error('Update concerning conversation error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Delete concerning conversation
async function deleteConcerningConversation(req, res) {
  try {
    const { conversationId } = req.params;
    
    const conversation = await ConcerningConversation.findByIdAndDelete(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({ 
      ok: true, 
      message: 'Conversation deleted successfully' 
    });
  } catch (e) {
    console.error('Delete concerning conversation error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Get statistics about concerning conversations
async function getConcerningConversationStats(req, res) {
  try {
    const stats = await ConcerningConversation.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byType: {
            $push: {
              type: '$concernType',
              severity: '$severity',
              isResolved: '$isResolved',
              followUpRequired: '$followUpRequired'
            }
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return res.json({
        total: 0,
        byType: {},
        bySeverity: {},
        resolved: 0,
        unresolved: 0,
        followUpRequired: 0
      });
    }
    
    const data = stats[0];
    const byType = {};
    const bySeverity = {};
    let resolved = 0;
    let unresolved = 0;
    let followUpRequired = 0;
    
    data.byType.forEach(item => {
      // Count by type
      byType[item.type] = (byType[item.type] || 0) + 1;
      
      // Count by severity
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      
      // Count resolved/unresolved
      if (item.isResolved) resolved++;
      else unresolved++;
      
      // Count follow-up required
      if (item.followUpRequired) followUpRequired++;
    });
    
    res.json({
      total: data.total,
      byType,
      bySeverity,
      resolved,
      unresolved,
      followUpRequired
    });
  } catch (e) {
    console.error('Get concerning conversation stats error:', e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * Get all students
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAllStudents(req, res) {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.status(200).json({ students });
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
}

/**
 * Delete a student
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    await Student.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
}

/**
 * Train model on all content types
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function trainModel(req, res) {
  try {
    // Train on FAQs
    const faqs = await FAQ.find();
    console.log(`Training model on ${faqs.length} FAQs`);
    
    // Train on PDFs and other files
    const files = await File.find({ status: 'processed' });
    console.log(`Training model on ${files.length} processed files`);
    
    // Train on student data
    const students = await Student.find();
    console.log(`Training model on ${students.length} student records`);
    
    // Update vector stores to include all content
    try {
      // Reset all vector stores to force rebuild with latest data
      const { updateVectorStore } = require('../services/learningIntegration');
      
      // Update knowledge store (PDFs, documents, etc.)
      updateVectorStore('knowledge');
      console.log('Updated knowledge vector store');
      
      // Update FAQ store
      updateVectorStore('faq');
      console.log('Updated FAQ vector store');
      
      // Update student data
      if (students.length > 0) {
        await trainModelOnStudentData(students);
        console.log('Trained model on student data');
      }
      
      // Update event store
      updateVectorStore('event');
      console.log('Updated event vector store');
      
      // Update user profile store for personalization
      updateVectorStore('userProfile');
      console.log('Updated user profile vector store');
    } catch (trainingError) {
      console.error('Error during vector store updates:', trainingError);
      // Continue execution even if there's an error in one of the training steps
    }
    
    res.status(200).json({ 
      message: 'Model training completed successfully',
      stats: {
        faqs: faqs.length,
        files: files.length,
        students: students.length
      }
    });
  } catch (error) {
    console.error('Error training model:', error);
    res.status(500).json({ error: 'Failed to train model' });
  }
}

module.exports = {
  uploadAndIngest,
  uploadStudentData,
  getAllStudents, 
  addFaq, 
  updateFaq,
  listChats, 
  getFiles, 
  getFaqs,
  deleteFile, 
  deleteFaq,
  getFileDetails, 
  reprocessFile,
  ingestUrl,
  createEvent,
  listEvents,
  deleteEvent,
  getConcerningConversations,
  getConcerningConversationDetails,
  updateConcerningConversation,
  deleteConcerningConversation,
  getConcerningConversationStats,
  deleteStudent,
  trainModel
};


