const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test cases for the improved chatbot
const testCases = [
  {
    name: "Basic Greeting",
    message: "hello",
    expectedKeywords: ["hello", "assistant", "help", "university"]
  },
  {
    name: "How are you",
    message: "how are you",
    expectedKeywords: ["great", "thank", "help", "university"]
  },
  {
    name: "University Question",
    message: "tell me about computer science program",
    expectedKeywords: ["computer science", "program", "engineering", "vignan"]
  },
  {
    name: "Academic Regulations",
    message: "what is R22 regulation",
    expectedKeywords: ["R22", "regulation", "academic", "credits"]
  },
  {
    name: "Thank you",
    message: "thank you",
    expectedKeywords: ["welcome", "help", "university"]
  }
];

async function testChatbot() {
  console.log('🤖 Testing Vignan University Chatbot Improvements\n');
  
  // You would need to get a valid token for testing
  const token = 'your-test-token-here'; // Replace with actual token
  
  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Test: ${testCase.name}`);
      console.log(`💬 Input: "${testCase.message}"`);
      
      const response = await axios.post(`${API_BASE}/chat`, {
        message: testCase.message,
        sessionId: 'test-session',
        language: 'en'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const answer = response.data.answer;
      console.log(`🤖 Response: "${answer}"`);
      
      // Check if response contains expected keywords
      const containsKeywords = testCase.expectedKeywords.some(keyword => 
        answer.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (containsKeywords) {
        console.log('✅ Test PASSED - Response contains expected keywords');
      } else {
        console.log('❌ Test FAILED - Response missing expected keywords');
        console.log(`Expected keywords: ${testCase.expectedKeywords.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ Test FAILED - Error: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Testing completed!');
}

// Run tests if called directly
if (require.main === module) {
  testChatbot().catch(console.error);
}

module.exports = { testChatbot };




