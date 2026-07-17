import { isDuplicate, saveNews } from '../utils/db.js';
import { sendToTelegram } from '../utils/telegram.js';
import sources from '../data/sources.json' assert { type: 'json' };

async function fetchRSS(url) {
  const res = await fetch(url);
  const text = await res.text();
  // Парсинг RSS (упрощённо — используем регулярки или DOMParser)
  const items = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
  return items.map(item => {
    const title = item.match(/<title>(.*?)<\/title>/)[1] || '';
    const link = item.match(/<link>(.*?)<\/link>/)[1] || '';
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)[1] || '';
    return { title, link, pubDate, id: link };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const allSources = [
    ...sources.main,
    ...sources.altcoins,
    ...sources.exclusive
  ];

  let newCount = 0;
  for (const url of allSources) {
    try {
      const items = await fetchRSS(url);
      for (const item of items) {
        if (!isDuplicate(item.id)) {
          saveNews(item.id, item);
          await sendToTelegram(`<b>${item.title}</b>\n${item.link}`);
          newCount++;
        }
      }
    } catch (e) {
      console.error('Ошибка источника:', url, e);
    }
  }

  res.json({ success: true, new: newCount });
}
