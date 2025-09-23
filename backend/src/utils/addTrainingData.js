const mongoose = require('mongoose');
require('dotenv').config();

const KnowledgeItem = require('../models/KnowledgeItem');
const { embedText } = require('../services/gemini');

// Sample training data for common university questions
const trainingData = [
  {
    title: "Vignan University Overview",
    content: "Vignan University is a premier educational institution located in Guntur, Andhra Pradesh, India. It offers undergraduate and postgraduate programs in Engineering, Management, Pharmacy, and other professional fields. The university is affiliated with JNTU (Jawaharlal Nehru Technological University) and follows R22 and R25 academic regulations. Vignan University is known for its modern infrastructure, experienced faculty, strong industry connections, and excellent placement support.",
    sourceType: "text",
    sourceName: "University Information"
  },
  {
    title: "Computer Science Engineering Program",
    content: "The Computer Science Engineering program at Vignan University is a 4-year B.Tech program that covers fundamental concepts in computer science, programming, algorithms, data structures, software engineering, database management, computer networks, and artificial intelligence. Students learn multiple programming languages including C, C++, Java, Python, and web technologies. The program includes practical lab sessions, projects, internships, and industry training. Graduates can pursue careers in software development, data science, cybersecurity, web development, and more.",
    sourceType: "text",
    sourceName: "Academic Programs"
  },
  {
    title: "Academic Regulations R22",
    content: "R22 regulations are the 2022 academic framework for undergraduate programs at JNTU-affiliated institutions including Vignan University. Key features include: 4-year duration (8 semesters), Choice Based Credit System (CBCS), minimum 160 credits for graduation, minimum 5.0 CGPA requirement, 30% internal assessment and 70% external assessment, 10-point grading scale (O, A+, A, B+, B, C, P, F), mandatory project work in 6th, 7th, and 8th semesters, and internship/industrial training requirements.",
    sourceType: "text",
    sourceName: "Academic Regulations"
  },
  {
    title: "Academic Regulations R25",
    content: "R25 regulations are the enhanced 2025 academic framework with industry focus. Key features include: 4-year duration (8 semesters), Enhanced Choice Based Credit System, 160-170 credits for graduation, minimum 5.0 CGPA requirement, 40% continuous assessment and 60% end-semester examination, enhanced 10-point grading scale, mandatory research methodology course, more flexible elective choices, increased industry integration, and additional skill development courses.",
    sourceType: "text",
    sourceName: "Academic Regulations"
  },
  {
    title: "Placement and Career Support",
    content: "Vignan University has a dedicated Training and Placement Cell that provides comprehensive career support to students. Services include: industry partnerships with top companies, regular placement drives, internship opportunities, career counseling, resume building workshops, mock interviews, soft skills training, technical skill development programs, and alumni network support. The university has strong connections with IT companies, manufacturing firms, and service industries.",
    sourceType: "text",
    sourceName: "Career Services"
  },
  {
    title: "Campus Facilities",
    content: "Vignan University campus features modern facilities including: well-equipped laboratories with latest technology, extensive library with digital resources, computer centers with high-speed internet, sports facilities and gymnasium, hostel accommodation for students, cafeteria and food courts, medical center, transportation services, auditoriums and seminar halls, research centers, and green campus environment.",
    sourceType: "text",
    sourceName: "Campus Information"
  },
  {
    title: "Admission Process",
    content: "Admission to Vignan University programs is based on: EAMCET (Engineering, Agriculture and Medical Common Entrance Test) scores for engineering programs, ICET (Integrated Common Entrance Test) for management programs, GPAT (Graduate Pharmacy Aptitude Test) for pharmacy programs, direct admission based on merit, and management quota seats. The admission process includes application submission, document verification, counseling, and fee payment.",
    sourceType: "text",
    sourceName: "Admissions"
  },
  {
    title: "Student Life and Activities",
    content: "Vignan University offers vibrant student life with various activities including: technical clubs and societies, cultural events and festivals, sports competitions, academic conferences and seminars, entrepreneurship development programs, community service initiatives, student government, peer mentoring programs, and international exchange opportunities. The university encourages holistic development beyond academics.",
    sourceType: "text",
    sourceName: "Student Life"
  },
  {
    title: "Study Tips for Students",
    content: "Effective study strategies for university students include: creating a study schedule and sticking to it, using active learning techniques like summarizing and teaching others, taking regular breaks during study sessions, forming study groups with classmates, utilizing library resources and online materials, attending all classes and taking detailed notes, practicing past exam papers, seeking help from professors and teaching assistants, maintaining a healthy work-life balance, and staying organized with assignments and deadlines.",
    sourceType: "text",
    sourceName: "Academic Support"
  },
  {
    title: "Common Student Questions",
    content: "Frequently asked questions by students include: How to check exam results and grades? What are the library timings and resources? How to apply for scholarships and financial aid? What are the hostel facilities and rules? How to access online learning platforms? What are the internship and project requirements? How to contact faculty and administration? What are the campus safety measures? How to participate in extracurricular activities? What are the graduation requirements and procedures?",
    sourceType: "text",
    sourceName: "Student Support"
  }
];

async function addTrainingData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vignan_chatbot';
    await mongoose.connect(mongoUri, { autoIndex: true });
    console.log('Connected to MongoDB');
    
    console.log('Starting to add training data...');
    
    for (const item of trainingData) {
      // Check if item already exists
      const existingItem = await KnowledgeItem.findOne({ 
        title: item.title,
        sourceType: item.sourceType 
      });
      
      if (existingItem) {
        console.log(`Skipping existing item: ${item.title}`);
        continue;
      }
      
      // Generate embedding for the content
      console.log(`Generating embedding for: ${item.title}`);
      const embedding = await embedText(item.content);
      
      // Create new knowledge item
      const knowledgeItem = new KnowledgeItem({
        ...item,
        embedding: embedding,
        metadata: {
          addedBy: 'system',
          category: 'training_data',
          priority: 'high'
        }
      });
      
      await knowledgeItem.save();
      console.log(`Added training data: ${item.title}`);
    }
    
    console.log('Training data addition completed successfully!');
  } catch (error) {
    console.error('Error adding training data:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  addTrainingData().then(() => {
    console.log('Training data script completed');
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { addTrainingData };
