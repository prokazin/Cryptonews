const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8422981212:AAFqUt5juqdC_l64q7FACOBw-mFL4f0hN8Y';
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@your_channel_username';

export async function sendToTelegram(message, category = '') {
  if (!CHANNEL_ID || CHANNEL_ID === '@your_channel_username') {
    console.log('⚠️ НЕ НАСТРОЕН CHANNEL_ID!');
    console.log('📤 Тестовое сообщение:', message);
    return { ok: false, error: 'CHANNEL_ID not set' };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: `📰 ${category ? '[' + category + '] ' : ''}${message}`,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Ошибка Telegram:', data);
    }
    return data;
  } catch (error) {
    console.error('❌ Ошибка отправки:', error);
    return { ok: false, error: error.message };
  }
}

// Функция для получения chat_id
export async function getUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;
  const response = await fetch(url);
  return response.json();
}
