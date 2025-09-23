const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { embedText } = require('./gemini');
const axios = require('axios');

// OCR configuration (multi-language + page cap)
const OCR_LANGS = (process.env.OCR_LANGS || 'eng').toLowerCase().replace(/[, ]+/g, '+');
const OCR_PDF_PAGES = Number.parseInt(process.env.OCR_PDF_PAGES || process.env.OCR_MAX_PAGES || '5', 10);

// Enhanced PDF extraction with better text processing (preserve line breaks)
async function extractFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    // pdf-parse keeps line breaks in data.text. Normalize but preserve them so timetable parsing works.
    let text = String(data.text || '');
    text = text.replace(/\r\n/g, '\n'); // normalize EOL
    text = text.replace(/[ \t]+\n/g, '\n'); // trim trailing spaces before newline
    text = text.replace(/\n{3,}/g, '\n\n'); // collapse huge blank blocks
    text = text.replace(/[ \t]{2,}/g, ' '); // collapse long runs of spaces but keep newlines
    text = text.trim();

    // If the extracted text is suspiciously short, try a secondary extraction via pdfjs-dist
    if (text.length < 50) {
      try {
        const pdfjsLib = require('pdfjs-dist');
        // For Node usage, directly pass the buffer
        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
        const pdf = await loadingTask.promise;
        let alt = '';
        const maxPages = Math.min(pdf.numPages, 10); // cap for performance
        for (let p = 1; p <= maxPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const pageText = content.items.map(it => it.str).join(' ');
          alt += (alt ? '\n\n' : '') + pageText;
        }
        alt = String(alt || '')
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
        if (alt.length > text.length) text = alt;
      } catch (e) {
        console.warn('Secondary PDF extraction (pdfjs) failed:', e.message);
      }
    }

    // Final fallback: Local OCR (Tesseract) on first few pages via sharp rasterization
    if (text.length < 50) {
      try {
        const ocr = await ocrPdfWithSharp(dataBuffer, OCR_PDF_PAGES, OCR_LANGS);
        if (ocr.length > text.length) text = ocr;
      } catch (e) {
        console.warn('OCR PDF fallback failed:', e.message);
      }
    }

    // Split into logical sections based on common patterns (uses double newlines)
    const sections = splitIntoSections(text);

    return {
      rawText: text,
      sections,
      metadata: {
        pages: data.numpages,
        info: data.info,
        extractedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return { rawText: '', sections: [], metadata: { error: error.message } };
  }
}

// Enhanced DOCX extraction (preserve line breaks)
async function extractFromDocx(filePath) {
  try {
    const { value } = await mammoth.extractRawText({ path: filePath });
    let text = String(value || '');

    // Normalize whitespace while preserving line breaks
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/[ \t]+\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]{2,}/g, ' ');
    text = text.trim();

    const sections = splitIntoSections(text);

    return {
      rawText: text,
      sections,
      metadata: {
        extractedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return { rawText: '', sections: [], metadata: { error: error.message } };
  }
}

// Enhanced image extraction with better OCR (preserve line breaks)
async function extractFromImage(filePath, lang = OCR_LANGS) {
  try {
    const { data: { text } } = await Tesseract.recognize(filePath, lang);
    let cleanedText = String(text || '');
    cleanedText = cleanedText.replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    const sections = splitIntoSections(cleanedText);

    return {
      rawText: cleanedText,


      sections,
      metadata: {
        extractedAt: new Date().toISOString(),
        language: lang
      }
    };
  } catch (error) {
    console.error('Image extraction error:', error);
    return { rawText: '', sections: [], metadata: { error: error.message } };
  }
}

// Basic URL/article extraction using readability endpoints
async function extractFromUrl(url) {
  try {
    // Try to fetch raw HTML
    const { data } = await axios.get(url, { timeout: 8000, responseType: 'text' });
    const html = String(data || '');
    // Strip tags naively as a baseline; admins are trusted to add academic links
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&amp;|&quot;|&lt;|&gt;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanedText = text.slice(0, 200000); // cap to 200k chars
    const sections = splitIntoSections(cleanedText);
    return {
      rawText: cleanedText,
      sections,
      metadata: { extractedAt: new Date().toISOString(), source: url }
    };
  } catch (error) {
    console.error('URL extraction error:', error.message);
    return { rawText: '', sections: [], metadata: { error: error.message } };
  }
}

