// ============================================================
// BrainRSS — Logique partagée
// ============================================================

// Utilitaires API
const API = {
  async addFeed(url) {
    const response = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return response.json();
  },

  async updateFeed(feedId) {
    const response = await fetch(`/api/feeds/${feedId}/update`, { method: 'POST' });
    return response.json();
  },

  async deleteFeed(feedId) {
    const response = await fetch(`/api/feeds/${feedId}`, { method: 'DELETE' });
    return response.json();
  },

  async markArticleAsRead(articleId) {
    const response = await fetch(`/api/articles/${articleId}/read`, { method: 'POST' });
    return response.json();
  },

  async toggleArticleSaved(articleId) {
    const response = await fetch(`/api/articles/${articleId}/toggle-saved`, { method: 'POST' });
    return response.json();
  },

  async getArticle(articleId) {
    const response = await fetch(`/api/articles/${articleId}`);
    if (!response.ok) throw new Error('Article introuvable');
    return response.json();
  }
};

// ============================================================
// Bouton flottant étoile (favoris)
// ============================================================
function createFloatingStar() {
  try {
    if (document.getElementById('floating-star')) return;

    var btn = document.createElement('button');
    btn.id = 'floating-star';
    btn.className = 'floating-star';
    btn.title = 'Ajouter aux favoris';
    btn.innerHTML = '☆';
    btn.style.display = 'none';
    document.body.appendChild(btn);

    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      var articleId = btn.dataset.articleId;
      if (!articleId) return;
      try {
        var result = await API.toggleArticleSaved(articleId);
        updateFloatingStar(result.saved);
      } catch (err) {
        console.error('Toggle saved failed:', err);
      }
    });
    console.log('[BrainRSS] floating star created');
  } catch (err) {
    console.error('[BrainRSS] createFloatingStar error:', err);
  }
}

function showFloatingStar(articleId, saved) {
  const btn = document.getElementById('floating-star');
  if (!btn) return;
  btn.dataset.articleId = articleId;
  updateFloatingStar(saved);
  btn.style.display = 'flex';
}

function hideFloatingStar() {
  const btn = document.getElementById('floating-star');
  if (btn) btn.style.display = 'none';
}

function updateFloatingStar(saved) {
  const btn = document.getElementById('floating-star');
  if (!btn) return;
  if (saved) {
    btn.innerHTML = '★';
    btn.classList.add('saved');
    btn.title = 'Retirer des favoris';
  } else {
    btn.innerHTML = '☆';
    btn.classList.remove('saved');
    btn.title = 'Ajouter aux favoris';
  }
}

// ============================================================
// Expansion des cards article
// ============================================================
function initArticleCards(containerSelector) {
  console.log('[BrainRSS] initArticleCards called, selector:', containerSelector);
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.log('[BrainRSS] initArticleCards: container not found');
    return;
  }

  const items = container.querySelectorAll('.article-item');
  console.log('[BrainRSS] initArticleCards: found', items.length, 'article items');

  items.forEach(item => {
    if (item.dataset.expandInit) return;
    item.dataset.expandInit = '1';

    const articleId = item.dataset.articleId;
    if (!articleId) return;

    item.addEventListener('click', async () => {
      console.log('[BrainRSS] click article', articleId);
      // Si déjà ouverte, on referme
      const existing = item.nextElementSibling;
      if (existing && existing.classList.contains('article-detail') && existing.dataset.parentId === articleId) {
        existing.remove();
        item.classList.remove('article-item--open');
        hideFloatingStar();
        return;
      }

      // Fermer toute autre card détail
      document.querySelectorAll('.article-detail').forEach(d => d.remove());
      document.querySelectorAll('.article-item--open').forEach(i => i.classList.remove('article-item--open'));

      // Marquer comme lu (l'API le fait déjà côté serveur, doublon inoffensif)
      API.markArticleAsRead(articleId).catch(() => { });

      // Ouvrir
      item.classList.add('article-item--open');
      const detail = document.createElement('div');
      detail.className = 'article-detail';
      detail.dataset.parentId = articleId;
      detail.innerHTML = `<div class="article-detail-loader"><span class="spinner"></span> Chargement...</div>`;
      item.insertAdjacentElement('afterend', detail);

      try {
        const article = await API.getArticle(articleId);
        console.log('[BrainRSS] article loaded, content length:', (article.content || '').length);
        detail.innerHTML = buildDetailHTML(article);
        showFloatingStar(articleId, article.saved === 1);
      } catch (err) {
        detail.innerHTML = `<div class="article-detail-error">Erreur : ${err.message}</div>`;
      }
    });

    // Empêcher le clic sur les liens/boutons internes
    item.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('click', e => e.stopPropagation());
    });
  });
}

function buildDetailHTML(article) {
  let html = '<button class="article-detail-close" title="Fermer">&times;</button>';
  if (article.image) {
    html += `<div class="article-detail-image"><img src="${escapeHtml(article.image)}" alt="" loading="lazy" onerror="this.style.display='none'"></div>`;
  }
  html += `<div class="article-detail-body">${article.content || article.description || ''}</div>`;

  // Attacher le handler close après insertion DOM
  setTimeout(() => {
    const closeBtn = document.querySelector(`.article-detail[data-parent-id="${article.id}"] .article-detail-close`);
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = closeBtn.closest('.article-detail');
        const p = d.previousElementSibling;
        if (p) p.classList.remove('article-item--open');
        d.remove();
        hideFloatingStar();
      });
    }
  }, 0);

  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// IntersectionObserver : marquer comme lu au scroll
