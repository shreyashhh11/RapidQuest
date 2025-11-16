# Knowledge Discovery & Internal Search MVP

A full-stack application that enables semantic search through uploaded documents using AI-powered embeddings. Perfect for creating an intelligent knowledge base from your documents.

## Features

- 🔍 **Semantic Search**: AI-powered search using OpenAI embeddings
- 📄 **Multi-format Support**: Upload PDF, TXT, and Markdown files
- 🚀 **Fast Processing**: Automatic text extraction and chunking
- 📊 **Real-time Statistics**: View document and search analytics
- 🎨 **Modern UI**: Clean, responsive interface with glassmorphism design
- 🔒 **Privacy Focused**: All processing happens locally with your API key

## Prerequisites

- **Node.js**: Version 18.0 or higher (Node.js 20+ recommended)
- **npm**: Latest version
- **OpenAI API Key**: Required for AI-powered semantic search

## Quick Start

### 1. Get Your OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com)
2. Sign up or log in to your account
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)

**Note**: OpenAI API usage is pay-per-use. For testing purposes, costs are very low (typically $0.01-0.10 for uploading and searching several documents).

### 2. Setup Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment
# Copy .env.example to .env and add your OpenAI API key
cp .env.example .env

# Edit .env file and add your OpenAI API key:
# OPENAI_API_KEY=your_actual_api_key_here

# Start backend server
npm start
```

The backend will start on `http://localhost:4000`

### 3. Setup Frontend (New Terminal)

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:3000`

### 4. Use the Application

1. Open your browser to `http://localhost:3000`
2. Upload documents (PDF, TXT, or MD files)
3. Start searching with natural language queries
4. View search statistics and manage your knowledge base

## Project Structure

```
knowledge-search-app/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── server.js       # Main server file
│   │   ├── database.js     # SQLite database operations
│   │   ├── document-processor.js # File processing utilities
│   │   └── search-service.js     # Search and AI integration
│   ├── data/               # SQLite database files
│   ├── uploads/            # Temporary file uploads
│   ├── .env               # Environment configuration
│   └── package.json       # Backend dependencies
└── frontend/              # React application
    ├── src/               # Source code
    ├── public/            # Static assets
    ├── .env               # Frontend environment
    └── package.json       # Frontend dependencies
```

## Configuration

### Backend Environment (.env)

```env
# Required: Your OpenAI API key
OPENAI_API_KEY=sk-your_actual_key_here

# Optional: Customize settings
EMBEDDING_MODEL=text-embedding-3-small
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_URL=./data/search.db
```

### Frontend Environment (.env)

```env
VITE_API_URL=http://localhost:4000
VITE_ENV=development
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Check server status

### Document Management
- **POST** `/api/upload` - Upload and process documents
- **GET** `/api/documents` - List all uploaded documents
- **GET** `/api/stats` - Get application statistics

### Search
- **POST** `/api/search` - Search through documents
  - Body: `{ "query": "your search query", "limit": 10 }`

## Troubleshooting

### Common Issues

**1. "Cannot find module 'dotenv'"**
- Run `npm install` in the backend directory
- Make sure you're using Node.js 18+ (check with `node --version`)

**2. "OpenAI API key not configured"**
- Add your OpenAI API key to `backend/.env`
- Restart the backend server

**3. "Port already in use"**
- Change the PORT in `backend/.env` (e.g., `PORT=4001`)
- Update `frontend/.env` to point to the new backend URL

**4. File upload errors**
- Ensure files are PDF, TXT, or MD format
- Check file size (max 50MB)
- Verify backend server is running

### Development Mode

```bash
# Backend with auto-reload
cd backend && npm run dev

# Frontend with auto-reload
cd frontend && npm run dev
```

## Technology Stack

### Backend
- **Express.js**: Web framework
- **SQLite**: Database with better-sqlite3
- **OpenAI**: Embeddings API
- **PDF Processing**: pdf-parse
- **File Upload**: multer

### Frontend
- **React 18**: UI framework
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **Lucide React**: Icons

## Performance Tips

1. **Chunking**: Documents are automatically split into chunks for better search precision
2. **Caching**: SQLite with WAL mode for better performance
3. **Batch Processing**: Upload multiple documents efficiently
4. **Memory Management**: Automatic cleanup of temporary files

## Security Considerations

- API key is stored locally and never sent to our servers
- All document processing happens on your machine
- CORS is configured for localhost development
- File uploads are validated and size-limited

## License

MIT License - feel free to use this for your projects!

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Verify your Node.js version (18+)
3. Ensure your OpenAI API key is valid
4. Check both backend and frontend are running

---

**Enjoy building your intelligent knowledge base!** 🚀