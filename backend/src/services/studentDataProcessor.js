const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const Student = require('../models/Student');

/**
 * Process CSV file and extract student data
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} - Array of student objects
 */
async function processCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Process Excel file and extract student data
 * @param {string} filePath - Path to the Excel file
 * @returns {Array} - Array of student objects
 */
function processExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    // Validate data structure
    if (!Array.isArray(data)) {
      throw new Error('Invalid Excel format: data is not an array');
    }
    
    return data;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw new Error(`Excel processing error: ${error.message}`);
  }
}

/**
 * Process student data file (CSV or Excel)
 * @param {string} filePath - Path to the file
 * @param {string} fileType - Type of file (csv or excel)
 * @returns {Promise<Array>} - Array of processed student data
 */
async function processStudentDataFile(filePath, fileType) {
  try {
    let studentData = [];
    
    if (fileType === 'csv') {
      studentData = await processCSV(filePath);
    } else if (fileType === 'excel') {
      studentData = processExcel(filePath);
    } else {
      throw new Error('Unsupported file type');
    }
    
    return studentData;
  } catch (error) {
    console.error('Error processing student data file:', error);
    throw error;
  }
}

/**
 * Save student data to database and prepare for AI training
 * @param {Array} studentData - Array of student objects
 * @returns {Promise<Object>} - Result of the operation
 */
async function saveStudentData(studentData) {
  try {
    const results = {
      total: studentData.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      trainedForAI: false
    };
    
    // Prepare training data for AI to understand registration numbers
    const trainingData = [];
    
    for (const student of studentData) {
      try {
        // Ensure student has a registration number
        if (!student.registrationNumber) {
          results.failed++;
          results.errors.push({ student, error: 'Missing registration number' });
          continue;
        }
        
        // Normalize registration number (remove spaces, convert to uppercase)
        student.registrationNumber = student.registrationNumber.toString().trim().toUpperCase();
        
        // Add to training data for AI
        trainingData.push({
          registrationNumber: student.registrationNumber,
          studentInfo: student
        });
        
        // Try to find existing student
        const existingStudent = await Student.findOne({ 
          registrationNumber: student.registrationNumber 
        });
        
        if (existingStudent) {
          // Update existing student
          Object.keys(student).forEach(key => {
            if (student[key] !== undefined && student[key] !== null) {
              // Handle special case for additionalData
              if (!['registrationNumber', 'name', 'email', 'course', 'batch', 'semester', 'department'].includes(key)) {
                existingStudent.additionalData.set(key, student[key]);
              } else {
                existingStudent[key] = student[key];
              }
            }
          });
          
          await existingStudent.save();
          results.updated++;
        } else {
          // Create new student
          const newStudent = {
            registrationNumber: student.registrationNumber,
            name: student.name || '',
            email: student.email || '',
            course: student.course || '',
            batch: student.batch || '',
            semester: student.semester || '',
            department: student.department || '',
            additionalData: {}
          };
          
          // Add any additional fields to additionalData
          Object.keys(student).forEach(key => {
            if (
              student[key] !== undefined && 
              student[key] !== null && 
              !['registrationNumber', 'name', 'email', 'course', 'batch', 'semester', 'department'].includes(key)
            ) {
              newStudent.additionalData[key] = student[key];
            }
          });
          
          await Student.create(newStudent);
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ student, error: error.message });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error processing student data:', error);
    throw error;
  }
}

/**
 * Train AI model to understand student data by registration number
 * @param {Array} trainingData - Array of student data for training
 * @returns {Promise<boolean>} - Success status
 */
async function trainModelOnStudentData(trainingData) {
  try {
    // If trainingData is not an array, convert it to one
    if (!Array.isArray(trainingData)) {
      trainingData = [trainingData];
    }
    
    console.log(`Training AI model with ${trainingData.length} student records`);
    
    // Format data for training
    const formattedData = [];
    
    for (const student of trainingData) {
      // Handle both direct student objects and objects with studentInfo property
      const studentInfo = student.studentInfo || student;
      const regNumber = student.registrationNumber || studentInfo.registrationNumber;
      
      if (!regNumber) {
        console.warn('Skipping student record without registration number');
        continue;
      }
      
      // Create multiple training examples for each student to improve recognition
      formattedData.push({
        input: `Student with registration number ${regNumber}`,
        output: JSON.stringify(studentInfo)
      });
      
      formattedData.push({
        input: `Find information for student ${regNumber}`,
        output: JSON.stringify(studentInfo)
      });
      
      formattedData.push({
        input: `Tell me about student with ID ${regNumber}`,
        output: JSON.stringify(studentInfo)
      });
      
      // Add training example with student name if available
      if (studentInfo.name) {
        formattedData.push({
          input: `Find student ${studentInfo.name} with ID ${regNumber}`,
          output: JSON.stringify(studentInfo)
        });
      }
    }
    
    // Create knowledge items for each student for vector search
    const { embedText } = require('./gemini');
    const KnowledgeItem = require('../models/KnowledgeItem');
    
    for (const student of trainingData) {
      const studentInfo = student.studentInfo || student;
      const regNumber = student.registrationNumber || studentInfo.registrationNumber;
      
      if (!regNumber) continue;
      
      // Create a structured text representation of the student
      const studentText = `
Student Registration: ${regNumber}
Name: ${studentInfo.name || 'Not specified'}
Email: ${studentInfo.email || 'Not specified'}
Course: ${studentInfo.course || 'Not specified'}
Department: ${studentInfo.department || 'Not specified'}
Batch: ${studentInfo.batch || 'Not specified'}
Semester: ${studentInfo.semester || 'Not specified'}
${studentInfo.additionalData ? `Additional Information: ${JSON.stringify(studentInfo.additionalData)}` : ''}
      `.trim();
      
      try {
        // Generate embedding for the student data
        const embedding = await embedText(studentText);
        
        // Create or update knowledge item for this student
        await KnowledgeItem.findOneAndUpdate(
          { 
            sourceType: 'student',
            'metadata.registrationNumber': regNumber
          },
          {
            title: `Student: ${studentInfo.name || regNumber}`,
            content: studentText,
            sourceType: 'student',
            sourceName: 'student-data',
            embedding,
            language: 'en',
            metadata: {
              registrationNumber: regNumber,
              studentId: studentInfo._id
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error(`Error creating knowledge item for student ${regNumber}:`, err);
      }
    }
    
    // Update the vector store to include the new student data
    const { updateVectorStore } = require('./learningIntegration');
    updateVectorStore('knowledge');
    
    return true;
  } catch (error) {
    console.error('Error training AI model on student data:', error);
    return false;
  }
}

module.exports = {
  processStudentDataFile,
  saveStudentData,
  trainModelOnStudentData
};