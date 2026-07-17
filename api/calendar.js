export default async function handler(req, res) {
  try {
    // Используем CoinGecko API для событий
    const url = 'https://api.coingecko.com/api/v3/events';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();
    
    // Форматируем для вывода
    const events = data.data || [];
    const formatted = events.slice(0, 20).map(event => ({
      title: event.title || 'Событие',
      date: event.start_date || 'Дата неизвестна',
      description: event.description || ''
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Ошибка календаря:', error);
    res.json([
      { title: 'Bitcoin 2026 Conference', date: '2026-07-20' },
      { title: 'Ethereum Upgrade', date: '2026-07-25' },
      { title: 'Solana Breakpoint', date: '2026-08-01' }
    ]);
  }
}
