export const CATEGORIES = [
  { emoji: '🍽️', label: 'Food & drink',  keywords: ['uber eat','doordash','grubhub','restaurant','dinner','lunch','breakfast','coffee','pizza','sushi','taco','burger','bar','cafe','ramen','brunch'] },
  { emoji: '🚗', label: 'Transport',      keywords: ['uber','lyft','taxi','gas','fuel','parking','transit','train','bus','metro','muni','bart','toll'] },
  { emoji: '🛒', label: 'Groceries',      keywords: ['grocery','groceries','costco','trader joe','whole foods','walmart','safeway','kroger','aldi','supermarket'] },
  { emoji: '✈️', label: 'Travel',         keywords: ['flight','hotel','airbnb','vrbo','hostel','motel','airline','resort'] },
  { emoji: '🏠', label: 'Home',           keywords: ['rent','utilities','electricity','internet','wifi','cable','cleaning','repairs','plumber','maintenance'] },
  { emoji: '🎉', label: 'Entertainment',  keywords: ['movie','cinema','concert','ticket','netflix','spotify','hulu','game','bowling','golf','museum','show'] },
  { emoji: '💸', label: 'Other',          keywords: [] },
] as const

export type Category = typeof CATEGORIES[number]

export function detectCategory(description: string): string {
  const lower = description.toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.emoji
  }
  return '💸'
}
