const mongoose = require('mongoose');

const TodoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: Date },
    isCompleted: { type: Boolean, default: false },
    sourceMessage: { type: String },
    sessionId: { type: String },
    expiresAt: { type: Date, index: { expires: 0 } } // TTL index
  },
  { timestamps: true }
);

module.exports = mongoose.model('Todo', TodoSchema);


