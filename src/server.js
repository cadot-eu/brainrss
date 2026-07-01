import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { initializeDatabase, closeDatabase } from './db/database.js';
import { registerRoutes } from './routes/index.js';
import { getAllFeeds, updateFeed } from './lib/rssManager.js';
import { refreshStatus } from './lib/refreshStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true
});

// Initialiser la base de données
await initializeDatabase();

// Configurer Pug comme moteur de template
const pug = await import('pug');
await app.register(fastifyView, {
  engine: {
    pug: pug
  },
  templates: path.join(__dirname, 'views')
});

// Servir les fichiers statiques
await app.register(fastifyStatic, {
  root: path.join(__dirname, '../public')
});

// Enregistrer les routes
await registerRoutes(app);

// Protection par mot de passe (Basic Auth)
const AUTH_USER = process.env.AUTH_USERNAME;
const AUTH_PASS = process.env.AUTH_PASSWORD;

if (AUTH_USER && AUTH_PASS) {
  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for static assets and refresh-status API
    const url = request.url;
    if (url.startsWith('/css/') || url.startsWith('/js/') || url.startsWith('/favicon') || url === '/sw.js' || url === '/api/refresh-status') {
      return;
    }

    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      reply.header('WWW-Authenticate', 'Basic realm="BrainRSS"');
      return reply.code(401).send({ error: 'Authentification requise' });
    }

    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (user !== AUTH_USER || pass !== AUTH_PASS) {
      reply.header('WWW-Authenticate', 'Basic realm="BrainRSS"');
      return reply.code(401).send({ error: 'Identifiants invalides' });
    }
  });
  app.addHook('onSend', async (request, reply, payload) => {
    // Désactiver le cache sur les pages HTML
    if (reply.getHeader('content-type')?.toString().includes('text/html')) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }
    return payload;
  });

  console.log('🔒 Basic Auth activé (' + AUTH_USER + ')');
}

// Gestion des erreurs globale
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  reply.code(500).send({ error: 'Internal Server Error' });
});

// Gestion de l'arrêt gracieux
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`\n${signal} received`);
    await app.close();
    await closeDatabase();
    process.exit(0);
  });
});

// Rafraichit tous les flux en arriere-plan
async function refreshAllFeeds() {
  if (refreshStatus.isRefreshing) return; // déjà en cours

  const feeds = await getAllFeeds();
  console.log('Auto-refresh de ' + feeds.length + ' flux(s)...');

  refreshStatus.isRefreshing = true;
  refreshStatus.total = feeds.length;
  refreshStatus.current = 0;
  refreshStatus.currentFeed = '';
  refreshStatus.results = [];
  refreshStatus.startedAt = new Date().toISOString();
  refreshStatus.finishedAt = null;

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    refreshStatus.current = i + 1;
    refreshStatus.currentFeed = feed.title;

    try {
      await updateFeed(feed.id);
      console.log('  OK : ' + feed.title);
      refreshStatus.results.push({ feedTitle: feed.title, ok: true });
    } catch (err) {
      console.log('  Echec : ' + feed.title + ' - ' + err.message);
      refreshStatus.results.push({ feedTitle: feed.title, ok: false, error: err.message });
    }
  }

  refreshStatus.isRefreshing = false;
  refreshStatus.currentFeed = '';
  refreshStatus.finishedAt = new Date().toISOString();
  console.log('Auto-refresh termine.');
}

// Démarrer le serveur
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('BrainRSS server running at http://localhost:3000');

    // Rafraichir tous les flux au demarrage (en arriere-plan)
    refreshAllFeeds().catch(err => app.log.error('Refresh startup failed: ' + err.message));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
