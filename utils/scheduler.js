const cron = require("node-cron");
const pool = require("../config/database");

/**
 * Scheduled Tasks for Points System Management
 * Handles weekly/monthly resets, leaderboard updates, and maintenance
 */

/**
 * Reset weekly points for all users (runs every Monday at 00:00)
 */
const resetWeeklyPoints = cron.schedule('0 0 * * 1', async () => {
  try {
    console.log("[SCHEDULER] Starting weekly points reset...");
    
    // Archive current week's top performers before reset
    const [topUsers] = await pool.execute(`
      SELECT user_id, weekly_points, 
             ROW_NUMBER() OVER (ORDER BY weekly_points DESC) as rank_position
      FROM users 
      WHERE weekly_points > 0
      ORDER BY weekly_points DESC
      LIMIT 10
    `);

    // Reset weekly points for all users
    const [resetResult] = await pool.execute(
      "UPDATE users SET weekly_points = 0"
    );

    // Archive weekly leaderboard results (you could create a weekly_leaderboard_history table)
    console.log(`[SCHEDULER] Weekly reset complete. Reset ${resetResult.affectedRows} users.`);
    console.log(`[SCHEDULER] Top performer this week: ${topUsers[0]?.weekly_points || 0} points`);
    
  } catch (error) {
    console.error("[SCHEDULER] Error in weekly reset:", error);
  }
}, {
  scheduled: false // Don't start automatically, we'll start it manually
});

/**
 * Reset monthly points for all users (runs on 1st of every month at 00:00)
 */
const resetMonthlyPoints = cron.schedule('0 0 1 * *', async () => {
  try {
    console.log("[SCHEDULER] Starting monthly points reset...");
    
    // Archive current month's top performers
    const [topUsers] = await pool.execute(`
      SELECT user_id, monthly_points,
             ROW_NUMBER() OVER (ORDER BY monthly_points DESC) as rank_position
      FROM users 
      WHERE monthly_points > 0
      ORDER BY monthly_points DESC
      LIMIT 10
    `);

    // Reset monthly points for all users
    const [resetResult] = await pool.execute(
      "UPDATE users SET monthly_points = 0"
    );

    console.log(`[SCHEDULER] Monthly reset complete. Reset ${resetResult.affectedRows} users.`);
    console.log(`[SCHEDULER] Top performer this month: ${topUsers[0]?.monthly_points || 0} points`);
    
  } catch (error) {
    console.error("[SCHEDULER] Error in monthly reset:", error);
  }
}, {
  scheduled: false
});

/**
 * Update leaderboard cache (runs every hour)
 */
const updateLeaderboardCache = cron.schedule('0 * * * *', async () => {
  try {
    console.log("[SCHEDULER] Updating leaderboard cache...");
    
    // Clear existing cache
    await pool.execute("DELETE FROM leaderboard_cache");

    // Rebuild cache
    await pool.execute(`
      INSERT INTO leaderboard_cache 
      (user_id, username, total_points, weekly_points, monthly_points, 
       level, rank_name, total_cleanups, total_reports, streak_days)
      SELECT 
        id, name, points, weekly_points, monthly_points,
        level, rank, total_cleanups, total_reports, streak_days
      FROM users 
      WHERE points > 0 
      ORDER BY points DESC
      LIMIT 1000
    `);

    const [count] = await pool.execute("SELECT COUNT(*) as total FROM leaderboard_cache");
    console.log(`[SCHEDULER] Leaderboard cache updated with ${count[0].total} users`);
    
  } catch (error) {
    console.error("[SCHEDULER] Error updating leaderboard cache:", error);
  }
}, {
  scheduled: false
});

/**
 * Clean up old points transactions (runs weekly on Sunday at 02:00)
 */
const cleanupOldTransactions = cron.schedule('0 2 * * 0', async () => {
  try {
    console.log("[SCHEDULER] Cleaning up old transactions...");
    
    // Keep only last 90 days of transactions
    const [result] = await pool.execute(`
      DELETE FROM points_transactions 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    `);

    console.log(`[SCHEDULER] Cleanup complete. Removed ${result.affectedRows} old transactions.`);
    
  } catch (error) {
    console.error("[SCHEDULER] Error cleaning up transactions:", error);
  }
}, {
  scheduled: false
});

