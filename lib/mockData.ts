export const TIERS = [
  { name: 'Seedling', min: 0, icon: '🌱', color: '#6BA368', perks: 'Community feed, basic matching' },
  { name: 'Helper', min: 200, icon: '💙', color: '#7B9ACC', perks: 'Helper badge, community feed' },
  { name: 'Guardian', min: 1000, icon: '🛡️', color: '#E8B84B', perks: 'Partner discounts' },
  { name: 'Beacon', min: 5000, icon: '✨', color: '#E8927C', perks: 'Featured in feed' },
  { name: 'Luminary', min: 15000, icon: '🌟', color: '#C77DBA', perks: '$25 gift card monthly' },
]

export const CAT_ICONS: Record<string, string> = {
  food: '🥦', clothing: '🧥', household: '🏠', baby: '👶',
  furniture: '🛋️', service: '🛠️', other: '📦',
}

export const ALL_ADDRESSES = [
  '1 Tower Street, Inglewood 4330', '7 Tower Street, Inglewood 4330',
  '10 Kelly Street, Inglewood 4330', '12 Brown Street, Inglewood 4330',
  '15 Rata Street, Inglewood 4330', '22 Matai Street, Inglewood 4330',
  '28 Richmond Street, Inglewood 4330', '33 James Street, Inglewood 4330',
  '42 Tower Street, Inglewood 4330', '55 Rimu Street, Inglewood 4330',
  '63 Brook Street, Inglewood 4330', '80 Rata Street, Inglewood 4330',
  '5 Standish Street, Inglewood 4330', '18 Mould Street, Inglewood 4330',
  '75 Devon Street East, New Plymouth 4310',
]

export const SCAM_WORDS = ['pay first', 'bank transfer', 'send money', 'western union', 'gift card', 'crypto', 'bitcoin', 'paypal']

export const REPORT_CATEGORIES = [
  'Inappropriate behaviour', 'Harassment', 'No-show', 'Suspicious activity',
  'Underage user', 'Inappropriate photo', 'Scam or money request', 'Other',
]

export const RESOURCES = {
  suburb: 'Inglewood, Taranaki',
  nearbyCount: 47,
  foodbanks: [
    { name: 'Inglewood Community Foodbank', distance: '0.4 km', address: '32 Rata St, Inglewood', hours: 'Mon, Wed, Fri 9am-1pm', icon: '🏛️', lat: -39.1478, lng: 174.1834 },
    { name: 'Salvation Army New Plymouth', distance: '12 km', address: '83 Powderham St, New Plymouth', hours: 'Mon-Fri 9am-4pm', icon: '🏛️', lat: -39.0556, lng: 174.0752 },
  ],
  communityGivers: [
    { name: 'Sarah T.', distance: '0.3 km', item: 'Fresh veges and eggs', freshness: 'From the garden today', icon: '🥦' },
    { name: 'Inglewood Community Kitchen', distance: '0.6 km', item: 'Community meal tonight 5:30pm', freshness: 'Fresh', icon: '🍲' },
  ],
  dropPoints: [
    { name: 'Inglewood Community Centre', distance: '0.3 km', hours: '8am-5pm', address: 'Inglewood Community Centre', lat: -39.1478, lng: 174.1834 },
    { name: 'Inglewood Library', distance: '0.4 km', hours: '9:30am-5pm', address: 'Inglewood Library', lat: -39.1482, lng: 174.1840 },
    { name: 'Fun Ho! Toys Building', distance: '0.5 km', hours: '10am-4pm', address: 'Fun Ho Toys Inglewood', lat: -39.1475, lng: 174.1830 },
  ],
}

export type ItemStatus = 'listed' | 'matched' | 'arranged' | 'ready' | 'completed'
export type ItemType = 'give' | 'need'

export interface MyItem {
  id: number
  type: ItemType
  item: string
  category: string
  status: ItemStatus
  otherPerson: string | null
  handoverType: string | null
  dropPoint: string | null
  dropTime: string | null
  note: string | null
  photos: string[]
  created: string
  availableUntil?: string
  foodExpiry?: string | null
  isLargeItem?: boolean
  urgency?: 'whenever' | 'soon' | 'urgent'
  matchExpiry?: number
  offerInReturn?: string
}

