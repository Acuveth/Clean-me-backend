const pool = require('./config/database');

async function addLevelColumn() {
    try {
        // Check if level column exists
        const [columns] = await pool.execute('DESCRIBE users');
        const hasLevel = columns.some(col => col.Field === 'level');

        if (!hasLevel) {
            await pool.execute('ALTER TABLE users ADD COLUMN level INT DEFAULT 1');
            console.log('✅ Level column added successfully');
        } else {
            console.log('✅ Level column already exists');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Wait a bit for database to initialize
setTimeout(addLevelColumn, 2000);