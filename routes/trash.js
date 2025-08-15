const express = require("express");
const multer = require("multer");
const path = require("path");
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/trash-reports/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Helper function to calculate points
const calculatePoints = (size, trashType) => {
  const sizeMultiplier = {
    Small: 10,
    Medium: 20,
    Large: 30,
    "Very Large": 50,
  };

  const typeMultiplier = {
    General: 1.0,
    Plastic: 1.2,
    Glass: 1.1,
    Metal: 1.3,
    Organic: 0.8,
    Hazardous: 2.0,
  };

  const basePoints = sizeMultiplier[size] || 20;
  const multiplier = typeMultiplier[trashType] || 1.0;
  return Math.round(basePoints * multiplier);
};

// Get all trash reports
router.get("/reports", authenticateToken, async (req, res) => {
  try {
    const [reports] = await pool.execute(`
      SELECT tr.*, u.name as reporter_name 
      FROM trash_reports tr 
      LEFT JOIN users u ON tr.user_id = u.id 
      WHERE tr.status = 'pending'
      ORDER BY tr.created_at DESC
    `);

    res.json(reports);
  } catch (error) {
    console.error("Fetch reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Submit trash report
router.post(
  "/report",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    try {
      const { latitude, longitude, description, trashType, size } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "Photo is required" });
      }

      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Location is required" });
      }

      const photoUrl = `/uploads/trash-reports/${req.file.filename}`;
      const points = calculatePoints(size, trashType);

      // Insert the report
      const [result] = await pool.execute(
        `
      INSERT INTO trash_reports 
      (user_id, latitude, longitude, photo_url, description, trash_type, size, points) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          req.user.id,
          latitude,
          longitude,
          photoUrl,
          description,
          trashType,
          size,
          points,
        ]
      );

      // Get the created report
      const [reports] = await pool.execute(
        "SELECT * FROM trash_reports WHERE id = ?",
        [result.insertId]
      );

      // Update user's report count
      await pool.execute(
        "UPDATE users SET total_reports = total_reports + 1 WHERE id = ?",
        [req.user.id]
      );

      res.status(201).json(reports[0]);
    } catch (error) {
      console.error("Report submission error:", error);
      res.status(500).json({ error: "Failed to submit report" });
    }
  }
);

// Get specific trash report
router.get("/report/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [reports] = await pool.execute(
      `
      SELECT tr.*, u.name as reporter_name 
      FROM trash_reports tr 
      LEFT JOIN users u ON tr.user_id = u.id 
      WHERE tr.id = ?
    `,
      [id]
    );

    if (reports.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(reports[0]);
  } catch (error) {
    console.error("Fetch report error:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

module.exports = router;
