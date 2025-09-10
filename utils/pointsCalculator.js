const pool = require("../config/database");

/**
 * Enhanced Points Calculation System
 * Handles complex points calculations with multipliers, bonuses, and tracking
 */

// Points structure configuration
const POINTS_CONFIG = {
  reporting: {
    base: { 
      Small: 15, 
      Medium: 25, 
      Large: 40, 
      "Very Large": 65 
    },
    typeMultipliers: {
      General: 1.0,
      Plastic: 1.3,
      Glass: 1.2,
      Metal: 1.4,
      Organic: 0.9,
      Hazardous: 2.5
    },
    qualityBonus: { 
      high: 15, 
      medium: 10, 
      low: 5 
    },
    aiBonus: 8,
    locationBonuses: {
      remote: 1.2,
      highTraffic: 1.1,
      sensitive: 1.5,
      event: 1.8
    }
  },
  cleanup: {
    base: 30,
    verificationBonus: 25, // max confidence bonus
    difficultyMultipliers: {
      easy: 1.0,
      medium: 1.3,
      hard: 1.8
    },
    speedBonus: 10,
    completionBonus: 20
  },
  streakMultiplier: {
    base: 1.05,
    maxMultiplier: 2.0
  },
  comboBonus: 0.5, // 50% bonus for combo actions
  firstTimeLocationBonus: 0.25 // 25% bonus for new locations
};

// Rank system configuration
const RANK_SYSTEM = [
  { name: "Eco Novice", minPoints: 0, multiplier: 1.0, level: 1 },
  { name: "Green Helper", minPoints: 500, multiplier: 1.05, level: 2 },
  { name: "Cleanup Warrior", minPoints: 1500, multiplier: 1.1, level: 3 },
  { name: "Environmental Guardian", minPoints: 3500, multiplier: 1.15, level: 4 },
  { name: "Planet Champion", minPoints: 7500, multiplier: 1.2, level: 5 },
  { name: "Eco Legend", minPoints: 15000, multiplier: 1.25, level: 6 }
];

/**
 * Calculate points for trash reporting
 */
async function calculateReportingPoints(userId, reportData) {
  try {
    const {
      size,
      trashType,
      severity,
      aiDescription,
      latitude,
      longitude,
      trashCount = 1
    } = reportData;

    // Get user's current data
    const userData = await getUserData(userId);
    
    // Base points calculation
    let basePoints = POINTS_CONFIG.reporting.base[size] || 25;
    
    // Apply trash type multiplier
    const typeMultiplier = POINTS_CONFIG.reporting.typeMultipliers[trashType] || 1.0;
    
    // Quality bonus based on AI analysis
    const qualityBonus = severity ? POINTS_CONFIG.reporting.qualityBonus[severity] || 0 : 0;
    
    // AI analysis bonus
    const aiBonus = aiDescription ? POINTS_CONFIG.reporting.aiBonus : 0;
    
    // Location-based bonuses
    const locationBonus = await calculateLocationBonus(latitude, longitude);
    
    // First-time location bonus
    const firstTimeBonus = await checkFirstTimeLocation(userId, latitude, longitude);
    
    // Calculate base total
    let totalPoints = (basePoints * typeMultiplier * trashCount) + qualityBonus + aiBonus;
    
    // Apply location multiplier
    totalPoints *= (1 + locationBonus + firstTimeBonus);
    
    // Apply streak multiplier
    const streakMultiplier = calculateStreakMultiplier(userData.streak_days);
    totalPoints *= streakMultiplier;
    
    // Apply combo bonus if applicable
    const comboMultiplier = await checkComboBonus(userId);
    totalPoints *= (1 + comboMultiplier);
    
    // Apply user's rank multiplier
    totalPoints *= userData.points_multiplier;
    
    // Round to integer
    totalPoints = Math.round(totalPoints);
    
    // Create points breakdown for transparency
    const breakdown = {
      basePoints: Math.round(basePoints * trashCount),
      typeMultiplier,
      qualityBonus,
      aiBonus,
      locationBonus: Math.round(locationBonus * 100),
      firstTimeBonus: Math.round(firstTimeBonus * 100),
      streakMultiplier: Math.round(streakMultiplier * 100) / 100,
      comboMultiplier: Math.round(comboMultiplier * 100),
      rankMultiplier: userData.points_multiplier,
      totalPoints
    };
    
    return { totalPoints, breakdown };
    
  } catch (error) {
    console.error("[POINTS] Error calculating reporting points:", error);
    return { totalPoints: 20, breakdown: { error: true } }; // fallback
  }
}

/**
 * Calculate points for cleanup activities
 */
