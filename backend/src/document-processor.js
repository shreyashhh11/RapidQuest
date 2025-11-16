const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { marked } = require('marked');

class DocumentProcessor {
  constructor() {
    // Configure marked for better parsing
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }

  async extractText(filePath, filename) {
    try {
      const ext = path.extname(filename).toLowerCase();
      console.log(`📄 Processing ${ext.toUpperCase()} file: ${filename}`);
      
      let extractedText = '';
      
      switch (ext) {
        case '.pdf':
          extractedText = await this.extractTextFromPDF(filePath);
          break;
        case '.txt':
          extractedText = await this.extractTextFromText(filePath);
          break;
        case '.md':
        case '.markdown':
          extractedText = await this.extractTextFromMarkdown(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}. Only PDF, TXT, and MD files are supported.`);
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(`No readable text found in ${ext.toUpperCase()} file. The file might be empty, corrupted, or contain only images/graphics.`);
      }
      
      console.log(`✅ Successfully extracted ${extractedText.length} characters from ${filename}`);
      return extractedText;
      
    } catch (error) {
      console.error(`❌ Error extracting text from ${filename}:`, error.message);
      throw new Error(`Failed to extract text from ${filename}: ${error.message}`);
    }
  }

  async extractTextFromPDF(filePath) {
    try {
      console.log(`🔍 Reading PDF file: ${filePath}`);
      const dataBuffer = fs.readFileSync(filePath);
      console.log(`📊 PDF file size: ${dataBuffer.length} bytes`);
      
      // Check if file is too small to be a valid PDF
      if (dataBuffer.length < 100) {
        throw new Error('PDF file is too small to be valid (less than 100 bytes)');
      }
      
      // Check for PDF header
      const header = dataBuffer.toString('ascii', 0, 8);
      if (!header.startsWith('%PDF-')) {
        throw new Error('Invalid PDF file format. File does not start with PDF header.');
      }
      
      console.log(`🔍 Parsing PDF content...`);
      const pdfData = await pdf(dataBuffer);
      
      if (!pdfData) {
        throw new Error('PDF parser returned no data');
      }
      
      if (!pdfData.text) {
        throw new Error('PDF parser found no text content. This might be a scanned document or contain only images.');
      }
      
      const extractedText = pdfData.text.trim();
      console.log(`📄 Extracted ${extractedText.length} characters from PDF`);
      
      if (extractedText.length < 10) {
        throw new Error('PDF contains insufficient text content for processing (less than 10 characters).');
      }
      
      // Check for common PDF encoding issues
      if (extractedText.includes('�') || extractedText.includes('?')) {
        console.warn('⚠️  PDF may contain encoding issues or special characters');
      }
      
      return extractedText;
      
    } catch (error) {
      console.error(`❌ PDF parsing failed:`, error.message);
      
      // More specific error messages based on error type
      if (error.message.includes('Invalid PDF') || error.message.includes('Invalid PDF file format')) {
        throw new Error('Invalid PDF file format. Please try a different PDF file.');
      } else if (error.message.includes('password') || error.message.includes('encrypted') || error.message.includes('permission')) {
        throw new Error('PDF is password protected or encrypted. Please use an unprotected PDF file.');
      } else if (error.message.includes('corrupted') || error.message.includes('malformed')) {
        throw new Error('PDF file is corrupted or malformed. Please try a different PDF file.');
      } else if (error.message.includes('scanned') || error.message.includes('images') || error.message.includes('image-based')) {
        throw new Error('This appears to be a scanned PDF (image-based) without selectable text. Please try a different PDF or convert it to text format first.');
      } else if (error.message.includes('too small to be valid')) {
        throw new Error('PDF file is too small or incomplete. Please try a different PDF file.');
      } else if (error.message.includes('insufficient text content')) {
        throw new Error('PDF contains insufficient text content for searching.');
      } else {
        // Generic PDF parsing error
        throw new Error(`PDF parsing failed: ${error.message}. This might be due to complex formatting, special characters, or file corruption. Try converting to text format first.`);
      }
    }
  }

  async extractTextFromText(filePath) {
    try {
      console.log(`📖 Reading text file: ${filePath}`);
      const stats = fs.statSync(filePath);
      console.log(`📊 Text file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Text file is empty (0 bytes)');
      }
      
      if (stats.size < 2) {
        throw new Error('Text file is too small (less than 2 bytes)');
      }
      
      // Try different encodings
      let content = '';
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (utf8Error) {
        console.warn('⚠️  UTF-8 encoding failed, trying other encodings...');
        
        // Try common encodings
        const encodings = ['utf16le', 'latin1', 'cp1252', 'ascii'];
        for (const encoding of encodings) {
          try {
            content = fs.readFileSync(filePath, encoding);
            console.log(`✅ Successfully read with ${encoding} encoding`);
            break;
          } catch (encodingError) {
            continue;
          }
        }
        
        if (!content) {
          throw new Error('Unable to read file with any supported encoding');
        }
      }
      
      const extractedText = content.trim();
      console.log(`📄 Extracted ${extractedText.length} characters from text file`);
      
      if (extractedText.length === 0) {
        throw new Error('Text file is empty after removing whitespace');
      }
      
      if (extractedText.length < 5) {
        throw new Error('Text file contains too little content (less than 5 characters)');
      }
      
      return extractedText;
      
    } catch (error) {
      console.error(`❌ Text file reading failed:`, error.message);
      throw new Error(`Text file processing failed: ${error.message}`);
    }
  }

