const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const DatabaseManager = require('./DatabaseManager');

// Supabase setup
const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

// Create database manager instance
const db = new DatabaseManager(supabase);

module.exports = {
  supabase,
  db
};