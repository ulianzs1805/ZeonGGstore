const API_URL = "https://api.yookassa.ru/v3";

function getAuthHeader() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error("YOOKASSA_NOT_CONFIGURED");
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`;
}

export type YooKassaPayment = {
  id: string;
  status: string;
  paid: boolean;
  amount?: { value?: string; currency?: string };
  confirmation?: { confirmation_url?: string };
  metadata?: Record<string, string>;
};

export async function createYooKassaPayment(input: {
  amountRub: number;
  paymentMethod: "sbp" | "bank_card" | "tinkoff_bank" | "sberbank";
  returnUrl: string;
  description: string;
  idempotencyKey: string;
  transactionId: string;
}) {
  const response = await fetch(`${API_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      amount: { value: input.amountRub.toFixed(2), currency: "RUB" },
      payment_method_data: { type: input.paymentMethod },
      confirmation: { type: "redirect", return_url: input.returnUrl },
      capture: true,
      description: input.description.slice(0, 128),
      metadata: { transaction_id: input.transactionId },
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as YooKassaPayment | { description?: string; code?: string } | null;
  if (!response.ok) {
    const detail = data && "description" in data && data.description ? data.description : "YooKassa rejected the payment";
    throw new Error(detail);
  }
  return data as YooKassaPayment;
}

export async function getYooKassaPayment(paymentId: string) {
  const response = await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: getAuthHeader() },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as YooKassaPayment | null;
  if (!response.ok || !data?.id) throw new Error("YOOKASSA_PAYMENT_NOT_FOUND");
  return data;
}
