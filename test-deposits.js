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

    if (error) {
      console.error('Error initializing user:', error);
      return null;
    }
    return data;
  }

  // Get user's ACTIVE tracked deposits only
  async getUserDeposits(chatId) {
    const { data, error } = await supabase
      .from('user_deposits')
      .select('deposit_id, status')
      .eq('chat_id', chatId)
      .eq('is_active', true); // Only get active deposits

    if (error) {
      console.error('Error fetching user deposits:', error);
      return new Set();
    }

    if (!data || data.length === 0) {
      return new Set();
    }

    return new Set(data.map(row => parseInt(row.deposit_id)));
  }

  // Add deposit for user (always creates as active)
  async addUserDeposit(chatId, depositId) {
    // Validate inputs
    if (!chatId || !depositId) {
      console.error('Error: Missing chatId or depositId');
      return false;
    }

    // Ensure depositId is a valid integer
    const depositIdInt = parseInt(depositId);
    if (isNaN(depositIdInt) || depositIdInt <= 0) {
      console.error('Error: Invalid depositId, must be a positive integer');
      return false;
    }

    try {
      // First, try to update existing record if it exists
      const { data: updateData, error: updateError } = await supabase
        .from('user_deposits')
        .update({
          status: 'tracking',
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('chat_id', chatId)
        .eq('deposit_id', depositIdInt)
        .select();

      if (updateError) {
        console.error('Error updating deposit:', updateError);
        return false;
      }

      // If no rows were updated, insert a new record
      if (!updateData || updateData.length === 0) {
        const { data: insertData, error: insertError } = await supabase
          .from('user_deposits')
          .insert({
            chat_id: chatId,
            deposit_id: depositIdInt,
            status: 'tracking',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting deposit:', insertError);
          return false;
        }
      }

      console.log(`✅ Successfully added deposit ${depositIdInt} for user ${chatId}`);
      return true;

    } catch (error) {
      console.error('Error in addUserDeposit:', error);
      return false;
    }
  }

  // Remove deposit - mark as inactive instead of deleting
  async removeUserDeposit(chatId, depositId) {
    // Validate inputs
    if (!chatId || !depositId) {
      console.error('Error: Missing chatId or depositId');
      return false;
    }

    // Ensure depositId is a valid integer
    const depositIdInt = parseInt(depositId);
    if (isNaN(depositIdInt) || depositIdInt <= 0) {
      console.error('Error: Invalid depositId, must be a positive integer');
      return false;
    }

    const { data, error } = await supabase
      .from('user_deposits')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('chat_id', chatId)
      .eq('deposit_id', depositIdInt);

    if (error) {
      console.error('Error removing deposit:', error);
      return false;
    }

    console.log(`✅ Successfully removed deposit ${depositIdInt} for user ${chatId}`);
    return true;
  }

  // Get user's ACTIVE deposit states only
  async getUserDepositStates(chatId) {
    const { data, error } = await supabase
      .from('user_deposits')
      .select('deposit_id, status, intent_hash')
      .eq('chat_id', chatId)
      .eq('is_active', true); // Only get active deposits

    if (error) {
      console.error('Error fetching user deposit states:', error);
      return new Map();
    }

    if (!data || data.length === 0) {
      return new Map();
    }

    const statesMap = new Map();
    data.forEach(row => {
      statesMap.set(parseInt(row.deposit_id), {
        status: row.status,
        intentHash: row.intent_hash
      });
    });

    return statesMap;
  }

  // Update deposit status (only for active deposits)
  async updateDepositStatus(chatId, depositId, status, intentHash = null) {
    // Validate inputs
    if (!chatId || !depositId || !status) {
      console.error('Error: Missing chatId, depositId, or status');
      return false;
    }

    // Ensure depositId is a valid integer
    const depositIdInt = parseInt(depositId);
    if (isNaN(depositIdInt) || depositIdInt <= 0) {
      console.error('Error: Invalid depositId, must be a positive integer');
      return false;
    }

    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (intentHash) {
      updateData.intent_hash = intentHash;
    }

    const { data, error } = await supabase
      .from('user_deposits')
      .update(updateData)
      .eq('chat_id', chatId)
      .eq('deposit_id', depositIdInt)
      .eq('is_active', true); // Only update active deposits

    if (error) {
      console.error('Error updating deposit status:', error);
      return false;
    }

    console.log(`✅ Successfully updated deposit ${depositIdInt} status to ${status} for user ${chatId}`);
    return true;
  }

  // Store deposit amount
  async storeDepositAmount(depositId, amount) {
    // Validate inputs
    if (!depositId || !amount) {
      console.error('Error: Missing depositId or amount');
      return false;
    }

    // Ensure depositId is a valid integer (for deposit_amounts table which uses bigint)
    const depositIdInt = parseInt(depositId);
    if (isNaN(depositIdInt) || depositIdInt <= 0) {
      console.error('Error: Invalid depositId, must be a positive integer');
      return false;
    }

    // Ensure amount is a valid number
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error('Error: Invalid amount, must be a positive number');
      return false;
    }

    // Convert to integer for database storage (multiply by 100 to store cents)
    // This is because the schema defines amount as bigint, not decimal
    const amountInt = Math.round(amountNum * 100);

    // Store in database for persistence
    const { data, error } = await supabase
      .from('deposit_amounts')
      .upsert({
        deposit_id: depositIdInt,
        amount: amountInt,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'deposit_id'
      });

    if (error) {
      console.error('Error storing deposit amount:', error);
      return false;
    }

    console.log(`✅ Successfully stored amount ${amountNum} (as ${amountInt} cents) for deposit ${depositIdInt}`);
    return true;
  }

  // Get deposit amount
  async getDepositAmount(depositId) {
    // Validate input
    if (!depositId) {
      console.error('Error: Missing depositId');
      return 0;
    }

    // Ensure depositId is a valid integer
    const depositIdInt = parseInt(depositId);
    if (isNaN(depositIdInt) || depositIdInt <= 0) {
      console.error('Error: Invalid depositId, must be a positive integer');
      return 0;
    }

    // Get from database
    const { data, error } = await supabase
      .from('deposit_amounts')
      .select('amount')
      .eq('deposit_id', depositIdInt)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error getting deposit amount:', error);
      }
      return 0;
    }

    // Convert from cents back to decimal
    const storedAmount = data?.amount || 0;
    return storedAmount / 100;
  }
}

