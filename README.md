# ZKP2P Telegram Tracker Bot
Telegram bot for tracking ZKP2P deposit events on Base blockchain in real-time.

## 🚀 Features
- **Real-time tracking**: Monitor specific deposit IDs or listen to all deposits
- **Event notifications**: Get alerts for order creation, fulfillment, and cancellation
- **Multi-platform support**: CashApp, Venmo, Revolut, Wise, and Zelle
- **Persistent storage**: User data backed by Supabase database
- **Clean event handling**: Ignores withdrawal events to prevent spam

## 📱 Commands

### Deposit Tracking
- `/deposit 123` - Track a specific deposit
- `/deposit all` - Listen to ALL deposits (every event)
- `/deposit stop` - Stop listening to all deposits
- `/deposit 123,456,789` - Track multiple deposits
- `/remove 123` - Stop tracking specific deposit(s)

### General
- `/list` - Show all tracking status
- `/clearall` - Stop all tracking and clear everything
- `/status` - Check WebSocket connection and settings
- `/help` - Show this help message

## 🛠 Setup

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
BASE_RPC=your_base_rpc_url  
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

## 📊 Supported Events
- `DepositReceived` - New deposits created
- `DepositCurrencyAdded` - Currency options added
- `DepositVerifierAdded` - Platform verifiers added
- `IntentSignaled` - Orders created
- `IntentFulfilled` - Orders completed
- `IntentPruned` - Orders cancelled
- `DepositWithdrawn` - Deposits withdrawn (ignored)
- `DepositClosed` - Deposits closed (ignored)

## 🤝 Contributing
This is an **open source** project! Contributions welcome:
1. Fork the repo
2. Create a feature branch
3. Submit a pull request

**Ideas for contributions:**
- Portfolio tracking features
- Advanced filtering options
- Enhanced notification systems

## 📄 License
MIT License - feel free to use and modify!

---
*Built for the ZKP2P community. Trade safely! 🚀*
