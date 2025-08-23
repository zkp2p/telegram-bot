require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

class DatabaseManager {
  // Helper function to format timestamps for PostgreSQL (without timezone)
  _formatTimestamp(date) {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  // Initialize user if not exists
  async initUser(chatId, username = null, firstName = null, lastName = null) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        chat_id: chatId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        last_active: this._formatTimestamp(new Date())
      }, {
        onConflict: 'chat_id',
        ignoreDuplicates: false
      });

    if (error) console.error('Error initializing user:', error);
    return data;
  }

  async setUserSniper(chatId, currency, platform = null) {
    // Always insert - no deactivation needed
    const now = new Date();
    const timestamp = this._formatTimestamp(now);

    // First, try to deactivate any existing snipers for this currency/platform combo
    let deactivateQuery = supabase
      .from('user_snipers')
      .update({ is_active: false, updated_at: timestamp })
      .eq('chat_id', chatId)
      .eq('currency', currency.toUpperCase())
      .eq('is_active', true);

    if (platform !== null) {
      deactivateQuery = deactivateQuery.eq('platform', platform.toLowerCase());
    } else {
      deactivateQuery = deactivateQuery.is('platform', null);
    }

    await deactivateQuery;

    // Now insert the new sniper
    const { error } = await supabase
      .from('user_snipers')
      .insert({
        chat_id: chatId,
        currency: currency.toUpperCase(),
        platform: platform ? platform.toLowerCase() : null,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp
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
    // Format date to match PostgreSQL timestamp without time zone format
    const thirtyDaysAgoFormatted = this._formatTimestamp(thirtyDaysAgo);

    const { data, error } = await supabase
      .from('user_snipers')
      .select('currency, platform, created_at')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .gte('created_at', thirtyDaysAgoFormatted)
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
}

async function testSniperFunctionality() {
  console.log('🧪 Testing Sniper Functionality...\n');

  const db = new DatabaseManager();
  const testChatId = 123456789; // Test chat ID
  const testCurrency = 'EUR';
  const testPlatform = 'revolut';

  try {
    // 1. Initialize test user
    console.log('1. Initializing test user...');
    await db.initUser(testChatId, 'testuser', 'Test', 'User');
    console.log('✅ User initialized successfully\n');

    // 2. Test setting a sniper
    console.log('2. Setting sniper for EUR on Revolut...');
    const setResult = await db.setUserSniper(testChatId, testCurrency, testPlatform);
    if (setResult) {
      console.log('✅ Sniper set successfully\n');
    } else {
      console.log('❌ Failed to set sniper\n');
      return;
    }

    // 3. Test getting snipers
    console.log('3. Retrieving user snipers...');
    const snipers = await db.getUserSnipers(testChatId);
    console.log('📋 Found snipers:', snipers);

    if (snipers.length > 0) {
      console.log('✅ Successfully retrieved snipers\n');
      console.log('🎯 Sniper details:');
      snipers.forEach((sniper, index) => {
        console.log(`   ${index + 1}. Currency: ${sniper.currency}, Platform: ${sniper.platform || 'All Platforms'}, Created: ${sniper.created_at}`);
      });
    } else {
      console.log('❌ No snipers found\n');
    }

    // 4. Test setting another sniper for the same currency (should update)
    console.log('\n4. Setting sniper for same currency (EUR) but different platform (wise)...');
    await db.setUserSniper(testChatId, testCurrency, 'wise');
    const snipersAfterUpdate = await db.getUserSnipers(testChatId);
    console.log('📋 Snipers after update:', snipersAfterUpdate.length, 'total');

    // 5. Test setting sniper without platform (all platforms)
    console.log('\n5. Setting sniper for USD on all platforms...');
    await db.setUserSniper(testChatId, 'USD');
    const finalSnipers = await db.getUserSnipers(testChatId);
    console.log('📋 Final sniper count:', finalSnipers.length);

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testSniperFunctionality();