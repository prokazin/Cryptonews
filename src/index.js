// ========== КОНФИГУРАЦИЯ ==========
const BOT_TOKEN = '8422981212:AAFx0HvRRFZy-JlTno_NXzUzpm2rJ-KWrBY';
const CHANNEL_ID = -1004345602790;

// ========== ИСТОЧНИКИ НОВОСТЕЙ ==========
const SOURCES = {
  main: [
    'https://cointelegraph.com/feed',
    'https://decrypt.co/feed',
    'https://bitcoinmagazine.com/feed',
    'https://coindesk.com/feed',
    'https://cryptoslate.com/feed',
    'https://news.bitcoin.com/feed'
  ],
  altcoins: [
    'https://cryptopotato.com/feed',
    'https://altcoinbuzz.io/feed'
  ],
  exclusive: [
    'https://www.newsbtc.com/feed',
    'https://www.crypto-news.net/feed'
  ]
};

// ========== ХРАНИЛИЩЕ ==========
const newsStore = new Map();
let stats = { total: 0, sent: 0, duplicates: 0, lastUpdate: null };
const translateCache = new Map();

// ========== ПЕРЕВОД ==========
async function translateToRussian(text) {
  if (translateCache.has(text)) {
    return translateCache.get(text);
  }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseData && data.responseData.translatedText) {
      const translated = data.responseData.translatedText;
      translateCache.set(text, translated);
      if (translateCache.size > 1000) {
        const firstKey = translateCache.keys().next().value;
        translateCache.delete(firstKey);
      }
      return translated;
    }
    return text;
  } catch (error) {
    console.error('Ошибка перевода:', error);
    return text;
  }
}

// ========== ПАРСИНГ RSS ==========
async function fetchRSS(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await response.text();
    const items = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const item of itemMatches) {
      const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.trim() || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
      const guid = item.match(/<guid>(.*?)<\/guid>/)?.[1]?.trim() || link;
      if (title && link) {
        if (!newsStore.has(guid)) {
          const translatedTitle = await translateToRussian(title);
          items.push({ title: translatedTitle, link, pubDate, id: guid });
        } else {
          const existing = newsStore.get(guid);
          items.push({ title: existing.title, link, pubDate, id: guid });
        }
      }
    }
    return items;
  } catch (error) {
    console.error(`Ошибка ${url}:`, error);
    return [];
  }
}

// ========== ОТПРАВКА В TELEGRAM ==========
async function sendToTelegram(message, category = '') {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const text = category ? `📰 [${category}] ${message}` : message;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Ошибка отправки:', error);
    return { ok: false };
  }
}

// ========== СБОР НОВОСТЕЙ ==========
async function fetchNews() {
  let newCount = 0;
  const results = [];
  const allSources = [
    ...SOURCES.main.map(s => ({ url: s, category: 'Основные' })),
    ...SOURCES.altcoins.map(s => ({ url: s, category: 'Альткоины' })),
    ...SOURCES.exclusive.map(s => ({ url: s, category: 'Эксклюзив' }))
  ];
  for (const { url, category } of allSources) {
    const items = await fetchRSS(url);
    for (const item of items) {
      if (!newsStore.has(item.id)) {
        newsStore.set(item.id, { ...item, category, savedAt: new Date().toISOString() });
        stats.total++;
        stats.sent++;
        newCount++;
        const message = `<b>${item.title}</b>\n\n${item.link}`;
        await sendToTelegram(message, category);
        results.push({ title: item.title, category });
      } else {
        stats.duplicates++;
      }
    }
  }
  stats.lastUpdate = new Date().toISOString();
  return { newCount, total: stats.total, results: results.slice(0, 10) };
}

// ========== ГЛАВНЫЙ ОБРАБОТЧИК ==========
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Главная страница
    if (path === '/' || path === '') {
      const html = await env.ASSETS.fetch(new Request('https://raw.githubusercontent.com/prokazin/Cryptonews/main/public/index.html'));
      return new Response(html.body, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // Админ панель
    if (path === '/admin-panel-xyz123') {
      const html = await env.ASSETS.fetch(new Request('https://raw.githubusercontent.com/prokazin/Cryptonews/main/public/admin.html'));
      return new Response(html.body, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // API: Данные для админки
    if (path === '/api/admin-data') {
      const allNews = Array.from(newsStore.values());
      const sorted = allNews.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return Response.json({
        stats: stats,
        cacheSize: newsStore.size,
        news: sorted.slice(0, 20)
      });
    }
    
    // API: Получить новости
    if (path === '/api/news') {
      const allNews = Array.from(newsStore.values());
      const sorted = allNews.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return Response.json({
        stats: stats,
        news: sorted.slice(0, 100)
      });
    }
    
    // API: Сбор новостей
    if (path === '/api/fetch') {
      const result = await fetchNews();
      return Response.json({
        success: true,
        ...result
      });
    }
    
    // API: Статистика
    if (path === '/api/stats') {
      return Response.json({
        stats: stats,
        cacheSize: newsStore.size,
        timestamp: new Date().toISOString()
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