export const INITIAL_ITEMS: MyItem[] = [
  { id: 1, type: 'give', item: '3x Tins of Baked Beans', category: 'food', status: 'arranged', otherPerson: 'Jordan M.', handoverType: 'droppoint', dropPoint: 'Inglewood Community Centre', dropTime: 'Today, 3-5pm', note: null, photos: [], created: '2 hrs ago', availableUntil: 'This week', isLargeItem: false },
  { id: 2, type: 'give', item: 'Kids Winter Jacket (Size 6)', category: 'clothing', status: 'listed', otherPerson: null, handoverType: null, dropPoint: null, dropTime: null, note: 'Good condition, barely worn', photos: ['https://placehold.co/400x300/E8F5F3/147A6E?text=Jacket+Front', 'https://placehold.co/400x300/E8F5F3/147A6E?text=Jacket+Back'], created: 'Yesterday', availableUntil: '2 weeks', isLargeItem: false },
  { id: 3, type: 'need', item: 'Nappies (Size 3)', category: 'baby', status: 'matched', otherPerson: 'Priya R.', handoverType: null, dropPoint: null, dropTime: null, note: 'Any brand fine', photos: [], created: '5 hrs ago', urgency: 'soon', matchExpiry: Date.now() + 24 * 60 * 60 * 1000 },
  { id: 4, type: 'give', item: '3-Seater Couch', category: 'furniture', status: 'matched', otherPerson: 'Tane W.', handoverType: null, dropPoint: null, dropTime: null, note: 'Blue fabric, no tears. Good condition.', photos: ['https://placehold.co/400x300/E8F5F3/147A6E?text=Couch+Front'], created: '6 hrs ago', availableUntil: 'This week', isLargeItem: true, matchExpiry: Date.now() + 20 * 60 * 60 * 1000 },
  { id: 5, type: 'need', item: 'Lawn Mowing', category: 'service', status: 'listed', otherPerson: null, handoverType: null, dropPoint: null, dropTime: null, note: 'Front and back yard', photos: [], created: '3 hrs ago', urgency: 'whenever', offerInReturn: 'money: Happy to pay $30 or trade for baking' },
]

export interface BrowseItem {
  id: number
  giver: string
  distance: string
  item: string
  category: string
  photos: string[]
  note: string
  available: string
  idVerified: boolean
  reliability: number
}

export const BROWSE_ITEMS: BrowseItem[] = [
  { id: 101, giver: 'Sarah T.', distance: '0.3 km', item: 'Fresh Veges and Eggs', category: 'food', photos: ['https://placehold.co/400x300/E6F9E6/2D7A2D?text=Fresh+Veges'], note: 'From my garden today - silverbeet, courgettes, 6 eggs', available: 'Today', idVerified: true, reliability: 97 },
  { id: 102, giver: 'James K.', distance: '0.8 km', item: 'Guitar Lessons (Beginner)', category: 'service', photos: [], note: 'Happy to teach basics. 30 min sessions', available: 'Weekends', idVerified: false, reliability: 85 },
  { id: 103, giver: 'Mel B.', distance: '1.2 km', item: 'Baby Clothes Bundle (0-6 months)', category: 'baby', photos: ['https://placehold.co/400x300/E8F0FF/7B9ACC?text=Baby+Clothes'], note: 'Mix of onesies, pants, hats. Good condition.', available: 'This week', idVerified: false, reliability: 72 },
  { id: 104, giver: 'Tom & Liz', distance: '1.5 km', item: 'Microwave (Working)', category: 'household', photos: ['https://placehold.co/400x300/FFF3E6/B8762A?text=Microwave'], note: 'Samsung, works perfectly, just upgraded', available: 'This week', idVerified: true, reliability: 91 },
  { id: 105, giver: 'Aroha P.', distance: '0.6 km', item: 'Kids Books (Ages 5-8)', category: 'other', photos: ['https://placehold.co/400x300/E8F5F3/147A6E?text=Books+Stack'], note: 'About 20 books. Roald Dahl, Dr Seuss, Diary of a Wimpy Kid', available: 'Ongoing', idVerified: true, reliability: 95 },
  { id: 106, giver: 'Whaea Rua', distance: '0.4 km', item: 'Homemade Rewena Bread', category: 'food', photos: ['https://placehold.co/400x300/E6F9E6/2D7A2D?text=Rewena+Bread'], note: 'Baked fresh today. No allergens.', available: 'Today only', idVerified: true, reliability: 99 },
]

export const INITIAL_NOTIFICATIONS = [
  { id: 1, type: 'match', text: 'Priya R. has nappies for you!', time: '5 min ago', read: false, itemId: 3 },
  { id: 2, type: 'claimed', text: 'Tane W. wants your couch', time: '30 min ago', read: false, itemId: 4 },
  { id: 3, type: 'arranged', text: 'Drop-off confirmed at Community Centre', time: '1 hr ago', read: true },
  { id: 4, type: 'message', text: 'New message from Jordan M.', time: '1 hr ago', read: true },
  { id: 5, type: 'points', text: 'You earned +30 KP for listing!', time: '2 hrs ago', read: true },
  { id: 6, type: 'reminder', text: "Accept or decline Tane W.'s match (20h left)", time: '4 hrs ago', read: false },
]

