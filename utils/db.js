/// Временно храним в памяти (для Vercel)
const newsStore = new Map();
const statsStore = { total: 0, sent: 0, duplicates: 0, lastUpdate: null };

export function isDuplicate(id) {
  return newsStore.has(id);
}

export function saveNews(id, data) {
  if (!isDuplicate(id)) {
    newsStore.set(id, { ...data, savedAt: new Date().toISOString() });
    statsStore.total++;
    statsStore.sent++;
    return true;
  }
  statsStore.duplicates++;
  return false;
}

export function getStats() {
  return { ...statsStore, cacheSize: newsStore.size };
}

export function getRecent(limit = 50) {
  const all = Array.from(newsStore.values());
  return all.slice(-limit).reverse();
}

export function getNewsByCategory(category) {
  const all = Array.from(newsStore.values());
  return all.filter(item => item.category === category).slice(-30).reverse();
}

export function clearOldNews(days = 7) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  for (const [key, value] of newsStore.entries()) {
    if (new Date(value.savedAt).getTime() < cutoff) {
      newsStore.delete(key);
    }
  }
}
