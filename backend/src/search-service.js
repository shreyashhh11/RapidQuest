const fs = require('fs').promises;
const path = require('path');

class SearchService {
    constructor(database) {
        this.db = database;
        this.openai = null; // Will be set to OpenAI client if API key is available
        
        // Only initialize OpenAI if API key is available
        if (process.env.OPENAI_API_KEY && 
            process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
            process.env.OPENAI_API_KEY.trim() !== '') {
            try {
                const { OpenAI } = require('openai');
                this.openai = new OpenAI({ 
                    apiKey: process.env.OPENAI_API_KEY 
                });
                this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
                console.log('✅ OpenAI initialized for semantic search');
            } catch (error) {
                console.warn('OpenAI not available:', error.message);
                this.openai = null;
            }
        } else {
            console.log('⚠️ OpenAI API key not configured. Using fallback text search method.');
        }
    }

    // Generate embedding for text content
    async generateEmbedding(text) {
        if (!this.openai) {
            return null; // No OpenAI, return null
        }

        try {
            const response = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: text
            });

            return JSON.stringify(response.data[0].embedding);
        } catch (error) {
            console.warn('Failed to generate embedding:', error.message);
            return null;
        }
    }

    // Split text into chunks for processing
    splitTextIntoChunks(text, chunkSize = 1000, overlap = 100) {
        const words = text.split(/\s+/);
        const chunks = [];
        
        for (let i = 0; i < words.length; i += chunkSize - overlap) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            if (chunk.trim()) {
                chunks.push(chunk);
            }
        }
        
        return chunks;
    }

    // Calculate cosine similarity between two vectors
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB) {
            return 0;
        }

        try {
            const vectorA = JSON.parse(vecA);
            const vectorB = JSON.parse(vecB);
            
            if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
                return 0;
            }

            let dotProduct = 0;
            let normA = 0;
            let normB = 0;

            for (let i = 0; i < vectorA.length; i++) {
                dotProduct += vectorA[i] * vectorB[i];
                normA += vectorA[i] * vectorA[i];
                normB += vectorB[i] * vectorB[i];
            }

            const denominator = Math.sqrt(normA) * Math.sqrt(normB);
            return denominator === 0 ? 0 : dotProduct / denominator;
        } catch (error) {
            return 0;
        }
    }

    // Fallback text-based search when OpenAI is not available
    async textSearch(query, limit = 10) {
        console.log(`Performing text search for: "${query}"`);
        
        const documents = await this.db.getAllDocuments();
        const results = [];
        const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);

        for (const doc of documents) {
            if (doc.content) {
                const content = doc.content.toLowerCase();
                let score = 0;
                let matchedChunks = [];

                // Find matching chunks and calculate relevance score
                const textChunks = this.splitTextIntoChunks(content, 500, 50);
                
                for (const chunk of textChunks) {
                    let chunkScore = 0;
                    let matchedWords = [];

                    for (const queryWord of queryWords) {
                        const regex = new RegExp(`\\b${queryWord}\\b`, 'gi');
                        const matches = chunk.match(regex);
                        if (matches) {
                            chunkScore += matches.length;
                            matchedWords.push(queryWord);
                        }
                    }

                    if (chunkScore > 0) {
                        matchedChunks.push({
                            text: chunk,
                            score: chunkScore,
                            matchedWords: matchedWords
                        });
                    }
                }

                if (matchedChunks.length > 0) {
                    // Sort chunks by score and take the best ones
                    matchedChunks.sort((a, b) => b.score - a.score);
                    
                    // Calculate overall document score
                    const overallScore = matchedChunks.reduce((sum, chunk) => sum + chunk.score, 0);
                    
                    results.push({
                        id: doc.id,
                        filename: doc.filename,
                        content: doc.content,
                        wordCount: doc.wordCount,
                        pageCount: doc.pageCount,
                        uploadedAt: doc.uploadedAt,
                        score: overallScore,
                        chunks: matchedChunks.slice(0, 3) // Top 3 chunks
                    });
                }
            }
        }

        // Sort by score and return top results
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    // Semantic search using OpenAI embeddings
    async semanticSearch(query, limit = 10) {
        if (!this.openai) {
            throw new Error('OpenAI not configured for semantic search');
        }

        try {
            const queryEmbedding = await this.generateEmbedding(query);
            if (!queryEmbedding) {
                throw new Error('Failed to generate query embedding');
            }
            
            const documents = await this.db.getAllDocuments();
            const results = [];

            for (const doc of documents) {
                if (doc.embedding) {
                    const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
                    if (similarity > 0.1) { // Minimum similarity threshold
                        results.push({
                            id: doc.id,
                            filename: doc.filename,
                            content: doc.content,
                            wordCount: doc.wordCount,
                            pageCount: doc.pageCount,
                            uploadedAt: doc.uploadedAt,
                            score: similarity
                        });
                    }
                }
            }

            // Sort by similarity and return top results
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);

        } catch (error) {
            console.error('Semantic search error:', error);
            throw error;
        }
    }

    // Main search function that handles both semantic and text search
    async search(query, limit = 10) {
        try {
            let searchResults = [];
            
            if (this.openai) {
                try {
                    searchResults = await this.semanticSearch(query, limit);
                    console.log(`Semantic search completed: ${searchResults.length} results`);
                } catch (error) {
                    console.warn('Semantic search failed, falling back to text search:', error.message);
                    searchResults = await this.textSearch(query, limit);
                }
            } else {
                searchResults = await this.textSearch(query, limit);
            }

            return searchResults;

        } catch (error) {
            console.error('Search error:', error);
            
            // Always try text search as fallback
            try {
                const fallbackResults = await this.textSearch(query, limit);
                return fallbackResults;
            } catch (fallbackError) {
                console.error('Fallback search also failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    // Get recent searches from search history
    async getRecentSearches(limit = 10) {
        try {
            return await this.db.getSearchHistory();
        } catch (error) {
            console.warn('Failed to get search history:', error.message);
            return [];
        }
    }
}

module.exports = SearchService;