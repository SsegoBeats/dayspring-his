# Mobile Money Integration Guide

Dayspring HIS uses **Pesapal** for mobile money and online payments in Uganda. See **[PESAPAL_SETUP.md](./PESAPAL_SETUP.md)** for setup instructions.

## Current Status

- **Pesapal integration**: Live mobile money and card payments via Pesapal are implemented.
- **Cashier UI**: When Mobile Money or Card is selected, the cashier clicks "Initiate Payment". A new tab opens where the patient chooses MTN, Airtel, or card and completes payment.
- **IPN**: Payment completion is received via IPN and the bill is automatically marked as Paid.

## Payment Flow

1. Cashier selects a bill and chooses "Mobile Money (MTN, Airtel)" or "Card".
2. Cashier clicks "Initiate Payment".
3. A new tab opens with Pesapal's payment page.
4. Patient selects payment method (MTN Mobile Money, Airtel Money, card) and completes payment.
5. Pesapal sends an IPN to our server on success.
6. Bill is automatically marked as Paid; cashier can click "Check Payment Status" to refresh.
