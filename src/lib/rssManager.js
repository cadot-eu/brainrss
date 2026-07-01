import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database.js';

const parser = new Parser();

export async function addFeed(feedUrl) {
  const db = getDatabase();

  try {
    const feed = await parser.parseURL(feedUrl);

    const feedId = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO feeds (id, title, url, description, link, image, lastUpdated, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        feedId,
        feed.title || 'Untitled Feed',
        feedUrl,
        feed.description || '',
        feed.link || '',
        feed.image?.url || '',
        now,
        now
      ]
    );

    // Récupérer et stocker les articles (en évitant les doublons)
    if (feed.items) {
      for (const item of feed.items) {
        const itemTitle = item.title || 'Untitled';

        // Vérifier si l'article existe déjà (même feedId + link)
        if (item.link) {
          const existingByLink = await db.get(
            'SELECT id FROM articles WHERE feedId = ? AND link = ?',
            [feedId, item.link]
          );
          if (existingByLink) continue;
        }

        // Vérifier aussi par titre (même feedId + titre)
        const existingByTitle = await db.get(
          'SELECT id FROM articles WHERE feedId = ? AND title = ?',
          [feedId, itemTitle]
        );
        if (existingByTitle) continue;

        const articleId = uuidv4();
        await db.run(
          `INSERT INTO articles (id, feedId, title, description, content, link, author, pubDate, image, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            articleId,
            feedId,
            itemTitle,
            item.contentSnippet || item.description || '',
            item.content || item.description || '',
            item.link || '',
            item.creator || item.author || '',
            item.pubDate || now,
            item.image?.url || '',
            now
          ]
        );
      }
    }

    return { success: true, feedId, feedTitle: feed.title };
  } catch (error) {
    console.error('Error adding feed:', error);
    throw new Error(`Failed to add feed: ${error.message}`);
  }
}

export async function updateFeed(feedId) {
  const db = getDatabase();

  try {
    const feedRow = await db.get('SELECT url FROM feeds WHERE id = ?', [feedId]);
    if (!feedRow) {
      throw new Error('Feed not found');
    }

    const feed = await parser.parseURL(feedRow.url);
    const now = new Date().toISOString();

    // Mettre à jour les informations du flux
    await db.run(
      `UPDATE feeds SET title = ?, description = ?, link = ?, image = ?, lastUpdated = ?
       WHERE id = ?`,
      [
        feed.title || 'Untitled Feed',
        feed.description || '',
        feed.link || '',
        feed.image?.url || '',
        now,
        feedId
      ]
    );

    // Ajouter les nouveaux articles (en évitant les doublons)
    if (feed.items) {
      for (const item of feed.items) {
        const itemTitle = item.title || 'Untitled';

        // Vérifier par lien
        if (item.link) {
          const existingByLink = await db.get(
            'SELECT id FROM articles WHERE feedId = ? AND link = ?',
            [feedId, item.link]
          );
          if (existingByLink) continue;
        }

        // Vérifier par titre
        const existingByTitle = await db.get(
          'SELECT id FROM articles WHERE feedId = ? AND title = ?',
          [feedId, itemTitle]
        );
        if (existingByTitle) continue;

        const articleId = uuidv4();
        await db.run(
          `INSERT INTO articles (id, feedId, title, description, content, link, author, pubDate, image, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            articleId,
            feedId,
            itemTitle,
            item.contentSnippet || item.description || '',
            item.content || item.description || '',
            item.link || '',
            item.creator || item.author || '',
            item.pubDate || now,
            item.image?.url || '',
            now
          ]
        );
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating feed:', error);
    throw new Error(`Failed to update feed: ${error.message}`);
  }
}

export async function removeFeed(feedId) {
  const db = getDatabase();

  try {
    await db.run('DELETE FROM feeds WHERE id = ?', [feedId]);
    return { success: true };
  } catch (error) {
    console.error('Error removing feed:', error);
    throw new Error(`Failed to remove feed: ${error.message}`);
  }
}

export async function getAllFeeds() {
  const db = getDatabase();

  try {
    const feeds = await db.all(`
      SELECT f.*, COUNT(a.id) as articleCount, COUNT(CASE WHEN a.read = 0 THEN 1 END) as unreadCount
      FROM feeds f
      LEFT JOIN articles a ON f.id = a.feedId
      GROUP BY f.id
      ORDER BY f.createdAt DESC
    `);
    return feeds || [];
  } catch (error) {
    console.error('Error getting feeds:', error);
    return [];
  }
}

export async function getFeedById(feedId) {
  const db = getDatabase();

  try {
    const feed = await db.get(`
      SELECT f.*, COUNT(a.id) as articleCount, COUNT(CASE WHEN a.read = 0 THEN 1 END) as unreadCount
      FROM feeds f
      LEFT JOIN articles a ON f.id = a.feedId
      WHERE f.id = ?
      GROUP BY f.id
    `, [feedId]);
    return feed;
  } catch (error) {
    console.error('Error getting feed:', error);
    return null;
  }
}

export async function getArticlesByFeed(feedId, limit = 50, offset = 0) {
  const db = getDatabase();

  try {
    const articles = await db.all(`
      SELECT * FROM articles
      WHERE feedId = ?
      ORDER BY pubDate DESC
      LIMIT ? OFFSET ?
    `, [feedId, limit, offset]);
    return articles || [];
  } catch (error) {
    console.error('Error getting articles:', error);
    return [];
  }
}

export async function getArticleById(articleId) {
  const db = getDatabase();

  try {
    const article = await db.get('SELECT * FROM articles WHERE id = ?', [articleId]);
    return article;
  } catch (error) {
    console.error('Error getting article:', error);
    return null;
  }
}

export async function markArticleAsRead(articleId) {
  const db = getDatabase();

  try {
    await db.run('UPDATE articles SET read = 1 WHERE id = ?', [articleId]);
    return { success: true };
  } catch (error) {
    console.error('Error marking article as read:', error);
    throw new Error(`Failed to mark article as read: ${error.message}`);
  }
}

export async function toggleArticleSaved(articleId) {
  const db = getDatabase();

  try {
    const article = await db.get('SELECT saved, feedId FROM articles WHERE id = ?', [articleId]);
    if (!article) throw new Error('Article not found');

    const newSavedState = article.saved ? 0 : 1;
    await db.run('UPDATE articles SET saved = ? WHERE id = ?', [newSavedState, articleId]);

    // +/- 1 priorite sur le feed correspondant
    const delta = newSavedState ? 1 : -1;
    await db.run('UPDATE feeds SET priority = priority + ? WHERE id = ?', [delta, article.feedId]);

    return { success: true, saved: newSavedState === 1 };
  } catch (error) {
    console.error('Error toggling article saved:', error);
    throw new Error(`Failed to toggle article saved: ${error.message}`);
  }
}

export async function getUnreadArticles(limit = 50) {
  const db = getDatabase();

  try {
    const articles = await db.all(`
      SELECT a.*, f.title as feedTitle
      FROM articles a
      JOIN feeds f ON a.feedId = f.id
      WHERE a.read = 0
      ORDER BY a.pubDate DESC
      LIMIT ?
    `, [limit]);
    return articles || [];
  } catch (error) {
    console.error('Error getting unread articles:', error);
    return [];
  }
}

export async function getUnreadCount() {
  const db = getDatabase();
  try {
    const row = await db.get('SELECT COUNT(*) as count FROM articles WHERE read = 0');
    return row ? row.count : 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

export async function getSavedArticles(limit = 50) {
  const db = getDatabase();

  try {
    const articles = await db.all(`
      SELECT a.*, f.title as feedTitle
      FROM articles a
      JOIN feeds f ON a.feedId = f.id
      WHERE a.saved = 1
      ORDER BY a.pubDate DESC
      LIMIT ?
    `, [limit]);
    return articles || [];
  } catch (error) {
    console.error('Error getting saved articles:', error);
    return [];
  }
}


// ============================================================
// Filtres et priorites
// ============================================================

export async function getFilters() {
  const db = getDatabase();
  try {
    return await db.all('SELECT * FROM filters ORDER BY createdAt DESC') || [];
  } catch (error) {
    console.error('Error getting filters:', error);
    return [];
  }
}

export async function addFilter(keywords, action, priority) {
  const db = getDatabase();
  const id = uuidv4();
  await db.run(
    'INSERT INTO filters (id, keywords, action, priority) VALUES (?, ?, ?, ?)',
    [id, keywords.toLowerCase(), action, priority || 5]
  );
  return { success: true, id };
}

export async function removeFilter(id) {
  const db = getDatabase();
  await db.run('DELETE FROM filters WHERE id = ?', [id]);
  return { success: true };
}

// Calcule la priorite d'un article en fonction des filtres
export function computeArticlePriority(article, filters) {
  let priority = (article.priority || 0) + (article.feedPriority || 0);
  if (!filters || filters.length === 0) return priority;

  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();

  for (const filter of filters) {
    const keywords = filter.keywords.split(',').map(k => k.trim()).filter(Boolean);
    for (const kw of keywords) {
      if (text.includes(kw)) {
        if (filter.action === 'hide') return -999; // caché
        priority += (filter.priority || 5);
        break; // un seul match par filtre
      }
    }
  }
  return priority;
}

// Articles non lus avec priorite (feed + filtre)
export async function getUnreadArticlesWithPriority(limit = 1000, sortBy = 'priority') {
  const db = getDatabase();
  try {
    const articles = await db.all(`
      SELECT a.*, f.title as feedTitle, f.priority as feedPriority
      FROM articles a
      JOIN feeds f ON a.feedId = f.id
      WHERE a.read = 0
      ORDER BY a.pubDate DESC
      LIMIT ?
    `, [limit]);

    const filters = await getFilters();

    // Calculer la priorite pour chaque article
    const scored = articles.map(a => ({
      ...a,
      score: computeArticlePriority(a, filters)
    })).filter(a => a.score > -999); // exclure les "hide"

    // Tri
    if (sortBy === 'priority') {
      scored.sort((a, b) => b.score - a.score || new Date(b.pubDate) - new Date(a.pubDate));
    } else {
      // site = priorite du feed seul
      scored.sort((a, b) => (b.feedPriority || 0) - (a.feedPriority || 0) || new Date(b.pubDate) - new Date(a.pubDate));
    }

    return scored;
  } catch (error) {
    console.error('Error getting unread with priority:', error);
    return [];
  }
}
