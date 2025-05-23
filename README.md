# ZKP2P Telegram Bot 🤖

A real-time Telegram bot that monitors ZKP2P escrow contract events on Base blockchain. Track your deposits and get instant notifications for intent signals, fulfillments, cancellations, and closures.

## Features ✨

- 📊 **Multi-deposit tracking** - Track multiple deposit IDs simultaneously
- 🔔 **Real-time notifications** - Instant alerts for all contract events
- 💰 **Detailed transaction info** - USDC amounts, fiat conversions, and more
- 🔗 **BaseScan integration** - Direct links to transaction details
- 📱 **Easy commands** - Simple Telegram commands to manage tracking

## Supported Events 📡

- 🟡 **IntentSignaled** - New trading intent created
- 🟢 **IntentFulfilled** - Order successfully completed
- 🟠 **IntentPruned** - Order cancelled
## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/zkp2p-telegram-bot.git
   cd zkp2p-telegram-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure your environment variables**
   Edit `.env` file with your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   BASE_RPC=wss://base-mainnet.g.alchemy.com/v2/your-api-key
   ```

5. **Run the bot**
   ```bash
   node bot.js
   ```

## Bot Commands 💬

| Command | Description | Example |
|---------|-------------|---------|
| `/deposit <ids>` | Track single or multiple deposits | `/deposit 123` or `/deposit 123,456,789` |
| `/remove <ids>` | Stop tracking specific deposits | `/remove 123` or `/remove 123,456` |
| `/list` | Show all tracked deposits and status | `/list` |
| `/clearall` | Stop tracking all deposits | `/clearall` |
| `/help` | Show help message | `/help` |

## Usage Examples 📚

### Track a single deposit
```
/deposit 737
```
✅ Now tracking deposit IDs: `737`

### Track multiple deposits
```
/deposit 737,1024,2048
```
✅ Now tracking deposit IDs: `737, 1024, 2048`

### Check tracking status
```
/list
```
📋 **Currently tracking 3 deposits:**

🟡 `737` - signaled  
✅ `1024` - fulfilled  
👀 `2048` - tracking  

### Remove specific deposits
```
/remove 737,1024
```
✅ Removed specified IDs. Still tracking: `2048`

## Notification Examples 📨

### Intent Signaled
```
🟡 Intent Signaled
• Deposit ID: 737
• Intent Hash: 0xDec04F75A452E59857DDA8F0A8C3FE37AA204BF45F4A63031D46AB4735EED65CF73
• Owner: 0x1234...5678
• Verifier: 0xabcd...efgh
• To: 0x9876...5432
• Amount: 100.00 USDC
• Fiat Amount: 95.50 EUR
• Conversion Rate: 955000000000000000
• Time: Fri, 23 May 2025 14:30:00 GMT
• Block: 12345678
• Tx: View on BaseScan
```

### Intent Fulfilled
```
🟢 Intent Fulfilled
• Deposit ID: 737
• Intent Hash: 0xDec04F75A452E59857DDA8F0A8C3FE37AA204BF45F4A63031D46AB4735EED65CF73
• Owner: 0x1234...5678
• Verifier: 0xabcd...efgh
• To: 0x9876...5432
• Amount: 100.00 USDC
• Sustainability Fee: 0.10 USDC
• Verifier Fee: 0.50 USDC
• Block: 12345679
• Tx: View on BaseScan
```

## Smart Contract Details 📄

- **Contract Address**: `0xca38607d85e8f6294dc10728669605e6664c2d70`
- **Network**: Base Mainnet
- **Explorer**: [BaseScan](https://basescan.org/address/0xca38607d85e8f6294dc10728669605e6664c2d70)


**Disclaimer**: This bot is for informational purposes only. Always verify transactions independently. Use at your own risk.
