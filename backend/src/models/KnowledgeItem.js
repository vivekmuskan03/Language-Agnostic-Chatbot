const mongoose = require('mongoose');

const KnowledgeItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    sourceType: { type: String, enum: ['pdf', 'docx', 'image', 'text', 'faq'], required: true },
    sourceName: { type: String },
    sourceFile: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    embedding: { type: [Number], index: '2dsphere' },
    language: { type: String, default: 'en' },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('KnowledgeItem', KnowledgeItemSchema);


