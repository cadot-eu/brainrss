import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Extrait le contenu principal d'une page web (comme Firefox Reader View).
 * Inspiré de l'approche XPath/Readability de BrainRSS.
 */
export async function extractArticleContent(url) {
  // Récupérer la page HTML
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BrainRSS/1.0; +https://example.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr,en;q=0.9'
    },
    timeout: 15000,
    maxRedirects: 5,
    responseType: 'text'
  });

  const html = response.data;

  // Parser avec JSDOM
  const dom = new JSDOM(html, {
    url: url,
    contentType: 'text/html'
  });

  // Extraire le contenu principal avec Readability
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  return {
    title: article.title || '',
    content: article.content || '',       // HTML nettoyé
    textContent: article.textContent || '', // Texte brut
    excerpt: article.excerpt || '',
    byline: article.byline || '',
    siteName: article.siteName || '',
    length: article.length || 0
  };
}