  async extractTextFromMarkdown(filePath) {
    try {
      console.log(`📝 Reading Markdown file: ${filePath}`);
      const stats = fs.statSync(filePath);
      console.log(`📊 Markdown file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Markdown file is empty (0 bytes)');
      }
      
      const markdownContent = fs.readFileSync(filePath, 'utf8').trim();
      
      if (markdownContent.length === 0) {
        throw new Error('Markdown file is empty after removing whitespace');
      }
      
      if (markdownContent.length < 5) {
        throw new Error('Markdown file contains too little content (less than 5 characters)');
      }
      
      console.log(`📄 Read ${markdownContent.length} characters from Markdown file`);
      
      // Convert markdown to HTML, then strip HTML tags for plain text
      let html = '';
      try {
        html = marked(markdownContent);
      } catch (markedError) {
        console.warn('⚠️  Markdown parsing with marked failed, treating as plain text');
        // If markdown parsing fails, treat as plain text
        return this.stripHtmlTags(markdownContent);
      }
      
      const extractedText = this.stripHtmlTags(html);
      console.log(`🔧 Converted to text: ${extractedText.length} characters`);
      
      if (extractedText.length === 0) {
        throw new Error('Markdown file contains no readable content after processing');
      }
      
      return extractedText;
      
    } catch (error) {
      console.error(`❌ Markdown processing failed:`, error.message);
      throw new Error(`Markdown processing failed: ${error.message}`);
    }
  }

  stripHtmlTags(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove style tags
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<')  // Replace &lt; with <
      .replace(/&gt;/g, '>')  // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ')   // Replace multiple whitespace with single space
      .trim();
  }

  splitIntoChunks(text, chunkSize = 1000, overlap = 100) {
    if (!text || text.length === 0) {
      return [];
    }

    console.log(`✂️  Splitting ${text.length} characters into chunks...`);

    // Clean and normalize text
    const cleanText = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (cleanText.length <= chunkSize) {
      console.log(`📦 Single chunk created (${cleanText.length} characters)`);
      return [cleanText];
    }

    const chunks = [];
    let start = 0;
    let chunkCount = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;

      // Try to break at sentence boundaries
      if (end < cleanText.length) {
        const sentenceEnd = this.findSentenceBoundary(cleanText, start, end);
        if (sentenceEnd > start) {
          end = sentenceEnd;
        }
      }

      // Add overlap for context
      let chunk = cleanText.substring(start, end);
      
      // Ensure we don't cut words in half at the beginning
      if (start > 0) {
        const wordStart = this.findWordBoundary(cleanText, start);
        if (wordStart > start && wordStart < start + 50) { // Small overlap tolerance
          start = wordStart;
          chunk = cleanText.substring(start, end);
        }
      }

      if (chunk.trim()) {
        chunkCount++;
        chunks.push(chunk.trim());
      }

      // Move start position with overlap
      start = Math.max(start + chunkSize - overlap, start + 1);
    }

    console.log(`✅ Created ${chunkCount} chunks (avg ${Math.round(cleanText.length / chunkCount)} chars each)`);
    return chunks;
  }

  findSentenceBoundary(text, start, end) {
    // Look for sentence endings (., !, ?) in the last 100 characters
    const searchStart = Math.max(start + (end - start) - 100, start);
    const searchEnd = Math.min(end + 50, text.length);
    
    for (let i = searchEnd; i > searchStart; i--) {
      if (/[.!?]/.test(text[i]) && (i === searchEnd - 1 || /\s/.test(text[i + 1]))) {
        return i + 1;
      }
    }
    
    return end;
  }

  findWordBoundary(text, position) {
    // Look for word boundaries before the position
    for (let i = position; i > Math.max(0, position - 50); i--) {
      if (/\s/.test(text[i]) && !/\s/.test(text[i - 1])) {
        return i;
      }
    }
    
    return position;
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ext.slice(1); // Remove the dot
  }

  validateFile(file) {
    const allowedTypes = ['pdf', 'txt', 'md', 'markdown'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    console.log(`🔍 Validating file: ${file.originalname}`);
    console.log(`📏 File size: ${file.size} bytes`);
    console.log(`📄 File type: ${path.extname(file.originalname)}`);
    
    const fileType = this.getFileType(file.originalname);
    
    if (!allowedTypes.includes(fileType)) {
      const error = new Error(`Unsupported file type: ${fileType}. Only PDF, TXT, and MD files are allowed.`);
      error.code = 'INVALID_FILE_TYPE';
      throw error;
    }
    
    if (file.size > maxSize) {
      const error = new Error(`File too large: ${file.size} bytes. Maximum size is ${maxSize} bytes (${Math.round(maxSize / 1024 / 1024)}MB).`);
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }
    
    if (file.size < 10) {
      const error = new Error(`File too small: ${file.size} bytes. Minimum file size is 10 bytes.`);
      error.code = 'FILE_TOO_SMALL';
      throw error;
    }
    
    console.log(`✅ File validation passed`);
    return true;
  }

  // Utility method to clean text for better processing
  cleanTextForEmbedding(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Method to extract key information from text
  extractKeywords(text, maxKeywords = 20) {
    const cleaned = this.cleanTextForEmbedding(text);
    const words = cleaned.split(/\s+/);
    
    // Filter out common stop words
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'of', 'for', 'with', 'in',
      'to', 'from', 'by', 'about', 'into', 'through', 'over', 'under', 'above',
      'below', 'up', 'down', 'out', 'off', 'between', 'after', 'before', 'during'
    ]);
    
    const wordFreq = {};
    
    words.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // Sort by frequency and return top keywords
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  // Method to check if file seems valid based on content analysis
  analyzeFileContent(text, filename) {
    const analysis = {
      filename,
      textLength: text.length,
      wordCount: text.split(/\s+/).length,
      lineCount: text.split('\n').length,
      hasSpecialChars: /[^\w\s.,!?-]/.test(text),
      avgWordsPerLine: 0,
      suggestions: []
    };

    analysis.avgWordsPerLine = Math.round(analysis.wordCount / Math.max(analysis.lineCount, 1));

    // Generate suggestions based on analysis
    if (analysis.textLength < 100) {
      analysis.suggestions.push('File is very short - may not contain enough content for meaningful search');
    }

    if (analysis.lineCount < 5) {
      analysis.suggestions.push('File has very few lines - might be poorly formatted');
    }

    if (analysis.hasSpecialChars) {
      analysis.suggestions.push('File contains special characters that might affect text processing');
    }

    if (analysis.avgWordsPerLine < 3) {
      analysis.suggestions.push('Average words per line is low - file might be formatted in columns or tables');
    }

    return analysis;
  }
}

module.exports = DocumentProcessor;