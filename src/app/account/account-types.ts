export type InventoryItem = { id: string; name: string; rarity: string; image: string; price: number; addedAt: string };
export type Operation = { id: string; type: string; label: string | null; amount: number; status: string; createdAt: string; item?: { name: string } | null };
export type Transaction = { id: string; type: string; rubAmount: number | null; zCoinAmount: number; status: string; paymentId: string | null; createdAt: string };
export type Ticket = { id: string; subject: string; description: string; status: string; createdAt: string };
export type AccountUser = { id?: string; name: string | null; email: string; avatar?: string | null; balance?: number; createdAt: string; role: "USER" | "ADMIN" | "DEV" | "NPN1_DEV" };
export type ProfileData = { user: AccountUser; inventory: InventoryItem[]; operations: Operation[]; transactions: Transaction[]; tickets: Ticket[] };
export type Statistics = { inventoryCount: number; inventoryValue: number; openedCases: number; soldItems: number; spent: number; earned: number };
export type AccountSection = "inventory" | "promocodes" | "transactions" | "statistics" | "settings" | "support";
export function number(value: number) { return new Intl.NumberFormat("ru-RU").format(value); }
export function date(value: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
