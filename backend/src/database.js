const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'data', 'search.db');
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            // Ensure data directory exists
            const fs = require('fs');
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createDocumentsTable = `
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    content TEXT NOT NULL,
                    file_size INTEGER,
                    word_count INTEGER DEFAULT 0,
                    page_count INTEGER DEFAULT 0,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    embedding TEXT
                )
            `;

            const createSearchHistoryTable = `
                CREATE TABLE IF NOT EXISTS search_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query TEXT NOT NULL,
                    result_count INTEGER DEFAULT 0,
                    searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            this.db.serialize(() => {
                this.db.run(createDocumentsTable);
                this.db.run(createSearchHistoryTable);
                console.log('Database tables created successfully');
                resolve();
            });
        });
    }

    async addDocument(docData) {
        return new Promise((resolve, reject) => {
            const { filename, content, fileSize, wordCount, pageCount, uploadedAt, embedding } = docData;
            const query = `
                INSERT INTO documents (filename, content, file_size, word_count, page_count, uploaded_at, embedding)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(query, [filename, content, fileSize, wordCount, pageCount, uploadedAt, embedding], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getAllDocuments() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, filename, content, file_size as fileSize, word_count as wordCount, 
                       page_count as pageCount, uploaded_at as uploadedAt
                FROM documents 
                ORDER BY uploaded_at DESC
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getDocumentById(id) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, filename, content, file_size as fileSize, word_count as wordCount, 
                       page_count as pageCount, uploaded_at as uploadedAt, embedding
                FROM documents 
                WHERE id = ?
            `;
            
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async deleteDocument(id) {
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM documents WHERE id = ?';
            
            this.db.run(query, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async getStats() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(*) as totalDocuments,
                    COALESCE(SUM(word_count), 0) as totalWordCount,
                    COALESCE(SUM(page_count), 0) as totalPageCount,
                    COALESCE(SUM(file_size), 0) as totalFileSize
                FROM documents
            `;
            
            this.db.get(query, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || {
                        totalDocuments: 0,
                        totalWordCount: 0,
                        totalPageCount: 0,
                        totalFileSize: 0
                    });
                }
            });
        });
    }

    async logSearch(query, resultCount) {
        return new Promise((resolve, reject) => {
            const insertQuery = `
                INSERT INTO search_history (query, result_count)
                VALUES (?, ?)
            `;
            
            this.db.run(insertQuery, [query, resultCount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getSearchHistory() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT query, result_count as resultCount, searched_at as searchedAt
                FROM search_history 
                ORDER BY searched_at DESC 
                LIMIT 50
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;