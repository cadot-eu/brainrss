# 📐 Structure de BrainRSS

> Fichier généré automatiquement — résumé architectural du projet.

---

## 🌳 Arborescence

```
brainrss/
├── config/                  # Configurations (monté en volume Docker)
├── data/                    # Base SQLite + cache disque
│   ├── brainrss.db          # Base de données SQLite
│   └── cache/
│       ├── articles/        # Contenu extrait (HTML) des articles sauvegardés
│       └── summaries/       # Résumés IA des articles sauvegardés
├── logs/                    # Logs applicatifs (monté en volume Docker)
├── public/                  # Fichiers statiques servis par Fastify
│   ├── css/
│   │   └── style.css        # Feuille de style unique
│   └── js/
│       └── main.js          # Tout le JS frontend (~700 lignes)
├── src/                     # Code source
│   ├── server.js            # Point d'entrée – Fastify, Basic Auth, refresh auto
│   ├── db/
│   │   └── database.js      # Initialisation SQLite + migrations (schéma)
│   ├── lib/
│   │   ├── aiSummarizer.js   # Résumé IA via l'API DeepSeek
│   │   ├── cache.js          # Cache disque articles & résumés
│   │   ├── contentExtractor.js # Extraction contenu (Mozilla Readability + JSDOM)
│   │   ├── refreshStatus.js  # État global du refresh en cours
│   │   └── rssManager.js     # CRUD flux, articles, filtres, priorités
│   ├── routes/
│   │   └── index.js          # Toutes les routes HTTP (pages + API REST)
│   └── views/                # Templates Pug
│       ├── layout.pug        # Layout commun (header, nav, footer)
│       ├── index.pug         # Page d'accueil / dashboard
│       ├── feeds.pug         # Gestion des flux
│       ├── feed.pug          # Articles d'un flux
│       ├── article.pug       # Vue détaillée d'un article
│       ├── unread.pug        # Articles non lus (tri par priorité)
│       ├── saved.pug         # Articles sauvegardés
│       ├── filters.pug       # Filtres par mots-clés
│       └── 404.pug           # Page d'erreur 404
├── .gitignore
├── Dockerfile                # Image Node 20 Alpine + build sqlite3
├── compose.yaml              # Docker Compose (dev avec hot reload)
├── dev.sh                    # Script de démarrage dev
├── import-opml.sh            # Script d'import OPML
├── reset-unread.sh           # Script pour remettre tout en "non lu"
├── package.json              # Dépendances et scripts npm
└── README.md                 # Documentation bilingue EN/FR
```

---

## 🧱 Stack technique

| Couche       | Technologie                             |
|-------------|-----------------------------------------|
| Runtime     | Node.js 20                              |
| Serveur     | Fastify 4                               |
| Base données | SQLite (via `sqlite` + `sqlite3`)       |
| Templates   | Pug 3                                   |
| Frontend    | JavaScript vanilla (pas de framework)   |
| IA          | DeepSeek API (`deepseek-chat`)          |
| Extraction  | Mozilla Readability + JSDOM             |
| Parsing RSS | `rss-parser`                            |
| HTTP externe| `axios`                                 |
| Conteneur   | Docker (Alpine) + Docker Compose        |

---

## 🗄️ Base de données

Fichier unique : `data/brainrss.db` (SQLite).

### Table `feeds`

| Colonne     | Type     | Description                     |
|------------|----------|---------------------------------|
| id         | TEXT PK  | UUID                            |
| title      | TEXT     | Nom du flux                     |
| url        | TEXT UNIQ| URL du flux RSS                 |
| description| TEXT     | Description                     |
| link       | TEXT     | Lien du site                    |
| image      | TEXT     | URL de l'image                  |
| lastUpdated| DATETIME | Dernier refresh                 |
| priority   | INTEGER  | Score de priorité du site       |
| createdAt  | DATETIME | Date d'ajout                    |

### Table `articles`

