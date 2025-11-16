import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, []);

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/documents`);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      showMessage('Failed to load documents', 'error');
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const uploadDocument = async () => {
    if (!selectedFile) {
      showMessage('Please select a file', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message || 'Document uploaded successfully', 'success');
        setSelectedFile(null);
        document.getElementById('fileInput').value = '';
        loadDocuments();
        loadStats();
      } else {
        showMessage(data.error || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showMessage('Upload failed. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const searchDocuments = async () => {
    if (!searchQuery.trim()) {
      showMessage('Please enter a search query', 'error');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.results || []);
        showMessage(`Found ${data.results?.length || 0} results`, 'success');
      } else {
        showMessage(data.error || 'Search failed', 'error');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      showMessage('Search failed. Please try again.', 'error');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const deleteDocument = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/documents/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Document deleted successfully', 'success');
        loadDocuments();
        loadStats();
        setSearchResults([]); // Clear search results
      } else {
        showMessage(data.error || 'Delete failed', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showMessage('Delete failed. Please try again.', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚀 RapidQuest</h1>
        <p>AI-Powered Document Search & Management</p>
      </header>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="container">
        {/* Upload Section */}
        <section className="upload-section">
          <h2>📤 Upload Document</h2>
          <div className="upload-area">
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileSelect}
              className="file-input"
            />
            <button
              onClick={uploadDocument}
              disabled={!selectedFile || isUploading}
              className="upload-btn"
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
          <p className="upload-info">
            Supports PDF, TXT, and MD files (max 10MB)
          </p>
        </section>

        {/* Search Section */}
        <section className="search-section">
          <h2>🔍 Search Documents</h2>
          <div className="search-area">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchDocuments()}
              placeholder="Enter your search query..."
              className="search-input"
            />
            <button
              onClick={searchDocuments}
              disabled={isSearching || !searchQuery.trim()}
              className="search-btn"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </section>

        {/* Stats Section */}
        {stats && (
          <section className="stats-section">
            <h2>📊 Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>{stats.totalDocuments || 0}</h3>
                <p>Total Documents</p>
              </div>
              <div className="stat-card">
                <h3>{stats.totalWordCount || 0}</h3>
                <p>Total Words</p>
              </div>
              <div className="stat-card">
                <h3>{stats.totalPageCount || 0}</h3>
                <p>Total Pages</p>
              </div>
              <div className="stat-card">
                <h3>{stats.totalFileSize ? formatFileSize(stats.totalFileSize) : '0 Bytes'}</h3>
                <p>Total Size</p>
              </div>
            </div>
          </section>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <section className="results-section">
            <h2>📋 Search Results ({searchResults.length})</h2>
            <div className="results-list">
              {searchResults.map((result, index) => (
                <div key={index} className="result-item">
                  <div className="result-header">
                    <h3>{result.filename}</h3>
                    <span className="score">
                      Score: {result.score?.toFixed(3) || '0.000'}
                    </span>
                  </div>
                  <p className="snippet">
                    {result.content?.substring(0, 200)}...
                  </p>
                  <div className="result-meta">
                    <span>Words: {result.wordCount || 0}</span>
                    <span>Pages: {result.pageCount || 0}</span>
                    <span>Uploaded: {formatDate(result.uploadedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documents List */}
        <section className="documents-section">
          <h2>📚 Documents ({documents.length})</h2>
          <div className="documents-list">
            {documents.length === 0 ? (
              <p className="no-documents">No documents uploaded yet.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="document-item">
                  <div className="document-header">
                    <h3>{doc.filename}</h3>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="delete-btn"
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="document-meta">
                    <span>Words: {doc.wordCount || 0}</span>
                    <span>Pages: {doc.pageCount || 0}</span>
                    <span>Size: {formatFileSize(doc.fileSize || 0)}</span>
                  </div>
                  <div className="document-date">
                    Uploaded: {formatDate(doc.uploadedAt)}
                  </div>
                  <div className="document-preview">
                    {doc.content?.substring(0, 150)}...
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;