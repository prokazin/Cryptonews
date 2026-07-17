import { getUpdates } from '../utils/telegram.js';

export default async function handler(req, res) {
  try {
    const data = await getUpdates();
    const messages = data.result || [];
    const chats = messages.map(msg => ({
      chat_id: msg.message?.chat?.id,
      chat_type: msg.message?.chat?.type,
      title: msg.message?.chat?.title || msg.message?.chat?.username || 'Личный чат',
      text: msg.message?.text?.substring(0, 50) || ''
    }));

    res.json({
      instructions: '👇 Отправьте любое сообщение в ваш канал или боту, затем обновите эту страницу',
      chats: chats,
      tip: 'Скопируйте chat_id с минусом для канала (например: -1001234567890)'
    });
  } catch (error) {
    res.json({ error: error.message });
  }
}