| Colonne     | Type     | Description                     |
|------------|----------|---------------------------------|
| id         | TEXT PK  | UUID                            |
| feedId     | TEXT FK  | Référence vers `feeds.id`       |
| title      | TEXT     | Titre                           |
| description| TEXT     | Extrait / description courte    |
| content    | TEXT     | Contenu HTML complet            |
| link       | TEXT     | URL de l'article original       |
| author     | TEXT     | Auteur                          |
| pubDate    | DATETIME | Date de publication             |
| image      | TEXT     | Image de l'article              |
| read       | INTEGER  | 0 = non lu, 1 = lu              |
| saved      | INTEGER  | 0 = normal, 1 = favori          |
| priority   | INTEGER  | Score de priorité               |
| createdAt  | DATETIME | Date d'ajout en base            |

### Table `filters`

| Colonne     | Type     | Description                     |
|------------|----------|---------------------------------|
| id         | TEXT PK  | UUID                            |
| keywords   | TEXT     | Mots-clés séparés par `,`       |
| action     | TEXT     | `priority` ou `hide`            |
| priority   | INTEGER  | Bonus de score (défaut 5)       |
| createdAt  | DATETIME | Date d'ajout                    |

### Tables inutilisées

`tags` et `feedTags` existent dans le schéma mais ne sont **pas utilisées** dans le code. Elles pourraient servir à une future fonctionnalité de tags.

---

## 🔄 Flux de données

### 1. Ajout d'un flux RSS

```
[Formulaire page /] → POST /api/feeds → rssManager.addFeed()
  → parser.parseURL() → INSERT feeds + INSERT articles (anti-doublons)
```

### 2. Refresh d'un flux

```
[Bouton Actualiser] → POST /api/feeds/:id/update → rssManager.updateFeed()
  → parser.parseURL() → UPDATE feed + INSERT nouveaux articles (anti-doublons)
```

### 3. Refresh automatique global

```
[Au démarrage] → server.refreshAllFeeds() → boucle sur tous les feeds
  → rssManager.updateFeed() pour chaque feed
  → refreshStatus mis à jour en temps réel (exposé via GET /api/refresh-status)
```

### 4. Lecture d'un article avec extraction

```
GET /api/articles/:id → rssManager.getArticleById()
  → markArticleAsRead() automatique
  → Si contenu court (< 500 car.) : contentExtractor.extractArticleContent()
    → axios.fetch() → JSDOM → Readability.parse()
  → Si article déjà sauvegardé : cache.setCachedArticle()
  → Sinon : cache en lecture seule (getCachedArticle)
```

### 5. Résumé IA

```
POST /api/articles/:id/summarize →
  1. Vérifier cache résumé → si trouvé, retour immédiat
  2. Récupérer contenu (cache ou extraction)
  3. aiSummarizer.summarizeArticle()
     → stripHtml() → Prompt en français → POST DeepSeek API
  4. Si article sauvegardé : cache.setCachedSummary()
```

### 6. Priorité des articles non lus

```
GET /unread?sort=priority|site →
  rssManager.getUnreadArticlesWithPriority()
    → SELECT articles non lus + priorité du feed
    → Pour chaque article : computeArticlePriority(article, filters)
      → Si filtre "hide" match → exclu (score = -999)
      → Si filtre "priority" match → bonus au score
    → Tri par score (priority) ou par score du feed seul (site)
```

---

## 🔌 Routes API REST

