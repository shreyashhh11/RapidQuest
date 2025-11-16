const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import custom modules
const Database = require('./database');
const DocumentProcessor = require('./document-processor');
const SearchService = require('./search-service');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.md', '.markdown'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      const error = new Error(`Unsupported file type: ${ext}. Only PDF, TXT, and MD files are allowed.`);
      error.code = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  }
});

// Initialize services
const db = new Database(process.env.DATABASE_URL || './data/search.db');
const documentProcessor = new DocumentProcessor();
const searchService = new SearchService(db);

// Initialize database
db.init().then(() => {
  console.log('✅ Database initialized successfully');
}).catch(err => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    supportedFormats: ['PDF', 'TXT', 'MD'],
    maxFileSize: '50MB'
  });
});

// Upload and process documents with enhanced error handling
app.post('/api/upload', upload.single('document'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded',
        details: 'Please select a file to upload'
      });
    }

    tempFilePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    console.log('📄 Processing file:', req.file.originalname);
    console.log('📁 File path:', tempFilePath);
    console.log('📊 File size:', req.file.size, 'bytes');
    console.log('📝 File type:', fileExt);

    // Validate file before processing
    try {
      documentProcessor.validateFile(req.file);
    } catch (validationError) {
      console.error('❌ File validation failed:', validationError.message);
      
      // Clean up file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      return res.status(400).json({
        success: false,
        error: 'File validation failed',
        details: validationError.message,
        filename: req.file.originalname
      });
    }

    // Extract text from uploaded file
    console.log('🔍 Starting text extraction...');
    const extractedText = await documentProcessor.extractText(
      tempFilePath, 
      req.file.originalname
    );

    console.log('✅ Text extraction completed');
    console.log('📏 Extracted text length:', extractedText.length, 'characters');

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error(`No readable text found in ${fileExt.toUpperCase()} file. This might be a scanned image, corrupted file, or contain only images/graphics.`);
    }

    // Check for minimum content
    if (extractedText.trim().length < 10) {
      throw new Error('File contains too little text content to be useful for searching.');
    }

    // Split into chunks for better search
    console.log('✂️  Splitting text into chunks...');
    const chunks = documentProcessor.splitIntoChunks(extractedText);
    console.log('📦 Created', chunks.length, 'chunks');

    // Store in database (skip embeddings for now due to OpenAI issues)
    console.log('💾 Storing document in database...');
    const documentId = await searchService.storeDocument(
      req.file.originalname,
      extractedText,
      chunks
    );

    // Clean up uploaded file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('🗑️  Temporary file cleaned up');
    }

    console.log('✅ Document processing completed successfully');

    res.json({
      success: true,
      documentId,
      filename: req.file.originalname,
      fileType: fileExt.toUpperCase(),
      chunksProcessed: chunks.length,
      textLength: extractedText.length,
      message: `Successfully processed ${fileExt.toUpperCase()} file`
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Clean up file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️  Temporary file cleaned up after error');
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
    
    // Enhanced error handling based on error type
    let statusCode = 500;
    let errorCategory = 'Processing Error';
    let userMessage = 'An unexpected error occurred while processing your file.';
    
    if (error.message.includes('PDF parsing failed') || 
        error.message.includes('No readable text found in PDF')) {
      statusCode = 400;
      errorCategory = 'PDF Processing Error';
      userMessage = 'Unable to read text from PDF. Possible causes:';
      
      const suggestions = [];
      if (error.message.includes('scanned image')) {
        suggestions.push('• PDF might be a scanned document (image-based)');
      }
      if (error.message.includes('corrupted')) {
        suggestions.push('• PDF file might be corrupted');
      }
      if (error.message.includes('password') || error.message.includes('protected')) {
        suggestions.push('• PDF might be password protected');
      }
      suggestions.push('• Try converting PDF to text format first');
      suggestions.push('• Try a different PDF file');
      
      userMessage += '\n' + suggestions.join('\n');
      
    } else if (error.message.includes('Text file reading failed')) {
      statusCode = 400;
      errorCategory = 'Text File Error';
      userMessage = 'Unable to read text file. Please check that the file is not corrupted.';
      
    } else if (error.message.includes('Markdown processing failed')) {
      statusCode = 400;
      errorCategory = 'Markdown Processing Error';
      userMessage = 'Unable to process Markdown file. Please check the file format.';
      
    } else if (error.message.includes('Unsupported file type')) {
      statusCode = 400;
      errorCategory = 'File Type Error';
      userMessage = error.message;
      
    } else if (error.message.includes('File too large')) {
      statusCode = 400;
      errorCategory = 'File Size Error';
      userMessage = error.message;
      
    } else if (error.message.includes('too little text content')) {
      statusCode = 400;
      errorCategory = 'Content Error';
      userMessage = error.message;
    }
    
    // Handle multer-specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      statusCode = 400;
      errorCategory = 'File Size Error';
      userMessage = 'File is too large. Maximum size is 50MB.';
    } else if (error.code === 'INVALID_FILE_TYPE') {
      statusCode = 400;
      errorCategory = 'File Type Error';
      userMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorCategory,
      message: userMessage,
      details: error.message,
      filename: req.file ? req.file.originalname : 'unknown',
      suggestions: getSuggestions(error, req.file)
    });
  }
});

// Helper function to provide helpful suggestions
function getSuggestions(error, file) {
  const suggestions = [];
  
  if (!file) return suggestions;
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === '.pdf') {
    suggestions.push('Try a different PDF file');
    suggestions.push('Check if PDF is password protected');
    suggestions.push('Try converting PDF to text format');
    suggestions.push('Ensure PDF contains selectable text (not scanned images)');
  } else if (ext === '.txt') {
    suggestions.push('Check if text file is corrupted');
    suggestions.push('Try saving file in UTF-8 encoding');
    suggestions.push('Ensure file is not empty');
  } else if (ext === '.md') {
    suggestions.push('Check Markdown file syntax');
    suggestions.push('Try a simpler Markdown structure');
    suggestions.push('Ensure file is not corrupted');
  }
  
  return suggestions;
}

// Search documents
app.post('/api/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query is required',
        message: 'Please enter a search term'
      });
    }

    if (query.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query too short',
        message: 'Search query must be at least 2 characters long'
      });
    }

    console.log('🔍 Searching for:', query);

    const results = await searchService.search(query, limit);

    res.json({
      success: true,
      query,
      results,
      totalResults: results.length,
      message: results.length > 0 ? `Found ${results.length} relevant results` : 'No results found'
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Search failed',
      message: 'An error occurred while searching documents',
      details: error.message 
    });
  }
});

// Get document statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await searchService.getStats();
    res.json({
      success: true,
      stats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get statistics',
      message: 'Unable to retrieve system statistics'
    });
  }
});

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await db.getAllDocuments();
    res.json({
      success: true,
      documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Documents error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get documents',
      message: 'Unable to retrieve document list'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Handle multer errors specifically
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large. Maximum size is 50MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field.';
        break;
      default:
        message = error.message;
    }
    
    return res.status(400).json({
      success: false,
      error: 'Upload Error',
      message
    });
  }
  
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong on our end',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'POST /api/upload - Upload documents',
      'POST /api/search - Search documents',
      'GET /api/documents - Get all documents',
      'GET /api/stats - Get system statistics',
      'GET /api/health - Health check'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Knowledge Search Backend running on port ${PORT}`);
  console.log(`📡 API available at: http://localhost:${PORT}/api`);
  console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📁 Supported formats: PDF, TXT, MD`);
  console.log(`📏 Max file size: 50MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  db.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});