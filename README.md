# 🧠 BrainRSS

**English** · [Français](#français)

A modern RSS reader with AI-powered summaries, keyword filtering, and content extraction.

## Features

- 📰 **RSS feeds** — add, refresh, delete feeds, manual refresh with toast notifications
- 🔍 **Search** — full-text or whole-word, case-insensitive
- 🤖 **AI summaries** — DeepSeek V4 Flash bullet-point summaries in French, cached for saved articles
- 🏷️ **Priority filters** — boost or hide articles by keyword
- 📖 **Content extraction** — Firefox Reader View style, cached for saved articles
- 💾 **Disk cache** — saved articles' content & summaries in `data/cache/`
- ⭐ **Bookmarks** — save articles, floating star button
- 🔒 **Password protection** — optional Basic Auth via `.env`
- 🎨 **Clean UI** — Pug templates, responsive, toast notifications
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

- 📰 **Flux RSS** — ajouter, actualiser, supprimer, refresh manuel avec toasts
- 🔍 **Recherche** — texte intégral ou mot entier, insensible à la casse
- 🤖 **Résumés IA** — DeepSeek V4 Flash, résumé en français, caché pour articles sauvegardés
- 🏷️ **Filtres de priorité** — booster ou masquer des articles par mot-clé
- 📖 **Extraction de contenu** — article complet, caché pour articles sauvegardés
- 💾 **Cache disque** — contenu & résumés des articles sauvegardés dans `data/cache/`
- ⭐ **Favoris** — sauvegarder, bouton étoile flottant
- 🔒 **Mot de passe** — protection Basic Auth optionnelle via `.env`
- 🎨 **Interface propre** — templates Pug, responsive, notifications toast
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
