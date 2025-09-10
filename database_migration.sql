-- Database Migration for New Features
-- Run this SQL to update your database schema

-- Add new fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank VARCHAR(50) DEFAULT 'Beginner';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_oauth_user BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_cleanups INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_reports INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes to users table
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_oauth_lookup (oauth_provider, oauth_id);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_email (email);

-- Add missing fields to trash_reports table
ALTER TABLE trash_reports ADD COLUMN IF NOT EXISTS ai_description TEXT;
ALTER TABLE trash_reports ADD COLUMN IF NOT EXISTS trash_count INT DEFAULT 1;
ALTER TABLE trash_reports ADD COLUMN IF NOT EXISTS trash_types JSON;
ALTER TABLE trash_reports ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium';
ALTER TABLE trash_reports ADD COLUMN IF NOT EXISTS location_context VARCHAR(100);
ALTER TABLE trash_reports ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT FALSE;

-- Add indexes to trash_reports table
ALTER TABLE trash_reports ADD INDEX IF NOT EXISTS idx_status (status);
ALTER TABLE trash_reports ADD INDEX IF NOT EXISTS idx_location (latitude, longitude);
ALTER TABLE trash_reports ADD INDEX IF NOT EXISTS idx_created_at (created_at);
ALTER TABLE trash_reports ADD INDEX IF NOT EXISTS idx_severity (severity);

-- Create cleanup_sessions table
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
);

-- Create pickup_issues table
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
);

-- Create achievements table
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
);

-- Create user achievements junction table
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_achievement (user_id, achievement_id)
);

-- Insert default achievements
INSERT INTO achievements (title, description, icon, category, points, threshold_value, achievement_type, rarity) VALUES
('First Steps', 'Complete your first trash pickup', 'eco', 'beginner', 50, 1, 'cleanups', 'common'),
('Reporter', 'Submit your first trash report', 'camera_alt', 'beginner', 25, 1, 'reports', 'common'),
('Cleanup Novice', 'Complete 5 trash pickups', 'cleaning_services', 'cleanup', 100, 5, 'cleanups', 'common'),
('Point Collector', 'Earn 500 points', 'star', 'points', 100, 500, 'points', 'common'),
('Cleanup Expert', 'Complete 25 trash pickups', 'workspace_premium', 'cleanup', 500, 25, 'cleanups', 'uncommon'),
('Dedicated Reporter', 'Submit 10 trash reports', 'report', 'social', 250, 10, 'reports', 'uncommon'),
('Week Warrior', 'Maintain a 7-day streak', 'local_fire_department', 'streak', 300, 7, 'streak', 'uncommon'),
('Point Master', 'Earn 2500 points', 'emoji_events', 'points', 500, 2500, 'points', 'uncommon'),
('Cleanup Champion', 'Complete 50 trash pickups', 'military_tech', 'cleanup', 1000, 50, 'cleanups', 'rare'),
('Community Hero', 'Submit 25 trash reports', 'volunteer_activism', 'social', 500, 25, 'reports', 'rare'),
('Streak Legend', 'Maintain a 30-day streak', 'whatshot', 'streak', 1000, 30, 'streak', 'rare'),
('Point Legend', 'Earn 10000 points', 'diamond', 'points', 2000, 10000, 'points', 'legendary'),
('Cleanup Master', 'Complete 100 trash pickups', 'shield', 'cleanup', 2500, 100, 'cleanups', 'legendary');

-- Enhanced Points System Tables

-- Add enhanced user fields for points system
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS points_multiplier DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS combo_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_combo_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_cleanup_locations TEXT; -- JSON array of visited locations
ALTER TABLE users ADD COLUMN IF NOT EXISTS weather_bonus_count INTEGER DEFAULT 0;

-- Create points transactions table for detailed tracking
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
);

-- Create leaderboard views table for performance
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
);

-- Create community challenges table
CREATE TABLE IF NOT EXISTS community_challenges (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type ENUM('cleanup_count', 'points_total', 'streak_days', 'location_variety') NOT NULL,
    target_value INTEGER NOT NULL,
    bonus_points INTEGER DEFAULT 0,
    bonus_multiplier DECIMAL(3,2) DEFAULT 1.00,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user challenge participation table
CREATE TABLE IF NOT EXISTS user_challenge_participation (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    user_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP NULL,
    bonus_awarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES community_challenges(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_challenge (user_id, challenge_id)
);

-- Create location bonuses table
CREATE TABLE IF NOT EXISTS location_bonuses (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    location_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius_meters INTEGER DEFAULT 100,
    bonus_type ENUM('remote', 'high_traffic', 'sensitive', 'event') NOT NULL,
    multiplier DECIMAL(3,2) DEFAULT 1.20,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default community challenges
INSERT INTO community_challenges (title, description, challenge_type, target_value, bonus_points, start_date, end_date) VALUES
('Monthly Cleanup Champion', 'Complete 20 cleanups this month', 'cleanup_count', 20, 500, CURDATE(), LAST_DAY(CURDATE())),
('Points Master', 'Earn 1000 points this week', 'points_total', 1000, 200, DATE_SUB(CURDATE(), INTERVAL DAYOFWEEK(CURDATE())-1 DAY), DATE_ADD(DATE_SUB(CURDATE(), INTERVAL DAYOFWEEK(CURDATE())-1 DAY), INTERVAL 6 DAY)),
('Streak Warrior', 'Maintain a 14-day activity streak', 'streak_days', 14, 300, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY));

-- Insert sample location bonuses
INSERT INTO location_bonuses (location_name, latitude, longitude, bonus_type, multiplier, description, valid_from, valid_until) VALUES
('City Park', 40.7589, -73.9851, 'sensitive', 1.50, 'Extra points for keeping parks clean', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR)),
('Beach Area', 40.7282, -73.9942, 'sensitive', 1.75, 'Critical marine environment protection', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR)),
('Downtown District', 40.7505, -73.9934, 'high_traffic', 1.20, 'High visibility area bonus', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR));

-- Update existing users with default values
UPDATE users SET 
    bio = NULL,
    location = NULL,
    streak_days = 0,
    last_activity_date = CURDATE(),
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
WHERE bio IS NULL;