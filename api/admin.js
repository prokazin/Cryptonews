import { getStats, getRecent, getNewsByCategory } from '../utils/db.js';

export default function handler(req, res) {
  const stats = getStats();
  const recent = getRecent(20);
  const mainNews = getNewsByCategory('Основные').length;
  const altNews = getNewsByCategory('Альткоины').length;
  const exclusiveNews = getNewsByCategory('Эксклюзив').length;

  res.json({
    stats: {
      ...stats,
      byCategory: { main: mainNews, alt: altNews, exclusive: exclusiveNews }
    },
    recent: recent.slice(0, 10),
    timestamp: new Date().toISOString()
  });
}