async function calculateCleanupPoints(userId, cleanupData) {
  try {
    const {
      verificationResult,
      timeTaken,
      difficulty = 'medium',
      latitude,
      longitude
    } = cleanupData;

    const userData = await getUserData(userId);
    
    // Base cleanup points
    let basePoints = POINTS_CONFIG.cleanup.base;
    
    // Verification confidence bonus
    const verificationBonus = Math.round(
      verificationResult.confidence * POINTS_CONFIG.cleanup.verificationBonus
    );
    
    // Difficulty multiplier
    const difficultyMultiplier = POINTS_CONFIG.cleanup.difficultyMultipliers[difficulty] || 1.3;
    
    // Speed bonus (if completed quickly)
    const speedBonus = timeTaken && timeTaken < 600 ? POINTS_CONFIG.cleanup.speedBonus : 0; // 10 minutes
    
    // Full completion bonus
    const completionBonus = verificationResult.verified ? POINTS_CONFIG.cleanup.completionBonus : 0;
    
    // Location bonus
    const locationBonus = await calculateLocationBonus(latitude, longitude);
    
    // First-time location bonus
    const firstTimeBonus = await checkFirstTimeLocation(userId, latitude, longitude);
    
    // Calculate total
    let totalPoints = (basePoints * difficultyMultiplier) + verificationBonus + speedBonus + completionBonus;
    
    // Apply location multipliers
    totalPoints *= (1 + locationBonus + firstTimeBonus);
    
    // Apply streak multiplier
    const streakMultiplier = calculateStreakMultiplier(userData.streak_days);
    totalPoints *= streakMultiplier;
    
    // Apply combo bonus
    const comboMultiplier = await checkComboBonus(userId);
    totalPoints *= (1 + comboMultiplier);
    
    // Apply user's rank multiplier
    totalPoints *= userData.points_multiplier;
    
    totalPoints = Math.round(totalPoints);
    
    const breakdown = {
      basePoints,
      verificationBonus,
      difficultyMultiplier,
      speedBonus,
      completionBonus,
      locationBonus: Math.round(locationBonus * 100),
      firstTimeBonus: Math.round(firstTimeBonus * 100),
      streakMultiplier: Math.round(streakMultiplier * 100) / 100,
      comboMultiplier: Math.round(comboMultiplier * 100),
      rankMultiplier: userData.points_multiplier,
      totalPoints
    };
    
    return { totalPoints, breakdown };
    
  } catch (error) {
    console.error("[POINTS] Error calculating cleanup points:", error);
    return { totalPoints: 30, breakdown: { error: true } };
  }
}

/**
 * Record points transaction for tracking
 */
