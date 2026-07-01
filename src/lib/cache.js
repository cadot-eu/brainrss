// ============================================================
// Cache disque pour articles et résumés IA
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../../data/cache');
const ARTICLES_DIR = path.join(CACHE_DIR, 'articles');
const SUMMARIES_DIR = path.join(CACHE_DIR, 'summaries');

// Créer les répertoires au démarrage
[ARTICLES_DIR, SUMMARIES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function safeFilename(id) {
  // UUID ou titre safe pour le système de fichiers
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
}

// --- Cache contenu d'article ---

export function getCachedArticle(articleId) {
  const filepath = path.join(ARTICLES_DIR, safeFilename(articleId) + '.html');
  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
  } catch (_) { /* ignore */ }
  return null;
}

export function setCachedArticle(articleId, content) {
  const filepath = path.join(ARTICLES_DIR, safeFilename(articleId) + '.html');
  try {
    fs.writeFileSync(filepath, content, 'utf-8');
  } catch (_) { /* ignore */ }
}

// --- Cache résumé IA ---

export function getCachedSummary(articleId) {
  const filepath = path.join(SUMMARIES_DIR, safeFilename(articleId) + '.html');
  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
  } catch (_) { /* ignore */ }
  return null;
}

export function setCachedSummary(articleId, summary) {
  const filepath = path.join(SUMMARIES_DIR, safeFilename(articleId) + '.html');
  try {
    fs.writeFileSync(filepath, summary, 'utf-8');
  } catch (_) { /* ignore */ }
}
