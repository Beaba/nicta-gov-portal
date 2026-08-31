// #A32 — the client's 13 named CEO Approval Inbox document categories. Free string (Memo.category),
// same list-as-string reasoning as delegations/categories.ts.
export const MEMO_CATEGORIES = [
  'General Memo',
  'BAU Approval',
  'Activity Approval',
  'Financial Delegation',
  'Expenditure Approval',
  'Travel or Event Approval',
  'Procurement Memo',
  'Administrative Memo',
  'Document Approval',
  'Director Request',
  'CEO Office Request',
  'Information Memo',
  'General BAU Approval',
] as const;

export type MemoCategory = (typeof MEMO_CATEGORIES)[number];

// Categories the client explicitly allows to route through WhatsApp (ordinary memos and
// non-substantial BAU approvals) — everything else is portal-only regardless of amount.
const WHATSAPP_ELIGIBLE_CATEGORIES: readonly string[] = [
  'General Memo',
  'BAU Approval',
  'Administrative Memo',
  'Information Memo',
  'General BAU Approval',
];

export function isCategoryWhatsAppEligible(category: string): boolean {
  return WHATSAPP_ELIGIBLE_CATEGORIES.includes(category);
}
