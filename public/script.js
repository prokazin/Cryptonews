let currentTab = 'fresh';
const content = document.getElementById('content');

const tabs = document.querySelectorAll('#tabs button');
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    loadTab(currentTab);
  });
});

async function loadTab(tab) {
  content.innerHTML = 'Загрузка...';
  let url = '/api/fetch-news';
  if (tab === 'calendar') url = '/api/calendar';
  if (tab === 'admin') url = '/api/admin';

  try {
    const res = await fetch(url);
    const data = await res.json();
    render(tab, data);
  } catch (e) {
    content.innerHTML = 'Ошибка загрузки';
  }
}

function render(tab, data) {
  if (tab === 'calendar') {
    content.innerHTML = data.map(e =>
      `<div class="news-item">📅 ${e.title}<div class="date">${e.date}</div></div>`
    ).join('');
    return;
  }

  // Для новостей (ожидаем массив)
  const items = data.news || data || [];
  content.innerHTML = items.map(item =>
    `<div class="news-item">
      <a href="${item.link}" target="_blank">${item.title}</a>
      <div class="date">${item.pubDate || ''}</div>
    </div>`
  ).join('') || 'Новостей пока нет';
}

// Первая загрузка
loadTab('fresh');
