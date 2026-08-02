I'm building "Atlas AI" — a Telegram bot that acts as a personalized finance
news assistant. Build this in PHASES, stopping after each phase for me to
test before continuing. Do not skip ahead to a later phase.

STACK: Node.js, Express, Telegraf (Telegram bot lib, polling mode not
webhook), Prisma ORM, PostgreSQL (Neon), OpenAI SDK, node-cron.

ARCHITECTURE OVERVIEW (for your context):
- 4 DB tables: User, Preference, Message, NewsItem
- 3 pipelines: (1) onboarding — new user, greet, ask questions via inline
  buttons, skippable, save to Preference; (2) cron job — hourly fetch of
  finance news into NewsItem, plus per-user scheduled briefing send based
  on Preference.briefingTime; (3) chat — user asks a question, load
  Preference + last 20 Messages + last 2-3 days of NewsItem, build a
  system prompt, call OpenAI, save both turns to Message, reply.

Use the file structure below exactly:

[paste the file structure block above here]

---

PHASE 1 — Project setup + DB schema
- Initialize package.json, install: express, telegraf, @prisma/client,
  prisma, openai, node-cron, dotenv, axios
- Create prisma/schema.prisma with these models:
  - User: id, telegramId (unique), createdAt
  - Preference: id, userId (FK), occupation, interests (String[] or
    Json), industries (String[] or Json), briefingTime (String, nullable
    — e.g. "08:00" or null for "don't send"), onboardingComplete (Bool,
    default false)
  - Message: id, userId (FK), role ("user" | "assistant"), content
    (String), createdAt
  - NewsItem: id, title, summary, company (String, nullable), category
    (String, nullable), sourceUrl, publishedAt, createdAt
- Create src/db/prisma.js as a singleton Prisma client
- Create src/config/env.js validating: BOT_TOKEN, DATABASE_URL,
  OPENAI_API_KEY, NEWS_API_KEY
- Create src/server.js: bare Express app with GET /health returning
  200 "ok"
- Create .env.example listing the 4 required vars
STOP HERE. I'll run `npx prisma migrate dev` and confirm the DB before
Phase 2.

---

PHASE 2 — Basic bot connection (no logic yet)
- src/bot/bot.js: Telegraf instance from BOT_TOKEN, bot.start() replies
  "Hey, I'm Atlas 👋" as a placeholder, bot.launch() in polling mode
- Wire bot.launch() into server.js so starting the server starts the bot
- Confirm graceful shutdown (bot.stop() on SIGINT/SIGTERM)
STOP HERE. I'll message the bot on Telegram and confirm it replies
before Phase 3.

---

PHASE 3 — Onboarding pipeline
- src/bot/keyboards/onboarding.keyboards.js: inline keyboard layouts for
  each onboarding question (interests as multi-select buttons, briefing
  time as single-select: 8 AM / 9 AM / 7 PM / Don't send)
- src/bot/scenes/onboarding.scene.js: Telegraf Scene (wizard) —
  1. Greet: "Hi, I'm Atlas. I track finance news and send personalized
     briefings." with inline button "Get started" / "Skip"
  2. If not skipped: ask occupation (free text), interests (buttons,
     multi-select), industries (buttons, multi-select)
  3. Ask briefing time (buttons: 8 AM/9 AM/7 PM/Don't send)
  4. On completion (or skip): upsert User + Preference
     (onboardingComplete: true), confirm to user
- src/services/preference.service.js: getPreference(userId),
  upsertPreference(userId, data)
- Wire scene into bot.js: trigger on /start or first message from a
  user with no existing Preference row
STOP HERE. I'll walk through onboarding on Telegram and check the DB
rows before Phase 4.

---

PHASE 4 — News ingestion cron job
- src/services/news.service.js: fetchLatestNews() — call [NAME YOUR
  CHOSEN NEWS API HERE] via axios, normalize response into
  {title, summary, company, category, sourceUrl, publishedAt}, dedupe
  against existing NewsItem rows by sourceUrl before inserting
- src/jobs/fetchNews.job.js: node-cron schedule (hourly), calls
  news.service.fetchLatestNews(), logs count inserted
- Wire the cron start into server.js
STOP HERE. I'll check NewsItem rows populate correctly before Phase 5.

---

PHASE 5 — AI orchestration + chat pipeline
- src/services/message.service.js: saveMessage(userId, role, content),
  getRecentMessages(userId, limit=20) — returns oldest-first (fetch
  desc, then reverse)
- src/services/ai.service.js:
  - buildSystemPrompt(preference, newsItems) — dynamic prompt template
    using preference.interests/industries and injecting recent news as
    JSON, instructing the model to explain "why this matters" and keep
    replies concise
  - getChatResponse(userId, userMessage) — full pipeline: load
    preference, load last 20 messages, load NewsItem from last 3 days,
    build prompt, call OpenAI chat.completions, return reply text
- src/controllers/chat.controller.js: on incoming text message (for
  onboarded users), call ai.service.getChatResponse(), save both user
  msg and reply via message.service, reply via ctx.reply()
- Wire into bot.js: bot.on('text', ...) routes to chat.controller if
  onboardingComplete is true
STOP HERE. I'll test asking questions on Telegram before Phase 6.

---

PHASE 6 — Scheduled briefings
- src/jobs/briefing.job.js: node-cron running every 15-30 min, checks
  all Preferences where briefingTime matches current time (rounded),
  and briefingTime is not null — for each, generate a personalized
  briefing using ai.service (reuse buildSystemPrompt/similar), send via
  bot.telegram.sendMessage(telegramId, text)
- Wire into server.js
STOP HERE. I'll test with a near-future briefingTime before Phase 7.

---

PHASE 7 — Polish
- Add typing indicator (ctx.sendChatAction('typing')) before AI replies
  in chat.controller
- Add try/catch error handling around all OpenAI calls and external
  news API calls, with user-friendly fallback messages
- Add a basic /help command
- Review formatting of all bot messages (use Telegram Markdown, keep
  concise per the product brief)

For every phase, keep code clean, comment non-obvious logic, and use
async/await with proper error handling — no unhandled promise
rejections. Do not add features beyond what's specified in each phase.