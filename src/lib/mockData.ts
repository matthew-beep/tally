export const PEOPLE = {
  you:    { name: 'You',    initials: 'ME', color: '#F2C144', text: '#7A5200' },
  sam:    { name: 'Sam',    initials: 'SA', color: '#A8DCC4', text: '#0A4A2E' },
  taylor: { name: 'Taylor', initials: 'TA', color: '#F7B89A', text: '#7A2E10' },
  jordan: { name: 'Jordan', initials: 'JO', color: '#C4B4F0', text: '#3A1870' },
  riley:  { name: 'Riley',  initials: 'RI', color: '#F4B8CC', text: '#7A1840' },
} as const

export type PersonKey = keyof typeof PEOPLE

export interface MockExpense {
  id: string
  desc: string
  amount: number
  paidBy: PersonKey
  splitAmong: PersonKey[]
  date: string
  emoji: string
}

export interface MockGroup {
  id: string
  name: string
  emoji: string
  members: PersonKey[]
  expenses: MockExpense[]
}

export const INITIAL_GROUPS: MockGroup[] = [
  {
    id: 'bigsur',
    name: 'Big Sur Trip',
    emoji: '🏕️',
    members: ['you', 'sam', 'taylor', 'jordan'],
    expenses: [
      { id: 'e1', desc: 'Airbnb deposit',    amount: 320,   paidBy: 'you',    splitAmong: ['you','sam','taylor','jordan'], date: 'Mon', emoji: '🏠' },
      { id: 'e2', desc: 'Gas — round trip',  amount: 86.40, paidBy: 'you',    splitAmong: ['you','sam','taylor','jordan'], date: 'Tue', emoji: '⛽' },
      { id: 'e3', desc: 'Grocery run',       amount: 147.20,paidBy: 'sam',    splitAmong: ['you','sam','taylor','jordan'], date: 'Wed', emoji: '🛒' },
      { id: 'e4', desc: 'Kayak rentals',     amount: 200,   paidBy: 'taylor', splitAmong: ['sam','taylor','jordan'],       date: 'Wed', emoji: '🚣' },
      { id: 'e5', desc: 'Dinner at Nepenthe',amount: 268,   paidBy: 'jordan', splitAmong: ['you','sam','taylor','jordan'], date: 'Thu', emoji: '🍽️' },
    ],
  },
  {
    id: 'tokyo',
    name: 'Tokyo 2025',
    emoji: '✈️',
    members: ['you', 'taylor', 'riley'],
    expenses: [
      { id: 'e6', desc: 'Flights',        amount: 1840, paidBy: 'you',    splitAmong: ['you','taylor','riley'], date: 'Feb 3', emoji: '🛫' },
      { id: 'e7', desc: 'Hotel Shinjuku', amount: 960,  paidBy: 'riley',  splitAmong: ['you','taylor','riley'], date: 'Feb 4', emoji: '🏨' },
      { id: 'e8', desc: 'Ramen + drinks', amount: 62,   paidBy: 'taylor', splitAmong: ['you','taylor','riley'], date: 'Feb 5', emoji: '🍜' },
    ],
  },
  {
    id: 'house',
    name: 'Housemates',
    emoji: '🏠',
    members: ['you', 'sam', 'jordan', 'riley'],
    expenses: [
      { id: 'e9',  desc: 'Electricity',      amount: 124, paidBy: 'you',    splitAmong: ['you','sam','jordan','riley'], date: 'Apr 1',  emoji: '⚡' },
      { id: 'e10', desc: 'Internet',         amount: 60,  paidBy: 'sam',    splitAmong: ['you','sam','jordan','riley'], date: 'Apr 1',  emoji: '📶' },
      { id: 'e11', desc: 'Cleaning supplies',amount: 38,  paidBy: 'jordan', splitAmong: ['you','sam','jordan','riley'], date: 'May 10', emoji: '🧹' },
    ],
  },
]

export function computeGroupBalances(group: MockGroup): Record<string, number> {
  const net: Record<string, number> = {}
  for (const p of group.members) net[p] = 0

  for (const expense of group.expenses) {
    const each = expense.amount / expense.splitAmong.length
    for (const p of expense.splitAmong) {
      if (p === expense.paidBy) continue
      net[expense.paidBy] = Math.round(((net[expense.paidBy] ?? 0) + each) * 100) / 100
      net[p] = Math.round(((net[p] ?? 0) - each) * 100) / 100
    }
  }
  return net
}

export function computeGlobalBalances() {
  // net[person] > 0 = they owe you; net[person] < 0 = you owe them
  const net: Record<string, number> = {}

  for (const group of INITIAL_GROUPS) {
    for (const expense of group.expenses) {
      const each = expense.amount / expense.splitAmong.length

      if (expense.paidBy === 'you') {
        for (const p of expense.splitAmong) {
          if (p === 'you') continue
          net[p] = Math.round(((net[p] ?? 0) + each) * 100) / 100
        }
      } else if (expense.splitAmong.includes('you')) {
        net[expense.paidBy] = Math.round(((net[expense.paidBy] ?? 0) - each) * 100) / 100
      }
    }
  }

  const total = Math.round(Object.values(net).reduce((s, v) => s + v, 0) * 100) / 100

  const owedToYou = Object.entries(net)
    .filter(([, v]) => v > 0.01)
    .map(([person, amount]) => ({ person: person as PersonKey, amount }))
    .sort((a, b) => b.amount - a.amount)

  const youOwe = Object.entries(net)
    .filter(([, v]) => v < -0.01)
    .map(([person, amount]) => ({ person: person as PersonKey, amount: -amount }))
    .sort((a, b) => b.amount - a.amount)

  return { total, owedToYou, youOwe }
}

export function simplifyGroupDebts(group: MockGroup) {
  const net = computeGroupBalances(group)
  const debtors = Object.entries(net)
    .filter(([, v]) => v < -0.01)
    .map(([uid, v]) => ({ uid: uid as PersonKey, amt: -v }))
    .sort((a, b) => b.amt - a.amt)
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0.01)
    .map(([uid, v]) => ({ uid: uid as PersonKey, amt: v }))
    .sort((a, b) => b.amt - a.amt)

  const out: { from: PersonKey; to: PersonKey; amount: number }[] = []
  let d = 0, c = 0
  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].amt, creditors[c].amt)
    out.push({ from: debtors[d].uid, to: creditors[c].uid, amount: Math.round(pay * 100) / 100 })
    debtors[d].amt -= pay
    creditors[c].amt -= pay
    if (debtors[d].amt < 0.01) d++
    if (creditors[c].amt < 0.01) c++
  }
  return out
}
