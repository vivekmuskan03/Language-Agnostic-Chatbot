const mongoose = require('mongoose');

const ConcerningConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registrationNumber: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    concernType: { 
      type: String, 
      enum: ['suicide', 'self_harm', 'depression', 'anxiety', 'academic_stress', 'other'], 
      required: true 
    },
    severity: {
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'], 
      required: true 
    },
    originalMessage: { type: String, required: true },
    aiResponse: { type: String, required: true },
    fullConversation: [{
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }],
    keywords: [String], // Keywords that triggered the concern detection
    isResolved: { type: Boolean, default: false },
    adminNotes: String,
    followUpRequired: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Index for efficient querying
ConcerningConversationSchema.index({ registrationNumber: 1, createdAt: -1 });
ConcerningConversationSchema.index({ concernType: 1, severity: 1 });
ConcerningConversationSchema.index({ isResolved: 1, followUpRequired: 1 });

module.exports = mongoose.model('ConcerningConversation', ConcerningConversationSchema);
