const { retrieveRelevantKnowledge } = require('../services/learningIntegration');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');

// Mock dependencies
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Test suite for the learning integration service
describe('Learning Integration Service', () => {
  // Connect to the test database before running tests
  beforeAll(async () => {
    await connectDB();
  });

  // Disconnect from the database after tests
  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test retrieveRelevantKnowledge function with different query types
  describe('retrieveRelevantKnowledge', () => {
    // Test case for course-related queries
    it('should retrieve relevant knowledge for course-related queries', async () => {
      const query = 'What are the prerequisites for Data Structures and Algorithms?';
      const userId = '60d0fe4f5311236168a109ca'; // Mock user ID
      
      const results = await retrieveRelevantKnowledge(query, userId);
      
      // Verify results structure
      expect(results).toBeDefined();
      expect(results).toHaveProperty('knowledgeItems');
      expect(results).toHaveProperty('faqs');
      expect(results).toHaveProperty('events');
      expect(results).toHaveProperty('chatLogs');
      expect(results).toHaveProperty('userProfiles');
      expect(results).toHaveProperty('webResults');
      expect(results).toHaveProperty('urlContent');
    });

    // Test case for event-related queries
    it('should retrieve relevant events for event-related queries', async () => {
      const query = 'Are there any upcoming workshops this month?';
      const userId = '60d0fe4f5311236168a109ca'; // Mock user ID
      
      const results = await retrieveRelevantKnowledge(query, userId);
      
      // Verify events are retrieved
      expect(results).toBeDefined();
      expect(results).toHaveProperty('events');
      // Events should be an array
      expect(Array.isArray(results.events)).toBe(true);
    });

    // Test case for FAQ-related queries
    it('should retrieve relevant FAQs for common questions', async () => {
      const query = 'How do I register for classes?';
      const userId = '60d0fe4f5311236168a109ca'; // Mock user ID
      
      const results = await retrieveRelevantKnowledge(query, userId);
      
      // Verify FAQs are retrieved
      expect(results).toBeDefined();
      expect(results).toHaveProperty('faqs');
      // FAQs should be an array
      expect(Array.isArray(results.faqs)).toBe(true);
    });

    // Test case for user profile integration
    it('should include user profile data for personalized queries', async () => {
      const query = 'What courses should I take next semester based on my interests?';
      const userId = '60d0fe4f5311236168a109ca'; // Mock user ID
      
      const results = await retrieveRelevantKnowledge(query, userId);
      
      // Verify user profiles are retrieved
      expect(results).toBeDefined();
      expect(results).toHaveProperty('userProfiles');
      // User profiles should be an array
      expect(Array.isArray(results.userProfiles)).toBe(true);
    });

    // Test case for web search integration
    it('should perform web search for queries requiring external information', async () => {
      const query = 'What are the latest advancements in artificial intelligence?';
      const userId = '60d0fe4f5311236168a109ca'; // Mock user ID
      
      const results = await retrieveRelevantKnowledge(query, userId);
      
      // Verify web results are retrieved
      expect(results).toBeDefined();
      expect(results).toHaveProperty('webResults');
      // Web results should be an array
      expect(Array.isArray(results.webResults)).toBe(true);
    });

    // Test error handling
    it('should handle errors gracefully', async () => {
      // Mock an error by passing invalid parameters
      const query = null;
      const userId = '60d0fe4f5311236168a109ca';
      
      try {
        await retrieveRelevantKnowledge(query, userId);
      } catch (error) {
        // Verify error is logged
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });
});