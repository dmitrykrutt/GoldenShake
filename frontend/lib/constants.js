export const RARITY_GREEN = 'green';
export const RARITY_BLUE = 'blue';
export const RARITY_PURPLE = 'purple';
export const RARITY_RED = 'red';
export const RARITY_GOLD = 'gold';

export const RARITIES = [
  RARITY_GREEN,
  RARITY_BLUE,
  RARITY_PURPLE,
  RARITY_RED,
  RARITY_GOLD,
];

export const RARITY_META = {
  green: { label: 'Зеленый', color: '#3FB950' },
  blue: { label: 'Синий', color: '#58A6FF' },
  purple: { label: 'Фиолетовый', color: '#BC8CFF' },
  red: { label: 'Красный', color: '#FF7B72' },
  gold: { label: 'Золотой', color: '#D29922' },
};

export const EXCHANGE_RATES = {
  blue: { from: 'green', amount: 50 },
  purple: { from: 'blue', amount: 10 },
  red: { from: 'purple', amount: 10 },
  gold: { from: 'red', amount: 10 },
};

export const LEVEL_THRESHOLDS = {
  green: { rarity: 'green', min: 0 },
  green_plus: { rarity: 'green', min: 100 },
  blue: { rarity: 'blue', min: 1 },
  blue_plus: { rarity: 'blue', min: 25 },
  purple: { rarity: 'purple', min: 1 },
  purple_plus: { rarity: 'purple', min: 25 },
  red: { rarity: 'red', min: 1 },
  red_plus: { rarity: 'red', min: 25 },
  gold: { rarity: 'gold', min: 1 },
  gold_plus: { rarity: 'gold', min: 10 },
};

export const LEVEL_ORDER = [
  'gold_plus',
  'gold',
  'red_plus',
  'red',
  'purple_plus',
  'purple',
  'blue_plus',
  'blue',
  'green_plus',
  'green',
];

export const CRYPTO_CURRENCIES = ['USDT', 'TON'];

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
