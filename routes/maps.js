const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");

// Get Google Maps configuration - Public endpoint since API key is used client-side
router.get("/config", (req, res) => {
  res.json({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    // You can add other map configurations here
    defaultCenter: {
      lat: 40.7128,
      lng: -74.0060
    },
    defaultZoom: 11
  });
});

// Proxy for Google Maps Geocoding API
router.get("/geocode", authenticateToken, async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Geocoding error:", error);
    res.status(500).json({ error: "Failed to geocode address" });
  }
});

// Proxy for Google Maps Places API
router.get("/places/autocomplete", authenticateToken, async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) {
      return res.status(400).json({ error: "Input is required" });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Places autocomplete error:", error);
    res.status(500).json({ error: "Failed to get place suggestions" });
  }
});

module.exports = router;