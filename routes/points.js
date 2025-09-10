const express = require("express");
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { RANK_SYSTEM } = require("../utils/pointsCalculator");

const router = express.Router();

/**
 * Get user's points summary and statistics
 */
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(`
      SELECT 
        id, name, points, weekly_points, monthly_points, level, rank,
        points_multiplier, combo_streak, max_combo_streak, streak_days,
        total_cleanups, total_reports, created_at
      FROM users 
      WHERE id = ?
    `, [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Get recent transactions
    const [transactions] = await pool.execute(`
      SELECT 
        action_type, points_awarded, multipliers, bonuses, description, created_at
      FROM points_transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [req.user.id]);

    // Parse JSON fields
    const formattedTransactions = transactions.map(t => ({
      ...t,
      multipliers: JSON.parse(t.multipliers || '{}'),
      bonuses: JSON.parse(t.bonuses || '{}')
    }));

    // Calculate next rank info
    const currentRank = RANK_SYSTEM.find(rank => rank.name === user.rank);
    const nextRank = RANK_SYSTEM.find(rank => rank.level === (currentRank?.level || 0) + 1);
    
    const progressToNext = nextRank 
      ? {
          nextRank: nextRank.name,
          pointsNeeded: nextRank.minPoints - user.points,
          progress: ((user.points - (currentRank?.minPoints || 0)) / 
                   ((nextRank?.minPoints || user.points) - (currentRank?.minPoints || 0))) * 100
        }
      : null;

    res.json({
      user: {
        ...user,
        rankInfo: currentRank,
        progressToNext,
        pointsThisWeek: user.weekly_points,
        pointsThisMonth: user.monthly_points
      },
      recentTransactions: formattedTransactions
    });

  } catch (error) {
    console.error("[POINTS/PROFILE] Error:", error);
    res.status(500).json({ error: "Failed to fetch user points profile" });
  }
});

/**
 * Get detailed points transaction history
 */
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE user_id = ?";
    let queryParams = [req.user.id];

    if (type) {
      whereClause += " AND action_type = ?";
      queryParams.push(type);
    }

    const [transactions] = await pool.execute(`
      SELECT 
        pt.*, tr.description as report_description, tr.photo_url,
        cs.verification_score
      FROM points_transactions pt
      LEFT JOIN trash_reports tr ON pt.related_report_id = tr.id
      LEFT JOIN cleanup_sessions cs ON pt.related_cleanup_id = cs.id
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM points_transactions ${whereClause}
    `, queryParams);

    const formattedTransactions = transactions.map(t => ({
      ...t,
      multipliers: JSON.parse(t.multipliers || '{}'),
      bonuses: JSON.parse(t.bonuses || '{}')
    }));

    res.json({
      transactions: formattedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(countResult[0].total / limit),
        totalTransactions: countResult[0].total,
        hasNext: countResult[0].total > offset + parseInt(limit)
      }
    });

  } catch (error) {
    console.error("[POINTS/TRANSACTIONS] Error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

/**
 * Get leaderboards
 */
router.get("/leaderboard", authenticateToken, async (req, res) => {
  try {
    const { type = "total", limit = 50 } = req.query;

    let orderByClause;
    let pointsField;

    switch (type) {
      case "weekly":
        orderByClause = "weekly_points DESC, points DESC";
        pointsField = "weekly_points";
        break;
      case "monthly":
        orderByClause = "monthly_points DESC, points DESC";
        pointsField = "monthly_points";
        break;
      case "cleanups":
        orderByClause = "total_cleanups DESC, points DESC";
        pointsField = "total_cleanups";
        break;
      case "reports":
        orderByClause = "total_reports DESC, points DESC";
        pointsField = "total_reports";
        break;
      default: // total
        orderByClause = "points DESC, total_cleanups DESC";
        pointsField = "points";
    }

    const [leaderboard] = await pool.execute(`
      SELECT 
        id, name, points, weekly_points, monthly_points, 
        total_cleanups, total_reports, level, rank, streak_days,
        ${pointsField} as display_points
      FROM users 
      ORDER BY ${orderByClause}
      LIMIT ?
    `, [parseInt(limit)]);

    // Add rank position
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      position: index + 1,
      isCurrentUser: user.id === req.user.id
    }));

    // Find current user's position if not in top results
    let currentUserPosition = rankedLeaderboard.find(u => u.isCurrentUser)?.position;
    let currentUserData = null;

    if (!currentUserPosition) {
      const [userRank] = await pool.execute(`
        SELECT COUNT(*) + 1 as position
        FROM users 
        WHERE ${pointsField} > (
          SELECT ${pointsField} FROM users WHERE id = ?
        )
      `, [req.user.id]);

      const [userData] = await pool.execute(`
        SELECT 
          id, name, points, weekly_points, monthly_points,
          total_cleanups, total_reports, level, rank, streak_days,
          ${pointsField} as display_points
        FROM users 
        WHERE id = ?
      `, [req.user.id]);

      if (userData.length > 0) {
        currentUserData = {
          ...userData[0],
          position: userRank[0].position,
          isCurrentUser: true
        };
      }
    }

    res.json({
      leaderboard: rankedLeaderboard,
      currentUser: currentUserData,
      type,
      total: leaderboard.length
    });

  } catch (error) {
    console.error("[POINTS/LEADERBOARD] Error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/**
 * Get community challenges
 */
router.get("/challenges", authenticateToken, async (req, res) => {
  try {
    const [challenges] = await pool.execute(`
      SELECT 
        cc.*,
        ucp.current_progress,
        ucp.is_completed,
        ucp.completed_at
      FROM community_challenges cc
      LEFT JOIN user_challenge_participation ucp 
        ON cc.id = ucp.challenge_id AND ucp.user_id = ?
      WHERE cc.is_active = true 
      AND cc.end_date >= CURDATE()
      ORDER BY cc.end_date ASC
    `, [req.user.id]);

    // Calculate progress for each challenge
    const challengesWithProgress = await Promise.all(challenges.map(async (challenge) => {
      let currentProgress = challenge.current_progress || 0;

      // If not participating yet, calculate current progress
      if (!challenge.current_progress) {
        switch (challenge.challenge_type) {
          case "cleanup_count":
            const [cleanupCount] = await pool.execute(`
              SELECT COUNT(*) as count 
              FROM cleanup_sessions 
              WHERE user_id = ? 
              AND status = 'completed'
              AND DATE(end_time) BETWEEN ? AND ?
            `, [req.user.id, challenge.start_date, challenge.end_date]);
            currentProgress = cleanupCount[0].count;
            break;

          case "points_total":
            const [pointsSum] = await pool.execute(`
              SELECT COALESCE(SUM(points_awarded), 0) as total 
              FROM points_transactions 
              WHERE user_id = ? 
              AND DATE(created_at) BETWEEN ? AND ?
            `, [req.user.id, challenge.start_date, challenge.end_date]);
            currentProgress = pointsSum[0].total;
            break;

          case "streak_days":
            const [userData] = await pool.execute(
              "SELECT streak_days FROM users WHERE id = ?", 
              [req.user.id]
            );
            currentProgress = userData[0]?.streak_days || 0;
            break;

          case "location_variety":
            const [locationCount] = await pool.execute(`
              SELECT COUNT(DISTINCT CONCAT(ROUND(latitude, 3), ',', ROUND(longitude, 3))) as count
              FROM trash_reports 
              WHERE user_id = ? 
              AND DATE(created_at) BETWEEN ? AND ?
            `, [req.user.id, challenge.start_date, challenge.end_date]);
            currentProgress = locationCount[0].count;
            break;
        }

        // Auto-join user to challenge if they have progress
        if (currentProgress > 0) {
          await pool.execute(`
            INSERT IGNORE INTO user_challenge_participation 
            (user_id, challenge_id, current_progress) 
            VALUES (?, ?, ?)
          `, [req.user.id, challenge.id, currentProgress]);
        }
      }

      const progressPercentage = Math.min((currentProgress / challenge.target_value) * 100, 100);
      const isCompleted = currentProgress >= challenge.target_value;

      return {
        ...challenge,
        current_progress: currentProgress,
        progress_percentage: Math.round(progressPercentage),
        is_completed: isCompleted,
        days_remaining: Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24))
      };
    }));

    res.json({ challenges: challengesWithProgress });

  } catch (error) {
    console.error("[POINTS/CHALLENGES] Error:", error);
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

/**
 * Get user's points statistics and insights
 */
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const { period = "month" } = req.query;

    // Date range calculation
    let dateCondition;
    switch (period) {
      case "week":
        dateCondition = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)";
        break;
      case "month":
        dateCondition = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)";
        break;
      case "year":
        dateCondition = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)";
        break;
      default:
        dateCondition = "1=1"; // all time
    }

    // Points breakdown by action type
    const [actionBreakdown] = await pool.execute(`
      SELECT 
        action_type,
        COUNT(*) as action_count,
        SUM(points_awarded) as total_points,
        AVG(points_awarded) as avg_points
      FROM points_transactions 
      WHERE user_id = ? AND ${dateCondition}
      GROUP BY action_type
    `, [req.user.id]);

    // Daily points trend
    const [dailyTrend] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        SUM(points_awarded) as daily_points,
        COUNT(*) as daily_actions
      FROM points_transactions 
      WHERE user_id = ? AND ${dateCondition}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [req.user.id]);

    // Best performing categories
    const [categoryStats] = await pool.execute(`
      SELECT 
        JSON_UNQUOTE(JSON_EXTRACT(multipliers, '$.type')) as category,
        COUNT(*) as actions,
        AVG(points_awarded) as avg_points,
        SUM(points_awarded) as total_points
      FROM points_transactions 
      WHERE user_id = ? AND ${dateCondition} 
      AND JSON_EXTRACT(multipliers, '$.type') IS NOT NULL
      GROUP BY JSON_UNQUOTE(JSON_EXTRACT(multipliers, '$.type'))
      ORDER BY total_points DESC
    `, [req.user.id]);

    // Bonus statistics
    const [bonusStats] = await pool.execute(`
      SELECT 
        AVG(JSON_UNQUOTE(JSON_EXTRACT(bonuses, '$.location'))) as avg_location_bonus,
        AVG(JSON_UNQUOTE(JSON_EXTRACT(bonuses, '$.ai'))) as avg_ai_bonus,
        AVG(JSON_UNQUOTE(JSON_EXTRACT(bonuses, '$.quality'))) as avg_quality_bonus,
        AVG(JSON_UNQUOTE(JSON_EXTRACT(multipliers, '$.streak'))) as avg_streak_multiplier
      FROM points_transactions 
      WHERE user_id = ? AND ${dateCondition}
    `, [req.user.id]);

    res.json({
      period,
      actionBreakdown,
      dailyTrend: dailyTrend.reverse(),
      categoryStats,
      bonusStats: bonusStats[0] || {},
      insights: {
        totalActions: actionBreakdown.reduce((sum, action) => sum + action.action_count, 0),
        totalPoints: actionBreakdown.reduce((sum, action) => sum + action.total_points, 0),
        avgPointsPerAction: actionBreakdown.length > 0 
          ? Math.round(actionBreakdown.reduce((sum, action) => sum + action.total_points, 0) / 
                      actionBreakdown.reduce((sum, action) => sum + action.action_count, 0))
          : 0
      }
    });

  } catch (error) {
    console.error("[POINTS/STATS] Error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

/**
 * Update leaderboard cache (admin/cron endpoint)
 */
router.post("/refresh-leaderboard", async (req, res) => {
  try {
    // This would typically be secured with admin authentication
    // For now, we'll allow it but add logging
    
    console.log("[POINTS] Refreshing leaderboard cache...");

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
    `);

    const [count] = await pool.execute("SELECT COUNT(*) as total FROM leaderboard_cache");
    
    console.log(`[POINTS] Leaderboard cache refreshed with ${count[0].total} users`);
    
    res.json({ 
      success: true, 
      message: `Leaderboard cache refreshed with ${count[0].total} users` 
    });

  } catch (error) {
    console.error("[POINTS/REFRESH] Error:", error);
    res.status(500).json({ error: "Failed to refresh leaderboard cache" });
  }
});

module.exports = router;