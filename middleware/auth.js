const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "default_secret"
    );
    const [users] = await pool.execute(
      "SELECT id, email, name, points FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

module.exports = { authenticateToken };
