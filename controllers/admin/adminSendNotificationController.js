const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const moment = require("moment-timezone");
require("dotenv").config();
const WebSocket = require("ws");
const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use((req, res, next) => {
  req.wss = wss;
  next();
});
exports.sendallusers = async (req, res) => {
  const messages = req.body.message;
  const date = moment
    .tz(new Date(), "Europe/Oslo")
    .format("YYYY-MM-DD HH:mm:ss");
  const wss = req.wss;

  try {
    // Fetch all users
    db.query("SELECT id FROM users", (err, users) => {
      if (err) {
        console.error("Error fetching users:", err);
        return res.status(500).json({
          message: "Error fetching users",
          error: err,
        });
      }

      // Check if any users exist
      if (users.length === 0) {
        return res.status(404).json({
          message: "No users found",
        });
      }

      const readStatus = "No"; // 0 for unread, 1 for read

      // Loop through each user and insert notification
      users.forEach((user) => {
        // Insert notification for the user
        db.query(
          "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
          ["Admin", user.id, messages, readStatus, date],
          (err, result) => {
            if (err) {
              console.error(
                `Error inserting notification for user ${user.id}:`,
                err
              );
            } else {
              console.log(`Notification inserted for user ${user.id}`);

              // Insert into notificationforadmin table
            }
          }
        );
      });
      db.query(
        "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
        [messages, date], // Use the insertId from the first query
        (err) => {
          if (err) {
            console.error(
              `Error inserting into notificationforadmin for notification :`,
              err
            );
          } else {
            console.log(
              `Notification entry added to notificationforadmin for notification `
            );
          }
        }
      );
      // Prepare broadcast message
      const broadcastMessage = JSON.stringify({
        event: "adminNotification",
        user_id: users.map((user) => user.id), // Send an array of user IDs
        message: messages,
      });

      // Broadcast to all WebSocket clients
      if (wss) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastMessage);
          }
        });
      }

      // Respond once the operation is initiated
      res.status(201).json({
        message: "Notifications are being created for all users",
      });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      message: "Server error",
      error,
    });
  }
};
exports.getnotificationadmin = async (req, res) => {
  try {
    // Fetch all users
    db.query(
      "SELECT * FROM notificationforadmin order by id desc",
      (err, results) => {
        if (err) {
          console.error("Error fetching users:", err);
          return res.status(500).json({
            message: "Error fetching users",
            error: err,
          });
        }

        // Respond once the operation is initiated
        res.status(201).json({
          message: "Notifications are being created for all users",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      message: "Server error",
      error,
    });
  }
};
exports.deletenotifications = async (req, res) => {
  var id = req.body.id;
  try {
    // Fetch all users
    const deleteQuery = `DELETE FROM notificationforadmin WHERE id = ?`;
    db.query(deleteQuery, [id], (deleteErr) => {
      if (deleteErr) {
        console.error("Database delete error:", deleteErr);
        return res
          .status(500)
          .json({ message: "Database delete error", error: deleteErr });
      }
      return res.status(200).json({ message: "" });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      message: "Server error",
      error,
    });
  }
};
