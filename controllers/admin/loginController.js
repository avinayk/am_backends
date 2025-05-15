const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
require("dotenv").config();

exports.login = (req, res) => {
  const { email, password } = req.body;
  //console.log("Request body:", req.body);
  // Check if email and password are provided
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Emailsss and password are required" });
  }

  // Query the database to get the user by email
  db.query(
    "SELECT * FROM admin WHERE email = ?",
    [email],
    async (err, rows) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      if (rows.length > 0) {
        const user = rows[0];

        // Check if password matches
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res
            .status(404)
            .json({ status: "2", message: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        db.query(
          "UPDATE admin SET token = ? WHERE email = ?",
          [token, email],
          (err, result) => {
            if (err) {
              console.error("Database update error:", err);
              return;
            }
          }
        );
        res.status(200).json({
          message: "Login successful",
          token,
          user: {
            id: user.id,
            email: user.email,
            token: token,
          },
        });
      } else {
        res
          .status(404)
          .json({ status: "2", message: "Invalid email or password" });
      }
    }
  );
};
