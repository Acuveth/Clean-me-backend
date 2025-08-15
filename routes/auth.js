const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { email, name, password } = req.body;

    // Basic validation
    if (!email || !name || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const [result] = await pool.execute(
      "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
      [email, name, passwordHash]
    );

    // Get the created user
    const [users] = await pool.execute(
      "SELECT id, email, name, points FROM users WHERE id = ?",
      [result.insertId]
    );

    const user = users[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "default_secret"
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        points: user.points,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (users.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "default_secret"
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        points: user.points,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user info
router.get("/me", authenticateToken, (req, res) => {
  res.json(req.user);
});

module.exports = router;
