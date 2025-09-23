const mongoose = require('mongoose');

const ChatTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    language: { type: String, default: 'en' },
  },
  { _id: false, timestamps: true }
);

const ChatLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    turns: { type: [ChatTurnSchema], default: [] },
    sessionId: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatLog', ChatLogSchema);


