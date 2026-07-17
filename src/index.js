// ========== КОНФИГУРАЦИЯ ==========
const BOT_TOKEN = '8422981212:AAFqUt5juqdC_l64q7FACOBw-mFL4f0hN8Y';
const CHANNEL_ID = '@your_channel_username'; // ЗАМЕНИТЕ НА ВАШ

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

// ========== ПЕРЕВОД НА РУССКИЙ (через MyMemory API) ==========
async function translateToRussian(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
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
        // Переводим заголовок на русский
        const translatedTitle = await translateToRussian(title);
        items.push({ title: translatedTitle, link, pubDate, id: guid });
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
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    #content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      padding-bottom: 80px;
    }
    
    #content::-webkit-scrollbar {
      width: 4px;
    }
    #content::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.3);
      border-radius: 10px;
    }
    
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .stat-item {
      text-align: center;
    }
    .stat-number { font-size: 20px; font-weight: bold; color: #0a84ff; }
    .stat-label { font-size: 10px; color: rgba(255,255,255,0.4); }
    
    .news-item {
      background: rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 14px 16px;
      margin-bottom: 10px;
      border: 1px solid rgba(255,255,255,0.05);
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
      font-size: 11px;
      color: rgba(255,255,255,0.25);
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
      width: auto;
      max-width: 90%;
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
    
    .error { color: #ff453a; text-align: center; padding: 20px; }
    .empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); }
  </style>
</head>
<body>

  <div id="content">
    <div class="stats-bar" id="stats">
      <div class="stat-item">
        <div class="stat-number" id="totalNews">0</div>
        <div class="stat-label">Всего</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" id="sentNews">0</div>
        <div class="stat-label">Отправлено</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" id="dupNews">0</div>
        <div class="stat-label">Дублей</div>
      </div>
    </div>
    
    <div id="newsList">
      <div class="loading">⏳ Загрузка...</div>
    </div>
    <div class="last-update" id="lastUpdate"></div>
  </div>

  <!-- ВКЛАДКИ ВНИЗУ (только иконки) -->
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
        
        document.getElementById('totalNews').textContent = data.stats.total || 0;
        document.getElementById('sentNews').textContent = data.stats.sent || 0;
        document.getElementById('dupNews').textContent = data.stats.duplicates || 0;
        
        if (data.stats.lastUpdate) {
          document.getElementById('lastUpdate').textContent = '🕐 ' + new Date(data.stats.lastUpdate).toLocaleString();
        }
        
        renderNews(currentTab);
      } catch(e) {
        document.getElementById('newsList').innerHTML = '<div class="error">❌ Ошибка загрузки</div>';
      }
    }
    
    function renderNews(tab) {
      const list = document.getElementById('newsList');
      let filtered = newsData;
      
      if (tab === 'main') filtered = newsData.filter(n => n.category === 'Основные');
      else if (tab === 'alt') filtered = newsData.filter(n => n.category === 'Альткоины');
      else if (tab === 'exclusive') filtered = newsData.filter(n => n.category === 'Эксклюзив');
      
      if (filtered.length === 0) {
        list.innerHTML = '<div class="empty">📭 Новостей нет</div>';
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
    
    // Переключение вкладок (только иконки)
    document.querySelectorAll('#bottomTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#bottomTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderNews(currentTab);
      });
    });
    
    // Автообновление каждые 60 секунд
    loadNews();
    setInterval(loadNews, 60000);
  </script>
</body>
</html>`;

// ========== АДМИН ПАНЕЛЬ (скрытая ссылка) ==========
const ADMIN_PAGE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админ панель</title>
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
    h1 { font-size: 28px; margin-bottom: 20px; color: #0a84ff; }
    .card {
      background: rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .card h2 { font-size: 18px; margin-bottom: 12px; color: rgba(255,255,255,0.7); }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }
    .stat-box {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .stat-box .num { font-size: 32px; font-weight: bold; color: #0a84ff; }
    .stat-box .label { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
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
    }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; }
    .refresh-btn { margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>🔐 Админ панель</h1>
  
  <div class="card">
    <h2>📊 Статистика</h2>
    <div class="stat-grid" id="adminStats">
      <div class="stat-box"><div class="num" id="aTotal">0</div><div class="label">Всего новостей</div></div>
      <div class="stat-box"><div class="num" id="aSent">0</div><div class="label">Отправлено</div></div>
      <div class="stat-box"><div class="num" id="aDup">0</div><div class="label">Дублей</div></div>
      <div class="stat-box"><div class="num" id="aCache">0</div><div class="label">В кеше</div></div>
    </div>
    <div style="margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.3);" id="aUpdate"></div>
  </div>
  
  <button class="btn refresh-btn" onclick="runFetch()">🔄 Собрать новости сейчас</button>
  
  <div class="card">
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
      const btn = document.querySelector('.refresh-btn');
      btn.textContent = '⏳ Сбор...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/fetch', { method: 'POST' });
        const data = await res.json();
        alert('✅ Добавлено: ' + (data.newCount || 0) + ' новостей');
        loadAdmin();
      } catch(e) {
        alert('❌ Ошибка');
      }
      btn.textContent = '🔄 Собрать новости сейчас';
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
    
    // ===== ГЛАВНАЯ СТРАНИЦА =====
    if (path === '/' || path === '') {
      return new Response(HTML_PAGE, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // ===== АДМИН ПАНЕЛЬ (скрытая ссылка) =====
    // ДОСТУП ТОЛЬКО ПО ССЫЛКЕ: /admin-panel-xyz123
    if (path === '/admin-panel-xyz123') {
      return new Response(ADMIN_PAGE, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // ===== API: Данные для админки =====
    if (path === '/api/admin-data') {
      const allNews = Array.from(newsStore.values());
      const sorted = allNews.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return Response.json({
        stats: stats,
        cacheSize: newsStore.size,
        news: sorted.slice(0, 20)
      });
    }
    
    // ===== API: Получить новости =====
    if (path === '/api/news') {
      const allNews = Array.from(newsStore.values());
      const sorted = allNews.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return Response.json({
        stats: stats,
        news: sorted.slice(0, 100)
      });
    }
    
    // ===== API: Сбор новостей =====
    if (path === '/api/fetch') {
      const result = await fetchNews();
      return Response.json({
        success: true,
        ...result
      });
    }
    
    // ===== API: Статистика =====
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
