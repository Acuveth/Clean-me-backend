-- Run this script in HeidiSQL to set up the database and user
-- 1. Open HeidiSQL and connect to your MariaDB server
-- 2. Copy and run this entire script

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS trash_clean;

-- Create a new user with standard MySQL authentication
-- Change 'your_password_here' to a secure password
DROP USER IF EXISTS 'trash_app'@'localhost';
CREATE USER 'trash_app'@'localhost' IDENTIFIED BY 'TrashApp2025!';

-- Grant all privileges on the trash_clean database to the new user
GRANT ALL PRIVILEGES ON trash_clean.* TO 'trash_app'@'localhost';

-- Also create user for IP connection (127.0.0.1)
DROP USER IF EXISTS 'trash_app'@'127.0.0.1';
CREATE USER 'trash_app'@'127.0.0.1' IDENTIFIED BY 'TrashApp2025!';
GRANT ALL PRIVILEGES ON trash_clean.* TO 'trash_app'@'127.0.0.1';

-- Apply the changes
FLUSH PRIVILEGES;

-- Verify the user was created successfully
SELECT User, Host, plugin FROM mysql.user WHERE User = 'trash_app';