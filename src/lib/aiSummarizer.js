// ============================================================
// Résumé d'article via DeepSeek V4 Flash
// ============================================================

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

/**
 * Génère un résumé concis d'un article en français.
 * @param {string} title - Titre de l'article
 * @param {string} content - Contenu HTML ou texte de l'article
 * @returns {Promise<string>} Résumé formaté en liste à puces
 */
export async function summarizeArticle(title, content) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY non définie dans .env');
  }

  // Nettoyer le HTML pour extraire le texte
  const text = stripHtml(content || '');
  const truncated = text.substring(0, 12000); // limiter la taille

  const prompt = `Résume l'article suivant en français sous forme de liste à puces.
Règles :
- Maximum 10 points
- Chaque point fait 3 lignes maximum
- Va à l'essentiel, sois concis
- Format : une liste Markdown avec des tirets (-)

Titre : ${title}

Contenu :
${truncated}`;

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui résume des articles de manière concise et pertinente en français.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content;

  if (!summary) {
    throw new Error('DeepSeek API : réponse vide');
  }

  return summary;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
