const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
    conversationHistory: [{
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      language: { type: String, default: 'en' }
    }],
    userContext: {
      department: String,
      course: String,
      year: String,
      interests: [String],
      lastTopics: [String],
      currentSemester: String,
      academicYear: String,
      preferences: {
        language: { type: String, default: 'en' },
        responseStyle: { type: String, default: 'friendly' },
        topics: [String]
      }
    },
    sessionMetadata: {
      deviceInfo: String,
      ipAddress: String,
      userAgent: String,
      loginTime: { type: Date, default: Date.now },
      lastMessageTime: { type: Date, default: Date.now },
      lastEventTitle: { type: String }
    }
  },
  { timestamps: true }
);

// Index for efficient queries
UserSessionSchema.index({ userId: 1, sessionId: 1 });
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ lastActivity: 1 });

// Method to add a conversation turn
UserSessionSchema.methods.addConversationTurn = function(role, content, language = 'en') {
  const entry = { role, content, language, timestamp: new Date() };
  const now = new Date();
  return this.constructor.updateOne(
    { _id: this._id },
    {
      $push: { conversationHistory: { $each: [entry], $slice: -50 } },
      $set: { lastActivity: now, 'sessionMetadata.lastMessageTime': now }
    }
  ).exec();
};

// Method to update user context
UserSessionSchema.methods.updateUserContext = function(contextData) {
  const update = {};
  const addUnique = (arr = [], more = []) => Array.from(new Set([...(arr || []), ...more]));
  if (contextData.department) update['userContext.department'] = contextData.department;
  if (contextData.course) update['userContext.course'] = contextData.course;
  if (contextData.year) update['userContext.year'] = contextData.year;
  if (contextData.currentSemester) update['userContext.currentSemester'] = contextData.currentSemester;
  if (contextData.academicYear) update['userContext.academicYear'] = contextData.academicYear;

  const setOps = { ...update };
  const now = new Date();
  const ops = { $set: { ...setOps, lastActivity: now } };

  // For array fields we need current doc to union values
  return this.constructor.findById(this._id).then((doc) => {
    if (!doc) return null;
    if (contextData.interests) ops.$set['userContext.interests'] = addUnique(doc.userContext.interests, contextData.interests);
    if (contextData.lastTopics) ops.$set['userContext.lastTopics'] = addUnique(doc.userContext.lastTopics, contextData.lastTopics);
    if (contextData.preferences) ops.$set['userContext.preferences'] = { ...doc.userContext.preferences, ...contextData.preferences };
    return this.constructor.updateOne({ _id: this._id }, ops).exec();
  });
};

// Method to get recent conversation history
UserSessionSchema.methods.getRecentHistory = function(limit = 10) {
  return this.conversationHistory
    .slice(-limit)
    .map(turn => ({
      role: turn.role,
      content: turn.content
    }));
};

// Static method to find or create active session
UserSessionSchema.statics.findOrCreateActiveSession = async function(userId, sessionId, sessionMetadata = {}) {
  let session = await this.findOne({ userId, sessionId, isActive: true });
  
  if (!session) {
    session = new this({
      userId,
      sessionId,
      sessionMetadata: {
        ...sessionMetadata,
        loginTime: new Date()
      }
    });
    await session.save();
  } else {
    // Update last activity
    session.lastActivity = new Date();
    await session.save();
  }
  
  return session;
};

// Static method to deactivate old sessions
UserSessionSchema.statics.deactivateOldSessions = async function(userId, keepSessionId) {
  await this.updateMany(
    { 
      userId, 
      sessionId: { $ne: keepSessionId },
      isActive: true 
    },
    { 
      isActive: false,
      lastActivity: new Date()
    }
  );
};

module.exports = mongoose.model('UserSession', UserSessionSchema);
