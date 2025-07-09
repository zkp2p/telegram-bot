require('dotenv').config();

// Import all modules
const { supabase } = require('./database');
const { createBot, initializeBot, registerAllCommands } = require('./bot');
const { createBlockchainProvider } = require('./blockchain');
const { startApiServer } = require('./api');
const { createContractEventHandler } = require('./bot/handlers');

// Global variables
let bot;
let resilientProvider;
let apiServer;

// Main initialization function
const initializeApplication = async () => {
  try {
    console.log('🤖 Samba Market Maker Telegram Bot Started');
    console.log('🔍 Initializing all modules...');

    // Test database connection first
    try {
      const { data, error } = await supabase.from('users').select('chat_id').limit(1);
      if (error) throw error;
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }

    // Create and initialize bot
    bot = await createBot();
    console.log('✅ Telegram bot created');

    // Create event handler
    const eventHandler = createContractEventHandler(bot);

    // Initialize blockchain provider
    resilientProvider = createBlockchainProvider(eventHandler);
    console.log('✅ Blockchain provider initialized');

    // Start API server
    const { app, server } = startApiServer();
    apiServer = { app, server };
    console.log('✅ API server started');

    // Initialize bot after a delay to ensure all systems are ready
    setTimeout(() => initializeBot(bot), 3000);

    console.log('🚀 All systems initialized successfully!');
    console.log(`📡 Listening for contract events...`);

  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    console.log('🔄 Retrying initialization in 30 seconds...');
    setTimeout(initializeApplication, 30000);
  }
};

// Improved graceful shutdown with proper cleanup
const gracefulShutdown = async (signal) => {
  console.log(`🔄 Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new connections
    if (resilientProvider) {
      await resilientProvider.destroy();
    }

    // Stop the Telegram bot
    if (bot) {
      console.log('🛑 Stopping Telegram bot...');
      await bot.stopPolling();
    }

    // Close Express server properly
    if (apiServer?.server) {
      console.log('🛑 Closing Express server...');
      await new Promise((resolve) => {
        apiServer.server.close(resolve);
      });
    }

    console.log('✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Enhanced error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  console.error('Stack trace:', error.stack);

  // Attempt to restart WebSocket if it's a connection issue
  if (error.message.includes('WebSocket') || error.message.includes('ECONNRESET')) {
    console.log('🔄 Attempting to restart WebSocket due to connection error...');
    if (resilientProvider) {
      resilientProvider.restart();
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);

  // Attempt to restart WebSocket if it's a connection issue
  if (reason && reason.message &&
    (reason.message.includes('WebSocket') || reason.message.includes('ECONNRESET'))) {
    console.log('🔄 Attempting to restart WebSocket due to rejection...');
    if (resilientProvider) {
      resilientProvider.restart();
    }
  }
});

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Health check interval
setInterval(async () => {
  if (resilientProvider && !resilientProvider.isConnected) {
    console.log('🔍 Health check: WebSocket disconnected, attempting restart...');
    await resilientProvider.restart();
  }
}, 120000); // Check every two minutes

// Start the application
initializeApplication();