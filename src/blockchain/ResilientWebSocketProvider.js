const { WebSocketProvider } = require('ethers');

// Enhanced WebSocket Provider with better connection stability
class ResilientWebSocketProvider {
  constructor(url, contractAddress, eventHandler) {
    this.url = url;
    this.contractAddress = contractAddress;
    this.eventHandler = eventHandler;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 50;
    this.isConnecting = false;
    this.isDestroyed = false;
    this.provider = null;
    this.reconnectTimer = null;
    this.keepAliveTimer = null; // Add keep-alive timer
    this.lastActivityTime = Date.now();

    this.connect();
  }

  async connect() {
    if (this.isConnecting || this.isDestroyed) return;
    this.isConnecting = true;

    try {
      console.log(`🔌 Attempting WebSocket connection (attempt ${this.reconnectAttempts + 1})`);

      // Properly cleanup existing provider
      if (this.provider) {
        await this.cleanup();
      }

      // Add connection options for better stability
      this.provider = new WebSocketProvider(this.url, undefined, {
        // Add connection options
        reconnectInterval: 5000,
        maxReconnectInterval: 30000,
        reconnectDecay: 1.5,
        timeoutInterval: 10000,
        maxReconnectAttempts: null, // We handle this ourselves
        debug: false
      });

      this.setupEventListeners();

      // Test connection with timeout
      const networkPromise = this.provider.getNetwork();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 15000) // Increased timeout
      );

      await Promise.race([networkPromise, timeoutPromise]);

      console.log('✅ WebSocket connected successfully');
      this.lastActivityTime = Date.now();

      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.isConnecting = false;

      this.setupContractListening();
      this.startKeepAlive(); // Start keep-alive mechanism

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
      this.isConnecting = false;

      // Only schedule reconnect if not destroyed
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  async cleanup() {
    if (this.provider) {
      try {
        // Stop keep-alive first
        this.stopKeepAlive();

        // Remove all listeners first
        this.provider.removeAllListeners();

        // Close WebSocket connection if it exists
        if (this.provider._websocket) {
          this.provider._websocket.removeAllListeners();
          if (this.provider._websocket.readyState === 1) { // OPEN
            this.provider._websocket.close(1000, 'Normal closure'); // Proper close code
          }
        }

        // Destroy provider
        if (typeof this.provider.destroy === 'function') {
          await this.provider.destroy();
        }

        console.log('🧹 Cleaned up existing provider');
      } catch (error) {
        console.error('⚠️ Error during cleanup:', error.message);
      }
    }
  }

  setupEventListeners() {
    if (!this.provider || this.isDestroyed) return;

    if (this.provider._websocket) {
      this.provider._websocket.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        this.stopKeepAlive();
        if (!this.isDestroyed) {
          // Add delay before reconnecting to avoid rapid reconnections
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.scheduleReconnect();
            }
          }, 2000);
        }
      });

      this.provider._websocket.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.stopKeepAlive();
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      });

      // Enhanced ping/pong handling
      this.provider._websocket.on('ping', (data) => {
        console.log('🏓 WebSocket ping received');
        this.lastActivityTime = Date.now();
        this.provider._websocket.pong(data); // Respond to ping
      });

      this.provider._websocket.on('pong', () => {
        console.log('🏓 WebSocket pong received');
        this.lastActivityTime = Date.now();
      });

      // Track any message activity
      this.provider._websocket.on('message', () => {
        this.lastActivityTime = Date.now();
      });
    }

    // Listen for provider events too
    this.provider.on('error', (error) => {
      console.error('❌ Provider error:', error.message);
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    });
  }

  startKeepAlive() {
    this.stopKeepAlive(); // Clear any existing timer

    // Send ping every 30 seconds to keep connection alive
    this.keepAliveTimer = setInterval(() => {
      if (this.provider && this.provider._websocket && this.provider._websocket.readyState === 1) {
        try {
          this.provider._websocket.ping();
          console.log('🏓 Sent keep-alive ping');

          // Check if we haven't received any activity in 90 seconds
          const timeSinceActivity = Date.now() - this.lastActivityTime;
          if (timeSinceActivity > 90000) {
            console.log('⚠️ No activity for 90 seconds, forcing reconnection');
            this.scheduleReconnect();
          }
        } catch (error) {
          console.error('❌ Keep-alive ping failed:', error.message);
          this.scheduleReconnect();
        }
      }
    }, 30000); // 30 seconds
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  setupContractListening() {
    if (!this.provider || this.isDestroyed) return;

    try {
      // Add error handling for the event listener
      this.provider.on({ address: this.contractAddress.toLowerCase() }, (log) => {
        this.lastActivityTime = Date.now(); // Update activity time on events
        this.eventHandler(log);
      });

      console.log(`👂 Listening for events on contract: ${this.contractAddress}`);
    } catch (error) {
      console.error('❌ Failed to set up contract listening:', error.message);
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  scheduleReconnect() {
    if (this.isConnecting || this.isDestroyed) return;

    // Clear existing timer if any
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.stopKeepAlive(); // Stop keep-alive during reconnection

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

    this.reconnectTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, delay);
  }

  // Add manual restart method
  async restart() {
    console.log('🔄 Manual restart initiated...');
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopKeepAlive();
    await this.cleanup();

    // Wait a bit before reconnecting
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, 3000); // Increased delay
  }

  // Add proper destroy method
  async destroy() {
    console.log('🛑 Destroying WebSocket provider...');
    this.isDestroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopKeepAlive();
    await this.cleanup();
    this.provider = null;
  }

  get currentProvider() {
    return this.provider;
  }

  get isConnected() {
    return this.provider &&
      this.provider._websocket &&
      this.provider._websocket.readyState === 1 && // WebSocket.OPEN
      (Date.now() - this.lastActivityTime) < 120000; // Active within 2 minutes
  }
}

module.exports = ResilientWebSocketProvider;