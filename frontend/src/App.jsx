import React, { useState, useEffect, useRef } from 'react'
import { Search, Upload, FileText, Database, MessageSquare, Settings, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function App() {
  const [activeTab, setActiveTab] = useState('search')
  const [documents, setDocuments] = useState([])
  const [stats, setStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [apiStatus, setApiStatus] = useState('checking')
  const fileInputRef = useRef(null)
  const [draggedOver, setDraggedOver] = useState(false)

  useEffect(() => {
    checkApiStatus()
    loadData()
  }, [])

  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`)
      if (response.ok) {
        setApiStatus('connected')
      } else {
        setApiStatus('error')
      }
    } catch (error) {
      setApiStatus('disconnected')
    }
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // Load documents
      const docResponse = await fetch(`${API_BASE_URL}/api/documents`)
      if (docResponse.ok) {
        const docData = await docResponse.json()
        setDocuments(docData.documents || [])  // Extract documents array from response
      }

      // Load stats
      const statsResponse = await fetch(`${API_BASE_URL}/api/stats`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats || {})  // Extract stats object from response
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      } else {
        console.error('Search failed:', await response.text())
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadMessage('Uploading and processing files...')

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('document', file)

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const result = await response.json()
          setUploadMessage(`✅ Successfully processed: ${file.name}`)
          
          // Reload data to reflect new documents
          setTimeout(() => {
            loadData()
          }, 1000)
        } else {
          const error = await response.json()
          setUploadMessage(`❌ Failed to process ${file.name}: ${error.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      setUploadMessage(`❌ Upload failed: ${error.message}`)
    } finally {
      setIsUploading(false)
      // Clear message after delay
      setTimeout(() => setUploadMessage(''), 5000)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDraggedOver(false)
    const files = Array.from(e.dataTransfer.files)
    handleFileUpload(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDraggedOver(true)
  }

  const handleDragLeave = () => {
    setDraggedOver(false)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-400'
      case 'disconnected': return 'text-red-400'
      case 'error': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <CheckCircle2 className="w-4 h-4" />
      case 'disconnected': return <AlertCircle className="w-4 h-4" />
      case 'error': return <AlertCircle className="w-4 h-4" />
      default: return <Loader2 className="w-4 h-4 animate-spin" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-white text-center">Loading Knowledge Search...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Knowledge Search MVP</h1>
              <p className="text-white/70">AI-powered semantic search for your documents</p>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(apiStatus)}
              <span className={`text-sm ${getStatusColor(apiStatus)}`}>
                API {apiStatus}
              </span>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="glass-card p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-blue-400" />
                  <div>
                    <p className="text-white/70 text-sm">Documents</p>
                    <p className="text-white text-xl font-semibold">{stats.documents}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center space-x-3">
                  <Database className="w-6 h-6 text-green-400" />
                  <div>
                    <p className="text-white/70 text-sm">Search Chunks</p>
                    <p className="text-white text-xl font-semibold">{stats.chunks}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-6 h-6 text-purple-400" />
                  <div>
                    <p className="text-white/70 text-sm">Avg Chunks/Doc</p>
                    <p className="text-white text-xl font-semibold">{stats.avgChunksPerDocument}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center space-x-3">
                  <Settings className="w-6 h-6 text-yellow-400" />
                  <div>
                    <p className="text-white/70 text-sm">Text Length</p>
                    <p className="text-white text-xl font-semibold">{formatFileSize(stats.totalTextLength)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="glass-card p-2 mb-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all ${
                activeTab === 'search' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all ${
                activeTab === 'upload' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all ${
                activeTab === 'documents' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'search' && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Search Documents</h2>
            
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask a question about your documents..."
                  className="flex-1 glass-input px-4 py-3 text-white placeholder-white/50"
                  disabled={isSearching || apiStatus !== 'connected'}
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim() || apiStatus !== 'connected'}
                  className="glass-button px-6 py-3 text-white font-medium flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{isSearching ? 'Searching...' : 'Search'}</span>
                </button>
              </div>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Search Results</h3>
                {searchResults.map((result, index) => (
                  <div key={index} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-white">{result.filename}</h4>
                      <span className="text-sm text-white/60">
                        {Math.round((result.relevanceScore || 0) * 100)}% match
                      </span>
                    </div>
                    <p className="text-white/80 text-sm mb-2">{result.excerpt}</p>
                    <div className="text-xs text-white/50">
                      Chunk {result.chunk_index + 1} • Document ID: {result.document_id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Upload Documents</h2>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                draggedOver 
                  ? 'border-white/50 bg-white/10' 
                  : 'border-white/30 hover:border-white/40'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 text-white/60 mx-auto mb-4" />
              <p className="text-white text-lg mb-2">
                Drag and drop files here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-400 hover:text-blue-300 underline"
                  disabled={isUploading}
                >
                  browse
                </button>
              </p>
              <p className="text-white/60 text-sm">Supports PDF, TXT, and MD files (max 50MB)</p>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md"
                onChange={(e) => handleFileUpload(Array.from(e.target.files))}
                className="hidden"
              />
            </div>

            {uploadMessage && (
              <div className={`mt-4 p-4 rounded-lg ${
                uploadMessage.includes('✅') 
                  ? 'bg-green-500/20 border border-green-500/30' 
                  : 'bg-red-500/20 border border-red-500/30'
              }`}>
                <p className="text-white">{uploadMessage}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Document Library</h2>
            
            {documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="glass-card p-4">
                    <div className="flex items-start space-x-3">
                      <FileText className="w-6 h-6 text-blue-400 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{doc.filename}</h3>
                        <p className="text-white/60 text-sm mt-1">
                          {formatFileSize(doc.content_length)} • {doc.chunks_count} chunks
                        </p>
                        <p className="text-white/50 text-xs mt-1">
                          {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/70 text-lg">No documents uploaded yet</p>
                <p className="text-white/50 text-sm">Upload your first document to get started</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App