// Function to split text into logical sections
function splitIntoSections(text) {
  const sections = [];

  // Common section patterns for academic documents
  const sectionPatterns = [
    { pattern: /(?:chapter|section|part)\s*\d+[:\-\s]*([^\n]+)/gi, type: 'chapter' },
    { pattern: /(?:introduction|overview|summary|conclusion)/gi, type: 'section' },


    { pattern: /(?:syllabus|curriculum|course\s+outline)/gi, type: 'syllabus' },
    { pattern: /(?:regulation|rule|policy|guideline)/gi, type: 'regulation' },
    { pattern: /(?:credit|cgpa|grade|evaluation|assessment)/gi, type: 'academic' },
    { pattern: /(?:project|assignment|exam|test)/gi, type: 'assessment' }
  ];

  // Split by common delimiters
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  let currentSection = { type: 'general', content: '', title: 'Introduction' };

  for (const paragraph of paragraphs) {
    let sectionFound = false;

    for (const { pattern, type } of sectionPatterns) {
      if (pattern.test(paragraph)) {
        // Save current section if it has content
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }

        // Start new section
        currentSection = {
          type: type,
          content: paragraph.trim(),


          title: extractTitle(paragraph)
        };
        sectionFound = true;
        break;
      }
    }

    if (!sectionFound) {
      currentSection.content += (currentSection.content ? '\n\n' : '') + paragraph.trim();
    }
  }

  // Add the last section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}

// Function to extract title from text
function extractTitle(text) {
  const lines = text.split('\n');
  const firstLine = lines[0].trim();

  // If first line is short and looks like a title, use it
  if (firstLine.length < 100 && /^[A-Z]/.test(firstLine)) {
    return firstLine;
  }

  // Otherwise, create a generic title based on content
  if (text.toLowerCase().includes('syllabus')) return 'Syllabus';
  if (text.toLowerCase().includes('regulation')) return 'Regulations';
  if (text.toLowerCase().includes('course')) return 'Course Information';
  if (text.toLowerCase().includes('project')) return 'Project Guidelines';

  return 'Document Section';
}

// Function to create knowledge items from extracted content
async function createKnowledgeItems(extractedData, sourceType, sourceName) {
  const knowledgeItems = [];

  // Map incoming sourceType (which may be a MIME type) to our enum
  const mapSourceType = (type, name) => {
    const allowed = ['pdf', 'docx', 'image', 'text', 'faq'];
    let t = String(type || '').toLowerCase();
    if (t.includes('/')) {
      // MIME type
      if (t.startsWith('image/')) t = 'image';
      else if (t === 'application/pdf') t = 'pdf';
      else if (t.includes('officedocument.wordprocessingml.document')) t = 'docx';
      else t = 'text';
    }
    if (!allowed.includes(t)) {
      // Fall back to extension from sourceName


      const ext = (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
      if (ext === 'pdf') t = 'pdf';
      else if (ext === 'docx') t = 'docx';
      else if (['png','jpg','jpeg','bmp','tif','tiff','gif','webp'].includes(ext || '')) t = 'image';
      else t = 'text';
    }
    return t;
  };

  try {
    const mappedType = mapSourceType(sourceType, sourceName);

    // Create main knowledge item from raw text
    const mainEmbedding = await embedText(extractedData.rawText);
    knowledgeItems.push({
      title: `Document: ${sourceName}`,
      content: extractedData.rawText,
      sourceType: mappedType,
      sourceName: sourceName,
      embedding: mainEmbedding,
      metadata: extractedData.metadata
    });

    // Create section-specific knowledge items
    for (const section of extractedData.sections) {
      if (section.content.length > 50) {
        const sectionEmbedding = await embedText(section.content);
        knowledgeItems.push({
          title: `${section.title} - ${sourceName}`,
          content: section.content,
          sourceType: mappedType,
          sourceName: sourceName,
          embedding: sectionEmbedding,
          metadata: {
            ...extractedData.metadata,
            sectionType: section.type,
            sectionTitle: section.title
          }
        });
      }
    }

    return knowledgeItems;
  } catch (error) {
    console.error('Error creating knowledge items:', error);
    return [];
  }
}


// Local OCR for PDF using sharp to rasterize pages and Tesseract to recognize text
async function ocrPdfWithSharp(pdfBuffer, maxPages = OCR_PDF_PAGES, lang = OCR_LANGS) {
  let combined = '';
  try {
    // Probe number of pages using sharp's metadata; if unavailable, fall back to maxPages
    let pageCount = maxPages;
    try {
      const meta = await sharp(pdfBuffer).metadata();
      if (typeof meta.pages === 'number' && meta.pages > 0) {
        pageCount = Math.min(meta.pages, maxPages);
      }
    } catch (_) {}

    for (let i = 0; i < pageCount; i++) {
      // Render page i to PNG at higher density for better OCR
      const png = await sharp(pdfBuffer, { density: 200, page: i })
        .png()
        .toBuffer();
      const { data: { text } } = await Tesseract.recognize(png, lang);
      const cleaned = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      if (cleaned) combined += (combined ? '\n\n' : '') + cleaned;
      if (combined.length > 500) break; // Early stop if we already have enough text
    }
  } catch (e) {
    console.warn('ocrPdfWithSharp error:', e.message);
  }
  return combined;
}

module.exports = {
  extractFromPdf,
  extractFromDocx,
  extractFromImage,
  createKnowledgeItems,
  splitIntoSections,
  extractFromUrl
};


