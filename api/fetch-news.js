import Parser from 'rss-parser';
import { isDuplicate, saveNews } from '../utils/db.js';
import { sendToTelegram } from '../utils/telegram.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcesPath = join(__dirname, '../data/sources.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0' },
  timeout: 10000
});

async function fetchRSS(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
      id: item.link || item.guid || item.id,
      title: item.title || 'Без заголовка',
      link: item.link || '',
      pubDate: item.pubDate || item.published || new Date().toISOString(),
      content: item.content || item.description || ''
    }));
  } catch (error) {
    console.error(`❌ Ошибка парсинга ${url}:`, error.message);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allSources = [
    ...sources.main.map(s => ({ url: s, category: 'Основные' })),
    ...sources.altcoins.map(s => ({ url: s, category: 'Альткоины' })),
    ...sources.exclusive.map(s => ({ url: s, category: 'Эксклюзив' }))
  ];

  let newCount = 0;
  const results = [];

  for (const { url, category } of allSources) {
    try {
      const items = await fetchRSS(url);
      for (const item of items) {
        if (!isDuplicate(item.id)) {
          const saved = saveNews(item.id, { ...item, category });
          if (saved) {
            const message = `<b>${item.title}</b>\n\n${item.link}`;
            await sendToTelegram(message, category);
            newCount++;
            results.push({ title: item.title, category });
          }
        }
      }
    } catch (error) {
      console.error(`❌ Ошибка источника ${url}:`, error);
    }
  }

  res.json({
    success: true,
    newCount,
    totalChecked: allSources.length,
    results: results.slice(0, 10)
  });
}
