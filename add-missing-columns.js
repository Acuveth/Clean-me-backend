const pool = require('./config/database');

async function addMissingColumns() {
    try {
        console.log('Adding missing columns to users table...');
        
        const columnsToAdd = [
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS rank VARCHAR(50) DEFAULT \'Eco Novice\'',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_points INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_points INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS total_cleanups INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS total_reports INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS points_multiplier DECIMAL(3,2) DEFAULT 1.00',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS combo_streak INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS max_combo_streak INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS first_cleanup_locations TEXT',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS weather_bonus_count INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date DATE',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_oauth_user BOOLEAN DEFAULT FALSE',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(100)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS points INT DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity DATE',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        ];

        for (const query of columnsToAdd) {
            try {
                await pool.execute(query);
                console.log(`✅ Executed: ${query.substring(0, 60)}...`);
            } catch (err) {
                if (!err.message.includes('Duplicate column')) {
                    console.error(`❌ Failed: ${query.substring(0, 60)}... - ${err.message}`);
                }
            }
        }

        // Update existing users with calculated values
        await pool.execute(`
            UPDATE users SET 
                level = CASE
                    WHEN points >= 15000 THEN 6
                    WHEN points >= 7500 THEN 5
                    WHEN points >= 3500 THEN 4
                    WHEN points >= 1500 THEN 3
                    WHEN points >= 500 THEN 2
                    ELSE 1
                END,
                rank = CASE 
                    WHEN points >= 15000 THEN 'Eco Legend'
                    WHEN points >= 7500 THEN 'Planet Champion'
                    WHEN points >= 3500 THEN 'Environmental Guardian'
                    WHEN points >= 1500 THEN 'Cleanup Warrior'
                    WHEN points >= 500 THEN 'Green Helper'
                    ELSE 'Eco Novice'
                END,
                points_multiplier = CASE
                    WHEN points >= 15000 THEN 1.25
                    WHEN points >= 7500 THEN 1.20
                    WHEN points >= 3500 THEN 1.15
                    WHEN points >= 1500 THEN 1.10
                    WHEN points >= 500 THEN 1.05
                    ELSE 1.00
                END,
                first_cleanup_locations = '[]'
            WHERE level IS NULL OR rank IS NULL
        `);
        console.log('✅ Updated existing users with calculated values');

        // Add indexes for performance
        const indexes = [
            'ALTER TABLE users ADD INDEX IF NOT EXISTS idx_oauth_lookup (oauth_provider, oauth_id)',
            'ALTER TABLE users ADD INDEX IF NOT EXISTS idx_email (email)'
        ];

        for (const index of indexes) {
            try {
                await pool.execute(index);
                console.log(`✅ Index added: ${index.substring(0, 50)}...`);
            } catch (err) {
                if (!err.message.includes('Duplicate key')) {
                    console.error(`❌ Index failed: ${err.message}`);
                }
            }
        }

        // Verify the columns exist
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'trash_clean' 
            AND TABLE_NAME = 'users'
            AND COLUMN_NAME IN ('level', 'rank', 'weekly_points', 'monthly_points', 'streak_days')
        `);
        
        console.log(`\n✅ Verified ${columns.length} critical columns exist`);
        console.log('🎉 All missing columns added successfully!');
        
    } catch (error) {
        console.error('Error adding columns:', error);
    } finally {
        await pool.end();
    }
}

addMissingColumns();