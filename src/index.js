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

// ========== КЕШ ДЛЯ ПЕРЕВОДА ==========
const translateCache = new Map();

// ========== ПЕРЕВОД НА РУССКИЙ (с кешем) ==========
async function translateToRussian(text) {
  // Проверяем кеш
  if (translateCache.has(text)) {
    return translateCache.get(text);
  }
  
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.responseData && data.responseData.translatedText) {
      const translated = data.responseData.translatedText;
      // Сохраняем в кеш
      translateCache.set(text, translated);
      // Ограничиваем кеш до 1000 записей
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
        // Переводим только если новость новая (для экономии лимитов)
        if (!newsStore.has(guid)) {
          const translatedTitle = await translateToRussian(title);
          items.push({ title: translatedTitle, link, pubDate, id: guid });
        } else {
          // Если новость уже есть - берем сохраненный перевод
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

// ========== HTML СТРАНИЦА ==========
const HTML_PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>COIN DIGEST</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1c1c1e;
      color: #f5f5f7;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    /* ===== ШАПКА С НАЗВАНИЕМ КАНАЛА ===== */
    #header {
      padding: 20px 16px 12px 16px;
      text-align: center;
      background: linear-gradient(180deg, rgba(28,28,30,1) 0%, rgba(28,28,30,0) 100%);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    
    #header h1 {
      font-family: 'Georgia', serif;
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #f5f5f7 0%, #0a84ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 2px;
      text-shadow: 0 2px 20px rgba(10,132,255,0.2);
    }
    
    #header .subtitle {
      font-size: 11px;
      color: rgba(255,255,255,0.25);
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    
    #content {
      flex: 1;
      overflow-y: auto;
      padding: 0 16px 80px 16px;
    }
    
    #content::-webkit-scrollbar {
      width: 4px;
    }
    #content::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.3);
      border-radius: 10px;
    }
    
    .news-item {
      background: rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 14px 16px;
      margin-bottom: 10px;
      border: 1px solid rgba(255,255,255,0.05);
      transition: 0.2s;
      animation: fadeIn 0.3s ease;
    }
    
    .news-item:active {
      background: rgba(255,255,255,0.12);
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
      padding: 60px 20px;
      color: rgba(255,255,255,0.3);
    }
    
    .loading .spinner {
      display: inline-block;
      width: 30px;
      height: 30px;
      border: 3px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      border-top-color: #0a84ff;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .empty {
      text-align: center;
      padding: 60px 20px;
      color: rgba(255,255,255,0.3);
    }
    
    .error {
      text-align: center;
      padding: 20px;
      color: #ff453a;
    }
    
    .last-update {
      text-align: center;
      font-size: 11px;
      color: rgba(255,255,255,0.2);
      margin-top: 10px;
      padding-bottom: 10px;
    }
    
    /* ===== ВКЛАДКИ ВНИЗУ ===== */
    #bottomTabs {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 32px;
      background: rgba(44, 44, 46, 0.85);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      padding: 10px 28px;
      border-radius: 40px;
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 100;
    }
    
    #bottomTabs button {
      background: transparent;
      border: none;
      font-size: 24px;
      color: rgba(255,255,255,0.4);
      padding: 4px 0;
      cursor: pointer;
      transition: 0.2s;
      min-width: 32px;
      text-align: center;
    }
    
    #bottomTabs button.active {
      color: #0a84ff;
      transform: scale(1.1);
    }
    
    #bottomTabs button:active {
      transform: scale(0.9);
    }
  </style>