async function testDepositFunctionality() {
  console.log('🧪 Testing Deposit Functionality...\n');

  const db = new DatabaseManager();
  const testChatId = 123456789; // Test chat ID
  const testDepositId1 = 12345;
  const testDepositId2 = 67890;
  const testAmount = 1000.50;

  try {
    // 1. Initialize test user
    console.log('1. Initializing test user...');
    await db.initUser(testChatId, 'testuser', 'Test', 'User');
    console.log('✅ User initialized successfully\n');

    // 2. Test getting deposits for new user (should be empty)
    console.log('2. Getting deposits for new user (should be empty)...');
    let userDeposits = await db.getUserDeposits(testChatId);
    console.log('📋 Found deposits:', userDeposits.size);
    if (userDeposits.size === 0) {
      console.log('✅ Correctly returned empty deposits for new user\n');
    } else {
      console.log('❌ Expected empty deposits but got:', userDeposits, '\n');
    }

    // 3. Test adding first deposit
    console.log('3. Adding first deposit...');
    const addResult1 = await db.addUserDeposit(testChatId, testDepositId1);
    if (addResult1) {
      console.log('✅ Deposit added successfully\n');
    } else {
      console.log('❌ Failed to add deposit\n');
      return;
    }

    // 4. Test getting deposits after adding one
    console.log('4. Getting deposits after adding one...');
    userDeposits = await db.getUserDeposits(testChatId);
    console.log('📋 Found deposits:', userDeposits.size, Array.from(userDeposits));
    if (userDeposits.size === 1 && userDeposits.has(testDepositId1)) {
      console.log('✅ Correctly retrieved single deposit\n');
    } else {
      console.log('❌ Expected one deposit but got:', userDeposits, '\n');
    }

    // 5. Test adding second deposit
    console.log('5. Adding second deposit...');
    const addResult2 = await db.addUserDeposit(testChatId, testDepositId2);
    if (addResult2) {
      console.log('✅ Second deposit added successfully\n');
    } else {
      console.log('❌ Failed to add second deposit\n');
      return;
    }

    // 6. Test getting deposits after adding second
    console.log('6. Getting deposits after adding second...');
    userDeposits = await db.getUserDeposits(testChatId);
    console.log('📋 Found deposits:', userDeposits.size, Array.from(userDeposits));
    if (userDeposits.size === 2 && userDeposits.has(testDepositId1) && userDeposits.has(testDepositId2)) {
      console.log('✅ Correctly retrieved both deposits\n');
    } else {
      console.log('❌ Expected two deposits but got:', userDeposits, '\n');
    }

    // 7. Test getting deposit states
    console.log('7. Getting deposit states...');
    const depositStates = await db.getUserDepositStates(testChatId);
    console.log('📋 Deposit states:', depositStates.size);
    if (depositStates.size === 2) {
      console.log('✅ Correctly retrieved deposit states\n');
      depositStates.forEach((state, depositId) => {
        console.log(`   Deposit ${depositId}: ${state.status}`);
      });
    } else {
      console.log('❌ Expected 2 deposit states but got:', depositStates.size, '\n');
    }

    // 8. Test storing deposit amount
    console.log('\n8. Storing deposit amount...');
    const storeAmountResult = await db.storeDepositAmount(testDepositId1, testAmount);
    if (storeAmountResult) {
      console.log('✅ Amount stored successfully\n');
    } else {
      console.log('❌ Failed to store amount\n');
    }

    // 9. Test getting deposit amount
    console.log('9. Getting deposit amount...');
    const retrievedAmount = await db.getDepositAmount(testDepositId1);
    console.log('📋 Retrieved amount:', retrievedAmount);
    if (retrievedAmount === testAmount) {
      console.log('✅ Correctly retrieved deposit amount\n');
    } else {
      console.log('❌ Expected amount', testAmount, 'but got:', retrievedAmount, '\n');
    }

    // 10. Test updating deposit status
    console.log('10. Updating deposit status...');
    const updateResult = await db.updateDepositStatus(testChatId, testDepositId1, 'completed', '0x123abc');
    if (updateResult) {
      console.log('✅ Deposit status updated successfully\n');
    } else {
      console.log('❌ Failed to update deposit status\n');
    }

    // 11. Test getting updated deposit states
    console.log('11. Getting updated deposit states...');
    const updatedStates = await db.getUserDepositStates(testChatId);
    const deposit1State = updatedStates.get(testDepositId1);
    if (deposit1State && deposit1State.status === 'completed' && deposit1State.intentHash === '0x123abc') {
      console.log('✅ Deposit status correctly updated\n');
    } else {
      console.log('❌ Expected completed status with intent hash but got:', deposit1State, '\n');
    }

    // 12. Test removing a deposit
    console.log('12. Removing first deposit...');
    const removeResult = await db.removeUserDeposit(testChatId, testDepositId1);
    if (removeResult) {
      console.log('✅ Deposit removed successfully\n');
    } else {
      console.log('❌ Failed to remove deposit\n');
    }

    // 13. Test getting deposits after removal
    console.log('13. Getting deposits after removal...');
    userDeposits = await db.getUserDeposits(testChatId);
    console.log('📋 Found deposits:', userDeposits.size, Array.from(userDeposits));
    if (userDeposits.size === 1 && userDeposits.has(testDepositId2)) {
      console.log('✅ Correctly removed first deposit, second remains\n');
    } else {
      console.log('❌ Expected one deposit but got:', userDeposits, '\n');
    }

    // 14. Test adding duplicate deposit (should update, not create duplicate)
    console.log('14. Adding duplicate deposit...');
    const duplicateResult = await db.addUserDeposit(testChatId, testDepositId2);
    if (duplicateResult) {
      console.log('✅ Duplicate deposit handled correctly\n');
    } else {
      console.log('❌ Failed to handle duplicate deposit\n');
    }

    // 15. Verify still only one deposit
    console.log('15. Verifying no duplicates...');
    userDeposits = await db.getUserDeposits(testChatId);
    console.log('📋 Final deposit count:', userDeposits.size);
    if (userDeposits.size === 1) {
      console.log('✅ No duplicates created\n');
    } else {
      console.log('❌ Expected 1 deposit but got:', userDeposits.size, '\n');
    }

    // 16. Test error handling with invalid deposit ID
    console.log('16. Testing error handling with invalid deposit ID...');
    const invalidResult = await db.addUserDeposit(testChatId, 'invalid');
    if (!invalidResult) {
      console.log('✅ Correctly rejected invalid deposit ID\n');
    } else {
      console.log('❌ Should have rejected invalid deposit ID\n');
    }

    // 17. Test error handling with negative deposit ID
    console.log('17. Testing error handling with negative deposit ID...');
    const negativeResult = await db.addUserDeposit(testChatId, -123);
    if (!negativeResult) {
      console.log('✅ Correctly rejected negative deposit ID\n');
    } else {
      console.log('❌ Should have rejected negative deposit ID\n');
    }

    console.log('\n🎉 All deposit tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testDepositFunctionality();