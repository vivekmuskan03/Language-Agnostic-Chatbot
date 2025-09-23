const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Mongo connection
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vignan_chatbot';
mongoose
  .connect(mongoUri, { autoIndex: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api', routes);

// Serve uploaded images/files for events and other admin content
app.use('/api/uploads', express.static(path.join(process.cwd(), 'backend', 'uploads')));

// In production, serve the built frontend
const distPath = path.join(process.cwd(), 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Dev root route just shows a small JSON so you know the API is running
  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'Vignan Chatbot Backend', hint: 'Run frontend with: npm run dev (port 5173)' });
  });
}

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

module.exports = app;


