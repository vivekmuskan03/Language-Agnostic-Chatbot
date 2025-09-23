const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, default: 'general' },
    imagePath: { type: String },
    imageUrl: { type: String },
    startsAt: { type: Date },
    endsAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', EventSchema);


