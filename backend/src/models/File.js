const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  displayName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  filePath: { type: String, required: true },
  category: { type: String, required: true, default: 'general' },
  status: { 
    type: String, 
    default: 'uploaded', 
    enum: ['uploaded', 'processing', 'processed', 'error'] 
  },
  extractedText: { type: String },
  knowledgeItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeItem' }],
  uploadedBy: { type: String, default: 'admin' },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('File', FileSchema);
