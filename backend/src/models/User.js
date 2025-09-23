const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    registrationNumber: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String },
    phoneNumber: { type: String },
    languagePreference: { type: String, default: 'en' },
    department: { type: String },
    course: { type: String },
    branch: { type: String },
    section: { type: String },
    year: { type: String },
    semester: { type: String },
    academicYear: { type: String },
    conversationContext: {
      lastTopics: [String],
      interests: [String],
      currentSemester: String,
      academicYear: String
    },
    preferences: {
      responseStyle: { type: String, enum: ['friendly', 'formal'], default: 'friendly' },
      answerLength: { type: String, enum: ['short', 'medium', 'long'], default: 'medium' },
      defaultLanguage: { type: String, default: 'en' }
    },
    memories: [
      {
        title: String,
        summary: String,
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

UserSchema.methods.verifyPassword = async function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.hashPassword = async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

module.exports = mongoose.model('User', UserSchema);


