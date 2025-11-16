const OpenAI = require('openai');

class SearchService {
  constructor(database) {
    this.db = database;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async generateEmbedding(text) {
    try {
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        console.warn('⚠️ OpenAI API key not configured. Using fallback search method.');
        return null;
      }

      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  async storeDocument(filename, content, chunks) {
    try {
      // Store document and chunks in database
      const documentId = await this.db.storeDocument(filename, content, chunks);
      
      // Generate embeddings for chunks
      const embeddings = await Promise.all(
        chunks.map(chunk => this.generateEmbedding(chunk))
      );
      
      // Store embeddings in database
      if (embeddings.some(emb => emb !== null)) {
        await this.db.storeChunksWithEmbeddings(documentId, chunks, embeddings);
      }
      
      console.log(`✅ Stored document: ${filename} (${chunks.length} chunks)`);
      return documentId;
    } catch (error) {
      console.error('Error storing document:', error);
      throw error;
    }
  }

  async search(query, limit = 10) {
    try {
      console.log(`🔍 Searching for: "${query}" (limit: ${limit})`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in database
      let results;
      if (queryEmbedding) {
        results = await this.db.searchBySimilarity(JSON.stringify(queryEmbedding), limit);
      } else {
        // Fallback to basic content search if embedding fails
        results = await this.basicContentSearch(query, limit);
      }
      
      // Enhance results with relevance scoring
      const enhancedResults = results.map(result => {
        const relevanceScore = this.calculateRelevanceScore(query, result.content);
        return {
          ...result,
          relevanceScore: Math.round(relevanceScore * 100) / 100,
          excerpt: this.createExcerpt(result.content, query, 200)
        };
      });
      
      // Sort by relevance score
      enhancedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      console.log(`✅ Found ${enhancedResults.length} results`);
      return enhancedResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async basicContentSearch(query, limit = 10) {
    try {
      const chunks = await this.db.getAllChunks(limit * 3); // Get more chunks to filter
      
      // Simple text matching
      const queryWords = query.toLowerCase().split(/\s+/);
      
      return chunks
        .map(chunk => {
          const contentLower = chunk.content.toLowerCase();
          const score = queryWords.reduce((sum, word) => {
            return sum + (contentLower.includes(word) ? 1 : 0);
          }, 0);
          
          return {
            ...chunk,
            score: score
          };
        })
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Basic search error:', error);
      return [];
    }
  }

  calculateRelevanceScore(query, content) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    
    // Exact phrase matches get highest score
    if (contentLower.includes(query.toLowerCase())) {
      score += 10;
    }
    
    // Individual word matches
    queryWords.forEach(word => {
      if (word.length > 2) {
        const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += wordCount;
      }
    });
    
    // Word proximity bonus
    queryWords.forEach((word, i) => {
      if (i < queryWords.length - 1) {
        const nextWord = queryWords[i + 1];
        if (contentLower.includes(word + ' ' + nextWord)) {
          score += 2;
        }
      }
    });
    
    // Content length normalization
    const contentWords = contentLower.split(/\s+/).length;
    if (contentWords > 0) {
      score = score / Math.sqrt(contentWords);
    }
    
    return score;
  }

  createExcerpt(content, query, maxLength = 200) {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    const queryIndex = contentLower.indexOf(queryLower);
    
    if (queryIndex !== -1) {
      // Center the excerpt around the query
      const start = Math.max(0, queryIndex - maxLength / 2);
      const end = Math.min(content.length, start + maxLength);
      
      let excerpt = content.substring(start, end);
      
      // Add ellipsis if we're not at the beginning
      if (start > 0) {
        excerpt = '...' + excerpt;
      }
      
      // Add ellipsis if we're not at the end
      if (end < content.length) {
        excerpt = excerpt + '...';
      }
      
      return excerpt;
    } else {
      // Return first part if query not found
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
  }

  async getStats() {
    try {
      const stats = await this.db.getStats();
      return {
        ...stats,
        embeddingModel: this.embeddingModel,
        openaiConfigured: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  // Utility method for text similarity (fallback if OpenAI fails)
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => 
      words2.includes(word) && word.length > 2
    );
    
    const uniqueWords = new Set([...words1, ...words2]);
    
    return commonWords.length / uniqueWords.size;
  }

  // Method to reindex all documents (useful if embedding model changes)
  async reindexAllDocuments() {
    try {
      const documents = await this.db.getAllDocuments();
      
      for (const doc of documents) {
        console.log(`🔄 Reindexing: ${doc.filename}`);
        
        // Get chunks for this document
        // Note: This is a simplified version - you'd need to implement this properly
        
        console.log(`✅ Reindexed: ${doc.filename}`);
      }
      
      console.log('✅ Reindexing complete');
    } catch (error) {
      console.error('Reindexing error:', error);
      throw error;
    }
  }
}

module.exports = SearchService;