async function recordPointsTransaction(userId, actionType, pointsAwarded, breakdown, relatedIds = {}) {
  try {
    await pool.execute(`
      INSERT INTO points_transactions 
      (user_id, action_type, points_awarded, base_points, multipliers, bonuses, 
       related_report_id, related_cleanup_id, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      actionType,
      pointsAwarded,
      breakdown.basePoints || 0,
      JSON.stringify({
        type: breakdown.typeMultiplier || breakdown.difficultyMultiplier || 1,
        streak: breakdown.streakMultiplier || 1,
        rank: breakdown.rankMultiplier || 1,
        combo: breakdown.comboMultiplier || 0
      }),
      JSON.stringify({
        quality: breakdown.qualityBonus || 0,
        ai: breakdown.aiBonus || 0,
        location: breakdown.locationBonus || 0,
        firstTime: breakdown.firstTimeBonus || 0,
        verification: breakdown.verificationBonus || 0,
        speed: breakdown.speedBonus || 0,
        completion: breakdown.completionBonus || 0
      }),
      relatedIds.reportId || null,
      relatedIds.cleanupId || null,
      `${actionType} - ${pointsAwarded} points awarded`
    ]);
    
    console.log(`[POINTS] Transaction recorded: ${actionType} - ${pointsAwarded} points for user ${userId}`);
    
  } catch (error) {
    console.error("[POINTS] Error recording transaction:", error);
  }
}

/**
 * Update user points and related stats
 */
async function updateUserPoints(userId, pointsAwarded, actionType) {
  try {
    // Update user's total points and related counters
    await pool.execute(`
      UPDATE users 
      SET points = points + ?, 
          weekly_points = weekly_points + ?,
          monthly_points = monthly_points + ?,
          last_activity_date = CURDATE()
      WHERE id = ?
    `, [pointsAwarded, pointsAwarded, pointsAwarded, userId]);
    
    // Check if user's rank should be updated
    await updateUserRank(userId);
    
    // Update combo streak
    await updateComboStreak(userId, actionType);
    
    console.log(`[POINTS] User ${userId} awarded ${pointsAwarded} points for ${actionType}`);
    
  } catch (error) {
    console.error("[POINTS] Error updating user points:", error);
  }
}

/**
 * Update user's rank based on total points
 */
async function updateUserRank(userId) {
  try {
    const [users] = await pool.execute(
      "SELECT points FROM users WHERE id = ?", 
      [userId]
    );
    
    if (users.length === 0) return;
    
    const currentPoints = users[0].points;
    const newRank = RANK_SYSTEM.reverse().find(rank => currentPoints >= rank.minPoints);
    RANK_SYSTEM.reverse(); // restore original order
    
    if (newRank) {
      await pool.execute(`
        UPDATE users 
        SET rank = ?, level = ?, points_multiplier = ?
        WHERE id = ?
      `, [newRank.name, newRank.level, newRank.multiplier, userId]);
    }
    
  } catch (error) {
    console.error("[POINTS] Error updating user rank:", error);
  }
}

/**
 * Helper functions
 */

async function getUserData(userId) {
  const [users] = await pool.execute(`
    SELECT points, streak_days, points_multiplier, combo_streak, 
           first_cleanup_locations, last_activity_date
    FROM users WHERE id = ?
  `, [userId]);
  
  return users[0] || {
    points: 0,
    streak_days: 0,
    points_multiplier: 1.0,
    combo_streak: 0,
    first_cleanup_locations: '[]',
    last_activity_date: null
  };
}

function calculateStreakMultiplier(streakDays) {
  const { base, maxMultiplier } = POINTS_CONFIG.streakMultiplier;
  const multiplier = Math.pow(base, streakDays);
  return Math.min(multiplier, maxMultiplier);
}

async function calculateLocationBonus(latitude, longitude) {
  try {
    const [bonuses] = await pool.execute(`
      SELECT multiplier FROM location_bonuses 
      WHERE is_active = true 
      AND (valid_until IS NULL OR valid_until >= CURDATE())
      AND (valid_from IS NULL OR valid_from <= CURDATE())
      AND (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
          sin(radians(latitude)))) <= radius_meters / 1000
    `, [latitude, longitude, latitude]);
    
    // Apply highest applicable bonus
    const maxBonus = bonuses.reduce((max, bonus) => 
      Math.max(max, bonus.multiplier - 1), 0
    );
    
    return maxBonus;
    
  } catch (error) {
    console.error("[POINTS] Error calculating location bonus:", error);
    return 0;
  }
}

async function checkFirstTimeLocation(userId, latitude, longitude) {
  try {
    const userData = await getUserData(userId);
    const visitedLocations = JSON.parse(userData.first_cleanup_locations || '[]');
    
    // Simple location clustering (within 100m)
    const isNewLocation = !visitedLocations.some(loc => 
      calculateDistance(latitude, longitude, loc.lat, loc.lng) < 100
    );
    
    if (isNewLocation) {
      // Add to visited locations
      visitedLocations.push({ lat: latitude, lng: longitude });
      await pool.execute(
        "UPDATE users SET first_cleanup_locations = ? WHERE id = ?",
        [JSON.stringify(visitedLocations), userId]
      );
      
      return POINTS_CONFIG.firstTimeLocationBonus;
    }
    
    return 0;
    
  } catch (error) {
    console.error("[POINTS] Error checking first-time location:", error);
    return 0;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function checkComboBonus(userId) {
  try {
    // Check if user has performed multiple actions in the last hour
    const [actions] = await pool.execute(`
      SELECT COUNT(*) as action_count 
      FROM points_transactions 
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `, [userId]);
    
    const actionCount = actions[0].action_count;
    
    if (actionCount >= 2) {
      // Update combo streak
      await pool.execute(
        "UPDATE users SET combo_streak = combo_streak + 1 WHERE id = ?",
        [userId]
      );
      
      return POINTS_CONFIG.comboBonus;
    }
    
    return 0;
    
  } catch (error) {
    console.error("[POINTS] Error checking combo bonus:", error);
    return 0;
  }
}

async function updateComboStreak(userId, actionType) {
  try {
    const [users] = await pool.execute(
      "SELECT combo_streak, max_combo_streak FROM users WHERE id = ?",
      [userId]
    );
    
    if (users.length > 0) {
      const { combo_streak, max_combo_streak } = users[0];
      
      if (combo_streak > max_combo_streak) {
        await pool.execute(
          "UPDATE users SET max_combo_streak = ? WHERE id = ?",
          [combo_streak, userId]
        );
      }
    }
    
  } catch (error) {
    console.error("[POINTS] Error updating combo streak:", error);
  }
}

module.exports = {
  calculateReportingPoints,
  calculateCleanupPoints,
  recordPointsTransaction,
  updateUserPoints,
  updateUserRank,
  RANK_SYSTEM,
  POINTS_CONFIG
};