// ============================================================
function initScrollMarkRead() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // La card sort par le haut => non visible ET au-dessus du viewport
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        const articleId = entry.target.dataset.articleId;
        if (articleId) {
          API.markArticleAsRead(articleId).catch(() => { });
          observer.unobserve(entry.target);
        }
      }
    });
  }, {
    rootMargin: '-50px 0px 0px 0px' // détection légèrement avant la sortie réelle
  });

  document.querySelectorAll('.article-item').forEach(item => {
    observer.observe(item);
  });
}

// ============================================================
// Barre de recherche articles
// ============================================================
function initArticleSearch() {
  var searchBar = document.getElementById('articleSearch');
  var searchInput = document.getElementById('searchInput');
  var searchCount = document.getElementById('searchCount');
  var searchWholeWord = document.getElementById('searchWholeWord');

  // Afficher la barre seulement s'il y a des articles sur la page
  var articles = document.querySelectorAll('.article-item');
  if (!articles.length || !searchBar || !searchInput || !searchCount) return;

  searchBar.style.display = 'flex';

  function doSearch() {
    var query = searchInput.value.toLowerCase().trim();
    var wholeWord = searchWholeWord && searchWholeWord.checked;
    var visible = 0;

    articles.forEach(function (item) {
      if (!query) {
        item.style.display = '';
        visible++;
        return;
      }
      var title = (item.querySelector('h3') || {}).textContent || '';
      var desc = (item.querySelector('.article-description') || {}).textContent || '';
      var haystack = title.toLowerCase() + ' ' + desc.toLowerCase();

      var match = false;
      if (wholeWord) {
        // Mot entier : chercher le mot délimité par des non-lettres
        var regex = new RegExp('(^|[^a-z0-9])' + escapeRegex(query) + '($|[^a-z0-9])');
        match = regex.test(haystack);
      } else {
        match = haystack.indexOf(query) !== -1;
      }

      if (match) {
        item.style.display = '';
        visible++;
      } else {
        item.style.display = 'none';
      }
    });

    // Cacher les détails ouverts qui ne sont plus visibles
    document.querySelectorAll('.article-detail').forEach(function (d) {
      var prev = d.previousElementSibling;
      if (prev && prev.style.display === 'none') {
        d.remove();
        if (prev) prev.classList.remove('article-item--open');
        hideFloatingStar();
      }
    });

    searchCount.textContent = query ? visible + ' / ' + articles.length : '';
  }

  searchInput.addEventListener('input', doSearch);
  if (searchWholeWord) {
    searchWholeWord.addEventListener('change', doSearch);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Barre de refresh temps réel
// ============================================================
function initRefreshBar() {
  var bar = document.getElementById('refresh-bar');
  var text = document.getElementById('refresh-bar-text');
  var progress = document.getElementById('refresh-bar-progress');
  var details = document.getElementById('refresh-bar-details');

  if (!bar || !text || !progress || !details) return;

  var doneTimeout = null;

  async function poll() {
    try {
      var res = await fetch('/api/refresh-status');
      var status = await res.json();

      if (status.isRefreshing) {
        // En cours : afficher la barre
        if (doneTimeout) { clearTimeout(doneTimeout); doneTimeout = null; }
        bar.classList.remove('refresh-bar--done');
        bar.style.display = 'block';
        text.textContent = 'Rafraîchissement ' + status.current + '/' + status.total + ' : ' + status.currentFeed;
        if (status.total > 0) {
          var pct = Math.round(status.current / status.total * 20);
          progress.textContent = '█'.repeat(pct) + '░'.repeat(20 - pct);
        }
        details.innerHTML = status.results.slice().reverse().slice(0, 3).map(function (r) {
          return '<span class="refresh-result ' + (r.ok ? 'ok' : 'fail') + '">' + (r.ok ? '✅' : '❌') + ' ' + r.feedTitle + '</span>';
        }).join('');
      } else if (bar.style.display === 'block') {
        // Terminé : afficher le résumé puis cacher
        if (doneTimeout) return; // déjà en attente de fermeture
        var okCount = status.results.filter(function (r) { return r.ok; }).length;
        var failCount = status.results.filter(function (r) { return !r.ok; }).length;
        text.textContent = 'Rafraîchissement terminé : ' + okCount + ' OK' + (failCount > 0 ? ', ' + failCount + ' échec(s)' : '');
        progress.textContent = '✅'.repeat(Math.min(okCount, 25)) + (failCount > 0 ? '❌'.repeat(Math.min(failCount, 10)) : '');
        details.innerHTML = '';
        bar.classList.add('refresh-bar--done');
        doneTimeout = setTimeout(function () {
          bar.style.display = 'none';
          bar.classList.remove('refresh-bar--done');
          doneTimeout = null;
        }, 4000);
      }
    } catch (err) {
      // silencieux
    }
  }

  // Poll toutes les secondes
  poll();
  setInterval(poll, 1000);
}

// ============================================================
// Initialisation
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  console.log('[BrainRSS] DOM ready, initializing...');
  createFloatingStar();
  initArticleCards('.articles-list');
  initScrollMarkRead();
  initArticleSearch();
  initRefreshBar();

  // Boutons spécifiques aux pages feeds
  document.querySelectorAll('.btn-update').forEach(function (btn) {
    btn.addEventListener('click', handleUpdateFeed);
  });
  document.querySelectorAll('.btn-delete').forEach(function (btn) {
    btn.addEventListener('click', handleDeleteFeed);
  });

  // Formulaire d'ajout de flux
  var addFeedForm = document.getElementById('addFeedForm');
  if (addFeedForm) {
    addFeedForm.addEventListener('submit', handleAddFeed);
  }

  // Boutons Lire et Résumé IA sur les cartes article
  initArticleButtons();
});