/**
 * Update user streaks (runs daily at 01:00)
 */
const updateUserStreaks = cron.schedule('0 1 * * *', async () => {
  try {
    console.log("[SCHEDULER] Updating user activity streaks...");
    
    // Reset streaks for users who haven't been active today
    await pool.execute(`
      UPDATE users 
      SET streak_days = 0, combo_streak = 0
      WHERE last_activity_date < DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      AND streak_days > 0
    `);

    // Update streaks for active users
    await pool.execute(`
      UPDATE users 
      SET streak_days = streak_days + 1
      WHERE last_activity_date = CURDATE()
      AND EXISTS (
        SELECT 1 FROM points_transactions 
        WHERE user_id = users.id 
        AND DATE(created_at) = CURDATE()
      )
    `);

    console.log("[SCHEDULER] User streaks updated successfully");
    
  } catch (error) {
    console.error("[SCHEDULER] Error updating streaks:", error);
  }
}, {
  scheduled: false
});

/**
 * Update community challenge progress (runs every 4 hours)
 */
const updateChallengeProgress = cron.schedule('0 */4 * * *', async () => {
  try {
    console.log("[SCHEDULER] Updating community challenge progress...");
    
    // Get active challenges
    const [challenges] = await pool.execute(`
      SELECT id, challenge_type, start_date, end_date 
      FROM community_challenges 
      WHERE is_active = true 
      AND end_date >= CURDATE()
    `);

    for (const challenge of challenges) {
      let updateQuery = "";
      let params = [challenge.start_date, challenge.end_date, challenge.id];

      switch (challenge.challenge_type) {
        case "cleanup_count":
          updateQuery = `
            UPDATE user_challenge_participation ucp
            JOIN (
              SELECT user_id, COUNT(*) as progress
              FROM cleanup_sessions 
              WHERE status = 'completed'
              AND DATE(end_time) BETWEEN ? AND ?
              GROUP BY user_id
            ) cs ON ucp.user_id = cs.user_id
            SET ucp.current_progress = cs.progress
            WHERE ucp.challenge_id = ?
          `;
          break;

        case "points_total":
          updateQuery = `
            UPDATE user_challenge_participation ucp
            JOIN (
              SELECT user_id, COALESCE(SUM(points_awarded), 0) as progress
              FROM points_transactions 
              WHERE DATE(created_at) BETWEEN ? AND ?
              GROUP BY user_id
            ) pt ON ucp.user_id = pt.user_id
            SET ucp.current_progress = pt.progress
            WHERE ucp.challenge_id = ?
          `;
          break;

        case "streak_days":
          updateQuery = `
            UPDATE user_challenge_participation ucp
            JOIN users u ON ucp.user_id = u.id
            SET ucp.current_progress = u.streak_days
            WHERE ucp.challenge_id = ?
          `;
          params = [challenge.id]; // No date range needed for streaks
          break;
      }

      if (updateQuery) {
        await pool.execute(updateQuery, params);
      }
    }

    console.log(`[SCHEDULER] Updated progress for ${challenges.length} challenges`);
    
  } catch (error) {
    console.error("[SCHEDULER] Error updating challenge progress:", error);
  }
}, {
  scheduled: false
});

/**
 * Archive completed challenges and distribute rewards (runs daily at 03:00)
 */