export interface Message { from: 'me' | 'them' | 'system'; text: string; time: string }
export interface Conversation {
  id: string; person: string; itemName: string; lastMsg: string
  lastTime: string; unread: number; blocked: boolean; messages: Message[]
}

export const INITIAL_CONVERSATIONS: Conversation[] = [
  { id: 'jordan', person: 'Jordan M.', itemName: 'Baked Beans', lastMsg: 'See you at the Community Centre!', lastTime: '1 hr ago', unread: 0, blocked: false, messages: [
    { from: 'them', text: "Hey! I'd love those baked beans if still available?", time: '2 hrs ago' },
    { from: 'me', text: 'Sure! Want to pick up from the Community Centre?', time: '2 hrs ago' },
    { from: 'them', text: 'Perfect! Between 3 and 5 today', time: '1 hr ago' },
    { from: 'me', text: 'Great, see you!', time: '1 hr ago' },
    { from: 'them', text: 'See you at the Community Centre!', time: '1 hr ago' },
  ]},
  { id: 'priya', person: 'Priya R.', itemName: 'Nappies', lastMsg: 'I have Huggies size 3, about half full. Want them?', lastTime: '5 min ago', unread: 1, blocked: false, messages: [
    { from: 'them', text: 'Hi! I saw you need size 3 nappies. I have Huggies size 3, about half full. Want them?', time: '5 min ago' },
  ]},
  { id: 'tane', person: 'Tane W.', itemName: 'Couch', lastMsg: 'That couch looks great! Is it still going?', lastTime: '30 min ago', unread: 1, blocked: false, messages: [
    { from: 'them', text: 'That couch looks great! Is it still going?', time: '30 min ago' },
  ]},
]

export const COMMUNITY_FEED = [
  { user: 'Sarah T.', action: 'Shared fresh veges and eggs', time: '12 min ago', category: '🥦 Food', points: 50 },
  { user: 'James K.', action: 'Offered free guitar lessons', time: '34 min ago', category: '🎸 Skills', points: 40 },
  { user: 'Priya R.', action: 'Donated winter jackets (x3)', time: '1 hr ago', category: '🧥 Clothing', points: 30 },
  { user: 'Tom & Liz', action: 'Helped deliver a couch', time: '2 hrs ago', category: '🚚 Delivery', points: 60 },
  { user: 'Mei W.', action: 'Shared homemade soup', time: '3 hrs ago', category: '🍲 Food', points: 50 },
]

export const RELIABILITY: Record<string, { completed: number; total: number; streak: number; idVerified: boolean }> = {
  'Jordan M.': { completed: 12, total: 12, streak: 5, idVerified: true },
  'Priya R.': { completed: 7, total: 8, streak: 3, idVerified: false },
  'Tane W.': { completed: 22, total: 22, streak: 8, idVerified: true },
  'Mel B.': { completed: 4, total: 6, streak: 0, idVerified: false },
  'Sarah T.': { completed: 31, total: 31, streak: 12, idVerified: true },
}

export const getReliability = (name: string) => {
  const r = RELIABILITY[name]
  if (!r) return { score: null as number | null, completed: 0, total: 0, streak: 0, idVerified: false }
  return { ...r, score: r.total === 0 ? null : Math.round((r.completed / r.total) * 100) }
}

export const relLevel = (s: number | null) =>
  s === null ? 'new' : s >= 90 ? 'high' : s >= 70 ? 'mid' : 'low'

export const autoCategory = (text: string): string => {
  const l = text.toLowerCase()
  if (['couch', 'sofa', 'table', 'fridge', 'bed', 'desk', 'wardrobe', 'chair', 'shelf', 'drawers'].some(w => l.includes(w))) return 'furniture'
  if (['food', 'veges', 'eggs', 'bread', 'tins', 'beans', 'rice', 'milk', 'fruit', 'meat', 'frozen', 'soup'].some(w => l.includes(w))) return 'food'
  if (['jacket', 'coat', 'clothes', 'shoes', 'pants', 'shirt', 'dress', 'hoodie', 'jersey'].some(w => l.includes(w))) return 'clothing'
  if (['nappy', 'pram', 'baby', 'formula', 'cot', 'car seat', 'nappies', 'bottles'].some(w => l.includes(w))) return 'baby'
  if (['mow', 'lawn', 'fix', 'repair', 'paint', 'teach', 'drive', 'moving', 'clean', 'build', 'plumb'].some(w => l.includes(w))) return 'service'
  if (['kettle', 'toaster', 'vacuum', 'heater', 'iron', 'microwave', 'blender'].some(w => l.includes(w))) return 'household'
  return 'other'
}

export const getTimeLeft = (exp: number): string => {
  const ms = exp - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
