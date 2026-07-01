import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/brainrss.db');

let db = null;

export async function initializeDatabase() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      description TEXT,
      link TEXT,
      image TEXT,
      lastUpdated DATETIME,
      priority INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      feedId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      link TEXT,
      author TEXT,
      pubDate DATETIME,
      image TEXT,
      read INTEGER DEFAULT 0,
      saved INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS filters (
      id TEXT PRIMARY KEY,
      keywords TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'priority',
      priority INTEGER DEFAULT 5,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feedTags (
      feedId TEXT NOT NULL,
      tagId TEXT NOT NULL,
      PRIMARY KEY (feedId, tagId),
      FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);

  // Migration: ajouter les colonnes priority si elles n'existent pas
  // (doit être fait AVANT la création des index sur ces colonnes)
  try {
    await db.exec('ALTER TABLE feeds ADD COLUMN priority INTEGER DEFAULT 0');
  } catch (_) { /* déjà présente */ }
  try {
    await db.exec('ALTER TABLE articles ADD COLUMN priority INTEGER DEFAULT 0');
  } catch (_) { /* déjà présente */ }

  // Création des index (après les migrations pour garantir que les colonnes existent)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_feedId ON articles(feedId);
    CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(read);
    CREATE INDEX IF NOT EXISTS idx_articles_saved ON articles(saved);
    CREATE INDEX IF NOT EXISTS idx_articles_priority ON articles(priority);
    CREATE INDEX IF NOT EXISTS idx_feeds_priority ON feeds(priority);
  `);

  // Migration: supprimer les articles en doublon (même feedId + link)
  try {
    await db.exec(`
      DELETE FROM articles WHERE id NOT IN (
        SELECT MIN(id) FROM articles GROUP BY feedId, link
      );
    `);
  } catch (_) { /* OK */ }

  return db;
}

export function getDatabase() {
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
  }
}
