const bcrypt = require("bcryptjs");
const moment = require("moment-timezone");
const jwt = require("jsonwebtoken");
const db = require("../db");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

require("dotenv").config();
//const logActivity = require("../utils/logActivity"); // Import the utility
const logActivity = (userId, description) => {
  const query = `
    INSERT INTO logsactivity (user_id, description, date)
    VALUES (?, ?, NOW())
  `;
  console.log(query);
  db.query(query, [userId, description], (err, result) => {
    if (err) {
      console.error("Error inserting log activity:", err);
    }
  });
};
exports.login = (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  // Query the database to get the user by email
  db.query(
    "SELECT * FROM users WHERE email = ?",
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

        // Handle user status
        if (user.status === "Inactive") {
          return res
            .status(403)
            .json({ status: "3", message: "Account is inactive" });
        }
        if (user.status === "Banned") {
          return res
            .status(403)
            .json({ status: "3", message: "Account is banned" });
        }

        // Generate OTP
        const otp = generateOTP();

        // Update OTP in the database
        db.query(
          "UPDATE users SET login_OTP = ? WHERE email = ?",
          [otp, email],
          (updateErr, updateResult) => {
            if (updateErr) {
              return res.status(500).json({
                message: "Error updating OTP in database",
                error: updateErr,
              });
            }

            // Send OTP email
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: "amourette.no@gmail.com",
                pass: "ozox fcff dftd mguf", // Consider using environment variables for security
              },
            });

            const mailOptions = {
              from: "amourette.no@gmail.com",
              to: email, // Use the email from the database
              subject: "Your One-Time OTP for Amourette",
              text: `Dear User,\n\nYour one-time OTP for secure access is: ${otp}\n\nThis OTP is valid for a single use. Please do not share this code with anyone.\n\nThank you,\nAmourette Team`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                return res.status(500).json({
                  message: "Error sending OTP email",
                  error: error,
                });
              }
              // If OTP email sent successfully
              res.status(200).json({
                message:
                  "Verify your account, Please check your email and enter OTP",
                user: {
                  id: user.id,
                  email: user.email,
                  status: user.status,
                },
              });
            });
          }
        );
      } else {
        res
          .status(404)
          .json({ status: "2", message: "Invalid email or password" });
      }
    }
  );
};

// Generate OTP (Example)
function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit OTP
  return otp.toString();
}

exports.checkloginOTP = (req, res) => {
  const {
    city,
    country_code,
    country_name,
    region,
    timezone,
    latitude,
    longitude,
    email,
    postal,
    otp,
    IpAddress,
  } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, rows) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      if (rows.length > 0) {
        const user = rows[0];

        // Check if OTP matches the one stored in DB
        if (user.login_OTP !== otp) {
          return res
            .status(404)
            .json({ status: "2", message: "OTP not match" });
        }

        // Handle user status
        if (user.status === "Inactive") {
          return res
            .status(403)
            .json({ status: "3", message: "Account is inactive" });
        }
        if (user.status === "Banned") {
          return res
            .status(403)
            .json({ status: "3", message: "Account is banned" });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        logActivity(user.id, "User logged in successfully");

        // Update user login status and clear OTP
        const updateQuery = `
        UPDATE users
        SET token = ?, online_user = 'Online', last_activity = NOW(), login_OTP = ''
        WHERE email = ?;
      `;
        db.query(updateQuery, [token, email], (err) => {
          if (err) {
            console.error("Database update error:", err);
            return;
          }
        });

        var cc = user.attempt_count + 1;
        const updateQueryip = `
        UPDATE users
        SET IpAddress = ?, attempt_count = ?
        WHERE email = ?;
      `;
        db.query(updateQueryip, [IpAddress, cc, email], (err) => {
          if (err) {
            console.error("Database update error:", err);
            return;
          }
        });

        // Insert login details into usersmulti_login
        const querymultiLogin = `
        INSERT INTO usersmulti_login (user_id, IpAddress, city, country_code, country_name, region, postal, timezone, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

        db.query(
          querymultiLogin,
          [
            user.id,
            IpAddress,
            city,
            country_code,
            country_name,
            region,
            postal,
            timezone,
            latitude,
            longitude,
          ],
          (err) => {
            if (err) {
              console.error("Error inserting user login details:", err);
            }
          }
        );

        res.status(200).json({
          message: "Login successful",
          token,
          user: {
            id: user.id,
            email: user.email,
            status: user.status,
            token: token,
          },
        });
      } else {
        res.status(200).json({ status: "2", message: "Invalid email" });
      }
    }
  );
};

exports.checkUsersubscription = (req, res) => {
  console.log("Checking expired subscriptions...");

  const currentDate = moment.tz(new Date(), "Europe/Oslo").format("YYYY-MM-DD");

  db.query(
    "SELECT * FROM membership WHERE plan != ? AND DATE(end_date) <= DATE(?)",
    ["Free", currentDate],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Database query failed",
        });
      }

      if (results.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No expired memberships found",
        });
      }

      const updateQuery = `
        UPDATE membership
        SET unique_code = ?,
            start_date = ?,
            end_date = ?,
            date = ?,
            status = ?,
            PaymentrefundDispute_status = ?
        WHERE id = ?`;

      const insertQuery = `
        INSERT INTO allmembership
        (unique_code,user_id, product_id, customerId, session_id, start_date, end_date, days, plan, amount, payment_id, currency, livemode, date, PaymentrefundDispute_status, status, PaymentrefundDispute_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      results.forEach((row) => {
        const uniqueCode = crypto.randomBytes(4).toString("hex").toUpperCase();
        const newStartDate = moment
          .tz(new Date(), "Europe/Oslo")
          .format("YYYY-MM-DD");
        const newEndDate = moment
          .tz(new Date(), "Europe/Oslo")
          .add(row.days, "days")
          .format("YYYY-MM-DD");

        const updateValues = [
          uniqueCode, // Random unique code
          newStartDate, // Start date = Current date
          newEndDate, // End date = Current date + 'days'
          newStartDate, // Date = Current date
          "Complete", // Status
          "History", // PaymentrefundDispute_status
          row.id, // WHERE id = ?
        ];

        const insertValues = [
          uniqueCode,
          row.user_id,
          row.product_id,
          row.customerId,
          row.session_id,
          newStartDate,
          newEndDate,
          row.days,
          row.plan,
          row.amount,
          row.payment_id,
          row.currency,
          row.livemode,
          newStartDate,
          "History",
          "complete",
          newStartDate, // PaymentrefundDispute_date
        ];

        // Update the membership table
        db.query(updateQuery, updateValues, (updateErr) => {
          if (updateErr) {
            console.error(`Error updating membership ID ${row.id}:`, updateErr);
          } else {
            // Insert into allmembership table
            db.query(insertQuery, insertValues, (insertErr) => {
              if (insertErr) {
                console.error(
                  `Error inserting into allmembership for user ${row.user_id}:`,
                  insertErr
                );
              }
            });
          }
        });
      });

      res.status(200).json({
        success: true,
        message: `${results.length} expired memberships updated and logged in allmembership`,
      });
    }
  );
};
