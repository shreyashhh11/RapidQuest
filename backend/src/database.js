const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        // Ensure directory exists
        const dbDir = require('path').dirname(this.dbPath);
        const fs = require('fs');
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error('❌ Database connection failed:', err);
            reject(err);
            return;
          }

          // Enable PRAGMA settings
          this.db.serialize(() => {
            this.db.run('PRAGMA journal_mode = WAL');
            this.db.run('PRAGMA synchronous = NORMAL');
            this.db.run('PRAGMA cache_size = 1000000');
            this.db.run('PRAGMA temp_store = memory');
          });

          this.createTables().then(() => {
            console.log('✅ Database initialized successfully');
            resolve();
          }).catch(reject);
        });
      } catch (error) {
        console.error('❌ Database initialization failed:', error);
        reject(error);
      }
    });
  }

  // Helper method to run SQL commands with Promise wrapper
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Helper method for SELECT queries that return multiple rows
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Helper method for SELECT queries that return single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async createTables() {
    const createDocumentsTable = `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createChunksTable = `
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
      )
    `;

    const createEmbeddingsIndex = `
      CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
      ON document_chunks (document_id)
    `;

    await this.run(createDocumentsTable);
    await this.run(createChunksTable);
    await this.run(createEmbeddingsIndex);
  }

  async storeDocument(filename, content, chunks) {
    const documentId = uuidv4();

    // Use async/await with individual transactions for consistency
    // Insert document
    await this.run(
      'INSERT INTO documents (id, filename, content) VALUES (?, ?, ?)',
      [documentId, filename, content]
    );

    // Insert chunks
    for (let index = 0; index < chunks.length; index++) {
      const chunkId = uuidv4();
      await this.run(
        'INSERT INTO document_chunks (id, document_id, chunk_index, content) VALUES (?, ?, ?, ?)',
        [chunkId, documentId, index, chunks[index]]
      );
    }

    return documentId;
  }

  async storeChunksWithEmbeddings(documentId, chunks, embeddings) {
    for (let index = 0; index < chunks.length; index++) {
      await this.run(
        'UPDATE document_chunks SET embedding = ? WHERE document_id = ? AND chunk_index = ?',
        [embeddings[index], documentId, index]
      );
    }
  }

  async searchBySimilarity(embedding, limit = 10) {
    // Fallback to content-based search if embedding not available
    if (!embedding) {
      return this.getAllChunks(limit);
    }

    // For SQLite, we'll use a content-based similarity approach
    // This is a simplified approach - you could implement vector similarity here
    const query = `
      SELECT 
        dc.id,
        dc.content,
        dc.chunk_index,
        d.filename,
        d.id as document_id,
        -- Calculate a simple similarity score based on content length and keywords
        (
          -- Score based on content length similarity
          (1.0 / (1.0 + ABS(LENGTH(dc.content) - LENGTH(?)))) *
          -- Bonus for keyword matches (basic implementation)
          (1.0 + 
            CASE 
              WHEN INSTR(LOWER(dc.content), LOWER(SUBSTR(?, 1, 20))) > 0 THEN 0.5
              ELSE 0
            END
          )
        ) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      ORDER BY similarity DESC
      LIMIT ?
    `;

    const queryEmbedding = embedding.substring(0, 100);
    const results = await this.all(query, [queryEmbedding, queryEmbedding, limit]);
    
    return results.map(row => ({
      ...row,
      score: row.similarity
    }));
  }

  async getAllChunks(limit = 100) {
    const query = `
      SELECT 
        dc.id,
        dc.content,
        dc.chunk_index,
        d.filename,
        d.id as document_id
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      ORDER BY dc.created_at DESC
      LIMIT ?
    `;

    return await this.all(query, [limit]);
  }

  async getStats() {
    const docCount = await this.get('SELECT COUNT(*) as count FROM documents');
    const chunkCount = await this.get('SELECT COUNT(*) as count FROM document_chunks');
    const totalTextLength = await this.get('SELECT SUM(LENGTH(content)) as length FROM documents');

    return {
      documents: (docCount && docCount.count) ? docCount.count : 0,
      chunks: (chunkCount && chunkCount.count) ? chunkCount.count : 0,
      totalTextLength: (totalTextLength && totalTextLength.length) ? totalTextLength.length : 0,
      avgChunksPerDocument: (docCount && docCount.count && docCount.count > 0) ? Math.round(chunkCount.count / docCount.count) : 0
    };
  }

  async getAllDocuments() {
    const query = `
      SELECT 
        id,
        filename,
        LENGTH(content) as content_length,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM document_chunks WHERE document_id = d.id) as chunks_count
      FROM documents d
      ORDER BY created_at DESC
    `;

    return await this.all(query);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseService;