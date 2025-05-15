const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const moment = require("moment-timezone");
exports.getSearchAddfriend = async (req, res) => {
  const user_id = req.body.user_id;
  const searchTerm = req.body.searchTerm || ""; // Capture search term from request
  console.log(req.body);

  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all users who are not friends and match the search term
    db.query(
      `SELECT u.*
       FROM users u
       LEFT JOIN friendRequest_accept fr ON u.id = fr.user_id OR u.id = fr.sent_to
       WHERE fr.sent_to IS NULL
       AND u.id != ?
       AND (u.username LIKE ? OR u.birthday_date LIKE ? OR u.location LIKE ?)`, // Use LIKE to search multiple fields
      [user_id, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If results are found, return them; otherwise, return a message

        res.status(200).json({
          message: "Users retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Error retrieving users:", error);
    res.status(500).json({ message: "Error retrieving users", error });
  }
};
exports.getAddfriend = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(req.body);
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      `SELECT u.*
      FROM users u
      LEFT JOIN friendRequest_accept fr ON 
          (u.id = fr.user_id AND fr.sent_to = ?) OR 
          (u.id = fr.sent_to AND fr.user_id = ?)
      WHERE 
          (fr.status IS NULL OR fr.status = 'No') 
          AND u.id != ?
          AND u.id NOT IN (
              SELECT DISTINCT user_id
              FROM friendRequest_accept
              WHERE status = 'Yes'
          );
        `,
      [user_id, user_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        if (results.length > 0) {
          res.status(200).json({
            message: "Events retrieved successfully",
            results: results,
          });
        } else {
          res.status(404).json({ message: "No events found for this user" });
        }
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.getUserdetail = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(req.body);

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all users who are not friends and match the search term
    db.query(
      `SELECT *
      FROM users
      WHERE id = ?`,
      [user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }
        console.log(results.length);
        // Check if an event was found
        if (results.length === 0) {
          return res
            .status(200)
            .json({ message: "User not found.", event: "" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "Event retrieved successfully.",
          result: results[0], // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Error retrieving users:", error);
    res.status(500).json({ message: "Error retrieving users", error });
  }
};

exports.requestSent = async (req, res) => {
  const { user_id, sent_id } = req.body;
  console.log(req.body);

  if (!user_id || !sent_id) {
    return res
      .status(400)
      .json({ message: "User ID and Sent ID are required" });
  }

  const date = moment
    .tz(new Date(), "Europe/Oslo")
    .format("YYYY-MM-DD HH:mm:ss");

  try {
    // Check if a friend request already exists between user_id and sent_id
    db.query(
      "SELECT * FROM friendRequest_accept WHERE user_id = ? AND sent_to = ?",
      [user_id, sent_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If a record already exists, return a message
        if (results.length > 0) {
          return res.status(200).json({
            message: "Request already sent",
          });
        }

        // If no record exists, insert a new friend request
        db.query(
          "INSERT INTO friendRequest_accept (user_id, sent_to, status, date) VALUES (?, ?, ?, ?)",
          [user_id, sent_id, "No", date],
          (err, result) => {
            if (err) {
              console.error("Database insertion error:", err);
              return res
                .status(500)
                .json({ message: "Database insertion error", error: err });
            }

            res.status(201).json({
              message: "Request sent successfully",
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Error sending request:", error);
    res.status(500).json({ message: "Error sending request", error });
  }
};
