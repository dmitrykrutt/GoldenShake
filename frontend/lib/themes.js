export const THEMES = [
  { id: 'midnight', name: 'Midnight', primary: '#6C63FF', accent: '#FF6584', bg: '#0D0D1A' },
  { id: 'golden', name: 'Golden Hour', primary: '#F5A623', accent: '#F76B1C', bg: '#1A1200' },
  { id: 'emerald', name: 'Emerald', primary: '#00C896', accent: '#00E5FF', bg: '#001A12' },
  { id: 'crimson', name: 'Crimson', primary: '#E63946', accent: '#FF6B6B', bg: '#1A0005' },
  { id: 'ocean', name: 'Ocean', primary: '#0077B6', accent: '#00B4D8', bg: '#00080F' },
  { id: 'sakura', name: 'Sakura', primary: '#FF85A1', accent: '#FFC2D1', bg: '#1A0010' },
  { id: 'graphite', name: 'Graphite', primary: '#9E9E9E', accent: '#E0E0E0', bg: '#111111' },
  { id: 'aurora', name: 'Aurora', primary: '#7B2FBE', accent: '#00F5D4', bg: '#080318' },
];

export function resolveTheme(themeId) {
  return THEMES.find((t) => t.id === themeId) || THEMES[0];
}
