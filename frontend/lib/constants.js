export const RARITIES = ['green', 'blue', 'purple', 'red', 'gold'];

export const RARITY_META = {
  green: { label: 'Green', color: '#3FB950', ring: 'ring-rarity-green/50' },
  blue: { label: 'Blue', color: '#3B82F6', ring: 'ring-rarity-blue/50' },
  purple: { label: 'Purple', color: '#A855F7', ring: 'ring-rarity-purple/50' },
  red: { label: 'Red', color: '#EF4444', ring: 'ring-rarity-red/50' },
  gold: { label: 'Gold', color: '#FFD700', ring: 'ring-rarity-gold/50' },
};

export const EXCHANGE_RATES = {
  blue: { from: 'green', amount: 50 },
  purple: { from: 'blue', amount: 10 },
  red: { from: 'purple', amount: 10 },
  gold: { from: 'red', amount: 10 },
};

export const LEVEL_META = {
  green: { label: 'Green Handshake', rarity: 'green' },
  green_plus: { label: 'Green+ Handshake', rarity: 'green' },
  blue: { label: 'Blue Handshake', rarity: 'blue' },
  blue_plus: { label: 'Blue+ Handshake', rarity: 'blue' },
  purple: { label: 'Purple Handshake', rarity: 'purple' },
  purple_plus: { label: 'Purple+ Handshake', rarity: 'purple' },
  red: { label: 'Red Handshake', rarity: 'red' },
  red_plus: { label: 'Red+ Handshake', rarity: 'red' },
  gold: { label: 'Gold Handshake', rarity: 'gold' },
  gold_plus: { label: 'Gold+ Handshake', rarity: 'gold' },
};

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'protonmail.com',
  'tutanota.com',
  'tutamail.com',
  'mail.ru',
];

export const CRYPTO_CURRENCIES = ['USDT', 'TON', 'BTC', 'ETH', 'LTC', 'TRX', 'BNB'];

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
