const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const axios = require("axios");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Validate trash photo
router.post("/validate-trash-photo", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;
    
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a photo validator for an environmental cleanup app. Only approve photos that show litter/trash in OUTDOOR public spaces (streets, parks, sidewalks, beaches, etc.). Reject indoor photos, private property, or inappropriate content."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Validate this image for a community trash cleanup app. Return ONLY a JSON object:
                
                {
                  "isValid": true/false,
                  "reason": "explanation",
                  "location": "indoor/outdoor/unclear",
                  "confidence": 0.0-1.0
                }
                
                Approve ONLY if it shows outdoor litter/trash that can be safely cleaned.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let content = response.data.choices[0].message.content;
    // Clean markdown formatting if present (more robust pattern)
    content = content.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
    const validation = JSON.parse(content);
    
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error("Validation error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Failed to validate photo",
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Analyze trash photo with AI
router.post("/analyze-trash-photo", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;
    
    // First validate the photo
    const validationResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a photo validator for an environmental cleanup app. Only approve photos that show litter/trash in OUTDOOR public spaces."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Validate this image. Return ONLY a JSON object:
                {
                  "isValid": true/false,
                  "reason": "explanation"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let validationContent = validationResponse.data.choices[0].message.content;
    // Clean markdown formatting if present (more robust pattern)
    validationContent = validationContent.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
    const validation = JSON.parse(validationContent);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: "Invalid photo",
        validationError: validation.reason
      });
    }

    // If valid, proceed with analysis
    const analysisResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert in waste management and environmental cleanup. Analyze trash photos and provide detailed information."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this trash/litter image and provide detailed information. Return ONLY a JSON object with this structure:
                
                {
                  "category": "organic/recyclable/hazardous/electronic/mixed/general",
                  "materials": ["list", "of", "materials"],
                  "quantity": "small/medium/large",
                  "estimatedWeight": "weight in kg",
                  "hazardLevel": "low/medium/high",
                  "cleanupDifficulty": "easy/moderate/difficult",
                  "recyclingInfo": "Recycling instructions",
                  "disposalMethod": "Proper disposal method",
                  "environmentalImpact": "Brief environmental impact",
                  "points": 10-100,
                  "tips": "Cleanup tips",
                  "safetyNotes": "Safety considerations"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.5
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let content = analysisResponse.data.choices[0].message.content;
    // Clean markdown formatting if present (more robust pattern)
    content = content.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Raw content received:', JSON.stringify(analysisResponse.data.choices[0].message.content));
      console.error('Cleaned content:', JSON.stringify(content));
      throw parseError;
    }
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error("Analysis error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Failed to analyze photo",
      details: error.response?.data?.error?.message || error.message
    });
  }
});

module.exports = router;