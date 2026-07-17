// Хранилище (для Vercel используем память + JSON-файл, но для демо — Map)
const newsStore = new Map();
const statsStore = { total: 0, sent: 0, duplicates: 0 };

export function isDuplicate(id) {
  return newsStore.has(id);
}

export function saveNews(id, data) {
  if (!isDuplicate(id)) {
    newsStore.set(id, data);
    statsStore.total++;
    return true;
  }
  statsStore.duplicates++;
  return false;
}

export function getStats() {
  return statsStore;
}

export function getRecent(limit = 50) {
  return Array.from(newsStore.values()).slice(-limit);
}
