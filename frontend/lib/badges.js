export const HANDSHAKE_LEVELS = {
  green: { emoji: '🤝', color: '#4CAF50', label: 'Green' },
  green_plus: { emoji: '🤝', color: '#8BC34A', label: 'Green Pro' },
  'green-pro': { emoji: '🤝', color: '#8BC34A', label: 'Green Pro' },
  blue: { emoji: '🤝', color: '#2196F3', label: 'Blue' },
  blue_plus: { emoji: '🤝', color: '#2196F3', label: 'Blue+' },
  purple: { emoji: '🤝', color: '#9C27B0', label: 'Purple' },
  purple_plus: { emoji: '🤝', color: '#9C27B0', label: 'Purple+' },
  red: { emoji: '🤝', color: '#F44336', label: 'Red' },
  red_plus: { emoji: '🤝', color: '#F44336', label: 'Red+' },
  gold: { emoji: '🤝', color: '#FFD700', label: 'Gold' },
  gold_plus: { emoji: '🤝', color: '#FFD700', label: 'Gold+' },
};

export const USERNAME_GRADIENTS = [
  { id: 'none', name: 'Обычный', value: 'none' },
  { id: 'fire', name: 'Огонь', value: 'linear-gradient(90deg, #FF6B35, #F7931E)' },
  { id: 'ocean', name: 'Океан', value: 'linear-gradient(90deg, #0077B6, #00B4D8)' },
  { id: 'aurora', name: 'Аврора', value: 'linear-gradient(90deg, #7B2FBE, #00F5D4)' },
  { id: 'sunset', name: 'Закат', value: 'linear-gradient(90deg, #FF512F, #DD2476)' },
  { id: 'forest', name: 'Лес', value: 'linear-gradient(90deg, #134E5E, #71B280)' },
  { id: 'gold', name: 'Золото', value: 'linear-gradient(90deg, #F5A623, #F7DC6F)' },
  { id: 'neon', name: 'Неон', value: 'linear-gradient(90deg, #00F260, #0575E6)' },
];

export function getGradientStyle(gradientId) {
  const gradient = USERNAME_GRADIENTS.find((item) => item.id === gradientId);
  if (!gradient || gradient.value === 'none') {
    return {};
  }
  return {
    backgroundImage: gradient.value,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
}
