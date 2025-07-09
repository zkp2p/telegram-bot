require('dotenv').config();

module.exports = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  
  // Exchange API
  EXCHANGE_API_KEY: process.env.EXCHANGE_API_KEY,
  
  // Blockchain
  BASE_RPC: process.env.BASE_RPC,
  
  // Samba
  SAMBA_BACKEND_PUBLIC_KEY: process.env.SAMBA_BACKEND_PUBLIC_KEY,
  
  // Server
  PORT: process.env.PORT || 3001,

  // Domain used for SSL path
  DOMAIN: process.env.DOMAIN,
  
  // Environment
  PRODUCTION: process.env.PRODUCTION === "true" ? true : false,
};