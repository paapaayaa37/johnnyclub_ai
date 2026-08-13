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

    // Отправляем в нейросеть только последние 10 сообщений переписки,
    // чтобы не раздувать запрос и не упираться в лимиты контекста.
    const recentMessages = messages.slice(-10);

    // Groq использует формат, совместимый с OpenAI: системный промпт — это
    // просто первое сообщение с ролью "system" в общем массиве messages.
    const groqMessages = [
      {
        role: 'system',
        content: 'Тебя зовут JohnnyClub Neuro. Ты дружелюбный ассистент внутри Telegram Mini App. Отвечай кратко, понятно и по делу на русском языке (если пользователь не пишет на другом языке — тогда отвечай на его языке).',
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
        max_tokens: 1024,
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

// Генерация изображений (бесплатно, без ключа — через Pollinations.ai)
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Нужно передать текст запроса (prompt)' });
    }

    const seed = Math.floor(Math.random() * 1_000_000);
    const encoded = encodeURIComponent(prompt.trim());
    // Pollinations сам генерирует картинку прямо по ссылке — ключ не нужен.
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&seed=${seed}&nologo=true`;

    // Проверяем, что картинка действительно сгенерировалась, прежде чем отдавать ссылку фронтенду.
    const check = await fetch(imageUrl);
    if (!check.ok) {
      return res.status(502).json({ error: 'Не удалось сгенерировать изображение, попробуйте ещё раз' });
    }

    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при генерации изображения' });
  }
});

// health-check, удобно для Render/Railway
app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
