const express = require('express');
const multer = require('multer');
const path = require('path');
const { authRequired } = require('../middleware/auth');
const { studentSignup, studentLogin, adminLogin } = require('../controllers/authController');
const { chat, getUserSession, debugUserSessions } = require('../controllers/chatController');
const adminController = require('../controllers/adminController');
const { uploadAndIngest, addFaq, updateFaq, listChats, getFiles, getFaqs, deleteFile, deleteFaq, getFileDetails, reprocessFile, ingestUrl, createEvent, listEvents, deleteEvent, getConcerningConversations, getConcerningConversationDetails, updateConcerningConversation, deleteConcerningConversation, getConcerningConversationStats, uploadStudentData, getAllStudents } = adminController;

const router = express.Router();
const { getPreferences, updatePreferences, listTodos, createTodo, completeTodo, deleteTodo, updateProfile, uploadUserTimetable, getUserTimetable, deleteUserTimetable } = require('../controllers/userController');

// Multer upload (shared by user/admin uploads)
const upload = multer({ dest: path.join(process.cwd(), 'backend', 'uploads') });

router.get('/health', (_req, res) => res.json({ ok: true }));

// Auth
router.post('/auth/signup', studentSignup);
router.post('/auth/login', studentLogin);
router.post('/auth/admin', adminLogin);

// Chat
router.post('/chat', authRequired, chat);
router.get('/chat/session/:sessionId', authRequired, getUserSession);
router.get('/chat/session', authRequired, getUserSession);
router.get('/chat/debug/sessions', authRequired, debugUserSessions);

// User preferences
router.get('/user/preferences', authRequired, getPreferences);
router.put('/user/preferences', authRequired, updatePreferences);

// User profile
router.put('/user/profile', authRequired, updateProfile);

// Todos API
router.get('/user/todos', authRequired, listTodos);
router.post('/user/todos', authRequired, createTodo);
router.post('/user/todos/:todoId/complete', authRequired, completeTodo);
router.delete('/user/todos/:todoId', authRequired, deleteTodo);
// User timetable
router.get('/user/timetable', authRequired, getUserTimetable);
router.post('/user/timetable', authRequired, upload.single('file'), uploadUserTimetable);
router.delete('/user/timetable/:fileId', authRequired, deleteUserTimetable);


// Admin

router.post('/admin/upload', upload.single('file'), uploadAndIngest);
router.post('/admin/ingest-url', ingestUrl);
router.post('/admin/events', upload.single('image'), createEvent);
router.get('/admin/events', listEvents);
router.delete('/admin/events/:eventId', deleteEvent);
router.post('/admin/faq', addFaq);
router.put('/admin/faqs/:faqId', updateFaq);
router.get('/admin/faqs', getFaqs);
router.delete('/admin/faqs/:faqId', deleteFaq);
router.get('/admin/logs', listChats);
router.get('/admin/files', getFiles);
router.get('/admin/files/:fileId', getFileDetails);
router.delete('/admin/files/:fileId', deleteFile);
router.post('/admin/files/:fileId/reprocess', reprocessFile);

// Concerning conversations management
router.get('/admin/concerning-conversations', getConcerningConversations);
router.get('/admin/concerning-conversations/:conversationId', getConcerningConversationDetails);
router.put('/admin/concerning-conversations/:conversationId', updateConcerningConversation);
router.delete('/admin/concerning-conversations/:conversationId', deleteConcerningConversation);
router.get('/admin/concerning-conversations-stats', getConcerningConversationStats);

// Student data management
router.post('/admin/student-data', upload.single('file'), uploadStudentData);
router.get('/admin/students', getAllStudents);
router.delete('/admin/students/:id', adminController.deleteStudent);
router.post('/admin/train-model', adminController.trainModel);

module.exports = router;
