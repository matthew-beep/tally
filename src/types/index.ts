export interface Profile {
  id: string  // = auth.users.id
  name: string
  display_name: string | null
  handle: string | null
  email: string | null
  avatar_url: string | null
  add_code: string | null
  status: 'active' | 'guest'
  claim_token: string | null
  created_at: string
}

export interface Group {
  id: string
  name: string
  emoji: string
  created_by: string
  invite_token: string
  created_at: string
}

export interface GroupMember {
  group_id: string
  user_id: string
  status: 'pending' | 'active' | 'left'
  invited_by: string | null
  joined_at: string
  profile?: Profile
}

export interface Expense {
  id: string
  group_id: string
  paid_by: string
  description: string
  amount: number
  split_type: 'equal' | 'exact' | 'percentage' | 'itemized'
  category: string | null
  tax: number
  tip: number
  expense_date: string
  created_at: string
  updated_at: string
  share_token: string | null
  deleted_at: string | null
  splits?: ExpenseSplit[]
  payer?: Profile
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  user_id: string
  owed_amount: number
}

export interface ExpenseItem {
  id: string
  expense_id: string
  name: string
  price: number
}

export interface ExpenseItemAssignment {
  item_id: string
  user_id: string
}

export interface Settlement {
  id: string
  group_id: string
  from_user: string
  to_user: string
  amount: number
  note: string | null
  settled_date: string
  created_at: string
  status: 'pending' | 'confirmed'
  from_profile?: Profile
  to_profile?: Profile
}

export interface Notification {
  id: string
  recipient_id: string
  type:
    | 'group_invite'
    | 'settlement_confirm'
    | 'settlement_confirmed'
    | 'settlement_denied'
  settlement_id: string | null
  group_id: string | null
  read: boolean
  created_at: string
  settlement?: Settlement
  group?: Pick<Group, 'id' | 'name' | 'emoji'>
}

export interface DebtTransfer {
  from: string
  to: string
  amount: number
}

export type ActivityItem =
  | {
      type: 'expense'
      id: string
      description: string
      category: string | null
      amount: number
      date: string
      createdAt: string
      payerName: string
      groupId: string
      groupName: string
      groupEmoji: string
    }
  | {
      type: 'settlement'
      id: string
      amount: number
      status: 'pending' | 'confirmed'
      fromName: string
      toName: string
      createdAt: string
      groupId: string
      groupName: string
      groupEmoji: string
    }

export interface ActivityGroup {
  group: Pick<Group, 'id' | 'name' | 'emoji'>
  items: ActivityItem[]
}
