atlas-ai/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── bot/
│   │   ├── bot.js                    → Telegraf init, bot.launch()
│   │   ├── scenes/
│   │   │   └── onboarding.scene.js   → wizard: greet → questions → schedule → save
│   │   └── keyboards/
│   │       └── onboarding.keyboards.js → inline button layouts
│   ├── controllers/
│   │   └── chat.controller.js        → the "user asks a question" pipeline
│   ├── services/
│   │   ├── news.service.js           → fetch() news from external API, dedupe
│   │   ├── preference.service.js     → CRUD for Preference table
│   │   ├── message.service.js        → save/load conversation history
│   │   └── ai.service.js             → openai client, prompt builder, chat completion call
│   ├── jobs/
│   │   ├── fetchNews.job.js          → cron: hourly news fetch → NEWS_ITEM
│   │   └── briefing.job.js           → cron: per-user scheduled briefing send
│   ├── db/
│   │   └── prisma.js                 → prisma client singleton
│   ├── config/
│   │   └── env.js                    → validate/export env vars
│   └── server.js                     → express app, health route, starts bot + cron
├── .env
├── .env.example
├── package.json
└── README.md