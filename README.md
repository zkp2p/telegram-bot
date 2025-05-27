# ZKP2P Telegram Tracker Bot

Telegram bot for tracking ZKP2P deposit events on Base blockchain in real-time.

## 🚀 Features

- Track specific deposit IDs or listen to all deposits
- Real-time notifications for order creation, fulfillment, and cancellation
- Supports CashApp, Venmo, Revolut, Wise, and Zelle
- Persistent user data with Supabase
- Auto-reconnecting WebSocket connection

## 📱 Commands

- `/deposit 123` - Track a specific deposit
- `/deposit all` - Listen to all deposits  
- `/deposit stop` - Stop listening to all
- `/remove 123` - Stop tracking specific deposit
- `/list` - Show your tracked deposits
- `/clearall` - Reset all tracking
- `/status` - Check connection status
- `/help` - Show help

## 🛠 Setup

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
BASE_RPC=your_base_rpc_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Deploy to Heroku
1. Fork this repo
2. Connect to Heroku
3. Add environment variables
4. Deploy

### Run Locally
```bash
npm install
npm start
```

## 🤝 Contributing

This is an **open source** project! Contributions welcome:

1. Fork the repo
2. Create a feature branch
3. Submit a pull request

## 📄 License

MIT License - feel free to use and modify!
