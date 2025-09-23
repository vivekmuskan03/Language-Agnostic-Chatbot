/**
 * Manual Test Script for Learning Integration System
 * 
 * This script allows you to test the retrieveRelevantKnowledge function
 * with different query types to verify the system's functionality.
 */

const mongoose = require('mongoose');
const { retrieveRelevantKnowledge } = require('../services/learningIntegration');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');

// Sample user ID - replace with a valid user ID from your database
const TEST_USER_ID = '60d0fe4f5311236168a109ca'; // Example ID

// Sample queries to test different aspects of the system
const TEST_QUERIES = [
  {
    type: 'Course Query',
    query: 'What are the prerequisites for Data Structures and Algorithms?'
  },
  {
    type: 'Event Query',
    query: 'Are there any upcoming workshops this month?'
  },
  {
    type: 'FAQ Query',
    query: 'How do I register for classes?'
  },
  {
    type: 'Personalized Query',
    query: 'What courses should I take next semester based on my interests?'
  },
  {
    type: 'External Knowledge Query',
    query: 'What are the latest advancements in artificial intelligence?'
  }
];

/**
 * Run tests for all query types
 */
async function runTests() {
  try {
    // Connect to the database
    await connectDB();
    logger.info('Connected to database');
    
    // Test each query type
    for (const testCase of TEST_QUERIES) {
      logger.info(`\n\n===== Testing ${testCase.type} =====`);
      logger.info(`Query: "${testCase.query}"`);
      
      // Get results from the learning integration system
      const startTime = Date.now();
      const results = await retrieveRelevantKnowledge(testCase.query, TEST_USER_ID);
      const endTime = Date.now();
      
      // Log performance metrics
      logger.info(`Time taken: ${endTime - startTime}ms`);
      
      // Log result statistics
      logger.info('Results summary:');
      logger.info(`- Knowledge Items: ${results.knowledgeItems?.length || 0}`);
      logger.info(`- FAQs: ${results.faqs?.length || 0}`);
      logger.info(`- Events: ${results.events?.length || 0}`);
      logger.info(`- Chat Logs: ${results.chatLogs?.length || 0}`);
      logger.info(`- User Profiles: ${results.userProfiles?.length || 0}`);
      logger.info(`- Web Results: ${results.webResults?.length || 0}`);
      logger.info(`- URL Content: ${Object.keys(results.urlContent || {}).length}`);
      
      // Display top result from each category if available
      if (results.knowledgeItems?.length > 0) {
        logger.info('\nTop Knowledge Item:');
        logger.info(JSON.stringify(results.knowledgeItems[0], null, 2));
      }
      
      if (results.faqs?.length > 0) {
        logger.info('\nTop FAQ:');
        logger.info(JSON.stringify(results.faqs[0], null, 2));
      }
      
      if (results.events?.length > 0) {
        logger.info('\nTop Event:');
        logger.info(JSON.stringify(results.events[0], null, 2));
      }
    }
    
    logger.info('\n===== All tests completed =====');
  } catch (error) {
    logger.error('Error running tests:', error);
  } finally {
    // Disconnect from the database
    await mongoose.connection.close();
    logger.info('Disconnected from database');
    process.exit(0);
  }
}

// Run the tests
runTests();

/**
 * To run this script:
 * node src/scripts/test-learning-integration.js
 * 
 * Make sure you have a valid .env file with database connection details
 */