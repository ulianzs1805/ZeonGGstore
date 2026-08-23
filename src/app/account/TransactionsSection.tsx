"use client";

import { StateMessage } from "./AccountShell";
import { date, number } from "./account-types";
import type { Transaction } from "./account-types";

export default function TransactionsSection({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <StateMessage>Транзакций пока нет</StateMessage>;
  return <div className="space-y-3">{transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1017] p-4 text-sm"><div><p className="font-semibold text-white">{transaction.type === "DEPOSIT" ? "Пополнение баланса" : transaction.type === "PURCHASE" ? "Покупка Z-Coin" : transaction.type === "REFUND" ? "Возврат средств" : transaction.type === "FAILED" ? "Неуспешная транзакция" : transaction.type === "SALE" ? "Продажа предмета" : transaction.type}</p><p className="mt-1 text-slate-400">{date(transaction.createdAt)} · {transaction.status} · ID: {transaction.id}</p>{transaction.rubAmount !== null && <p className="mt-1 text-slate-500">{number(transaction.rubAmount)} ₽</p>}</div><span className="font-bold text-violet-100">{transaction.zCoinAmount > 0 ? "+" : ""}{number(transaction.zCoinAmount)} Z</span></div>)}</div>;
}
