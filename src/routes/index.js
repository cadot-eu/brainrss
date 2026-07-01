import {
  addFeed,
  updateFeed,
  removeFeed,
  getAllFeeds,
  getFeedById,
  getArticlesByFeed,
  getArticleById,
  markArticleAsRead,
  toggleArticleSaved,
  getUnreadArticles,
  getUnreadArticlesWithPriority,
  getUnreadCount,
  getSavedArticles,
  markAllAsRead,
  getFilters,
  addFilter,
  removeFilter
} from '../lib/rssManager.js';
import { getDatabase } from '../db/database.js';
import { refreshStatus } from '../lib/refreshStatus.js';
import { refreshAllFeeds } from '../server.js';

export async function registerRoutes(fastify) {
  // Page d'accueil
  fastify.get('/', async (request, reply) => {
    const feeds = await getAllFeeds();
    const unreadCount = feeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);

    return reply.view('index', {
      feeds,
      unreadCount
    });
  });

  // Page des flux
  fastify.get('/feeds', async (request, reply) => {
    const feeds = await getAllFeeds();
    return reply.view('feeds', { feeds });
  });

  // Page des filtres
  fastify.get('/filters', async (request, reply) => {
    const filters = await getFilters();
    const feeds = await getAllFeeds();
    return reply.view('filters', { filters, feeds });
  });

  // Page d'un flux spécifique
  fastify.get('/feed/:id', async (request, reply) => {
    const { id } = request.params;
    const feed = await getFeedById(id);

    if (!feed) {
      return reply.code(404).view('404', { message: 'Feed not found' });
    }

    const articles = await getArticlesByFeed(id, 50);
    const feeds = await getAllFeeds();

    return reply.view('feed', {
      feed,
      articles,
      feeds
    });
  });

  // Page d'un article
  fastify.get('/article/:id', async (request, reply) => {
    const { id } = request.params;
    const article = await getArticleById(id);

    if (!article) {
      return reply.code(404).view('404', { message: 'Article not found' });
    }

    const feed = await getFeedById(article.feedId);
    const feeds = await getAllFeeds();

    return reply.view('article', {
      article,
      feed,
      feeds
    });
  });

  // Page des articles non lus (avec tri par priorite)
  fastify.get('/unread', async (request, reply) => {
    const sortBy = request.query.sort || 'priority'; // 'priority' ou 'site'
    const articles = await getUnreadArticlesWithPriority(1000, sortBy);
    const feeds = await getAllFeeds();
    const unreadCount = await getUnreadCount();

    return reply.view('unread', {
      articles,
      feeds,
      unreadCount,
      sortBy
    });
  });

  // Page des articles sauvegardés
  fastify.get('/saved', async (request, reply) => {
    const articles = await getSavedArticles();
    const feeds = await getAllFeeds();

    return reply.view('saved', {
      articles,
      feeds
    });
  });

  // API: Ajouter un flux
  fastify.post('/api/feeds', async (request, reply) => {
    try {
      const { url } = request.body;

      if (!url) {
        return reply.code(400).send({ error: 'URL is required' });
      }

      const result = await addFeed(url);
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Mettre à jour un flux
  fastify.post('/api/feeds/:id/update', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await updateFeed(id);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Supprimer un flux
  fastify.delete('/api/feeds/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await removeFeed(id);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Marquer un article comme lu
  fastify.post('/api/articles/:id/read', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await markArticleAsRead(id);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Tout marquer comme lu
  fastify.post('/api/articles/mark-all-read', async (request, reply) => {
    try {
      const result = await markAllAsRead();
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Basculer l'état sauvegardé d'un article
  fastify.post('/api/articles/:id/toggle-saved', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await toggleArticleSaved(id);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Obtenir tous les flux
  fastify.get('/api/feeds', async (request, reply) => {
    const feeds = await getAllFeeds();
    return reply.send(feeds);
  });

  // API: Obtenir les articles d'un flux
  fastify.get('/api/feeds/:id/articles', async (request, reply) => {
    const { id } = request.params;
    const { limit = 50, offset = 0 } = request.query;
    const articles = await getArticlesByFeed(id, parseInt(limit), parseInt(offset));
    return reply.send(articles);
  });

  // API: Obtenir un article par son ID (extraction contenu complet si necessaire)
  fastify.get('/api/articles/:id', async (request, reply) => {
    const { id } = request.params;
    const article = await getArticleById(id);
    if (!article) {
      return reply.code(404).send({ error: 'Article not found' });
    }

    // Marquer comme lu automatiquement
    await markArticleAsRead(id);

    // Si le contenu est trop court, extraire l'article complet depuis l'URL
    const isShort = !article.content ||
      article.content.length < 500 ||
      article.content === article.description;

    if (isShort && article.link) {
      try {
        const { extractArticleContent } = await import('../lib/contentExtractor.js');
        const extracted = await extractArticleContent(article.link);
        if (extracted && extracted.content) {
          const db = getDatabase();
          await db.run('UPDATE articles SET content = ? WHERE id = ?', [extracted.content, id]);
          article.content = extracted.content;
        }
      } catch (err) {
        request.log.warn('Extraction echouee pour ' + article.link + ': ' + err.message);
      }
    }

    return reply.send(article);
  });

  // API: Filtres
  fastify.get('/api/filters', async (request, reply) => {
    const filters = await getFilters();
    return reply.send(filters);
  });

  fastify.post('/api/filters', async (request, reply) => {
    try {
      const { keywords, action, priority } = request.body;
      if (!keywords) return reply.code(400).send({ error: 'Keywords required' });
      const result = await addFilter(keywords, action || 'priority', priority || 5);
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  fastify.delete('/api/filters/:id', async (request, reply) => {
    try {
      const result = await removeFilter(request.params.id);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // API: Statut du refresh en cours (affichage temps réel)
  fastify.get('/api/refresh-status', async (request, reply) => {
    return reply.send(refreshStatus);
  });

  // API: Déclencher un rafraîchissement manuel
  fastify.post('/api/refresh-trigger', async (request, reply) => {
    if (refreshStatus.isRefreshing) {
      return reply.send({ success: false, message: 'Rafraîchissement déjà en cours' });
    }
    // Lancer en arrière-plan
    refreshAllFeeds().catch(err => console.error('Refresh error:', err));
    return reply.send({ success: true, message: 'Rafraîchissement lancé' });
  });

  // API: Résumé IA d'un article
  fastify.post('/api/articles/:id/summarize', async (request, reply) => {
    try {
      const { id } = request.params;
      const article = await getArticleById(id);
      if (!article) {
        return reply.code(404).send({ error: 'Article not found' });
      }

      // Extraire le contenu complet si nécessaire
      let content = article.content || article.description;
      if ((!content || content.length < 500) && article.link) {
        try {
          const { extractArticleContent } = await import('../lib/contentExtractor.js');
          const extracted = await extractArticleContent(article.link);
          if (extracted && extracted.content) {
            content = extracted.content;
          }
        } catch (_) { /* tant pis, on utilise ce qu'on a */ }
      }

      const { summarizeArticle } = await import('../lib/aiSummarizer.js');
      const summary = await summarizeArticle(article.title, content);

      return reply.send({ success: true, summary });
    } catch (error) {
      request.log.error('Summarize error: ' + error.message);
      return reply.code(500).send({ error: error.message });
    }
  });
}
