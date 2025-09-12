const pool = require('./config/database');

async function createMissingTables() {
    try {
        console.log('Creating missing tables...');
        
        // Create achievements table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                icon VARCHAR(50),
                category VARCHAR(50),
                points INTEGER,
                threshold_value INTEGER,
                achievement_type ENUM('cleanups', 'reports', 'points', 'streak') NOT NULL,
                rarity ENUM('common', 'uncommon', 'rare', 'legendary') DEFAULT 'common',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Achievements table created');

        // Create user_achievements table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                user_id INTEGER NOT NULL,
                achievement_id INTEGER NOT NULL,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                progress INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_achievement (user_id, achievement_id)
            )
        `);
        console.log('✅ User achievements table created');

        // Create points_transactions table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS points_transactions (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                user_id INTEGER NOT NULL,
                action_type ENUM('report', 'cleanup', 'bonus', 'penalty', 'achievement') NOT NULL,
                points_awarded INTEGER NOT NULL,
                base_points INTEGER,
                multipliers JSON,
                bonuses JSON,
                related_report_id INTEGER,
                related_cleanup_id INTEGER,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (related_report_id) REFERENCES trash_reports(id) ON DELETE SET NULL,
                INDEX idx_user_transactions (user_id, created_at)
            )
        `);
        console.log('✅ Points transactions table created');

        // Create leaderboard_cache table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS leaderboard_cache (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                user_id INTEGER NOT NULL,
                username VARCHAR(255) NOT NULL,
                total_points INTEGER NOT NULL,
                weekly_points INTEGER NOT NULL,
                monthly_points INTEGER NOT NULL,
                level INTEGER NOT NULL,
                rank_name VARCHAR(50) NOT NULL,
                total_cleanups INTEGER DEFAULT 0,
                total_reports INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user (user_id)
            )
        `);
        console.log('✅ Leaderboard cache table created');

        // Create cleanup_sessions table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS cleanup_sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                trash_report_id INT,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NULL,
                start_latitude DECIMAL(10, 8) NOT NULL,
                start_longitude DECIMAL(11, 8) NOT NULL,
                pickup_latitude DECIMAL(10, 8),
                pickup_longitude DECIMAL(11, 8),
                distance_from_trash DECIMAL(10, 2),
                location_accuracy DECIMAL(10, 2),
                pickup_photo_url VARCHAR(500),
                after_photo_url VARCHAR(500),
                verification_image_url VARCHAR(500),
                verification_score DECIMAL(3, 2),
                ai_confidence DECIMAL(3, 2),
                points_earned INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'active',
                verification_status VARCHAR(50),
                verification_timestamp TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (trash_report_id) REFERENCES trash_reports(id),
                INDEX idx_user_id (user_id),
                INDEX idx_status (status),
                INDEX idx_verification_status (verification_status)
            )
        `);
        console.log('✅ Cleanup sessions table created');

        // Create pickup_issues table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS pickup_issues (
                id INT PRIMARY KEY AUTO_INCREMENT,
                trash_report_id INT,
                user_id INT,
                issue_type ENUM('not_found', 'already_cleaned', 'inaccessible', 'wrong_location', 'other') NOT NULL,
                description TEXT,
                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trash_report_id) REFERENCES trash_reports(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                INDEX idx_trash_report (trash_report_id),
                INDEX idx_issue_type (issue_type)
            )
        `);
        console.log('✅ Pickup issues table created');

        // Insert default achievements
        const achievements = [
            ['First Steps', 'Complete your first trash pickup', 'eco', 'beginner', 50, 1, 'cleanups', 'common'],
            ['Reporter', 'Submit your first trash report', 'camera_alt', 'beginner', 25, 1, 'reports', 'common'],
            ['Cleanup Novice', 'Complete 5 trash pickups', 'cleaning_services', 'cleanup', 100, 5, 'cleanups', 'common'],
            ['Point Collector', 'Earn 500 points', 'star', 'points', 100, 500, 'points', 'common'],
            ['Cleanup Expert', 'Complete 25 trash pickups', 'workspace_premium', 'cleanup', 500, 25, 'cleanups', 'uncommon'],
            ['Dedicated Reporter', 'Submit 10 trash reports', 'report', 'social', 250, 10, 'reports', 'uncommon'],
            ['Week Warrior', 'Maintain a 7-day streak', 'local_fire_department', 'streak', 300, 7, 'streak', 'uncommon'],
            ['Point Master', 'Earn 2500 points', 'emoji_events', 'points', 500, 2500, 'points', 'uncommon'],
            ['Cleanup Champion', 'Complete 50 trash pickups', 'military_tech', 'cleanup', 1000, 50, 'cleanups', 'rare'],
            ['Community Hero', 'Submit 25 trash reports', 'volunteer_activism', 'social', 500, 25, 'reports', 'rare'],
            ['Streak Legend', 'Maintain a 30-day streak', 'whatshot', 'streak', 1000, 30, 'streak', 'rare'],
            ['Point Legend', 'Earn 10000 points', 'diamond', 'points', 2000, 10000, 'points', 'legendary'],
            ['Cleanup Master', 'Complete 100 trash pickups', 'shield', 'cleanup', 2500, 100, 'cleanups', 'legendary']
        ];

        for (const achievement of achievements) {
            try {
                await pool.execute(
                    `INSERT INTO achievements (title, description, icon, category, points, threshold_value, achievement_type, rarity) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    achievement
                );
            } catch (err) {
                if (!err.message.includes('Duplicate entry')) {
                    console.error('Error inserting achievement:', err.message);
                }
            }
        }
        console.log('✅ Default achievements inserted');

        console.log('🎉 All missing tables created successfully!');
        
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        await pool.end();
    }
}

createMissingTables();