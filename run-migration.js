const fs = require('fs');
const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./database_migration.sql', 'utf8');
    
    // Split into individual statements (basic splitting on semicolons)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await pool.execute(statement);
          console.log(`✅ Statement ${i + 1} completed successfully`);
        } catch (error) {
          if (error.message.includes('Duplicate column') || 
              error.message.includes('already exists') ||
              error.message.includes('Duplicate entry')) {
            console.log(`⏭️  Statement ${i + 1} skipped (already exists): ${error.message.substring(0, 100)}...`);
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            console.log(`📝 Failed statement: ${statement.substring(0, 200)}...`);
            // Continue with other statements instead of stopping
          }
        }
      }
    }
    
    console.log('🎉 Database migration completed!');
    
    // Test the new tables
    console.log('🔍 Testing new tables...');
    
    try {
      const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Users table: ${users[0].count} records`);
      
      const [pointsTransactions] = await pool.execute('SELECT COUNT(*) as count FROM points_transactions');
      console.log(`💰 Points transactions table: ${pointsTransactions[0].count} records`);
      
      const [leaderboard] = await pool.execute('SELECT COUNT(*) as count FROM leaderboard_cache');
      console.log(`🏆 Leaderboard cache: ${leaderboard[0].count} records`);
      
    } catch (testError) {
      console.error('❌ Error testing tables:', testError.message);
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the migration
runMigration();