async function handleUpdateFeed(e) {
  const btn = e.currentTarget;
  const feedId = btn.dataset.feedId;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Actualisation...';
  try {
    await API.updateFeed(feedId);
    btn.textContent = 'Actualisé!';
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    alert('Erreur: ' + error.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleDeleteFeed(e) {
  const btn = e.currentTarget;
  const feedId = btn.dataset.feedId;
  if (!confirm('Supprimer ce flux ?')) return;
  btn.disabled = true;
  try {
    await API.deleteFeed(feedId);
    location.reload();
  } catch (error) {
    alert('Erreur: ' + error.message);
    btn.disabled = false;
  }
}

async function handleAddFeed(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const url = form.querySelector('input').value;
  const messageEl = document.getElementById('feedMessage');
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Ajout en cours...';
  try {
    const result = await API.addFeed(url);
    if (result.success) {
      messageEl.innerHTML = `<p class="success">Flux "${result.feedTitle}" ajouté !</p>`;
      form.reset();
      setTimeout(() => location.reload(), 1500);
    } else {
      messageEl.innerHTML = `<p class="error">Erreur: ${result.error}</p>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ajouter';
    }
  } catch (error) {
    messageEl.innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ajouter';
  }
}

// ============================================================
// Boutons Lire / Résumé IA
// ============================================================
function initArticleButtons() {
  // Bouton Lire : déclenche l'expansion de la card
  document.querySelectorAll('.btn-read').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var articleId = this.dataset.articleId;
      var item = document.querySelector('.article-item[data-article-id="' + articleId + '"]');
      if (item) {
        item.click(); // réutilise le handler de clic existant
      }
    });
  });

  // Bouton Résumé IA
  document.querySelectorAll('.btn-summarize').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var articleId = this.dataset.articleId;
      handleSummarize(articleId, this);
    });
  });
}

async function handleSummarize(articleId, btn) {
  var item = document.querySelector('.article-item[data-article-id="' + articleId + '"]');
  if (!item) return;

  var originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳...';

  // Ouvrir la card si pas déjà ouverte (ou si encore en loader)
  var detail = document.querySelector('.article-detail[data-parent-id="' + articleId + '"]');
  if (!detail || detail.querySelector('.article-detail-loader')) {
    item.click();
    // Attendre que l'article soit complètement chargé (max 30s)
    for (var i = 0; i < 60; i++) {
      await new Promise(function (r) { setTimeout(r, 500); });
      detail = document.querySelector('.article-detail[data-parent-id="' + articleId + '"]');
      if (detail && !detail.querySelector('.article-detail-loader')) break;
    }
    if (!detail || detail.querySelector('.article-detail-loader')) {
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }
  }

  // Ajouter ou remplacer la section résumé
  var summaryBox = detail.querySelector('.article-summary');
  if (!summaryBox) {
    summaryBox = document.createElement('div');
    summaryBox.className = 'article-summary';
    var body = detail.querySelector('.article-detail-body');
    if (body) {
      body.insertAdjacentElement('beforebegin', summaryBox);
    } else {
      detail.appendChild(summaryBox);
    }
  }

  summaryBox.innerHTML = '<div class="article-summary-loader"><span class="spinner"></span> Résumé en cours de création...</div>';

  try {
    var res = await fetch('/api/articles/' + articleId + '/summarize', { method: 'POST' });
    var data = await res.json();
    if (data.success && data.summary) {
      var summaryHtml = data.summary
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^- (.+)$/gm, '<li>$1</li>');
      summaryHtml = '<ul>' + summaryHtml + '</ul>';
      summaryHtml = summaryHtml.replace(/<\/li>\s*<li>/g, '</li><li>');
      summaryBox.innerHTML = '<div class="article-summary-header">🤖 Résumé IA</div><div class="article-summary-content">' + summaryHtml + '</div>';
    } else {
      summaryBox.innerHTML = '<div class="article-summary-error">Erreur: ' + (data.error || 'inconnue') + '</div>';
    }
  } catch (err) {
    summaryBox.innerHTML = '<div class="article-summary-error">Erreur: ' + err.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
