const BOT_TOKEN = '8422981212:AAFqUt5juqdC_l64q7FACOBw-mFL4f0hN8Y';
const CHANNEL_ID = '@your_channel_username'; // замените

export async function sendToTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHANNEL_ID,
      text: message,
      parse_mode: 'HTML'
    })
  });
  return response.json();
}
