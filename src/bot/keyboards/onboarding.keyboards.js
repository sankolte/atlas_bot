import { Markup } from 'telegraf';

export const OCCUPATION_OPTIONS = [
  '💻 Tech / Developer',
  '🎓 Student',
  '🚀 Founder / Entr.',
  '📊 Investor / Trader',
  '💼 Executive / Management',
  '🏦 Finance / Banking',
  '✏️ Type Custom Role',
];

export const DEFAULT_INTEREST_OPTIONS = [
  'Macroeconomics',
  'Stocks & Equities',
  'Crypto & Web3',
  'Real Estate',
  'Venture Capital & Startups',
  'Personal Finance',
];

export const DEFAULT_INDUSTRY_OPTIONS = [
  'Technology & AI',
  'Banking & Fintech',
  'Energy & Clean Tech',
  'Healthcare',
  'E-Commerce & Retail',
  'EV & Automotive',
];

export const DEFAULT_UPDATE_TYPE_OPTIONS = [
  '🌅 Morning Briefing',
  '🌆 Evening Summary',
  '⚡ Breaking News',
  '📅 Weekly Digest',
];

export const INTEREST_OPTIONS = DEFAULT_INTEREST_OPTIONS;
export const INDUSTRY_OPTIONS = DEFAULT_INDUSTRY_OPTIONS;
export const UPDATE_TYPE_OPTIONS = DEFAULT_UPDATE_TYPE_OPTIONS;

export const TIME_OPTIONS = [
  { label: '🌅 8:00 AM', value: '08:00' },
  { label: '☀️ 9:00 AM', value: '09:00' },
  { label: '🌆 5:00 PM', value: '17:00' },
  { label: '🌙 7:00 PM', value: '19:00' },
  { label: '❌ Don\'t send', value: 'none' },
];

export function getStartKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🚀 Get Started', 'start_onboarding'),
      Markup.button.callback('⏭️ Skip', 'skip_onboarding'),
    ],
  ]);
}

export function getOccupationKeyboard() {
  const buttons = OCCUPATION_OPTIONS.map((item, idx) =>
    Markup.button.callback(item, `select_occ_${idx}`)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
//hii
  return Markup.inlineKeyboard(rows);
}

export function getInterestsKeyboard(selected = []) {
  // Combine defaults and any custom added items
  const allOptions = Array.from(new Set([...DEFAULT_INTEREST_OPTIONS, ...selected]));

  const buttons = allOptions.map((item) => {
    const isSelected = selected.includes(item);
    const label = `${isSelected ? '✅ ' : ''}${item}`;
    return Markup.button.callback(label, `toggle_interest_${item}`);
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([
    Markup.button.callback('✏️ Add Custom', 'add_custom_interest'),
    Markup.button.callback('Done ➡️', 'done_interests'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getIndustriesKeyboard(selected = []) {
  const allOptions = Array.from(new Set([...DEFAULT_INDUSTRY_OPTIONS, ...selected]));

  const buttons = allOptions.map((item) => {
    const isSelected = selected.includes(item);
    const label = `${isSelected ? '✅ ' : ''}${item}`;
    return Markup.button.callback(label, `toggle_industry_${item}`);
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([
    Markup.button.callback('✏️ Add Custom', 'add_custom_industry'),
    Markup.button.callback('Done ➡️', 'done_industries'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getUpdateTypesKeyboard(selected = []) {
  const allOptions = Array.from(new Set([...DEFAULT_UPDATE_TYPE_OPTIONS, ...selected]));

  const buttons = allOptions.map((item) => {
    const isSelected = selected.includes(item);
    const label = `${isSelected ? '✅ ' : ''}${item}`;
    return Markup.button.callback(label, `toggle_update_${item}`);
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([
    Markup.button.callback('✏️ Add Custom', 'add_custom_update'),
    Markup.button.callback('Done ➡️', 'done_updates'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getBriefingTimeKeyboard() {
  const rows = TIME_OPTIONS.map((opt) => [
    Markup.button.callback(opt.label, `select_time_${opt.value}`),
  ]);

  rows.push([
    Markup.button.callback('✏️ Custom Time (e.g. 10:30)', 'select_time_custom'),
  ]);

  return Markup.inlineKeyboard(rows);
}