const processCompletedChallenges = cron.schedule('0 3 * * *', async () => {
  try {
    console.log("[SCHEDULER] Processing completed challenges...");
    
    // Find challenges that ended yesterday but are still active
    const [expiredChallenges] = await pool.execute(`
      SELECT id, title, bonus_points, target_value
      FROM community_challenges 
      WHERE is_active = true 
      AND end_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);

    for (const challenge of expiredChallenges) {
      // Find users who completed this challenge but haven't received bonus
      const [completedUsers] = await pool.execute(`
        SELECT user_id, current_progress
        FROM user_challenge_participation 
        WHERE challenge_id = ? 
        AND current_progress >= ?
        AND is_completed = false
        AND bonus_awarded = false
      `, [challenge.id, challenge.target_value]);

      // Award bonus points to completed users
      for (const user of completedUsers) {
        if (challenge.bonus_points > 0) {
          // Add bonus points
          await pool.execute(
            "UPDATE users SET points = points + ? WHERE id = ?",
            [challenge.bonus_points, user.user_id]
          );

          // Record transaction
          await pool.execute(`
            INSERT INTO points_transactions 
            (user_id, action_type, points_awarded, description)
            VALUES (?, 'bonus', ?, ?)
          `, [
            user.user_id, 
            challenge.bonus_points, 
            `Challenge bonus: ${challenge.title}`
          ]);
        }

        // Mark as completed and bonus awarded
        await pool.execute(`
          UPDATE user_challenge_participation 
          SET is_completed = true, bonus_awarded = true, completed_at = NOW()
          WHERE challenge_id = ? AND user_id = ?
        `, [challenge.id, user.user_id]);
      }

      // Mark challenge as inactive
      await pool.execute(
        "UPDATE community_challenges SET is_active = false WHERE id = ?",
        [challenge.id]
      );

      console.log(`[SCHEDULER] Processed challenge '${challenge.title}' - ${completedUsers.length} users completed`);
    }
    
  } catch (error) {
    console.error("[SCHEDULER] Error processing completed challenges:", error);
  }
}, {
  scheduled: false
});

/**
 * Start all scheduled tasks
 */
function startScheduler() {
  console.log("[SCHEDULER] Starting all scheduled tasks...");
  
  resetWeeklyPoints.start();
  resetMonthlyPoints.start();
  updateLeaderboardCache.start();
  cleanupOldTransactions.start();
  updateUserStreaks.start();
  updateChallengeProgress.start();
  processCompletedChallenges.start();
  
  // Run initial leaderboard cache update
  setTimeout(async () => {
    try {
      console.log("[SCHEDULER] Running initial leaderboard cache update...");
      
      await pool.execute("DELETE FROM leaderboard_cache");

      await pool.execute(`
        INSERT INTO leaderboard_cache 
        (user_id, username, total_points, weekly_points, monthly_points, 
         level, rank_name, total_cleanups, total_reports, streak_days)
        SELECT 
          id, name, points, weekly_points, monthly_points,
          level, rank, total_cleanups, total_reports, streak_days
        FROM users 
        WHERE points > 0 
        ORDER BY points DESC
        LIMIT 1000
      `);

      const [count] = await pool.execute("SELECT COUNT(*) as total FROM leaderboard_cache");
      console.log(`[SCHEDULER] Initial leaderboard cache updated with ${count[0].total} users`);
      
    } catch (error) {
      console.error("[SCHEDULER] Error in initial leaderboard update:", error);
    }
  }, 5000);
  
  console.log("[SCHEDULER] All scheduled tasks started successfully");
}

/**
 * Stop all scheduled tasks
 */
function stopScheduler() {
  console.log("[SCHEDULER] Stopping all scheduled tasks...");
  
  resetWeeklyPoints.stop();
  resetMonthlyPoints.stop();
  updateLeaderboardCache.stop();
  cleanupOldTransactions.stop();
  updateUserStreaks.stop();
  updateChallengeProgress.stop();
  processCompletedChallenges.stop();
  
  console.log("[SCHEDULER] All scheduled tasks stopped");
}

/**
 * Manual trigger functions for testing
 */
const manualTriggers = {
  resetWeeklyPoints: () => {
    console.log("[SCHEDULER] Manual trigger: resetWeeklyPoints");
    // Implementation would call the actual function logic
  },
  resetMonthlyPoints: () => {
    console.log("[SCHEDULER] Manual trigger: resetMonthlyPoints");
    // Implementation would call the actual function logic  
  },
  updateLeaderboardCache: () => {
    console.log("[SCHEDULER] Manual trigger: updateLeaderboardCache");
    // Implementation would call the actual function logic
  },
  cleanupOldTransactions: () => {
    console.log("[SCHEDULER] Manual trigger: cleanupOldTransactions");
    // Implementation would call the actual function logic
  },
  updateUserStreaks: () => {
    console.log("[SCHEDULER] Manual trigger: updateUserStreaks");
    // Implementation would call the actual function logic
  },
  updateChallengeProgress: () => {
    console.log("[SCHEDULER] Manual trigger: updateChallengeProgress");
    // Implementation would call the actual function logic
  },
  processCompletedChallenges: () => {
    console.log("[SCHEDULER] Manual trigger: processCompletedChallenges");
    // Implementation would call the actual function logic
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  manualTriggers
};