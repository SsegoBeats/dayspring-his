# Pesapal Payment Integration

Dayspring HIS uses Pesapal for online payments (MTN Mobile Money, Airtel Money, cards, and more) in Uganda.

## Environment Variables

Add to `.env.local`:

```
PESAPAL_CONSUMER_KEY=your_consumer_key
PESAPAL_CONSUMER_SECRET=your_consumer_secret
PESAPAL_IPN_ID=your_ipn_id
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

- **PESAPAL_CONSUMER_KEY** and **PESAPAL_CONSUMER_SECRET**: From your Pesapal integration email.
- **PESAPAL_IPN_ID**: Register your IPN URL first (see below), then add the returned `ipn_id`.
- **NEXT_PUBLIC_APP_URL**: Your app's base URL (e.g. `https://dayspring.example.com` or `http://localhost:3000` for local dev).

## IPN Registration (Required)

Before payments will work, you must register your IPN (Instant Payment Notification) URL with Pesapal:

1. Go to **https://pay.pesapal.com/iframe/PesapalIframe3/IpnRegistration**
2. Log in with your Pesapal merchant account.
3. Register this URL: `https://your-domain.com/api/pesapal/ipn`
4. Choose **POST** as the notification type.
5. Copy the **ipn_id** (GUID) returned and set it as `PESAPAL_IPN_ID` in your env.

For local development, use a tunnel (e.g. ngrok) so Pesapal can reach your IPN:
- Run `ngrok http 3000`
- Register `https://xxxx.ngrok.io/api/pesapal/ipn`
- Use the ngrok URL for `NEXT_PUBLIC_APP_URL` during testing

## Payment Flow

1. Cashier selects **Mobile Money (MTN, Airtel)** or **Card** and clicks **Initiate Payment**.
2. A new tab opens with the Pesapal payment page.
3. Patient selects their method (MTN, Airtel, card) and completes payment.
4. Pesapal redirects the patient to `/cashier/payment-complete` and sends an IPN to our server.
5. The bill is marked as Paid when the IPN is processed.

## Contract Requirement

Pesapal requires a signed contract before settlements. Ensure your contract is in place before going live.

## API Reference

- [Pesapal Developer Docs](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/api-reference)
- [Authentication](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication)
- [SubmitOrderRequest](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest)
- [RegisterIPNURL](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl)
