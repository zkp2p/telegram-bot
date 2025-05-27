require('dotenv').config();
const { WebSocketProvider, Interface } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');

// Telegram setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Enhanced WebSocket Provider with reconnection
class ResilientWebSocketProvider {
  constructor(url, contractAddress, eventHandler) {
    this.url = url;
    this.contractAddress = contractAddress;
    this.eventHandler = eventHandler;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 50; // Try 50 times before giving up
    this.isConnecting = false;
    this.provider = null;
    
    this.connect();
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log(`🔌 Attempting WebSocket connection (attempt ${this.reconnectAttempts + 1})`);
      
      // Clean up existing provider
      if (this.provider) {
        this.provider.removeAllListeners();
        this.provider.destroy?.();
      }

      this.provider = new WebSocketProvider(this.url);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Test connection
      await this.provider.getNetwork();
      
      console.log('✅ WebSocket connected successfully');
      
      // Reset reconnect parameters on successful connection
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.isConnecting = false;
      
      // Set up contract event listening
      this.setupContractListening();
      
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  setupEventListeners() {
    this.provider.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      this.scheduleReconnect();
    });

    this.provider.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
      this.scheduleReconnect();
    });

    // Handle network changes
    this.provider.on('network', (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        console.log('🌐 Network changed, reconnecting...');
        this.scheduleReconnect();
      }
    });
  }

  setupContractListening() {
    if (!this.provider) return;
    
    try {
      this.provider.on({ address: this.contractAddress.toLowerCase() }, this.eventHandler);
      console.log(`👂 Listening for events on contract: ${this.contractAddress}`);
    } catch (error) {
      console.error('❌ Failed to set up contract listening:', error.message);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.isConnecting) return;
    
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`💀 Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping.`);
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 
      this.maxReconnectDelay
    );
    
    console.log(`⏰ Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Getter to access the current provider
  get currentProvider() {
    return this.provider;
  }
}

// ZKP2P Escrow contract on Base
const contractAddress = '0xca38607d85e8f6294dc10728669605e6664c2d70';

// ABI with exact event definitions from the contract
const abi = [
  `event IntentSignaled(
    bytes32 indexed intentHash,
    uint256 indexed depositId,
    address indexed verifier,
    address owner,
    address to,
    uint256 amount,
    bytes32 fiatCurrency,
    uint256 conversionRate,
    uint256 timestamp
  )`,
  `event IntentFulfilled(
    bytes32 indexed intentHash,
    uint256 indexed depositId,
    address indexed verifier,
    address owner,
    address to,
    uint256 amount,
    uint256 sustainabilityFee,
    uint256 verifierFee
  )`,
  `event IntentPruned(
    bytes32 indexed intentHash,
    uint256 indexed depositId
  )`
];

const iface = new Interface(abi);

// PER-USER TRACKING - Store each user's tracked deposits separately
const userTrackedDeposits = new Map(); // chatId -> Set of depositIds
const userDepositStates = new Map();   // chatId -> Map of depositId -> state
const pendingPrunedEvents = new Map(); // Still global for transaction handling

// Verifier address to platform mapping
const verifierMapping = {
  '0x76d33a33068d86016b806df02376ddbb23dd3703': { platform: 'CashApp', isUsdOnly: true },
  '0x9a733b55a875d0db4915c6b36350b24f8ab99df5': { platform: 'Venmo', isUsdOnly: true },
  '0xaa5a1b62b01781e789c900d616300717cd9a41ab': { platform: 'Revolut', isUsdOnly: false },
  '0xff0149799631d7a5bde2e7ea9b306c42b3d9a9ca': { platform: 'Wise', isUsdOnly: false },
  '0x1783f040783c0827fb64d128ece548d9b3613ad5': { platform: 'Zelle', isUsdOnly: true }
};

const getPlatformName = (verifierAddress) => {
  const mapping = verifierMapping[verifierAddress.toLowerCase()];
  return mapping ? mapping.platform : `Unknown (${verifierAddress.slice(0, 6)}...${verifierAddress.slice(-4)})`;
};

// Helper functions to manage per-user tracking
const getUserTrackedDeposits = (chatId) => {
  if (!userTrackedDeposits.has(chatId)) {
    userTrackedDeposits.set(chatId, new Set());
  }
  return userTrackedDeposits.get(chatId);
};

const getUserDepositStates = (chatId) => {
  if (!userDepositStates.has(chatId)) {
    userDepositStates.set(chatId, new Map());
  }
  return userDepositStates.get(chatId);
};

// Get all users tracking a specific deposit ID
const getUsersTrackingDeposit = (depositId) => {
  const trackingUsers = [];
  for (const [chatId, trackedDeposits] of userTrackedDeposits.entries()) {
    if (trackedDeposits.has(depositId)) {
      trackingUsers.push(chatId);
    }
  }
  return trackingUsers;
};

// Telegram commands - now per-user
bot.onText(/\/deposit (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const idsString = match[1];
  const newIds = idsString.split(/[,\s]+/).map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  
  if (newIds.length === 0) {
    bot.sendMessage(chatId, `❌ No valid deposit IDs provided. Use: /deposit 123 or /deposit 123,456,789`, { parse_mode: 'Markdown' });
    return;
  }
  
  const userDeposits = getUserTrackedDeposits(chatId);
  const userStates = getUserDepositStates(chatId);
  
  newIds.forEach(id => {
    userDeposits.add(id);
    if (!userStates.has(id)) {
      userStates.set(id, { status: 'tracking' });
    }
  });
  
  const idsArray = Array.from(userDeposits).sort((a, b) => a - b);
  bot.sendMessage(chatId, `✅ Now tracking deposit IDs: \`${idsArray.join(', ')}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/remove (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const idsString = match[1];
  const idsToRemove = idsString.split(/[,\s]+/).map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  
  if (idsToRemove.length === 0) {
    bot.sendMessage(chatId, `❌ No valid deposit IDs provided. Use: /remove 123 or /remove 123,456,789`, { parse_mode: 'Markdown' });
    return;
  }
  
  const userDeposits = getUserTrackedDeposits(chatId);
  const userStates = getUserDepositStates(chatId);
  
  idsToRemove.forEach(id => {
    userDeposits.delete(id);
    userStates.delete(id);
  });
  
  const remainingIds = Array.from(userDeposits).sort((a, b) => a - b);
  if (remainingIds.length > 0) {
    bot.sendMessage(chatId, `✅ Removed specified IDs. Still tracking: \`${remainingIds.join(', ')}\``, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, `✅ Removed specified IDs. No deposits being tracked.`, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const userDeposits = getUserTrackedDeposits(chatId);
  const userStates = getUserDepositStates(chatId);
  
  const idsArray = Array.from(userDeposits).sort((a, b) => a - b);
  if (idsArray.length === 0) {
    bot.sendMessage(chatId, `📋 No deposits currently being tracked.`, { parse_mode: 'Markdown' });
    return;
  }
  
  let message = `📋 *Currently tracking ${idsArray.length} deposits:*\n\n`;
  idsArray.forEach(id => {
    const state = userStates.get(id);
    const status = state ? state.status : 'tracking';
    const emoji = status === 'fulfilled' ? '✅' : 
                  status === 'pruned' ? '🟠' : '👀';
    message += `${emoji} \`${id}\` - ${status}\n`;
  });
  
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/clearall/, (msg) => {
  const chatId = msg.chat.id;
  const userDeposits = getUserTrackedDeposits(chatId);
  const userStates = getUserDepositStates(chatId);
  
  userDeposits.clear();
  userStates.clear();
  bot.sendMessage(chatId, `🗑️ Cleared all tracked deposit IDs.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const isConnected = resilientProvider.currentProvider !== null;
  const statusEmoji = isConnected ? '🟢' : '🔴';
  const statusText = isConnected ? 'Connected' : 'Disconnected';
  
  bot.sendMessage(chatId, `${statusEmoji} *WebSocket Status:* ${statusText}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
🤖 *ZKP2P Tracker Commands:*

• \`/deposit 123\` - Track a single deposit
• \`/deposit 123,456,789\` - Track multiple deposits
• \`/deposit 123 456 789\` - Track multiple deposits (space separated)
• \`/remove 123\` - Stop tracking specific deposit(s)
• \`/list\` - Show all tracked deposits and their status
• \`/clearall\` - Stop tracking all deposits
• \`/status\` - Check WebSocket connection status
• \`/help\` - Show this help message

*Note: Each user has their own tracking list*
`.trim();
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Helpers
const formatUSDC = (amount) => (Number(amount) / 1e6).toFixed(2);
const formatTimestamp = (ts) => new Date(Number(ts) * 1000).toUTCString();
const txLink = (hash) => `https://basescan.org/tx/${hash}`;
const depositLink = (id) => `https://www.zkp2p.xyz/deposit/${id}`;

const fiatCurrencyMap = {
  '0x4dab77a640748de8588de6834d814a344372b205265984b969f3e97060955bfa': 'AED',
  '0xcb83cbb58eaa5007af6cad99939e4581c1e1b50d65609c30f303983301524ef3': 'AUD',
  '0x221012e06ebf59a20b82e3003cf5d6ee973d9008bdb6e2f604faa89a27235522': 'CAD',
  '0xc9d84274fd58aa177cabff54611546051b74ad658b939babaad6282500300d36': 'CHF',
  '0xfaaa9c7b2f09d6a1b0971574d43ca62c3e40723167c09830ec33f06cec921381': 'CNY',
  '0xfff16d60be267153303bbfa66e593fb8d06e24ea5ef24b6acca5224c2ca6b907': 'EUR',
  '0x90832e2dc3221e4d56977c1aa8f6a6706b9ad6542fbbdaac13097d0fa5e42e67': 'GBP',
  '0xa156dad863111eeb529c4b3a2a30ad40e6dcff3b27d8f282f82996e58eee7e7d': 'HKD',
  '0xc681c4652bae8bd4b59bec1cdb90f868d93cc9896af9862b196843f54bf254b3': 'IDR',
  '0x313eda7ae1b79890307d32a78ed869290aeb24cc0e8605157d7e7f5a69fea425': 'ILS',
  '0xfe13aafd831cb225dfce3f6431b34b5b17426b6bff4fccabe4bbe0fe4adc0452': 'JPY',
  '0x589be49821419c9c2fbb26087748bf3420a5c13b45349828f5cac24c58bbaa7b': 'KES',
  '0xa94b0702860cb929d0ee0c60504dd565775a058bf1d2a2df074c1db0a66ad582': 'MXN',
  '0xf20379023279e1d79243d2c491be8632c07cfb116be9d8194013fb4739461b84': 'MYR',
  '0xdbd9d34f382e9f6ae078447a655e0816927c7c3edec70bd107de1d34cb15172e': 'NZD',
  '0x9a788fb083188ba1dfb938605bc4ce3579d2e085989490aca8f73b23214b7c1d': 'PLN',
  '0xf998cbeba8b7a7e91d4c469e5fb370cdfa16bd50aea760435dc346008d78ed1f': 'SAR',
  '0xc241cc1f9752d2d53d1ab67189223a3f330e48b75f73ebf86f50b2c78fe8df88': 'SGD',
  '0x326a6608c2a353275bd8d64db53a9d772c1d9a5bc8bfd19dfc8242274d1e9dd4': 'THB',
  '0x128d6c262d1afe2351c6e93ceea68e00992708cfcbc0688408b9a23c0c543db2': 'TRY',
  '0xc4ae21aac0c6549d71dd96035b7e0bdb6c79ebdba8891b666115bc976d16a29e': 'USD',
  '0xe85548baf0a6732cfcc7fc016ce4fd35ce0a1877057cfec6e166af4f106a3728': 'VND',
  '0x53611f0b3535a2cfc4b8deb57fa961ca36c7b2c272dfe4cb239a29c48e549361': 'ZAR',
  '0x8fd50654b7dd2dc839f7cab32800ba0c6f7f66e1ccf89b21c09405469c2175ec': 'ARS'
};

const getFiatCode = (hash) => fiatCurrencyMap[hash.toLowerCase()] || '❓ Unknown';

const formatConversionRate = (conversionRate, fiatCode) => {
  const rate = (Number(conversionRate) / 1e18).toFixed(6);
  return `${rate} ${fiatCode} / USDC`;
};

const createDepositKeyboard = (depositId) => {
  return {
    inline_keyboard: [[
      {
        text: `🔗 View Deposit ${depositId}`,
        url: depositLink(depositId)
      }
    ]]
  };
};

// Event handler function
const handleContractEvent = async (log) => {
  console.log('\n📦 Raw log received:');
  console.log(log);

  try {
    const parsed = iface.parseLog({ 
      data: log.data, 
      topics: log.topics 
    });
    
    if (!parsed) {
      console.log('⚠️ Log format did not match our ABI');
      console.log('📝 Event signature:', log.topics[0]);
      
      if (log.topics.length >= 3) {
        const topicDepositId = parseInt(log.topics[2], 16);
        console.log('📊 Extracted deposit ID from topic:', topicDepositId);
        
        // Send to all users tracking this deposit
        const trackingUsers = getUsersTrackingDeposit(topicDepositId);
        if (trackingUsers.length > 0) {
          console.log(`⚠️ Sending unrecognized event to ${trackingUsers.length} users`);
          
          const message = `
⚠️ *Unrecognized Event for Tracked Deposit*
• *Deposit ID:* \`${topicDepositId}\`
• *Event Signature:* \`${log.topics[0]}\`
• *Block:* ${log.blockNumber}
• *Tx:* [View on BaseScan](${txLink(log.transactionHash)})
`.trim();
          
          // Send to each tracking user
          trackingUsers.forEach(chatId => {
            bot.sendMessage(chatId, message, { 
              parse_mode: 'Markdown', 
              disable_web_page_preview: true,
              reply_markup: createDepositKeyboard(topicDepositId)
            });
          });
        }
      }
      return;
    }
    
    console.log('✅ Parsed log:', parsed.name);
    console.log('🔍 Args:', parsed.args);

    const { name } = parsed;

    if (name === 'IntentSignaled') {
      const { intentHash, depositId, verifier, owner, to, amount, fiatCurrency, conversionRate, timestamp } = parsed.args;    
      const id = Number(depositId);
      const fiatCode = getFiatCode(fiatCurrency);
      const fiatAmount = ((Number(amount) / 1e6) * (Number(conversionRate) / 1e18)).toFixed(2);
      const platformName = getPlatformName(verifier);
      const formattedRate = formatConversionRate(conversionRate, fiatCode);
      
      console.log('🧪 IntentSignaled depositId:', id);

      // Find users tracking this deposit
      const trackingUsers = getUsersTrackingDeposit(id);
      if (trackingUsers.length === 0) {
        console.log('🚫 Ignored — no users tracking this depositId.');
        return;
      }

      console.log(`📤 Sending to ${trackingUsers.length} users tracking deposit ${id}`);

      const message = `
🟡 *Order Created*
• *Deposit ID:* \`${id}\`
• *Order ID:* \`${intentHash}\`
• *Platform:* ${platformName}
• *Owner:* \`${owner}\`
• *To:* \`${to}\`
• *Amount:* ${formatUSDC(amount)} USDC
• *Fiat Amount:* ${fiatAmount} ${fiatCode} 
• *Rate:* ${formattedRate}
• *Time:* ${formatTimestamp(timestamp)}
• *Block:* ${log.blockNumber}
• *Tx:* [View on BaseScan](${txLink(log.transactionHash)})
`.trim();

      // Send to each user tracking this deposit
      trackingUsers.forEach(chatId => {
        const userStates = getUserDepositStates(chatId);
        userStates.set(id, { status: 'signaled', intentHash });
        
        bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown', 
          disable_web_page_preview: true,
          reply_markup: createDepositKeyboard(id)
        });
      });
    }

    if (name === 'IntentFulfilled') {
      const { intentHash, depositId, verifier, owner, to, amount, sustainabilityFee, verifierFee } = parsed.args;
      const id = Number(depositId);
      const txHash = log.transactionHash;
      const platformName = getPlatformName(verifier);
      
      console.log('🧪 IntentFulfilled depositId:', id);

      const trackingUsers = getUsersTrackingDeposit(id);
      if (trackingUsers.length === 0) {
        console.log('🚫 Ignored — no users tracking this depositId.');
        return;
      }

      // Cancel any pending IntentPruned notification for this transaction
      if (pendingPrunedEvents.has(txHash)) {
        console.log('🔄 Cancelling IntentPruned notification - order was fulfilled');
        pendingPrunedEvents.delete(txHash);
      }

      console.log(`📤 Sending fulfillment to ${trackingUsers.length} users tracking deposit ${id}`);

      const message = `
🟢 *Order Fulfilled*
• *Deposit ID:* \`${id}\`
• *Order ID:* \`${intentHash}\`
• *Platform:* ${platformName}
• *Owner:* \`${owner}\`
• *To:* \`${to}\`
• *Amount:* ${formatUSDC(amount)} USDC
• *Sustainability Fee:* ${formatUSDC(sustainabilityFee)} USDC
• *Verifier Fee:* ${formatUSDC(verifierFee)} USDC
• *Block:* ${log.blockNumber}
• *Tx:* [View on BaseScan](${txLink(log.transactionHash)})
`.trim();

      trackingUsers.forEach(chatId => {
        const userStates = getUserDepositStates(chatId);
        userStates.set(id, { status: 'fulfilled', intentHash });
        
        bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown', 
          disable_web_page_preview: true,
          reply_markup: createDepositKeyboard(id)
        });
      });
    }

    if (name === 'IntentPruned') {
      const { intentHash, depositId } = parsed.args;
      const id = Number(depositId);
      console.log('🧪 IntentPruned depositId:', id);

      const trackingUsers = getUsersTrackingDeposit(id);
      if (trackingUsers.length === 0) {
        console.log('🚫 Ignored — no users tracking this depositId.');
        return;
      }

      const txHash = log.transactionHash;
      pendingPrunedEvents.set(txHash, {
        intentHash,
        depositId: id,
        blockNumber: log.blockNumber,
        txHash,
        trackingUsers // Store which users to notify
      });

      setTimeout(() => {
        const prunedEvent = pendingPrunedEvents.get(txHash);
        if (prunedEvent) {
          console.log(`📤 Sending cancellation to ${prunedEvent.trackingUsers.length} users tracking deposit ${id}`);
          
          const message = `
🟠 *Order Cancelled*
• *Deposit ID:* \`${id}\`
• *Order ID:* \`${intentHash}\`
• *Block:* ${prunedEvent.blockNumber}
• *Tx:* [View on BaseScan](${txLink(prunedEvent.txHash)})

*Order was cancelled*
`.trim();

          prunedEvent.trackingUsers.forEach(chatId => {
            const userStates = getUserDepositStates(chatId);
            userStates.set(id, { status: 'pruned', intentHash });
            
            bot.sendMessage(chatId, message, { 
              parse_mode: 'Markdown', 
              disable_web_page_preview: true,
              reply_markup: createDepositKeyboard(id)
            });
          });
          
          pendingPrunedEvents.delete(txHash);
        }
      }, 2000);
    }

  } catch (err) {
    console.error('❌ Failed to parse log:', err.message);
    console.log('👀 Raw log (unparsed):', log);
    console.log('📝 Topics received:', log.topics);
    console.log('📝 First topic (event signature):', log.topics[0]);
    console.log('🔄 Continuing to listen for other events...');
  }
};

// Initialize the resilient WebSocket provider
const resilientProvider = new ResilientWebSocketProvider(
  process.env.BASE_RPC,
  contractAddress,
  handleContractEvent
);

// Add startup message
console.log('🤖 ZKP2P Telegram Bot Started (Per-User Tracking with Auto-Reconnect)');
console.log('🔍 Listening for contract events...');
console.log(`📡 Contract: ${contractAddress}`);

// Enhanced error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  // Don't exit, let reconnection handle recovery
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit, let reconnection handle recovery
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Received SIGTERM, shutting down gracefully...');
  if (resilientProvider.currentProvider) {
    resilientProvider.currentProvider.removeAllListeners();
    resilientProvider.currentProvider.destroy?.();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Received SIGINT, shutting down gracefully...');
  if (resilientProvider.currentProvider) {
    resilientProvider.currentProvider.removeAllListeners();
    resilientProvider.currentProvider.destroy?.();
  }
  process.exit(0);
});
