// Простой сервер для Telegram Mini App с нейросетью (Claude API)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Раздаём фронтенд (папку public) как статику
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

if (!GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY не задан! Добавьте его в файл .env');
}

// Главный endpoint, который вызывает фронтенд
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Нужно передать массив messages' });
    }

    // Отправляем в нейросеть только последние 20 сообщений переписки,
    // чтобы не раздувать запрос и не упираться в лимиты контекста.
    const recentMessages = messages.slice(-20);

    // Groq использует формат, совместимый с OpenAI: системный промпт — это
    // просто первое сообщение с ролью "system" в общем массиве messages.
    const groqMessages = [
      {
        role: 'system',
        content: `Тебя зовут JohnnyClub Neuro. Ты ассистент внутри Telegram Mini App, который помогает с учёбой и работой — отвечаешь на фактические вопросы и делаешь расчёты.

Главный приоритет — точность. Соблюдай строго:

1. Если нужно посчитать — считай пошагово, показывай промежуточные действия, а не только финальный ответ. В конце ещё раз проверь итог, пересчитав его другим способом или прикинув правдоподобность (порядок величины).
2. Если не уверен в факте, дате, цифре или названии — прямо скажи, что не уверен, вместо того чтобы гадать. Не выдумывай источники, цитаты, статьи законов, номера версий и т.п.
3. Если вопрос неоднозначный или в нём не хватает данных для точного ответа — сначала уточни у пользователя, что имеется в виду, вместо того чтобы отвечать наугад.
4. Не сглаживай ошибки в рассуждении ради красивого ответа — если на каком-то шаге пришёл к неопределённости, честно об этом скажи.
5. Отвечай кратко и по делу, без лишней воды, но не в ущерб точности — если задача сложная, лучше развёрнутый и верный ответ, чем короткий и рискующий быть неверным.
6. Отвечай на русском языке, если пользователь не пишет на другом — тогда отвечай на его языке.`,
      },
      ...recentMessages,
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1536,
        temperature: 0.2,
        messages: groqMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Ошибка нейросети' });
    }

    const reply = data.choices?.[0]?.message?.content || '';

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// health-check, удобно для Render/Railway
app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
