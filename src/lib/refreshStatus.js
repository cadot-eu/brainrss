// État global du refresh (exposé à l'API pour affichage temps réel)
// Module séparé pour éviter les imports circulaires

export const refreshStatus = {
  isRefreshing: false,
  total: 0,
  current: 0,
  currentFeed: '',
  results: [],  // { feedTitle, ok: bool, error?: string }
  startedAt: null,
  finishedAt: null
};
