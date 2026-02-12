/**
 * Pesapal API 3.0 helpers for Uganda mobile money and payments.
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/
 */

const PESAPAL_AUTH = "https://pay.pesapal.com/v3/api/Auth/RequestToken"
const PESAPAL_SUBMIT = "https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest"
const PESAPAL_STATUS = "https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus"

export async function getPesapalToken(): Promise<string> {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET
  if (!consumerKey || !consumerSecret) {
    throw new Error("PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET must be set")
  }
  const res = await fetch(PESAPAL_AUTH, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    }),
  })
  const data = (await res.json()) as { token?: string; error?: unknown; message?: string }
  if (!res.ok || !data.token) {
    throw new Error(data?.message || "Failed to get Pesapal token")
  }
  return data.token
}

export interface SubmitOrderParams {
  id: string
  amount: number
  currency: string
  description: string
  callbackUrl: string
  notificationId: string
  billingAddress: {
    email_address?: string
    phone_number?: string
    first_name?: string
    last_name?: string
    country_code?: string
  }
}

export async function submitPesapalOrder(params: SubmitOrderParams): Promise<{ redirectUrl: string; orderTrackingId: string }> {
  const token = await getPesapalToken()
  const body = {
    id: params.id.replace(/[^a-zA-Z0-9\-_.:]/g, "").slice(0, 50),
    currency: params.currency,
    amount: params.amount,
    description: params.description.slice(0, 100),
    callback_url: params.callbackUrl,
    notification_id: params.notificationId,
    redirect_mode: "TOP_WINDOW",
    billing_address: {
      email_address: params.billingAddress.email_address || "patient@dayspring.local",
      phone_number: params.billingAddress.phone_number || "",
      first_name: params.billingAddress.first_name || "",
      last_name: params.billingAddress.last_name || "",
      country_code: params.billingAddress.country_code || "UG",
    },
  }
  const res = await fetch(PESAPAL_SUBMIT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as {
    redirect_url?: string
    order_tracking_id?: string
    error?: unknown
    message?: string
    status?: string
  }
  if (!res.ok || !data.redirect_url) {
    throw new Error(data?.message || "Failed to create Pesapal order")
  }
  return {
    redirectUrl: data.redirect_url,
    orderTrackingId: data.order_tracking_id || "",
  }
}

export async function getPesapalTransactionStatus(orderTrackingId: string): Promise<{
  payment_status_description: string
  status_code: number
  merchant_reference?: string
  amount?: number
  payment_method?: string
}> {
  const token = await getPesapalToken()
  const url = `${PESAPAL_STATUS}?orderTrackingId=${encodeURIComponent(orderTrackingId)}`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
  const data = (await res.json()) as {
    payment_status_description?: string
    status_code?: number
    merchant_reference?: string
    amount?: number
    payment_method?: string
  }
  return {
    payment_status_description: data.payment_status_description || "UNKNOWN",
    status_code: data.status_code ?? -1,
    merchant_reference: data.merchant_reference,
    amount: data.amount,
    payment_method: data.payment_method,
  }
}