</head>
<body>

  <!-- ШАПКА С НАЗВАНИЕМ КАНАЛА -->
  <div id="header">
    <h1>COIN DIGEST</h1>
    <div class="subtitle">Крипто-дайджест</div>
  </div>

  <div id="content">
    <div id="newsList">
      <div class="loading">
        <div class="spinner"></div>
        <div>Загрузка новостей...</div>
      </div>
    </div>
    <div class="last-update" id="lastUpdate"></div>
  </div>

  <!-- ВКЛАДКИ ВНИЗУ -->
  <div id="bottomTabs">
    <button class="active" data-tab="all">📰</button>
    <button data-tab="main">🔥</button>
    <button data-tab="alt">🪙</button>
    <button data-tab="exclusive">🔒</button>
  </div>

  <script>
    let currentTab = 'all';
    let newsData = [];
    
    async function loadNews() {
      try {
        const response = await fetch('/api/news');
        const data = await response.json();
        newsData = data.news || [];
        
        if (data.stats.lastUpdate) {
          document.getElementById('lastUpdate').textContent = '🕐 ' + new Date(data.stats.lastUpdate).toLocaleString();
        }
        
        renderNews(currentTab);
      } catch(e) {
        document.getElementById('newsList').innerHTML = '<div class="error">❌ Ошибка загрузки новостей</div>';
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
        list.innerHTML = `
          <div class="empty">
            <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
            <div>Новостей в этой категории пока нет</div>
          </div>
        `;
        return;
      }
      
      list.innerHTML = filtered.map(item => {
        const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ru-RU') : 'Сегодня';
        return \`
          <div class="news-item">
            <a href="\${item.link}" target="_blank">\${item.title}</a>
            <div class="date">📅 \${date}</div>
          </div>
        \`;
      }).join('');
    }
    
    // Переключение вкладок
    document.querySelectorAll('#bottomTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#bottomTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderNews(currentTab);
      });
    });
    
    // Загружаем при старте
    loadNews();
    
    // Автообновление каждые 60 секунд
    setInterval(loadNews, 60000);
  </script>
</body>
</html>`;

// ========== АДМИН ПАНЕЛЬ ==========
const ADMIN_PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админ панель - COIN DIGEST</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1c1c1e;
      color: #f5f5f7;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { 
      font-size: 28px; 
      margin-bottom: 8px; 
      background: linear-gradient(135deg, #f5f5f7 0%, #0a84ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .sub { color: rgba(255,255,255,0.3); font-size: 13px; margin-bottom: 24px; }
    .card {
      background: rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .card h2 { font-size: 16px; margin-bottom: 12px; color: rgba(255,255,255,0.6); }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }
    .stat-box {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 14px;
      text-align: center;
    }
    .stat-box .num { font-size: 28px; font-weight: bold; color: #0a84ff; }
    .stat-box .label { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
    .news-item {
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 3px solid #0a84ff;
    }
    .news-item .title { font-size: 14px; }
    .news-item .meta { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }
    .btn {
      background: #0a84ff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: 0.2s;
    }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; }
    .update-time { font-size: 12px; color: rgba(255,255,255,0.25); margin-top: 8px; }
  </style>
</head>
<body>
  <h1>🔐 COIN DIGEST</h1>
  <div class="sub">Админ панель</div>
  
  <div class="card">
    <h2>📊 Статистика</h2>
    <div class="stat-grid" id="adminStats">
      <div class="stat-box"><div class="num" id="aTotal">0</div><div class="label">Всего</div></div>
      <div class="stat-box"><div class="num" id="aSent">0</div><div class="label">Отправлено</div></div>
      <div class="stat-box"><div class="num" id="aDup">0</div><div class="label">Дублей</div></div>
      <div class="stat-box"><div class="num" id="aCache">0</div><div class="label">В кеше</div></div>
    </div>
    <div class="update-time" id="aUpdate"></div>
  </div>
  
  <button class="btn" onclick="runFetch()" id="fetchBtn">🔄 Собрать новости</button>
  
  <div class="card" style="margin-top: 16px;">
    <h2>📰 Последние 20 новостей</h2>
    <div id="adminNews"></div>
  </div>
  
  <script>
    async function loadAdmin() {
      try {
        const res = await fetch('/api/admin-data');
        const data = await res.json();
        
        document.getElementById('aTotal').textContent = data.stats.total || 0;
        document.getElementById('aSent').textContent = data.stats.sent || 0;
        document.getElementById('aDup').textContent = data.stats.duplicates || 0;
        document.getElementById('aCache').textContent = data.cacheSize || 0;
        document.getElementById('aUpdate').textContent = '🕐 Обновлено: ' + new Date().toLocaleString();
        
        const newsDiv = document.getElementById('adminNews');
        if (data.news && data.news.length > 0) {
          newsDiv.innerHTML = data.news.map(item => \`
            <div class="news-item">
              <div class="title">\${item.title}</div>
              <div class="meta">\${item.category || 'Без категории'} | \${item.pubDate ? new Date(item.pubDate).toLocaleDateString('ru-RU') : 'Сегодня'}</div>
            </div>
          \`).join('');
        } else {
          newsDiv.innerHTML = '<div style="color: rgba(255,255,255,0.3);">Новостей пока нет</div>';
        }
      } catch(e) {
        document.getElementById('adminNews').innerHTML = '<div class="error">Ошибка загрузки</div>';
      }
    }
    
    async function runFetch() {
      const btn = document.getElementById('fetchBtn');
      btn.textContent = '⏳ Сбор...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/fetch', { method: 'POST' });
        const data = await res.json();
        alert('✅ Добавлено: ' + (data.newCount || 0) + ' новостей');
        loadAdmin();
      } catch(e) {
        alert('❌ Ошибка: ' + e.message);
      }
      btn.textContent = '🔄 Собрать новости';
      btn.disabled = false;
    }
    
    loadAdmin();
    setInterval(loadAdmin, 30000);
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
    
    // Админ панель (скрытая ссылка)
    if (path === '/admin-panel-xyz123') {
      return new Response(ADMIN_PAGE, {
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
