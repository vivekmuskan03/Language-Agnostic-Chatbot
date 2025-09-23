const mongoose = require('mongoose');

const FAQSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, required: true, default: 'general' },
    language: { type: String, default: 'en' },
    embedding: { type: [Number] },
    knowledgeItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeItem' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FAQ', FAQSchema);


