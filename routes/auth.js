// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const router = express.Router();

// Register Endpoint
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  // Check if the user already exists
  const [existingUser] = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  if (existingUser.length)
    return res.status(400).json({ message: "User already exists" });

  // Hash password and save the user
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.query("INSERT INTO users (username, password) VALUES (?, ?)", [
    username,
    hashedPassword,
  ]);

  res.status(201).json({ message: "User registered successfully" });
});

// Login Endpoint
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Find the user
  const [user] = await db.query("SELECT * FROM users WHERE username = ?", [
    username,
  ]);
  if (!user.length)
    return res.status(400).json({ message: "Invalid credentials" });

  // Check password
  const validPassword = await bcrypt.compare(password, user[0].password);
  if (!validPassword)
    return res.status(400).json({ message: "Invalid credentials" });

  // Generate JWT token
  const token = jwt.sign({ userId: user[0].id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.json({ token });
});

// Protected Route Example
router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "This is a protected route", userId: req.userId });
});

// Middleware to Verify Token
function verifyToken(req, res, next) {
  const token = req.header("Authorization").replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = verified.userId;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
}

module.exports = router;
