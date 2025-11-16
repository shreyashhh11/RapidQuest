const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const DocumentProcessor = require('./document-processor');
const SearchService = require('./search-service');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize services
const db = new Database();
const docProcessor = new DocumentProcessor();
const searchService = new SearchService(db);

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
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
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
        const allowedExtensions = ['.pdf', '.txt', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, and MD files are allowed!'), false);
        }
    }
});

// Initialize database
db.initialize().then(() => {
    console.log('Database initialized successfully');
}).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

// Routes

// Upload and process document
app.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;

        console.log(`Processing file: ${originalName}`);

        // Process the document
        const processedDoc = await docProcessor.processFile(filePath, originalName);

        // Generate embedding
        const embedding = await searchService.generateEmbedding(processedDoc.content);

        // Store in database
        const docId = await db.addDocument({
            filename: originalName,
            content: processedDoc.content,
            fileSize: processedDoc.metadata.size,
            wordCount: processedDoc.metadata.wordCount,
            pageCount: processedDoc.metadata.pageCount,
            uploadedAt: processedDoc.metadata.processedAt,
            embedding
        });

        // Cleanup uploaded file
        await docProcessor.cleanup(filePath);

        res.json({
            success: true,
            message: 'Document processed successfully',
            documentId: docId,
            filename: originalName,
            wordCount: processedDoc.metadata.wordCount,
            pageCount: processedDoc.metadata.pageCount
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Failed to process document',
            details: error.message 
        });
        
        // Cleanup file on error
        if (req.file && req.file.path) {
            await docProcessor.cleanup(req.file.path);
        }
    }
});

// Search documents
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const limit = parseInt(req.query.limit) || 10;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        console.log(`Searching for: "${query}"`);

        // Perform search
        const results = await searchService.search(query, limit);

        // Log search history
        await db.logSearch(query, results.length);

        res.json({
            query,
            results,
            totalResults: results.length,
            searchTime: Date.now()
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            error: 'Search failed',
            details: error.message 
        });
    }
});

// Get all documents
app.get('/documents', async (req, res) => {
    try {
        const documents = await db.getAllDocuments();
        res.json({ documents });
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch documents',
            details: error.message 
        });
    }
});

// Get document by ID
app.get('/documents/:id', async (req, res) => {
    try {
        const document = await db.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ document });
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch document',
            details: error.message 
        });
    }
});

// Get statistics
app.get('/stats', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch statistics',
            details: error.message 
        });
    }
});

// Delete document
app.delete('/documents/:id', async (req, res) => {
    try {
        const success = await db.deleteDocument(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ 
            success: true, 
            message: 'Document deleted successfully' 
        });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ 
            error: 'Failed to delete document',
            details: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 RapidQuest API server running on port ${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 Search endpoint: http://localhost:${PORT}/search`);
    console.log(`📄 Documents endpoint: http://localhost:${PORT}/documents`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await db.close();
    process.exit(0);
});

module.exports = app;
