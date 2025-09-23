const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  course: {
    type: String,
    trim: true
  },
  batch: {
    type: String,
    trim: true
  },
  semester: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  additionalData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create index for faster lookups
StudentSchema.index({ registrationNumber: 1 });

module.exports = mongoose.model('Student', StudentSchema);