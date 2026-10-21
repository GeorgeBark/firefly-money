# Log Apple Pay purchases automatically

When you pay with Apple Pay on your iPhone, a Shortcuts automation sends the amount, merchant and card to Money, and Money adds the expense in Firefly III straight away. It takes about five minutes to set up.

iOS doesn't let apps read your bank's notifications, so this only covers **Apple Pay** taps (in stores, and in apps or websites that use Apple Pay). Card swipes, online card entry and bank transfers still need adding by hand or by importing.

## What you need

- iOS 17 or newer.
- Your iPhone must be able to reach Money **at the moment you pay**. On your home Wi-Fi that's the usual address, but in a shop it isn't, so use a VPN that's always on (Tailscale, WireGuard) or a reverse proxy with HTTPS (see the README). If Money can't be reached, the payment still goes through. It just isn't logged.
- In Firefly, an asset or liability account for each card, named like the card is in Wallet (for example `Apple Card` or `Chase Sapphire`). Money matches the name, a name inside the other ("Chase Sapphire" matches "Chase Sapphire Preferred"), or the card's last four digits at the end of the account number.

## 1. Copy the address and key

In Money, open **Settings → Apple Pay** and copy the **Address** (ends in `/api/money-ingest`) and the **Key**. Treat the key like a password: anyone with it can add expenses (but can't read anything). Changing `DASH_PASSWORD` or `FIREFLY_TOKEN` gives a new key, and you'll need to paste it into the Shortcut again.

## 2. Make the automation

1. Open **Shortcuts → Automation**, tap **+**, and pick **Transaction**.
2. Choose the cards to watch (or all of them), leave **When I Tap** on, and pick **Run Immediately** so it doesn't ask each time. Tap **Next**, then **New Blank Automation**.
3. Add the action **Get Contents of URL** and set it up:
   - **URL:** the address from Settings.
   - **Method:** POST.
   - **Headers:** add `Authorization` with the value `Bearer ` followed by the key (one space after `Bearer`).
   - **Request Body:** JSON, with three Text fields:
     - `amount` → tap and pick **Shortcut Input**, then tap it again and choose **Amount**.
     - `merchant` → **Shortcut Input → Merchant**.
     - `card` → **Shortcut Input → Card or Pass**.
4. Optional: add **Show Notification** with **Contents of URL** as the text. Money answers with a short line like `Logged 4.75 at Blue Bottle (Apple Card).`, or says what went wrong.

To always use one account whatever the card, add a fourth field `account` with that account's name in Firefly.

## What gets logged

- A withdrawal from the card's account to the merchant (Firefly creates the payee if it's new), dated now, tagged **Apple Pay**.
- The category and budget you used last time with that merchant, like quick add does. Your Firefly rules then run on it too, so they can rename or recategorize it.
- A negative amount (a refund) is logged as income from the merchant.
- If the same payment is sent twice, Firefly spots the duplicate and Money answers `Already logged.`

Apple runs the automation when you tap, before the bank approves the payment, so a declined payment is logged as well. Delete it in Money if that happens. To check everything logged this way, search for the tag `Apple Pay`.

## If it doesn't work

| Money says | Fix |
| --- | --- |
| `Wrong key` | Copy the key again from Settings, and check the header is `Bearer <key>` with one space. |
| `No account matches the card "…"` | Rename the Firefly account to match the card's name in Wallet, or add an `account` field to the Shortcut. The message lists your accounts. |
| `No amount` | The `amount` field isn't set to **Shortcut Input → Amount**. |
| Nothing at all / a timeout | Your iPhone can't reach Money from where you are (see *What you need*). |
