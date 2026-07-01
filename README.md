# 🧠 BrainRSS

**English** · [Français](#français)

A modern RSS reader with AI-powered summaries, keyword filtering, and content extraction.

## Features

- 📰 **RSS feeds** — add, refresh, delete feeds
- 🔍 **Search** — full-text or whole-word, case-insensitive
- 🤖 **AI summaries** — DeepSeek V4 Flash bullet-point summaries in French (max 10 points, 3 lines each)
- 🏷️ **Priority filters** — boost or hide articles by keyword
- 📖 **Content extraction** — Firefox Reader View style full article extraction
- ⭐ **Bookmarks** — save articles for later
- 🎨 **Clean UI** — Pug templates, responsive design
- 🐳 **Docker** — ready to deploy

## Quick start

```bash
# Clone & install
git clone https://github.com/WCY-dt/BrainRSS.git
cd brainrss

# Set your DeepSeek API key (optional, for AI summaries)
echo 'DEEPSEEK_API_KEY=sk-...' > .env

# Set a password to protect the site (optional)
echo 'AUTH_USERNAME=admin' >> .env
echo 'AUTH_PASSWORD=mypassword' >> .env

# Docker
docker compose up -d

# Or without Docker
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tech stack

- **Backend**: Fastify + SQLite
- **Frontend**: Pug + vanilla JS
- **AI**: DeepSeek API (OpenAI-compatible)
- **Content**: Mozilla Readability + JSDOM

---

## Français

Un lecteur RSS moderne avec résumés IA, filtres par mots-clés et extraction de contenu.

### Fonctionnalités

- 📰 **Flux RSS** — ajouter, actualiser, supprimer
- 🔍 **Recherche** — texte intégral ou mot entier, insensible à la casse
- 🤖 **Résumés IA** — DeepSeek V4 Flash, résumé en français (max 10 points, 3 lignes chacun)
- 🏷️ **Filtres de priorité** — booster ou masquer des articles par mot-clé
- 📖 **Extraction de contenu** — article complet façon Firefox Reader View
- ⭐ **Favoris** — sauvegarder pour plus tard
- 🎨 **Interface propre** — templates Pug, responsive
- 🐳 **Docker** — prêt à déployer

### Démarrage rapide

```bash
git clone https://github.com/WCY-dt/BrainRSS.git
cd brainrss

# Clé API DeepSeek (optionnel, pour les résumés IA)
echo 'DEEPSEEK_API_KEY=sk-...' > .env

# Protéger le site par mot de passe (optionnel)
echo 'AUTH_USERNAME=admin' >> .env
echo 'AUTH_PASSWORD=monmotdepasse' >> .env

# Docker
docker compose up -d

# Ou sans Docker
npm install
npm run dev
```

Ouvrir `http://localhost:3000`.

### Stack technique

- **Backend** : Fastify + SQLite
- **Frontend** : Pug + JavaScript vanilla
- **IA** : API DeepSeek (compatible OpenAI)
- **Contenu** : Mozilla Readability + JSDOM

### Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard, add feeds |
| `/feeds` | Manage feeds |
| `/unread` | Unread articles (sort by priority) |
| `/saved` | Bookmarked articles |
| `/filters` | Keyword filters (priority/hide) |
| `/feed/:id` | Single feed articles |
# brainrss
