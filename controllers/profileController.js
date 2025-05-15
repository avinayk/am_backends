const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const moment = require("moment-timezone");
const express = require("express");
const app = express();
const nodemailer = require("nodemailer");
const http = require("http");
const server = http.createServer(app);
const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });
app.use((req, res, next) => {
  req.wss = wss;
  next();
});

// Broadcast function to send messages to all connected clients
const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};
//console.log(wss);
// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("New client connected");
  ws.send(JSON.stringify({ message: "Welcome to the WebSocket server!" }));

  ws.on("message", (message) => {
    // Handle incoming messages and broadcast them
    console.log(`Received message: ${message}`);
    broadcast(message);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
exports.getAllFriend = async (req, res) => {
  var user_id = req.body.user_id;
  console.log(user_id);
  try {
    // Ensure the email is provided
    if (!user_id) {
      return res.status(400).json({ message: "User id  is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT DISTINCT
    u.*,
    fr.status
FROM
    users u
JOIN
    friendRequest_accept fr
    ON (u.id = fr.sent_to AND fr.user_id = ?)
    OR (u.id = fr.user_id AND fr.sent_to = ?)
WHERE
    fr.status = ?
;
`,
      [user_id, user_id, "Yes"],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "All friend",
          results: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getAllFriendfav = async (req, res) => {
  var user_id = req.body.user_id;
  try {
    // Ensure the email is provided
    if (!user_id) {
      return res.status(400).json({ message: "User id  is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT 
    u.* 
FROM users u
JOIN fav_friends ff 
    ON u.id = ff.to_id
WHERE ff.user_id = ? order by ff.id desc;
;
`,
      [user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "All friend",
          results: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getUsersFriendRequest = async (req, res) => {
  var user_id = req.body.user_id;
  console.log(user_id);
  try {
    // Ensure the email is provided
    if (!user_id) {
      return res.status(400).json({ message: "User id  is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT
          u.* ,fr.id as frq_id, fr.user_id AS sentid
      FROM
          users u
      JOIN
          friendRequest_accept fr
      ON
          u.id = fr.user_id
      WHERE
          fr.sent_to = ? AND fr.status = ?;
      `,
      [user_id, "No"],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "Friend Request",
          results: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.AcceptRequest = async (req, res) => {
  const { id, user_id, sentto } = req.body; // Get the ID of the friend request to accept
  const wss = req.wss;
  try {
    // Ensure the friend request ID is provided
    if (!id) {
      return res.status(400).json({ message: "Friend request ID is required" });
    }
    console.log(sentto);
    console.log(user_id);
    // Update the friend request status to 'Yes'
    db.query(
      `UPDATE friendRequest_accept
       SET status = 'Yes'
       WHERE id = ?`,
      [id],
      (updateErr, updateResults) => {
        if (updateErr) {
          return res
            .status(500)
            .json({ message: "Database update error", error: updateErr });
        }
        console.log(updateResults);
        console.log("ccc");
        // Query to get the user's profile details after accepting the request
        db.query(
          `SELECT
              u.*, fr.id AS frq_id, fr.user_id AS sentid
          FROM
              users u
          JOIN
              friendRequest_accept fr
          ON
              u.id = fr.user_id
          WHERE
              fr.sent_to = ? AND fr.status = ?;`,
          [updateResults.insertId, "No"], // Use insertId or another appropriate identifier
          (queryErr, results) => {
            if (queryErr) {
              return res
                .status(500)
                .json({ message: "Database query error", error: queryErr });
            }
            const query = `
                    SELECT
                        u.*,
                        CASE
                            WHEN fr.status = 'Yes' THEN true
                            ELSE false
                        END AS is_friend

                    FROM
                        users u
                    JOIN
                        friendRequest_accept fr ON
                            (u.id = fr.sent_to AND fr.user_id = ?) OR
                            (u.id = fr.user_id AND fr.sent_to = ?)

                    WHERE
                        fr.status = 'Yes'  -- Ensure that the friend request is accepted;;`;

            // Fetching the messages
            db.query(query, [user_id, user_id], (err, results) => {
              if (err) {
                return res.status(500).json({
                  message: "Database query error",
                  error: err,
                });
              }
              db.query(
                `SELECT username FROM users WHERE id = ?`,
                [user_id], // Fetch the username of the user who accepted the request
                (err, userResult) => {
                  if (err) {
                    return res.status(500).json({
                      message: "Error fetching username for user_id",
                      error: err,
                    });
                  }

                  const userUsername =
                    userResult[0]?.username || "Unknown User"; // Username of the user who accepted the request

                  // Fetch the username of the user who sent the request
                  db.query(
                    `SELECT username FROM users WHERE id = ?`,
                    [user_id], // Fetch the username of the user who sent the friend request
                    (err, senderResult) => {
                      if (err) {
                        return res.status(500).json({
                          message: "Error fetching username for sentto",
                          error: err,
                        });
                      }

                      const senderUsername =
                        senderResult[0]?.username || "Unknown User"; // Username of the user who sent the request

                      // Prepare the notification message
                      const notificationMessage = ` are now friend`;

                      // Broadcast WebSocket notification to clients
                      const broadcastMessage = JSON.stringify({
                        event: "friendrequestacceptnotification",
                        user_id: results,
                        LoginData: results,
                      });

                      if (wss) {
                        wss.clients.forEach((client) => {
                          if (client.readyState === WebSocket.OPEN) {
                            client.send(broadcastMessage);
                          }
                        });
                      }

                      // Insert notification into the database
                      const date = moment
                        .tz(new Date(), "Europe/Oslo")
                        .format("YYYY-MM-DD HH:mm:ss");
                      // results.forEach((item) => {
                      //   const user_ids = item.id; // Use `id` from the results array

                      // });
                      db.query(
                        "INSERT INTO notification (to_id,user_id, message, date) VALUES (?, ?, ?,?)",
                        [user_id, sentto, notificationMessage, date],
                        (err, result) => {
                          if (err) {
                            console.error("Database insertion error:", err); // Log error to console
                          }
                        }
                      );
                      logActivity(user_id, notificationMessage);
                      // Send the response back to the client
                      res.status(200).json({
                        message: "Friend request accepted",
                        results: results, // Return the results after accepting the request
                      });
                    }
                  );
                }
              );
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getReceivedMessage = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.slug AS sender_slug,
    u1.location AS sender_location,
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday,
    u2.slug AS recipient_slug
FROM chatmessages cm
JOIN users u1 ON cm.user_id = u1.id
JOIN users u2 ON cm.to_id = u2.id
WHERE cm.id IN (
    SELECT MAX(sub.id)
    FROM chatmessages sub
    WHERE sub.to_id = ? AND sub.message != '' And sub.\`read\` = 'Yes'
    GROUP BY sub.user_id
)
ORDER BY cm.date DESC;
;
 `,
      [user_id, user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          results: results, // Return all results
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getReceivedMessageheader = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.slug AS sender_slug,
    u1.location AS sender_location,
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday,
    u2.slug AS recipient_slug
FROM chatmessages cm
JOIN users u1 ON cm.user_id = u1.id
JOIN users u2 ON cm.to_id = u2.id
WHERE cm.id IN (
    SELECT MAX(sub.id)
    FROM chatmessages sub
    WHERE (
        (sub.user_id = ? AND sub.to_id != ?)
        OR (sub.to_id = ? AND sub.user_id != ?)
    ) AND sub.message != ''
    GROUP BY LEAST(sub.user_id, sub.to_id), GREATEST(sub.user_id, sub.to_id)
)
ORDER BY cm.date DESC
;
 `,
      [user_id, user_id, user_id, user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          results: results, // Return all results
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getrec = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.slug AS sender_slug,
    u1.location AS sender_location,
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday,
    u2.slug AS recipient_slug
FROM chatmessages cm
JOIN users u1 ON cm.user_id = u1.id
JOIN users u2 ON cm.to_id = u2.id
WHERE cm.id IN (
    SELECT MAX(sub.id)
    FROM chatmessages sub
    WHERE sub.to_id = ? AND sub.message != '' And sub.\`read\` = 'No'
    GROUP BY sub.user_id
)
AND NOT EXISTS (
    SELECT 1 FROM chatmessage_left cl
    WHERE cl.chatmessages_id = cm.id
    AND cl.user_id = ?
)
ORDER BY cm.date DESC;
;
 `,
      [user_id, user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          results: results, // Return all results
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getSendMessage = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(user_id);

  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.slug AS sender_slug,
    u1.location AS sender_location,
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday,
    u2.slug AS recipient_slug
FROM chatmessages cm
JOIN users u1 ON cm.user_id = u1.id
JOIN users u2 ON cm.to_id = u2.id
WHERE cm.id IN (
    SELECT MAX(sub.id)
    FROM chatmessages sub
    WHERE sub.user_id = ? AND sub.message != '' And sub.\`read\` = 'Yes'
    GROUP BY sub.to_id
)
ORDER BY cm.date DESC;
 `,
      [user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          results: results, // Return all results
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getSendMessageunread = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(user_id);

  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.slug AS sender_slug,
    u1.location AS sender_location,
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday,
    u2.slug AS recipient_slug
FROM chatmessages cm
JOIN users u1 ON cm.user_id = u1.id
JOIN users u2 ON cm.to_id = u2.id
WHERE cm.id IN (
    SELECT MAX(sub.id)
    FROM chatmessages sub
    WHERE sub.user_id = ? AND sub.message != '' And sub.\`read\` = 'No'
    GROUP BY sub.to_id
)
ORDER BY cm.date DESC;
 `,
      [user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          results: results, // Return all results
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getSendMessageSearch = async (req, res) => {
  const user_id = req.body.user_id;
  const searchTerm = req.body.search; // Assuming searchTerm is provided in the request body

  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to search for messages with filtering
    const query = `
      SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.location AS sender_location,
    u1.slug AS sender_slug,                 -- Sender's slug
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday
FROM
    chatmessages cm
JOIN
    users u1 ON cm.user_id = u1.id
JOIN
    users u2 ON cm.to_id = u2.id 
WHERE
    cm.id IN (
        SELECT MAX(sub.id)
        FROM chatmessages sub
        WHERE sub.user_id = ? AND sub.message != '' And sub.\`read\` = 'Yes'
        GROUP BY sub.to_id
    )
    AND (u2.username LIKE ?
         OR u2.birthday_date LIKE ?
         OR u2.location LIKE ?
         OR cm.message LIKE ?)
ORDER BY
    cm.date DESC;

    `;

    // Prepare the search terms for the LIKE query
    const searchPattern = `%${searchTerm}%`; // Using wildcards for searching
    const params = [
      user_id,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    // Execute the query
    db.query(query, params, (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        results: results, // Return the filtered results
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getSendMessageSearchunread = async (req, res) => {
  const user_id = req.body.user_id;
  const searchTerm = req.body.search; // Assuming searchTerm is provided in the request body

  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to search for messages with filtering
    const query = `
      SELECT
    cm.*,
    u1.profile_image AS sender_profile,
    u1.username AS sender_username,
    u1.birthday_date AS sender_age,
    u1.location AS sender_location,
    u1.slug AS sender_slug, 
    u2.profile_image AS recipient_profile,
    u2.username AS recipient_username,
    u2.location AS recipient_location,
    u2.birthday_date AS recipient_birthday
FROM
    chatmessages cm
JOIN
    users u1 ON cm.user_id = u1.id 
JOIN
    users u2 ON cm.to_id = u2.id 
WHERE
    cm.id IN (
        SELECT MAX(sub.id)
        FROM chatmessages sub
        WHERE sub.user_id = ? AND sub.message != '' And sub.\`read\` = 'No'
        GROUP BY sub.to_id
    )
    AND (u2.username LIKE ?
         OR u2.birthday_date LIKE ?
         OR u2.location LIKE ?
         OR cm.message LIKE ?)
ORDER BY
    cm.date DESC;

    `;

    // Prepare the search terms for the LIKE query
    const searchPattern = `%${searchTerm}%`; // Using wildcards for searching
    const params = [
      user_id,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    // Execute the query
    db.query(query, params, (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        results: results, // Return the filtered results
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getReceivedMessageSearch = async (req, res) => {
  const user_id = req.body.user_id;
  const searchTerm = req.body.search; // Assuming searchTerm is provided in the request body

  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to search for messages with filtering
    const query = `
      SELECT
          cm.*,
          u1.profile_image AS sender_profile,
          u1.username AS sender_username,
          u1.birthday_date AS sender_age,
          u1.slug AS sender_slug,
          u1.location AS sender_location,
          u2.profile_image AS recipient_profile,
          u2.username AS recipient_username,
          u2.location AS recipient_location,
          u2.birthday_date AS recipient_birthday
      FROM
          chatmessages cm
      JOIN
          users u1 ON cm.user_id = u1.id          -- Join to get sender profile
      JOIN
          users u2 ON cm.to_id = u2.id            -- Join to get recipient profile
      WHERE cm.id IN (
          SELECT MAX(sub.id)
          FROM chatmessages sub
          WHERE sub.to_id = ? AND sub.message != ''  And sub.\`read\` = 'Yes'
          GROUP BY sub.user_id
      )
      AND (u1.username LIKE ? OR
           u1.birthday_date LIKE ? OR
           u2.location LIKE ? OR
           cm.message LIKE ?)


      ORDER BY
          cm.date DESC;
    `;

    // Prepare the search terms for the LIKE query
    const searchPattern = `%${searchTerm}%`; // Using wildcards for searching
    const params = [
      user_id,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    // Execute the query
    db.query(query, params, (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        results: results, // Return the filtered results
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getReceivedMessageheaderSearch = async (req, res) => {
  const user_id = req.body.user_id;
  const searchTerm = req.body.search; // Assuming searchTerm is provided in the request body

  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to search for messages with filtering
    const query = `
      SELECT
        cm.*,
        u1.profile_image AS sender_profile,
        u1.username AS sender_username,
        u1.birthday_date AS sender_age,
        u1.slug AS sender_slug,
        u1.location AS sender_location,
        u2.profile_image AS recipient_profile,
        u2.username AS recipient_username,
        u2.location AS recipient_location,
        u2.birthday_date AS recipient_birthday,
        u2.slug AS recipient_slug
      FROM chatmessages cm
      JOIN users u1 ON cm.user_id = u1.id
      JOIN users u2 ON cm.to_id = u2.id
      WHERE cm.id IN (
        SELECT MAX(sub.id)
        FROM chatmessages sub
        WHERE (
          (sub.user_id = ? AND sub.to_id != ?)
          OR (sub.to_id = ? AND sub.user_id != ?)
        )
        AND sub.message != ''
        GROUP BY LEAST(sub.user_id, sub.to_id), GREATEST(sub.user_id, sub.to_id)
      )
      AND (
        u1.username LIKE ? OR
        cm.message LIKE ?
      )
      ORDER BY cm.date DESC;
    `;

    // Prepare the search terms for the LIKE query
    const searchPattern = `%${searchTerm}%`; // Using wildcards for searching
    const params = [
      user_id,
      user_id,
      user_id,
      user_id,
      searchPattern, // u1.username
      searchPattern, // u1.birthday_date
    ];

    // Execute the query
    db.query(query, params, (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Send back the filtered results
      res.status(200).json({
        results: results, // Return the filtered results
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getReceivedMessageSearchunread = async (req, res) => {
  const user_id = req.body.user_id;
  const searchTerm = req.body.search; // Assuming searchTerm is provided in the request body

  console.log(user_id);
  try {
    // Ensure the user ID is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to search for messages with filtering
    const query = `
      SELECT
          cm.*,
          u1.profile_image AS sender_profile,
          u1.username AS sender_username,
          u1.birthday_date AS sender_age,
          u1.slug AS sender_slug, 
          u1.location AS sender_location,
          u2.profile_image AS recipient_profile,
          u2.username AS recipient_username,
          u2.location AS recipient_location,
          u2.birthday_date AS recipient_birthday
      FROM
          chatmessages cm
      JOIN
          users u1 ON cm.user_id = u1.id          -- Join to get sender profile
      JOIN
          users u2 ON cm.to_id = u2.id            -- Join to get recipient profile
      WHERE cm.id IN (
          SELECT MAX(sub.id)
          FROM chatmessages sub
          WHERE sub.to_id = ? AND sub.message != ''  And sub.\`read\` = 'No'
          GROUP BY sub.user_id
      )
      AND (u1.username LIKE ? OR
           u1.birthday_date LIKE ? OR
           u2.location LIKE ? OR
           cm.message LIKE ?)


      ORDER BY
          cm.date DESC;
    `;

    // Prepare the search terms for the LIKE query
    const searchPattern = `%${searchTerm}%`; // Using wildcards for searching
    const params = [
      user_id,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    // Execute the query
    db.query(query, params, (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        results: results, // Return the filtered results
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getUserSlug = async (req, res) => {
  var slug = req.body.slug;

  try {
    // Ensure the email is provided

    // Query the database to get the user's profile details
    db.query(
      `SELECT * FROM users where slug = ?
      `,
      [slug],
      (err, row) => {
        return res.status(200).json({ row: row });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getUsercheckPermisson = async (req, res) => {
  var slug = req.body.slug;
  var user_id = req.body.user_id;
  var to_id = req.body.to_id;
  console.log(req.body);
  try {
    // Ensure the email is provided

    // Query the database to get the user's profile details
    db.query(
      `SELECT
        users.*,
        userphotoprivate.user_id,
        userphotoprivate.to_id,
        userphotoprivate.status As uStatus
    FROM
        users
    LEFT JOIN
        userphotoprivate ON userphotoprivate.to_id = users.id
        AND userphotoprivate.user_id = ? -- Only match with user_id
    WHERE
        users.slug = ?
        AND (userphotoprivate.status = 'Yes' OR userphotoprivate.status IS NULL OR userphotoprivate.status = 'No')
        AND (userphotoprivate.to_id = ? OR userphotoprivate.to_id IS NULL)
    ORDER BY
        users.id DESC;
      `,
      [user_id, slug, to_id],
      (err, row) => {
        return res.status(200).json({ row: row });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.setonline = async (req, res) => {
  const user_id = req.body.user_id;

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `UPDATE users
       SET online_user = 'Online'
       WHERE id = ?`,
      [user_id],
      (updateErr, updateResults) => {
        if (updateErr) {
          return res
            .status(500)
            .json({ message: "Database update error", error: updateErr });
        }

        // Query to get online users and the total count of online users
        db.query(
          `SELECT *,
              (SELECT COUNT(*) FROM users WHERE online_user = 'Online' AND id != ?) AS onlineCount
           FROM users
           WHERE online_user = 'Online' AND id != ?`,
          [user_id, user_id],
          (queryErr, results) => {
            if (queryErr) {
              return res
                .status(500)
                .json({ message: "Database query error", error: queryErr });
            }

            res.status(200).json({
              message: "Online users",
              onlineCount: results[0]?.onlineCount || 0, // Total count of online users
              results: results, // List of online users
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.setoffline = async (req, res) => {
  const user_id = req.body.user_id;

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Offline'
    db.query(
      `UPDATE users
       SET online_user = 'Offline'
       WHERE id = ?`,
      [user_id],
      (updateErr, updateResults) => {
        if (updateErr) {
          return res
            .status(500)
            .json({ message: "Database update error", error: updateErr });
        }

        // Query to get offline users and the total count of offline users
        db.query(
          `SELECT *,
              (SELECT COUNT(*) FROM users WHERE online_user = 'Offline' AND id != ?) AS offlineCount
           FROM users
           WHERE online_user = 'Offline' AND id != ?`,
          [user_id, user_id],
          (queryErr, results) => {
            if (queryErr) {
              return res
                .status(500)
                .json({ message: "Database query error", error: queryErr });
            }

            res.status(200).json({
              message: "Offline users",
              offlineCount: results[0]?.offlineCount || 0, // Total count of offline users
              results: results, // List of offline users
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.gettotalOnline = async (req, res) => {
  const user_id = req.body.user_id;

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `SELECT *,
       (SELECT COUNT(*) 
        FROM users 
        WHERE online_user = 'Online' 
          AND online_user_active = 'Yes') AS onlineCount
FROM users
WHERE online_user = 'Online' 
  AND online_user_active = 'Yes';
`,

      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "Online users",
          onlineCount: results[0]?.onlineCount || 0, // Total count of online users
          results: results, // List of online users
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.gettotalImages = async (req, res) => {
  const user_id = req.body.user_id;

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `SELECT *,
          (SELECT COUNT(*) FROM gallery) AS imagesCount
       FROM gallery where user_id =?
       `,
      [user_id],

      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "",
          imagesCount: results[0]?.imagesCount || 0, // Total count of online users
          results: results, // List of online users
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.gettotalGroups = async (req, res) => {
  const user_id = req.body.user_id;
  console.log("cf");
  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `SELECT *,
          (SELECT COUNT(*) FROM \`groups\`) AS groupsCount
       FROM \`groups\` where user_id =?
       `,
      [user_id],
      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "",
          groupsCount: results[0]?.groupsCount || 0, // Total count of online users
          results: results, // List of online users
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.gettotalMembers = async (req, res) => {
  const user_id = req.body.user_id;
  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `SELECT *,
          (SELECT COUNT(*) FROM users) AS memberCount
       FROM users
       `,
      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "",
          memberCount: results[0]?.memberCount || 0, // Total count of online users
          results: results, // List of online users
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
exports.gettotalNewMembers = async (req, res) => {
  const user_id = req.body.user_id;
  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to get total members, recent members (last 24 hours, last 7 days), and user list
    db.query(
      `SELECT *, 
          (SELECT COUNT(*) FROM users) AS totalMembers, 
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 1 DAY) AS last24Hours,
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY) AS last7Days
       FROM users`,
      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "User count fetched successfully",
          totalMembers: results[0]?.totalMembers || 0, // Total number of users
          last24Hours: results[0]?.last24Hours || 0, // Users registered in the last 24 hours
          last7Days: results[0]?.last7Days || 0, // Users registered in the last 7 days
          users: results, // List of users including their created_at timestamp
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.gettotalEvents = async (req, res) => {
  const user_id = req.body.user_id;
  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `SELECT *,
          (SELECT COUNT(*) FROM events) AS eventsCount
       FROM events where user_id = ?
      `,
      [user_id],
      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "",
          eventsCount: results[0]?.eventsCount || 0, // Total count of online users
          results: results, // List of online users
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getvisitprofile = async (req, res) => {
  const user_id = req.body.user_id;
  console.log("cf");
  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Update the user status to 'Online'
    db.query(
      `SELECT
            pv.*,
            u.id AS uid,
            u.username,
            u.profile_image
        FROM
            profile_visit pv
        JOIN
            users u ON pv.user_id = u.id
        WHERE
            pv.to_id = ?
        ORDER BY
            pv.id DESC;`,
      [user_id],
      (queryErr, results) => {
        if (queryErr) {
          return res
            .status(500)
            .json({ message: "Database query error", error: queryErr });
        }

        res.status(200).json({
          message: "",
          result: results, // List of online users
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

function generateSlug(title) {
  if (!title) {
    throw new Error("Title is undefined or null");
  }
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove invalid characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/--+/g, "-");
}

function generateSlugedit(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove invalid characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/--+/g, "-"); // Replace multiple hyphens with a single one
}

// Function to create a unique slug
function createUniqueSlug(title, callback) {
  console.log(title);
  const slug = generateSlug(title);

  // Check  if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM speeddate WHERE slug = ?",
    [slug],
    (err, rows) => {
      if (err) {
        return callback(err); // Handle the error
      }

      // If the slug exists, add a number to the end and check again
      if (rows[0].count > 0) {
        let i = 1;
        const checkSlug = () => {
          const newSlug = `${slug}-${i}`;
          db.query(
            "SELECT COUNT(*) as count FROM speeddate WHERE slug = ?",
            [newSlug],
            (err, newRows) => {
              if (err) {
                return callback(err); // Handle the error
              }
              if (newRows[0].count === 0) {
                return callback(null, newSlug); // Return the new unique slug
              }
              i++;
              checkSlug(); // Check again with the incremented slug
            }
          );
        };
        checkSlug(); // Start checking with the incremented slug
      } else {
        callback(null, slug); // Return the original slug if it's unique
      }
    }
  );
}
function createUniqueSlugs(title, speedIdedit, callback) {
  const slug = generateSlug(title);

  // Check  if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM speeddate WHERE slug = ? And id != ?",
    [slug, speedIdedit],
    (err, rows) => {
      if (err) {
        return callback(err); // Handle the error
      }

      // If the slug exists, add a number to the end and check again
      if (rows[0].count > 0) {
        let i = 1;
        const checkSlug = () => {
          const newSlug = `${slug}-${i}`;
          db.query(
            "SELECT COUNT(*) as count FROM speeddate WHERE slug = ?",
            [newSlug],
            (err, newRows) => {
              if (err) {
                return callback(err); // Handle the error
              }
              if (newRows[0].count === 0) {
                return callback(null, newSlug); // Return the new unique slug
              }
              i++;
              checkSlug(); // Check again with the incremented slug
            }
          );
        };
        checkSlug(); // Start checking with the incremented slug
      } else {
        callback(null, slug); // Return the original slug if it's unique
      }
    }
  );
}

exports.speeddateSave = async (req, res) => {
  const {
    email,
    user_id,
    name,
    speed_date,
    speed_time,
    makeImageUse,
    description,
    image, // Optional, depending on your needs
  } = req.body;
  // Validate required fields
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  //const galleryImage = req.file?.location || null; // For single file upload

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;
    if (makeImageUse === "true" || makeImageUse === true) {
      var galleryImage = req.file?.location || null; // Assuming `image` is passed as a URL or path
    } else if (req.file) {
      // If a new file is uploaded, use the file's location
      var galleryImage = req.file?.location || null;
    }
    const speeddate = moment
      .tz(new Date(), "Europe/Oslo")
      .add(speed_date, "days") // Add 2 days
      .format("YYYY-MM-DD HH:mm:ss");
    // Generate a unique slug for the event name
    createUniqueSlug(name, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "INSERT INTO speeddate (days,speed_date, speed_time, makeImageUse, slug, image, user_id, name, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          speed_date,
          speeddate,
          speed_time,
          mp,
          slug,
          galleryImage,
          user_id,
          name,
          description,
          date,
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }

          // If mp === 1, update the user's profile_image
          if (mp === 1) {
            logActivity(
              user_id,
              `created a speed date session successfully and updated profile image`
            );
            res.status(201).json({
              message:
                "Speed Date created successfully and profile image updated",
              galleryId: result.insertId,
              user_id: user_id,
              slug: slug, // Return the generated slug
            });
            db.query(
              "UPDATE users SET profile_image = ? WHERE id = ?",
              [galleryImage, user_id],
              (err, result) => {}
            );
            const query = `
              SELECT
                u.*,
                CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
              FROM
                users u
              JOIN
                friendRequest_accept fr
              ON
                (u.id = fr.sent_to AND fr.user_id = ?) OR
                (u.id = fr.user_id AND fr.sent_to = ?)
              WHERE
                fr.status = 'Yes';
            `;

            db.query(query, [user_id, user_id], (err, results) => {
              if (err) {
                return res
                  .status(500)
                  .json({ message: "Database query error", error: err });
              }

              // Send WebSocket notification
              const broadcastMessage = JSON.stringify({
                event: "eventrequest_acceptnotification",
                user_id: results,
                LoginData: results,
              });

              if (wss) {
                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(broadcastMessage);
                  }
                });
              }

              // Fetch sender details
              db.query(
                `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
                [user_id],
                async (err, senderResult) => {
                  if (err) {
                    return res
                      .status(500)
                      .json({ message: "Error fetching username", error: err });
                  }

                  const senderUsername =
                    senderResult[0]?.username || "Unknown User";
                  const senderEmail = senderResult[0]?.email || "";
                  const notificationGroupEvent =
                    senderResult[0]?.notification_news_update;
                  const notificationMessage = ` has created a new speed date session.`;
                  const date = moment
                    .tz(new Date(), "Europe/Oslo")
                    .format("YYYY-MM-DD HH:mm:ss");
                  const link_href = "/allspeeddate/";

                  // Insert notifications for each friend
                  const insertNotificationsPromises = results.map((item) => {
                    return new Promise((resolve, reject) => {
                      db.query(
                        "INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                        [
                          item.id,
                          user_id,
                          notificationMessage,
                          date,
                          link_href,
                        ],
                        (err, result) => {
                          if (err) {
                            console.error("Database insertion error:", err);
                            reject(err);
                          } else {
                            resolve(result);
                          }
                        }
                      );
                    });
                  });

                  try {
                    await Promise.all(insertNotificationsPromises);

                    // Send email notification for each friend if group event setting is "Yes"

                    const emailPromises = results.map(async (item) => {
                      console.log(item.email);
                      if (item.notification_news_update === "Yes") {
                        await sendEmailFor_speeddateNotification(
                          item.email,
                          item.username,
                          senderUsername
                        );
                      }
                      // Call the email function for each friend
                    });

                    await Promise.all(emailPromises);
                    return res.status(200).json({
                      message: "Successfully created.",
                    });
                  } catch (error) {}
                }
              );
            });
          } else {
            logActivity(user_id, `created a speed date session successfully`);
            const query = `
  SELECT
    u.*,
    CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
  FROM
    users u
  JOIN
    friendRequest_accept fr
  ON
    (u.id = fr.sent_to AND fr.user_id = ?) OR
    (u.id = fr.user_id AND fr.sent_to = ?)
  WHERE
    fr.status = 'Yes';
`;

            db.query(query, [user_id, user_id], (err, results) => {
              if (err) {
                return res
                  .status(500)
                  .json({ message: "Database query error", error: err });
              }

              // Send WebSocket notification
              const broadcastMessage = JSON.stringify({
                event: "eventrequest_acceptnotification",
                user_id: results,
                LoginData: results,
              });

              if (wss) {
                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(broadcastMessage);
                  }
                });
              }

              // Fetch sender details
              db.query(
                `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
                [user_id],
                async (err, senderResult) => {
                  if (err) {
                    return res.status(500).json({
                      message: "Error fetching username",
                      error: err,
                    });
                  }

                  const senderUsername =
                    senderResult[0]?.username || "Unknown User";
                  const senderEmail = senderResult[0]?.email || "";
                  const notificationGroupEvent =
                    senderResult[0]?.notification_news_update;
                  const notificationMessage = ` has created a new speed date session.`;
                  const date = moment
                    .tz(new Date(), "Europe/Oslo")
                    .format("YYYY-MM-DD HH:mm:ss");
                  const link_href = "/allspeeddate/";

                  // Insert notifications for each friend
                  const insertNotificationsPromises = results.map((item) => {
                    return new Promise((resolve, reject) => {
                      db.query(
                        "INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                        [
                          item.id,
                          user_id,
                          notificationMessage,
                          date,
                          link_href,
                        ],
                        (err, result) => {
                          if (err) {
                            console.error("Database insertion error:", err);
                            reject(err);
                          } else {
                            resolve(result);
                          }
                        }
                      );
                    });
                  });

                  try {
                    await Promise.all(insertNotificationsPromises);

                    // Send email notification for each friend if group event setting is "Yes"

                    const emailPromises = results.map(async (item) => {
                      console.log(item.email);
                      if (item.notification_news_update === "Yes") {
                        await sendEmailFor_speeddateNotification(
                          item.email,
                          item.username,
                          senderUsername
                        );
                      }
                      // Call the email function for each friend
                    });

                    await Promise.all(emailPromises);
                    return res.status(200).json({
                      message: "Successfully created.",
                    });
                  } catch (error) {}
                }
              );
            });
          }
        }
      );

      // Insert the event data including the slug
    });
  } catch (error) {
    console.error("Event creation error:", error); // Log error to console
    res.status(500).json({ message: "Event creation error", error });
  }
};
async function sendEmailFor_speeddateNotification(too, name, byname) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf", // Use environment variables for sensitive data
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too,
    subject: `New Speed Date Session Created by ${byname}`, // Updated subject
    text: `Hello,\n\nWe are excited to inform you that a new speed date session has been created by ${byname} on Amourette.\n\nJoin now and connect with others!\n\n`, // Updated text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

exports.getAlldates = async (req, res) => {
  const { user_id } = req.body;
  try {
    // Ensure user_id and to_id are provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch chat messages between user_id and to_id
    const query = `
          SELECT g.*, u.username, u.profile_type, u.gender,u.birthday_date,u.id as uid,u.location
          FROM speeddate g
          JOIN users u ON g.user_id = u.id
          WHERE g.user_id IN (${user_id}) AND g.speed_date >= CURDATE()
          ORDER BY g.id DESC;
      `;

    // Fetching the messages
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Sending the chat messages in the response
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getdates = async (req, res) => {
  const { user_id } = req.body;
  try {
    // Ensure user_id and to_id are provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch chat messages between user_id and to_id
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender,u.location, u.birthday_date,u.id as uid
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      WHERE g.user_id = ?
        AND u.id = ?
        AND g.speed_date >= CURDATE()
      ORDER BY g.id DESC;
    `;

    // Fetching the messages
    db.query(query, [user_id, user_id], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Sending the chat messages in the response
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getAlldatesSearch = async (req, res) => {
  const { user_ids, search } = req.body; // Expecting a string of user IDs

  try {
    // Ensure user_ids is provided
    if (!user_ids) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    // Prepare search term with wildcards for partial matching
    const searchTerm = search ? `%${search}%` : "%"; // Match all if no search term is provided

    // Prepare SQL query to fetch galleries for multiple user IDs
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender,u.birthday_date,u.id as uid
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      WHERE g.user_id IN (${user_ids})
      AND (g.name LIKE ? OR g.description LIKE ? OR u.username LIKE ?) AND g.speed_date >= CURDATE()
      ORDER BY g.id DESC;
    `;

    // Fetching the galleries
    db.query(query, [searchTerm, searchTerm, searchTerm], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Sending the gallery data in the response
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getAlldatesleftsearch = async (req, res) => {
  const { search } = req.body; // Expecting a string of user IDs

  try {
    // Ensure user_ids is provided

    // Prepare search term with wildcards for partial matching
    const searchTerm = search ? `%${search}%` : "%"; // Match all if no search term is provided

    // Prepare SQL query to fetch galleries for multiple user IDs
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender,u.birthday_date,u.id as uid
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      WHERE (g.name LIKE ? OR g.description LIKE ? OR u.username LIKE ?) AND g.speed_date >= CURDATE()
      ORDER BY g.id DESC;
    `;

    // Fetching the galleries
    db.query(query, [searchTerm, searchTerm, searchTerm], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Sending the gallery data in the response
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getalldatesSearchfilter = async (req, res) => {
  const { user_ids, search } = req.body;

  try {
    // Ensure user_ids is provided and is an array
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ message: "Valid user IDs are required" });
    }

    // Prepare the search term (expecting an array or empty)
    const searchTerm = Array.isArray(search) ? search : [];

    // Initialize query parameters
    const queryParams = [user_ids]; // Add user_ids first for "IN (?)"

    // Dynamically build the WHERE clause for gender
    let whereClause = "";

    if (searchTerm.length > 0) {
      whereClause += " AND (";
      searchTerm.forEach((term, index) => {
        whereClause += "u.gender = ?";
        queryParams.push(term); // Add gender terms dynamically to queryParams

        if (index < searchTerm.length - 1) {
          whereClause += " OR ";
        }
      });
      whereClause += ")";
    }

    // Prepare the final SQL query
    const query = `
  SELECT g.*, u.username, u.profile_type, u.gender, u.birthday_date
  FROM speeddate g
  JOIN users u ON g.user_id = u.id
  WHERE g.user_id IN (?)
    AND g.speed_date >= CURDATE() ${whereClause}
  ORDER BY g.id DESC;
`;
    console.log(queryParams);
    // Execute the query
    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Send the results
      return res.status(200).json({ results });
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getdatesSearch = async (req, res) => {
  const { user_id, search } = req.body;

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Prepare search terms with wildcards for partial matching
    const searchTerm = search ? `%${search}%` : "%"; // If no search term is provided, match all

    // Query to fetch gallery items based on user_id and search terms
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender,u.birthday_date,u.id as uid,u.location
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      WHERE g.user_id = ?
      AND (g.name LIKE ? OR g.description LIKE ? OR u.username LIKE ?) AND g.speed_date >= CURDATE()
      ORDER BY g.id DESC;`;

    // Fetching the gallery items
    db.query(
      query,
      [user_id, searchTerm, searchTerm, searchTerm],
      (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Sending the results in the response
        return res.status(200).json({ results });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.forumSave = async (req, res) => {
  const {
    user_id,
    name,
    forum_section,
    category,
    description,
    image, // Optional, depending on your needs
  } = req.body;

  // Validate required fields
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const galleryImage = req.file?.location || null; // For single file upload

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    createUniqueSlugForum(name, (err, slug) => {
      console.log(mp);
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "INSERT INTO forum (forum_section,category,slug, image, user_id, name, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          forum_section,
          category,
          slug,
          galleryImage,
          user_id,
          name,
          description,
          date,
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }
          logActivity(user_id, `created a new forum post successfully`);
          const queryy = `
          SELECT
            u.*,
            CASE
              WHEN fr.status = 'Yes' THEN true
              ELSE false
            END AS is_friend
          FROM
            users u
          JOIN
            friendRequest_accept fr ON
              (u.id = fr.sent_to AND fr.user_id = ?) OR
              (u.id = fr.user_id AND fr.sent_to = ?)
          WHERE
            fr.status = 'Yes';`;

          // Fetching the messages
          db.query(queryy, [user_id, user_id], (err, results) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            const broadcastMessage = JSON.stringify({
              event: "grouprequest_acceptnotification",
              user_id: results,
              LoginData: results,
            });

            // Broadcast message to WebSocket clients if connected
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }

            // Prepare notification message
            db.query(
              `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
              [user_id], // Fetch the username and email of the user who sent the request
              async (err, senderResult) => {
                if (err) {
                  return res.status(500).json({
                    message: "Error fetching user data for sender",
                    error: err,
                  });
                }
                const senderUsername = senderResult[0].username;
                const notificationMessage = ` Create a forum post ` + name;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const link_href = "/singleforums/" + slug;

                // Insert notifications for each user
                const insertNotificationsPromises = results.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.query(
                      "INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                      [item.id, user_id, notificationMessage, date, link_href],
                      (err, result) => {
                        if (err) {
                          console.error("Database insertion error:", err);
                          reject(err);
                        } else {
                          resolve(result);
                        }
                      }
                    );
                  });
                });
                try {
                  await Promise.all(insertNotificationsPromises);

                  // Send email notification for each friend if group event setting is "Yes"

                  const emailPromises = results.map(async (item) => {
                    if (item.notification_news_update === "Yes") {
                      await sendEmailFor_ForumPostNotification(
                        name,
                        item.email,
                        item.username,
                        senderUsername
                      );
                    }
                    // Call the email function for each friend
                  });

                  await Promise.all(emailPromises);
                  return res.status(200).json({
                    message: "Successfully created.",
                  });
                } catch (error) {}

                // After all notifications are inserted
              }
            );
          });
          res.status(201).json({
            message: "Forum created successfully",
            galleryId: result.insertId,
            user_id: user_id,
            slug: slug, // Return the generated slug
          });
        }
      );

      // Insert the event data including the slug
    });
  } catch (error) {
    console.error("Event creation error:", error); // Log error to console
    res.status(500).json({ message: "Event creation error", error });
  }
};
exports.forumedit = async (req, res) => {
  const {
    user_id,
    name,
    forum_section,
    category,
    description,
    image, // Optional, depending on your needs
    id,
    previewImage,
  } = req.body;

  // Validate required fields
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const galleryImage = previewImage; // For single file upload

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    EditUniqueSlugForum(name, id, (err, slug) => {
      console.log(mp);
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "UPDATE forum SET forum_section = ?, category = ?, slug = ?, image = ?, user_id = ?, name = ?, description  = ? WHERE id = ?",
        [
          forum_section,
          category,
          slug,
          galleryImage,
          user_id,
          name,
          description,

          id,
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }
          logActivity(user_id, `update forum post successfully`);
          const queryy = `
          SELECT
            u.*,
            CASE
              WHEN fr.status = 'Yes' THEN true
              ELSE false
            END AS is_friend
          FROM
            users u
          JOIN
            friendRequest_accept fr ON
              (u.id = fr.sent_to AND fr.user_id = ?) OR
              (u.id = fr.user_id AND fr.sent_to = ?)
          WHERE
            fr.status = 'Yes';`;

          // Fetching the messages
          db.query(queryy, [user_id, user_id], (err, results) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            const broadcastMessage = JSON.stringify({
              event: "grouprequest_acceptnotification",
              user_id: results,
              LoginData: results,
            });

            // Broadcast message to WebSocket clients if connected
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }

            // Prepare notification message
            db.query(
              `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
              [user_id], // Fetch the username and email of the user who sent the request
              async (err, senderResult) => {
                if (err) {
                  return res.status(500).json({
                    message: "Error fetching user data for sender",
                    error: err,
                  });
                }
                const senderUsername = senderResult[0].username;
                const notificationMessage = ` Edit a forum post ` + name;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const link_href = "/singleforums/" + slug;

                // Insert notifications for each user
                const insertNotificationsPromises = results.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.query(
                      "INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                      [item.id, user_id, notificationMessage, date, link_href],
                      (err, result) => {
                        if (err) {
                          console.error("Database insertion error:", err);
                          reject(err);
                        } else {
                          resolve(result);
                        }
                      }
                    );
                  });
                });
                try {
                  await Promise.all(insertNotificationsPromises);

                  // Send email notification for each friend if group event setting is "Yes"

                  const emailPromises = results.map(async (item) => {
                    if (item.notification_news_update === "Yes") {
                      await sendEmailFor_ForumPostNotificationEdit(
                        name,
                        item.email,
                        item.username,
                        senderUsername
                      );
                    }
                    // Call the email function for each friend
                  });

                  await Promise.all(emailPromises);
                  return res.status(200).json({
                    message: "Forum updated successfully",
                  });
                } catch (error) {}

                // After all notifications are inserted
              }
            );
          });
          res.status(201).json({
            message: "Forum updated successfully",
            galleryId: result.insertId,
            user_id: user_id,
            slug: slug, // Return the generated slug
          });
        }
      );

      // Insert the event data including the slug
    });
  } catch (error) {
    console.error("Event creation error:", error); // Log error to console
    res.status(500).json({ message: "Event creation error", error });
  }
};
exports.forumeditfile = async (req, res) => {
  const {
    user_id,
    name,
    forum_section,
    category,
    description,
    image, // Optional, depending on your needs
    id,
  } = req.body;

  // Validate required fields
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const galleryImage = req.file?.location || null; // For single file upload

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    EditUniqueSlugForum(name, id, (err, slug) => {
      console.log(mp);
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "UPDATE forum SET forum_section = ?, category = ?, slug = ?, image = ?, user_id = ?, name = ?, description  = ? WHERE id = ?",
        [
          forum_section,
          category,
          slug,
          galleryImage,
          user_id,
          name,
          description,

          id,
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }
          logActivity(user_id, `update forum post successfully`);
          const queryy = `
          SELECT
            u.*,
            CASE
              WHEN fr.status = 'Yes' THEN true
              ELSE false
            END AS is_friend
          FROM
            users u
          JOIN
            friendRequest_accept fr ON
              (u.id = fr.sent_to AND fr.user_id = ?) OR
              (u.id = fr.user_id AND fr.sent_to = ?)
          WHERE
            fr.status = 'Yes';`;

          // Fetching the messages
          db.query(queryy, [user_id, user_id], (err, results) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            const broadcastMessage = JSON.stringify({
              event: "grouprequest_acceptnotification",
              user_id: results,
              LoginData: results,
            });

            // Broadcast message to WebSocket clients if connected
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }

            // Prepare notification message
            db.query(
              `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
              [user_id], // Fetch the username and email of the user who sent the request
              async (err, senderResult) => {
                if (err) {
                  return res.status(500).json({
                    message: "Error fetching user data for sender",
                    error: err,
                  });
                }
                const senderUsername = senderResult[0].username;
                const notificationMessage = ` Edit a forum post ` + name;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const link_href = "/singleforums/" + slug;

                // Insert notifications for each user
                const insertNotificationsPromises = results.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.query(
                      "INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                      [item.id, user_id, notificationMessage, date, link_href],
                      (err, result) => {
                        if (err) {
                          console.error("Database insertion error:", err);
                          reject(err);
                        } else {
                          resolve(result);
                        }
                      }
                    );
                  });
                });
                try {
                  await Promise.all(insertNotificationsPromises);

                  // Send email notification for each friend if group event setting is "Yes"

                  const emailPromises = results.map(async (item) => {
                    if (item.notification_news_update === "Yes") {
                      await sendEmailFor_ForumPostNotificationEdit(
                        name,
                        item.email,
                        item.username,
                        senderUsername
                      );
                    }
                    // Call the email function for each friend
                  });

                  await Promise.all(emailPromises);
                  return res.status(200).json({
                    message: "Forum updated successfully",
                  });
                } catch (error) {}

                // After all notifications are inserted
              }
            );
          });
          res.status(201).json({
            message: "Forum updated successfully",
            galleryId: result.insertId,
            user_id: user_id,
            slug: slug, // Return the generated slug
          });
        }
      );

      // Insert the event data including the slug
    });
  } catch (error) {
    console.error("Event creation error:", error); // Log error to console
    res.status(500).json({ message: "Event creation error", error });
  }
};
async function sendEmailFor_ForumPostNotificationEdit(
  gname,
  too,
  name,
  byname,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf", // Use environment variables for sensitive data
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too,
    subject: `Forum Post Updated: "${gname}" by ${byname}`, // Updated subject for post update
    text: `Hello,\n\nThe forum post in "${gname}" has been updated by ${byname} on Amourette.\n\nUpdated Post Title: "${name}"\n\nVisit the forum to see the changes and continue the discussion.\n\nBest regards,\nThe Amourette Team`, // Updated email body for post update
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    if (callback) callback(null, info);
  } catch (error) {
    console.error("Error sending email:", error);
    if (callback) callback(error, null);
  }
}

async function sendEmailFor_ForumPostNotification(
  gname,
  too,
  name,
  byname,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf", // Use environment variables for sensitive data
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too,
    subject: `New Forum Post Created: "${gname}" by ${byname}`, // Updated subject for forum post creation
    text: `Hello,\n\nA new forum post has been created in the "${gname}" by ${byname} on Amourette.\n\nPost Title: "${name}"\n\nVisit the forum to participate in the discussion.\n\nBest regards,\nThe Amourette Team`, // Updated email body
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    if (callback) callback(null, info);
  } catch (error) {
    console.error("Error sending email:", error);
    if (callback) callback(error, null);
  }
}

function createUniqueSlugForum(title, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM forum WHERE slug = ?",
    [slug],
    (err, rows) => {
      if (err) {
        return callback(err); // Handle the error
      }

      // If the slug exists, add a number to the end and check again
      if (rows[0].count > 0) {
        let i = 1;
        const checkSlug = () => {
          const newSlug = `${slug}-${i}`;
          db.query(
            "SELECT COUNT(*) as count FROM forum WHERE slug = ?",
            [newSlug],
            (err, newRows) => {
              if (err) {
                return callback(err); // Handle the error
              }
              if (newRows[0].count === 0) {
                return callback(null, newSlug); // Return the new unique slug
              }
              i++;
              checkSlug(); // Check again with the incremented slug
            }
          );
        };
        checkSlug(); // Start checking with the incremented slug
      } else {
        callback(null, slug); // Return the original slug if it's unique
      }
    }
  );
}
function EditUniqueSlugForum(title, id, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM forum WHERE slug = ? And id != ?",
    [slug, id],
    (err, rows) => {
      if (err) {
        return callback(err); // Handle the error
      }

      // If the slug exists, add a number to the end and check again
      if (rows[0].count > 0) {
        let i = 1;
        const checkSlug = () => {
          const newSlug = `${slug}-${i}`;
          db.query(
            "SELECT COUNT(*) as count FROM forum WHERE slug = ?",
            [newSlug],
            (err, newRows) => {
              if (err) {
                return callback(err); // Handle the error
              }
              if (newRows[0].count === 0) {
                return callback(null, newSlug); // Return the new unique slug
              }
              i++;
              checkSlug(); // Check again with the incremented slug
            }
          );
        };
        checkSlug(); // Start checking with the incremented slug
      } else {
        callback(null, slug); // Return the original slug if it's unique
      }
    }
  );
}

exports.getAllforum = async (req, res) => {
  const { user_id, search } = req.body; // Get search parameter from request body
  console.log(user_id, search);

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Construct WHERE condition for filtering
    let whereClause = `WHERE g.user_id IN (${user_id})`;
    if (search) {
      whereClause += ` AND g.forum_section LIKE '%${search}%'`; // Add search filter
    }

    // Query to fetch forum posts with optional search filter
    const query = `
        SELECT g.*,
              u.username,
              u.profile_type,
              u.gender,
              u.birthday_date,
              COUNT(fc.id) AS total_comments
        FROM forum g
        JOIN users u ON g.user_id = u.id
        LEFT JOIN forum_comment fc ON g.id = fc.forum_id
        ${whereClause}  -- Add filtering condition dynamically
        GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date
        ORDER BY g.id DESC;
    `;

    // Fetch results from the database
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getforum = async (req, res) => {
  const { user_id, search } = req.body; // Adding search parameter

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Adjust SQL query to filter by forum_section using LIKE
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender, u.birthday_date, COUNT(fc.id) AS total_comments
      FROM forum g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN forum_comment fc ON g.id = fc.forum_id
      WHERE g.user_id = ?
      AND g.forum_section LIKE ?  -- Use LIKE for partial matching
      GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date
      ORDER BY g.id DESC
    `;

    // Adding wildcard `%` for flexible matching
    const searchQuery = `%${search}%`;

    db.query(query, [user_id, searchQuery], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getAllforumSearch = async (req, res) => {
  const { user_ids, category, search, search2 } = req.body;
  const categories = category || [];
  console.log(req.body);

  try {
    // Ensure user_id is provided
    if (!user_ids) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Add wildcard for partial matching in search and search2
    const searchQuery1 = `%${search}%`;
    const searchQuery2 = `%${search2}%`;

    // Start building SQL query
    let query = `
      SELECT g.*, u.username, u.profile_type, u.gender, u.birthday_date, COUNT(fc.id) AS total_comments
      FROM forum g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN forum_comment fc ON g.id = fc.forum_id
      WHERE g.user_id IN (${user_ids})
      AND (g.name LIKE ? OR g.description LIKE ?)
      AND g.forum_section LIKE ?
    `;

    // Query parameters
    let queryParams = [searchQuery1, searchQuery1, searchQuery2];

    // Add category filtering only if categories are provided
    if (Array.isArray(categories) && categories.length > 0) {
      const categoryPlaceholders = categories.map(() => "?").join(", ");
      query += ` AND g.category IN (${categoryPlaceholders})`;
      queryParams = [...queryParams, ...categories];
    }

    // Final grouping & ordering
    query += ` GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date ORDER BY g.id DESC;`;

    // Execute the query
    db.query(query, queryParams, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getforumSearch = async (req, res) => {
  const { user_id, category, search, search2 } = req.body;
  const categories = category || [];
  console.log(req.body);

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Add wildcard for partial matching in search and search2
    const searchQuery1 = `%${search}%`;
    const searchQuery2 = `%${search2}%`;

    // Start building SQL query
    let query = `
      SELECT g.*, u.username, u.profile_type, u.gender, u.birthday_date, COUNT(fc.id) AS total_comments
      FROM forum g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN forum_comment fc ON g.id = fc.forum_id
      WHERE g.user_id = ?
      AND (g.name LIKE ? OR g.description LIKE ?)
      AND g.forum_section LIKE ?
    `;

    // Query parameters
    let queryParams = [user_id, searchQuery1, searchQuery1, searchQuery2];

    // Add category filtering only if categories are provided
    if (Array.isArray(categories) && categories.length > 0) {
      const categoryPlaceholders = categories.map(() => "?").join(", ");
      query += ` AND g.category IN (${categoryPlaceholders})`;
      queryParams = [...queryParams, ...categories];
    }

    // Final grouping & ordering
    query += ` GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date ORDER BY g.id DESC;`;

    // Execute the query
    db.query(query, queryParams, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.get_ForumDetailSlug = async (req, res) => {
  const slug = req.body.slug;
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Event Slug is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT 
      g.*, 
      u.username, 
      u.id as uid, 
      u.profile_type, 
      u.gender, 
      u.birthday_date, 
      COUNT(DISTINCT fc.id) AS total_comments,
      COUNT(DISTINCT fpf.id) AS total_likes
    FROM forum g
    JOIN users u ON g.user_id = u.id
    LEFT JOIN forum_comment fc ON g.id = fc.forum_id
    LEFT JOIN form_post_favourite fpf ON g.id = fpf.post_id
    WHERE g.slug = ?
    GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date
    ORDER BY g.id DESC;`,
      [slug],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, event: "" });
        }

        if (results.length === 0) {
          return res
            .status(200)
            .json({ message: "Event not found.", event: "" });
        }

        res.status(200).json({
          message: "Event retrieved successfully.",
          result: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.get_SpeeddateDetailSlug = async (req, res) => {
  const slug = req.body.slug;
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Event Slug is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      ` SELECT g.*, u.username, u.profile_type,u.id as uid, u.gender,u.birthday_date, COUNT(fc.id) AS total_comments
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN speeddate_comment fc ON g.id = fc.speeddate_id
      WHERE g.slug =?
      GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date ORDER BY g.id DESC;`,
      [slug],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, event: "" });
        }

        if (results.length === 0) {
          return res
            .status(200)
            .json({ message: "Event not found.", event: "" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "Event retrieved successfully.",
          result: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.get_ForumComments = async (req, res) => {
  const id = req.body.id;
  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT fc.*, u.id as uid,u.profile_image, u.username, u.makeImagePrivate
      FROM forum_comment AS fc
      JOIN users AS u ON fc.user_id = u.id
      WHERE fc.forum_id = ?
      ORDER BY fc.id DESC;
      `,
      [id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, event: "" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "",
          result: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.getspeedComments = async (req, res) => {
  const id = req.body.id;
  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT fc.*,u.id as uid, u.profile_image, u.username, u.makeImagePrivate
      FROM speeddate_comment AS fc
      JOIN users AS u ON fc.user_id = u.id
      WHERE fc.speeddate_id = ?
      ORDER BY fc.id DESC;
      `,
      [id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, event: "" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "",
          result: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.forumdelete = async (req, res) => {
  const id = req.body.id;

  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required." });
  }

  try {
    // Delete the forum first
    const deleteForumQuery = `DELETE FROM forum WHERE id = ?`;
    db.query(deleteForumQuery, [id], (forumDeleteErr) => {
      if (forumDeleteErr) {
        console.error("Database delete error (forum):", forumDeleteErr);
        return res.status(500).json({
          message: "Database delete error (forum)",
          error: forumDeleteErr,
        });
      }

      // Delete associated comments in forum_comment after successful forum deletion
      const deleteCommentQuery = `DELETE FROM forum_comment WHERE forum_id = ?`;
      db.query(deleteCommentQuery, [id], (commentDeleteErr) => {
        if (commentDeleteErr) {
          console.error("Database delete error (comments):", commentDeleteErr);
          return res.status(500).json({
            message: "Database delete error (comments)",
            error: commentDeleteErr,
          });
        }

        // Success response if both deletions are successful
        res.status(200).json({
          message: "Forum and associated comments deleted successfully.",
        });
      });
    });
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.speeddelete = async (req, res) => {
  const id = req.body.id;

  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required." });
  }

  try {
    // Delete the forum first
    const deleteForumQuery = `DELETE FROM speeddate WHERE id = ?`;
    db.query(deleteForumQuery, [id], (forumDeleteErr) => {
      if (forumDeleteErr) {
        console.error("Database delete error (forum):", forumDeleteErr);
        return res.status(500).json({
          message: "Database delete error (forum)",
          error: forumDeleteErr,
        });
      }

      // Delete associated comments in forum_comment after successful forum deletion
      const deleteCommentQuery = `DELETE FROM speeddate_comment WHERE speeddate_id = ?`;
      db.query(deleteCommentQuery, [id], (commentDeleteErr) => {
        if (commentDeleteErr) {
          console.error("Database delete error (comments):", commentDeleteErr);
          return res.status(500).json({
            message: "Database delete error (comments)",
            error: commentDeleteErr,
          });
        }

        // Success response if both deletions are successful
        res.status(200).json({
          message: "Date and associated comments deleted successfully.",
        });
      });
    });
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.userreport = async (req, res) => {
  const { user_id, to_id, reportData, otherReport } = req.body;
  console.log(req.body);
  // Validate required fields
  if (!user_id || !to_id) {
    return res.status(400).json({ message: "User ID and To ID are required." });
  }

  try {
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Step 1: Check if the combination of user_id and to_id exists in the userreport table
    db.query(
      "SELECT * FROM userreport WHERE user_id = ? AND to_id = ?",
      [user_id, to_id],
      (err, result) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // Step 2: If the user_id and to_id exist, update the record
        if (result.length > 0) {
          db.query(
            "UPDATE userreport SET otherReport = ?, report = ?, date = ? WHERE user_id = ? AND to_id = ?",
            [otherReport, reportData, date, user_id, to_id],
            (updateErr, updateResult) => {
              if (updateErr) {
                console.error("Database update error:", updateErr);
                return res
                  .status(500)
                  .json({ message: "Database update error", error: updateErr });
              }
              logActivity(user_id, `sent a report.`);
              return res.status(200).json({
                message: "Report inserted successfully",
                result: updateResult,
              });
            }
          );
        } else {
          // Step 3: If it doesn't exist, insert a new record
          db.query(
            "INSERT INTO userreport (otherReport, user_id, to_id, report, date) VALUES (?, ?, ?, ?, ?)",
            [otherReport, user_id, to_id, reportData, date],
            (insertErr, insertResult) => {
              if (insertErr) {
                console.error("Database insertion error:", insertErr); // Log error to console
                return res.status(500).json({
                  message: "Database insertion error",
                  error: insertErr,
                });
              }
              logActivity(user_id, `sent a report.`);
              return res.status(200).json({
                message: "Report inserted successfully",
                result: insertResult,
              });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    return res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getdatesSearchfilter = async (req, res) => {
  const { user_id, search } = req.body;
  console.log(req.body);
  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // If no search term is provided, match all
    const searchTerm = search && search.length > 0 ? search : []; // If no filters, return an empty array

    // Prepare the WHERE clause dynamically based on the search array
    let whereClause = "";
    let queryParams = [user_id]; // Start with the user_id in the query parameters

    if (searchTerm.length > 0) {
      whereClause += " AND (";
      // Dynamically build the WHERE condition for the array of values (e.g., ['Female', 'Couple'])
      searchTerm.forEach((term, index) => {
        // Add condition for each term (e.g., g.gender = ?)
        if (term === "Couple") {
          whereClause += `u.gender = ?`; // Assuming 'is_couple' is the column name for couple filter
        }
        if (term === "Male") {
          whereClause += `u.gender = ?`; // Assuming 'is_couple' is the column name for couple filter
        }
        if (term === "Female") {
          whereClause += `u.gender = ?`; // Assuming 'is_couple' is the column name for couple filter
        }

        if (index < searchTerm.length - 1) {
          whereClause += " OR ";
        }

        queryParams.push(term); // Add each term to the query parameters
      });
      whereClause += ")";
    }

    // Query to fetch gallery items based on user_id and dynamically built search terms
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender, u.birthday_date,u.id as uid,u.location
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      WHERE g.user_id = ? AND g.speed_date >= CURDATE()
      ${whereClause}
      ORDER BY g.id DESC;
    `;
    console.log(query);
    console.log(whereClause);
    // Fetching the gallery items
    db.query(query, queryParams, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Sending the results in the response
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.allforumfilter = async (req, res) => {
  const id = req.body.id;
  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT fc.*, u.profile_image, u.username, u.makeImagePrivate
      FROM forum_comment AS fc
      JOIN users AS u ON fc.user_id = u.id
      WHERE fc.forum_id = ?
      ORDER BY fc.id DESC;
      `,
      [id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, event: "" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "",
          result: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.handlepostDelete = (req, res) => {
  const { id, user_id } = req.body;

  try {
    // Ensure both id and user_id are provided
    if (!id || !user_id) {
      return res
        .status(400)
        .json({ message: "Both ID and User ID are required" });
    }

    // Query to delete from the group_post table
    db.query(
      `DELETE FROM speeddate WHERE id = ? AND user_id = ?`,
      [id, user_id],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }
        return res.status(200).json({
          message: "Post and related records deleted successfully",
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getdatesedit = (req, res) => {
  const { id, user_id } = req.body;

  try {
    // Ensure both id and user_id are provided
    if (!id || !user_id) {
      return res
        .status(400)
        .json({ message: "Both ID and User ID are required" });
    }

    // Query to delete from the group_post table
    db.query(
      `SELECT * FROM speeddate WHERE id = ? AND user_id = ?`,
      [id, user_id],
      (err, row) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }
        return res.status(200).json({
          message: "Get date",
          result: row[0],
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.speeddateUpdate = async (req, res) => {
  const {
    speedIdedit, // ID of the record to update
    user_id, // ID of the user
    name,
    email,
    speed_date,
    speed_time,
    makeImageUse,
    description,
    image,
  } = req.body;
  // Validate required fields
  // if (!speedIdedit || !user_id || !name || !description) {
  //   return res.status(400).json({ message: "All fields are required" });
  // }
  try {
    // Format dates
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    const speed_dates = moment
      .tz(new Date(speed_date), "Europe/Oslo")
      .format("YYYY-MM-DD");

    // Convert `makeImageUse` to numeric format
    let mp = makeImageUse;

    // Handle image logic
    let galleryImage = null;
    galleryImage = req.body.image;

    // Generate a unique slug for the event name
    createUniqueSlugs(name, speedIdedit, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err);
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }
      const speeddate = moment
        .tz(new Date(), "Europe/Oslo")
        .add(speed_date, "days") // Add 2 days
        .format("YYYY-MM-DD HH:mm:ss");
      // Perform the update query
      db.query(
        `UPDATE speeddate
         SET speed_date = ?, speed_time = ?, makeImageUse = ?, slug = ?, image = ?, name = ?, description = ?, date = ?
         WHERE id = ? AND user_id = ?`,
        [
          speeddate,
          speed_time,
          mp,
          slug,
          galleryImage,
          name,
          description,
          date,
          speedIdedit, // ID of the record to update
          user_id, // User ID to ensure proper ownership
        ],
        (err, result) => {
          if (err) {
            console.error("Database update error:", err);
            return res
              .status(500)
              .json({ message: "Database update error", error: err });
          }

          // If no rows were affected, the record doesn't exist
          if (result.affectedRows === 0) {
            return res
              .status(404)
              .json({ message: "Record not found or no changes made" });
          }

          // Respond with success
          res.status(200).json({
            message: "Speed Date updateds successfully",
            speedIdedit: speedIdedit,
            user_id: user_id,
            slug: slug,
          });
        }
      );
    });
  } catch (error) {
    console.error("Event update error:", error);
    res.status(500).json({ message: "Event update error", error });
  }
};

exports.updatespeed_dates = async (req, res) => {
  const {
    speedIdedit, // ID of the record to update
    user_id, // ID of the user
    name,
    speed_date,
    speed_time,
    makeImageUse,
    description,
    image,
  } = req.body;
  // Validate required fields
  // if (!speedIdedit || !user_id || !name || !description) {
  //   return res.status(400).json({ message: "All fields are required" });
  // }

  try {
    // Format dates
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    const speed_dates = moment
      .tz(new Date(speed_date), "Europe/Oslo")
      .format("YYYY-MM-DD");

    // Convert `makeImageUse` to numeric format
    let mp = makeImageUse === true || makeImageUse === "true" ? 1 : 0;

    // Handle image logic
    let galleryImage = null;
    if (mp === 1) {
      galleryImage = req.body.image; // Use the existing image if provided
    } else if (req.file) {
      galleryImage = req.file?.location || null; // Use the uploaded file location if available
    }

    // Generate a unique slug for the event name
    createUniqueSlugs(name, speedIdedit, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err);
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }
      const speeddate = moment
        .tz(new Date(), "Europe/Oslo")
        .add(speed_date, "days") // Add 2 days
        .format("YYYY-MM-DD HH:mm:ss");
      // Perform the update query
      db.query(
        `UPDATE speeddate
         SET speed_date = ?, speed_time = ?, makeImageUse = ?, slug = ?, image = ?, name = ?, description = ?, date = ?
         WHERE id = ? AND user_id = ?`,
        [
          speeddate,
          speed_time,
          mp,
          slug,
          galleryImage,
          name,
          description,
          date,
          speedIdedit, // ID of the record to update
          user_id, // User ID to ensure proper ownership
        ],
        (err, result) => {
          if (err) {
            console.error("Database update error:", err);
            return res
              .status(500)
              .json({ message: "Database update error", error: err });
          }

          // If no rows were affected, the record doesn't exist
          if (result.affectedRows === 0) {
            return res
              .status(404)
              .json({ message: "Record not found or no changes made" });
          }

          // Respond with success
          res.status(200).json({
            message: "Speed Date updated successfully",
            speedIdedit: speedIdedit,
            user_id: user_id,
            slug: slug,
          });
        }
      );
    });
  } catch (error) {
    console.error("Event update error:", error);
    res.status(500).json({ message: "Event update error", error });
  }
};

const logActivity = (userId, description) => {
  const query = `
    INSERT INTO logsactivity (user_id, description, date)
    VALUES (?, ?, NOW())
  `;
  db.query(query, [userId, description], (err, result) => {
    if (err) {
      console.error("Error inserting log activity:", err);
    }
  });
};

exports.areafilterspeedDates = async (req, res) => {
  const { user_id, search, search2 } = req.body;
  const selectedSubRegion = req.body.selectedSubRegion || [];
  const selectedTowns = req.body.selectedTowns || [];
  const location = req.body.location || [];
  const searchTermfield = search2 ? `%${search2}%` : "%";
  try {
    // Ensure user_ids is provided and is an array
    if (!user_id || !Array.isArray(user_id) || user_id.length === 0) {
      return res.status(400).json({ message: "Valid user IDs are required" });
    }

    // Prepare the search term (expecting an array or empty)
    const searchTerm = Array.isArray(search) ? search : [];

    let conditions = [];
    let queryParams = [user_id]; // Start with user_ids for "IN (?)"

    // Dynamically build the WHERE clause for gender if searchTerm is provided
    if (searchTerm.length > 0) {
      const genderConditions = searchTerm
        .map(() => `u.gender = ?`)
        .join(" OR ");
      conditions.push(`(${genderConditions})`);
      queryParams.push(...searchTerm);
    }
    console.log(queryParams);
    // Handle location filter
    if (location.length > 0) {
      const locationConditions = location
        .map(() => `u.location LIKE ?`)
        .join(" OR ");
      conditions.push(`(${locationConditions})`);
      queryParams.push(...location.map((loc) => `%${loc}%`));
    }

    // Handle subregion filter
    if (selectedSubRegion.length > 0) {
      const subRegionConditions = selectedSubRegion
        .map(() => `u.subregion LIKE ?`)
        .join(" OR ");
      conditions.push(`(${subRegionConditions})`);
      queryParams.push(...selectedSubRegion.map((sub) => `%${sub}%`));
    }

    // Handle town filter
    if (selectedTowns.length > 0) {
      const townConditions = selectedTowns
        .map(() => `JSON_SEARCH(u.town, 'one', ?) IS NOT NULL`)
        .join(" OR ");
      conditions.push(`(${townConditions})`);
      queryParams.push(...selectedTowns);
    }

    // Prepare the final WHERE clause
    let whereClause = `WHERE g.user_id IN (?) AND g.speed_date >= CURDATE()`;
    if (conditions.length > 0) {
      whereClause += " AND (" + conditions.join(" OR ") + ")";
    }

    // Add search term filtering for g.name, g.description, and u.username
    whereClause += ` AND (
      g.name LIKE ? OR
      g.description LIKE ? OR
      u.username LIKE ?
    )`;

    // Prepare the SQL query
    const query = `
      SELECT g.*, u.username, u.profile_type, u.gender, u.birthday_date,u.id as uid,u.location
      FROM speeddate g
      JOIN users u ON g.user_id = u.id
      ${whereClause}  AND g.speed_date >= CURDATE()
      ORDER BY g.id DESC;
    `;

    // Execute the query
    db.query(
      query,
      [...queryParams, searchTermfield, searchTermfield, searchTermfield],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Send the results
        return res.status(200).json({ results });
      }
    );
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getallforumDiscover = async (req, res) => {
  const { user_id, user_ids, slug } = req.body;

  try {
    if (!user_ids) {
      return res.status(400).json({ message: "User ID list is required" });
    }

    const query = `
      SELECT g.*,
            u.username,
            u.profile_type,
            u.gender,
            u.birthday_date,
            COUNT(fc.id) AS total_comments
      FROM forum g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN forum_comment fc ON g.id = fc.forum_id
      WHERE g.user_id IN (${user_ids}) And g.forum_section=?
        AND NOT EXISTS (
          SELECT 1
          FROM forum_comment fcc
          WHERE fcc.forum_id = g.id AND fcc.user_id = ?
        )
      GROUP BY g.id, u.username, u.profile_type, u.gender, u.birthday_date
      ORDER BY g.id DESC;
    `;

    db.query(query, [slug, user_id], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }
      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
