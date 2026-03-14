export const Colors = {
  teal: '#1A9E8F',
  tealLight: '#E8F5F3',
  tealDark: '#147A6E',
  warm: '#F4A261',
  warmLight: '#FFF3E6',
  coral: '#E8927C',
  dark: '#1B2A3D',
  cream: '#FBF9F6',
  sand: '#F2EDE7',
  grey: '#8B9AAD',
  greyLight: '#C8D1DC',
  green: '#6BA368',
  blue: '#7B9ACC',
  red: '#C53030',
  redLight: '#FDE8E8',
  gold: '#D4A843',
  goldLight: '#FFF8E1',
}

export const Fonts = {
  heading: 'System',
  body: 'System',
}

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 50,
}

export const KP_TIERS = [
  { name: 'Starter', min: 0, icon: '🌱', color: Colors.green, perks: 'Community feed, basic matching', dailyLimit: 3 },
  { name: 'Mate', min: 200, icon: '⚡', color: Colors.blue, perks: 'Mate badge, priority in browse', dailyLimit: 3 },
  { name: 'Baller', min: 1000, icon: '🔥', color: Colors.warm, perks: '5 listings/day, early access', dailyLimit: 5 },
  { name: 'MVP', min: 5000, icon: '💎', color: Colors.coral, perks: 'Boosted listings, custom profile', dailyLimit: 7 },
  { name: 'Icon', min: 15000, icon: '👑', color: '#C77DBA', perks: '10 listings/day, monthly giveaway', dailyLimit: 10 },
] as const

export const CATEGORIES = ['food', 'clothing', 'household', 'baby', 'furniture', 'service', 'other'] as const
export type Category = typeof CATEGORIES[number]

export const CATEGORY_ICONS: Record<Category, string> = {
  food: '🥬',
  clothing: '🧥',
  household: '🏠',
  baby: '👶',
  furniture: '🛋️',
  service: '🛠️',
  other: '📦',
}
