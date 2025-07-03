class DatabaseManager {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // Initialize user if not exists
  async initUser(chatId, username = null, firstName = null, lastName = null) {
    const { data, error } = await this.supabase
      .from('users')
      .upsert({
        chat_id: chatId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        last_active: new Date().toISOString()
      }, {
        onConflict: 'chat_id',
        ignoreDuplicates: false
      });

    if (error) console.error('Error initializing user:', error);
    return data;
  }

  // Get user's ACTIVE tracked deposits only
  async getUserDeposits(chatId) {
    const { data, error } = await this.supabase
      .from('user_deposits')
      .select('deposit_id, status')
      .eq('chat_id', chatId)
      .eq('is_active', true); // Only get active deposits

    if (error) {
      console.error('Error fetching user deposits:', error);
      return new Set();
    }

    return new Set(data.map(row => row.deposit_id));
  }

  // Get user's ACTIVE deposit states only
  async getUserDepositStates(chatId) {
    const { data, error } = await this.supabase
      .from('user_deposits')
      .select('deposit_id, status, intent_hash')
      .eq('chat_id', chatId)
      .eq('is_active', true); // Only get active deposits

    if (error) {
      console.error('Error fetching user deposit states:', error);
      return new Map();
    }

    const statesMap = new Map();
    data.forEach(row => {
      statesMap.set(row.deposit_id, {
        status: row.status,
        intentHash: row.intent_hash
      });
    });

    return statesMap;
  }

  // Add deposit for user (always creates as active)
  async addUserDeposit(chatId, depositId) {
    const { error } = await this.supabase
      .from('user_deposits')
      .upsert({
        chat_id: chatId,
        deposit_id: depositId,
        status: 'tracking',
        is_active: true, // Explicitly set as active
        created_at: new Date().toISOString()
      }, {
        onConflict: 'chat_id,deposit_id'
      });

    if (error) console.error('Error adding deposit:', error);
  }

  // Remove deposit - mark as inactive instead of deleting
  async removeUserDeposit(chatId, depositId) {
    const { error } = await this.supabase
      .from('user_deposits')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('chat_id', chatId)
      .eq('deposit_id', depositId);

    if (error) console.error('Error removing deposit:', error);
  }

  // Update deposit status (only for active deposits)
  async updateDepositStatus(chatId, depositId, status, intentHash = null) {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (intentHash) {
      updateData.intent_hash = intentHash;
    }

    const { error } = await this.supabase
      .from('user_deposits')
      .update(updateData)
      .eq('chat_id', chatId)
      .eq('deposit_id', depositId)
      .eq('is_active', true); // Only update active deposits

    if (error) console.error('Error updating deposit status:', error);
  }

  // Get ACTIVE listen all preference only
  async getUserListenAll(chatId) {
    const { data, error } = await this.supabase
      .from('user_settings')
      .select('listen_all')
      .eq('chat_id', chatId)
      .eq('is_active', true) // Only get active settings
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting listen all:', error);
    }
    return data?.listen_all || false;
  }

  async setUserListenAll(chatId, listenAll) {
    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        chat_id: chatId,
        listen_all: listenAll,
        is_active: true, // Always active when setting
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'chat_id'
      });

    if (error) console.error('Error setting listen all:', error);
  }

  // Clear user data - mark as inactive (PRESERVES DATA FOR ANALYTICS)
  async clearUserData(chatId) {
    const timestamp = new Date().toISOString();

    // Mark deposits as inactive instead of deleting
    const { error: error1 } = await this.supabase
      .from('user_deposits')
      .update({
        is_active: false,
        updated_at: timestamp
      })
      .eq('chat_id', chatId);

    // Mark settings as inactive instead of deleting  
    const { error: error2 } = await this.supabase
      .from('user_settings')
      .update({
        is_active: false,
        updated_at: timestamp
      })
      .eq('chat_id', chatId);

    // Clear sniper settings too
    const { error: error3 } = await this.supabase
      .from('user_snipers')
      .update({
        is_active: false,
        updated_at: timestamp
      })
      .eq('chat_id', chatId);

    if (error1) console.error('Error clearing user deposits:', error1);
    if (error2) console.error('Error clearing user settings:', error2);
    if (error3) console.error('Error clearing user snipers:', error3);
  }

  // Log event notification (for analytics)
  async logEventNotification(chatId, depositId, eventType) {
    const { error } = await this.supabase
      .from('event_notifications')
      .insert({
        chat_id: chatId,
        deposit_id: depositId,
        event_type: eventType,
        sent_at: new Date().toISOString()
      });

    if (error) console.error('Error logging notification:', error);
  }

  // Get users interested in a deposit (only ACTIVE users/settings)
  async getUsersInterestedInDeposit(depositId) {
    // Users listening to all deposits (ACTIVE settings only)
    const { data: allListeners } = await this.supabase
      .from('user_settings')
      .select('chat_id')
      .eq('listen_all', true)
      .eq('is_active', true); // Only active "listen all" users

    // Users tracking specific deposit (ACTIVE tracking only)
    const { data: specificTrackers } = await this.supabase
      .from('user_deposits')
      .select('chat_id')
      .eq('deposit_id', depositId)
      .eq('is_active', true); // Only active deposit tracking

    const allUsers = new Set();

    allListeners?.forEach(user => allUsers.add(user.chat_id));
    specificTrackers?.forEach(user => allUsers.add(user.chat_id));

    return Array.from(allUsers);
  }

  // BONUS: Analytics methods (new!)
  async getAnalytics() {
    // Total users who ever used the bot
    const { data: totalUsers } = await this.supabase
      .from('users')
      .select('chat_id', { count: 'exact' });

    // Currently active trackers
    const { data: activeTrackers } = await this.supabase
      .from('user_deposits')
      .select('chat_id', { count: 'exact' })
      .eq('is_active', true);

    // Total tracking sessions (including cleared ones)
    const { data: allTimeTracking } = await this.supabase
      .from('user_deposits')
      .select('chat_id', { count: 'exact' });

    // Most tracked deposits
    const { data: popularDeposits } = await this.supabase
      .from('user_deposits')
      .select('deposit_id')
      .eq('is_active', true);

    return {
      totalUsers: totalUsers?.length || 0,
      activeTrackers: activeTrackers?.length || 0,
      allTimeTracking: allTimeTracking?.length || 0,
      popularDeposits: popularDeposits || []
    };
  }

  async removeUserSniper(chatId, currency = null, platform = null) {
    let query = this.supabase
      .from('user_snipers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('chat_id', chatId);

    if (currency) {
      query = query.eq('currency', currency.toUpperCase());
    }

    if (platform) {
      query = query.eq('platform', platform.toLowerCase());
    }

    const { error } = await query;
    if (error) console.error('Error removing sniper:', error);
  }

  async setUserSniper(chatId, currency, platform = null) {
    // Always insert - no deactivation needed
    const { error } = await this.supabase
      .from('user_snipers')
      .insert({
        chat_id: chatId,
        currency: currency.toUpperCase(),
        platform: platform ? platform.toLowerCase() : null,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error setting sniper:', error);
      return false;
    }
    return true;
  }

  async getUserSnipers(chatId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await this.supabase
      .from('user_snipers')
      .select('currency, platform, created_at')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user snipers:', error);
      return [];
    }

    // Deduplicate - keep only the newest entry for each currency+platform combo
    const unique = new Map();
    data.forEach(row => {
      const key = `${row.currency}-${row.platform ?? 'all'}`; // ← Add fallback for null
      const existing = unique.get(key);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        unique.set(key, row);
      }
    });

    return Array.from(unique.values());
  }

  async getUsersWithSniper(currency, platform = null) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = this.supabase
      .from('user_snipers')
      .select('chat_id, currency, platform, created_at')
      .eq('currency', currency.toUpperCase())
      .gte('created_at', thirtyDaysAgo.toISOString());

    // If platform is specified, match exactly OR get users with null platform (all platforms)
    if (platform) {
      // Get users who either specified this platform OR want all platforms (null)
      query = query.or(`platform.eq.${platform.toLowerCase()},platform.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users with sniper:', error);
      return [];
    }

    // Deduplicate by chat_id - if user has multiple entries, keep the newest
    const userMap = new Map();
    data.forEach(row => {
      const existing = userMap.get(row.chat_id);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        userMap.set(row.chat_id, row);
      }
    });

    return Array.from(userMap.keys()); // Return just the chat IDs
  }

  async logSniperAlert(chatId, depositId, currency, depositRate, marketRate, percentageDiff) {
    const { error } = await this.supabase
      .from('sniper_alerts')
      .insert({
        chat_id: chatId,
        deposit_id: depositId,
        currency: currency,
        deposit_rate: depositRate,
        market_rate: marketRate,
        percentage_diff: percentageDiff,
        sent_at: new Date().toISOString()
      });

    if (error) console.error('Error logging sniper alert:', error);
  }

  async storeDepositAmount(depositId, amount) {
    // Also store in database for persistence
    const { error } = await this.supabase
      .from('deposit_amounts')
      .upsert({
        deposit_id: Number(depositId),
        amount: Number(amount),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'deposit_id'
      });

    if (error) console.error('Error storing deposit amount:', error);
  }

  async getDepositAmount(depositId) {
    // Fall back to database
    const { data, error } = await this.supabase
      .from('deposit_amounts')
      .select('amount')
      .eq('deposit_id', Number(depositId))
      .single();

    if (error) {
      console.error('Error getting deposit amount:', error);
      return 0;
    }

    return data?.amount || 0;
  }

  // Get user's global sniper threshold
  async getUserThreshold(chatId) {
    const { data, error } = await this.supabase
      .from('user_settings')
      .select('threshold')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting user threshold:', error);
    }
    return data?.threshold || 0.2; // Default to 0.2% if not set
  }

  // Set user's global sniper threshold
  async setUserThreshold(chatId, threshold) {
    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        chat_id: chatId,
        threshold: threshold,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'chat_id'
      });

    if (error) console.error('Error setting user threshold:', error);
  }

  // add new samba contract to DB 
  async addSambaContract(contractAddress, user) {
    const { error } = await this.supabase
      .from('samba_contracts')
      .upsert({
        contract_address: contractAddress.toLowerCase(),
        user,
        is_active: true,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'contract_address'
      });

    if (error) console.error('Error adding samba contract:', error);
    return !error;
  }

  async removeSambaContract(contractAddress) {
    const { error } = await this.supabase
      .from('samba_contracts')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('contract_address', contractAddress.toLowerCase());

    if (error) console.error('Error removing samba contract:', error);
    return !error;
  }

  async getSambaContracts() {
    const { data, error } = await this.supabase
      .from('samba_contracts')
      .select('contract_address, user, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching samba contracts:', error);
      return [];
    }

    return data || [];
  }

  async isSambaContract(contractAddress) {
    const { data, error } = await this.supabase
      .from('samba_contracts')
      .select('contract_address')
      .eq('contract_address', contractAddress.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking samba contract:', error);
    }
    return !!data;
  }
}

module.exports = DatabaseManager;