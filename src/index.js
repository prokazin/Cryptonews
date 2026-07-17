// ========== КОНФИГУРАЦИЯ ==========
const BOT_TOKEN = '8422981212:AAFqUt5juqdC_l64q7FACOBw-mFL4f0hN8Y';
const CHANNEL_ID = '@your_channel_username'; // ЗАМЕНИТЕ ПОТОМ

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
        items.push({ title, link, pubDate, id: guid });
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

// ========== HTML СТРАНИЦА ==========
const HTML_PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Крипто Новости</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1c1c1e;
      color: #f5f5f7;
      padding: 16px;
      max-width: 600px;
      margin: 0 auto;
      min-height: 100vh;
      padding-bottom: 100px;
    }
    .header { 
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(40px);
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .header h1 { font-size: 24px; margin-bottom: 12px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 10px 0;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .stat-number { font-size: 22px; font-weight: bold; color: #0a84ff; }
    .stat-label { font-size: 11px; color: rgba(255,255,255,0.5); }
    .tabs {
      display: flex;
      gap: 8px;
      margin: 16px 0;
      background: rgba(120,120,128,0.2);
      backdrop-filter: blur(30px);
      border-radius: 30px;
      padding: 6px;
      border: 1px solid rgba(255,255,255,0.1);
      position: sticky;
      top: 10px;
      z-index: 10;
    }
    .tabs button {
      flex: 1;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.4);
      padding: 10px;
      border-radius: 25px;
      font-size: 18px;
      cursor: pointer;
      transition: 0.2s;
    }
    .tabs button.active {
      background: rgba(255,255,255,0.12);
      color: white;
    }
    .btn {
      background: #0a84ff;
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin: 10px 0;
    }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; }
    .news-item {
      background: rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 14px 16px;
      margin-bottom: 10px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .news-item .category {
      font-size: 10px;
      color: #ff9f0a;
      background: rgba(255,159,10,0.15);
      padding: 2px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .news-item a {
      color: #0a84ff;
      text-decoration: none;
      font-size: 15px;
      line-height: 1.4;
      display: block;
    }
    .news-item .date {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 6px;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: rgba(255,255,255,0.4);
    }
    .last-update {
      text-align: center;
      font-size: 12px;
      color: rgba(255,255,255,0.3);
      margin-top: 20px;
    }
    .error { color: #ff453a; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📰 Крипто Новости</h1>
    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-number" id="totalNews">0</div>
        <div class="stat-label">Всего</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="sentNews">0</div>
        <div class="stat-label">Отправлено</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="dupNews">0</div>
        <div class="stat-label">Дублей</div>
      </div>
    </div>
  </div>
  
  <div class="tabs">
    <button class="active" data-tab="all">📰 Все</button>
    <button data-tab="main">🔥 Главные</button>
    <button data-tab="alt">🪙 Альты</button>
    <button data-tab="exclusive">🔒 Эксклюзив</button>
  </div>
  
  <button class="btn" id="refreshBtn">🔄 Обновить новости</button>
  
  <div id="newsList">
    <div class="loading">⏳ Загрузка новостей...</div>
  </div>
  <div class="last-update" id="lastUpdate"></div>

  <script>
    let currentTab = 'all';
    let newsData = [];
    
    async function loadNews() {
      try {
        const response = await fetch('/api/news');
        const data = await response.json();
        newsData = data.news || [];
        
        document.getElementById('totalNews').textContent = data.stats.total || 0;
        document.getElementById('sentNews').textContent = data.stats.sent || 0;
        document.getElementById('dupNews').textContent = data.stats.duplicates || 0;
        
        if (data.stats.lastUpdate) {
          document.getElementById('lastUpdate').textContent = '🕐 Последнее обновление: ' + new Date(data.stats.lastUpdate).toLocaleString();
        }
        
        renderNews(currentTab);
      } catch(e) {
        document.getElementById('newsList').innerHTML = '<div class="error">❌ Ошибка загрузки. Проверьте интернет.</div>';
        console.error(e);
      }
    }
    
    function renderNews(tab) {
      const list = document.getElementById('newsList');
      let filtered = newsData;
      
      if (tab === 'main') filtered = newsData.filter(n => n.category === 'Основные');
      else if (tab === 'alt') filtered = newsData.filter(n => n.category === 'Альткоины');
      else if (tab === 'exclusive') filtered = newsData.filter(n => n.category === 'Эксклюзив');
      
      if (filtered.length === 0) {
        list.innerHTML = '<div class="loading">📭 Новостей пока нет</div>';
        return;
      }
      
      list.innerHTML = filtered.map(item => {
        const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'Сегодня';
        const category = item.category || 'Новости';
        const emoji = category === 'Основные' ? '📰' : category === 'Альткоины' ? '🪙' : '🔒';
        return \`
          <div class="news-item">
            <div class="category">\${emoji} \${category}</div>
            <a href="\${item.link}" target="_blank">\${item.title}</a>
            <div class="date">📅 \${date}</div>
          </div>
        \`;
      }).join('');
    }
    
    async function refreshNews() {
      const btn = document.getElementById('refreshBtn');
      btn.textContent = '⏳ Обновление...';
      btn.disabled = true;
      
      try {
        const response = await fetch('/api/fetch', { method: 'POST' });
        const data = await response.json();
        if (data.newCount > 0) {
          alert('✅ Добавлено ' + data.newCount + ' новых новостей!');
        } else {
          alert('📭 Новых новостей нет');
        }
        await loadNews();
      } catch(e) {
        alert('❌ Ошибка обновления');
        console.error(e);
      }
      
      btn.textContent = '🔄 Обновить новости';
      btn.disabled = false;
    }
    
    document.querySelectorAll('.tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderNews(currentTab);
      });
    });
    
    document.getElementById('refreshBtn').addEventListener('click', refreshNews);
    
    loadNews();
    setInterval(loadNews, 60000);
  </script>
</body>
</html>`;

// ========== ГЛАВНЫЙ ОБРАБОТЧИК ==========
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Главная страница
    if (path === '/' || path === '') {
      return new Response(HTML_PAGE, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
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
    
    // API: Запустить сбор новостей
    if (path === '/api/fetch') {
      const result = await fetchNews();
      return Response.json({
        success: true,
        ...result,
        message: `Добавлено ${result.newCount} новостей`
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