| Méthode | Route                              | Description                        |
|---------|------------------------------------|------------------------------------|
| GET     | `/`                                | Dashboard                          |
| GET     | `/feeds`                           | Gestion des flux                   |
| GET     | `/feed/:id`                        | Articles d'un flux                 |
| GET     | `/article/:id`                     | Vue article                        |
| GET     | `/unread?sort=priority\|site`      | Articles non lus triés             |
| GET     | `/saved`                           | Articles sauvegardés               |
| GET     | `/filters`                         | Gestion des filtres                |
| POST    | `/api/feeds`                       | Ajouter un flux                    |
| DELETE  | `/api/feeds/:id`                   | Supprimer un flux                  |
| POST    | `/api/feeds/:id/update`            | Rafraîchir un flux                 |
| GET     | `/api/feeds`                       | Lister tous les flux               |
| GET     | `/api/feeds/:id/articles`          | Articles d'un flux (JSON)          |
| GET     | `/api/articles/:id`                | Article + extraction auto          |
| POST    | `/api/articles/:id/read`           | Marquer comme lu                   |
| POST    | `/api/articles/mark-all-read`      | Tout marquer comme lu              |
| POST    | `/api/articles/:id/toggle-saved`   | Basculer favori                    |
| POST    | `/api/articles/:id/summarize`      | Résumé IA                          |
| GET     | `/api/filters`                     | Lister les filtres                 |
| POST    | `/api/filters`                     | Ajouter un filtre                  |
| DELETE  | `/api/filters/:id`                 | Supprimer un filtre                |
| GET     | `/api/refresh-status`              | Statut du refresh en cours         |
| POST    | `/api/refresh-trigger`             | Lancer un refresh manuel           |

---

## 🛡️ Sécurité

- **Basic Auth** : activé si `AUTH_USERNAME` et `AUTH_PASSWORD` sont définis dans `.env`
- Les assets statiques (`/css/`, `/js/`) et `/api/refresh-status` sont exclus de l'auth
- Les pages HTML ont `Cache-Control: no-store` lorsque l'auth est activée

---

## 🎨 Frontend

- **CSS** : feuille unique `public/css/style.css`
- **JS** : fichier unique `public/js/main.js` (~700 lignes, vanilla JS)
  - Fonctions principales :
    - `addFeed()` / `updateFeed()` / `deleteFeed()` — CRUD flux
    - `markArticleAsRead()` / `toggleArticleSaved()` — état des articles
    - `initArticleCards()` — affichage inline des articles (cards dépliables)
    - `initScrollMarkRead()` — IntersectionObserver pour marquer comme lu au scroll
    - `initArticleSearch()` — recherche full-text / mot entier dans les articles
    - `initRefreshBar()` — barre de progression du refresh
    - `handleSummarize()` — demande de résumé IA avec rendu dans une card
    - `createFloatingStar()` — bouton flottant étoile pour sauvegarder
    - `showToast()` — notifications toast
    - `initArticleButtons()` — délégation d'événements pour les boutons articles

---

## 🐳 Docker

- **Dockerfile** : `node:20-alpine` + build tools pour `sqlite3`, port 3000
- **compose.yaml** : développement avec hot reload (`npm run dev`), volumes montés pour `src/`, `public/`, `.env`
- Variables d'environnement : `NODE_ENV`, `DEEPSEEK_API_KEY`, `AUTH_USERNAME`, `AUTH_PASSWORD`

---

## 📜 Scripts npm

| Script   | Commande                    | Description              |
|----------|-----------------------------|--------------------------|
| `dev`    | `node --watch src/server.js`| Développement (reload auto) |
| `start`  | `node src/server.js`        | Production               |
| `prod`   | `node src/server.js`        | Identique à start        |
| `build`  | `echo ...`                  | Pas de build nécessaire  |
| `lint`   | `eslint src --fix`          | Linting                  |

---

## 🔑 Dépendances clés

| Package              | Usage                                    |
|---------------------|------------------------------------------|
| `fastify`           | Serveur HTTP                             |
| `@fastify/view`     | Intégration Pug                          |
| `@fastify/static`   | Fichiers statiques                       |
| `rss-parser`        | Parsing des flux RSS/Atom                |
| `@mozilla/readability`| Extraction du contenu principal       |
| `jsdom`             | DOM pour Readability                     |
| `axios`             | Requêtes HTTP pour l'extraction          |
| `sqlite` + `sqlite3`| Base de données                          |
| `uuid`              | Génération d'identifiants                |
| `pug`               | Moteur de templates                      |
| `dotenv`            | Chargement du `.env`                     |
