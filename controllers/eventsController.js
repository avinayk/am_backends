const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const WebSocket = require("ws");
const slugify = require("slugify");
const moment = require("moment-timezone");
const express = require("express");
const http = require("http");
const nodemailer = require("nodemailer");
const app = express();
const server = http.createServer(app);
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
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove invalid characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/--+/g, "-"); // Replace multiple hyphens with a single one
}

// Function to create a unique slug
function createUniqueSlug(title, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM events WHERE slug = ?",
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
            "SELECT COUNT(*) as count FROM events WHERE slug = ?",
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
function EditUniqueSlug(title, eventId, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM events WHERE slug = ? And id != ?",
    [slug, eventId],
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
            "SELECT COUNT(*) as count FROM events WHERE slug = ?",
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

exports.events = async (req, res) => {
  const { user_id, name, start_date, end_date, time, location, description } =
    req.body;

  // Validate required fields
  if (
    !user_id ||
    !name ||
    !start_date ||
    !end_date ||
    !time ||
    !location ||
    !description
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const eventImage = req.file?.location || null; // For single file upload
  const wss = req.wss;
  try {
    // Create Date objects and validate
    const startDate = moment
      .tz(new Date(start_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    const endDate = moment
      .tz(new Date(end_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    console.log(endDate);
    // Validate date objects

    // Optionally check if start_date is before end_date
    if (startDate >= endDate) {
      return res
        .status(200)
        .json({ message: "Start date must be before end date", status: "2" });
    }

    const createdAt = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImagePrivate;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    createUniqueSlug(name, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err, status: "2" });
      }

      // Insert the event data including the slug
      db.query(
        "INSERT INTO events (makeImagePrivate,slug, image, user_id, name, start_date, end_date, time, location, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
        [
          mp,
          slug,
          eventImage,
          user_id,
          name,
          startDate,
          endDate,
          time,
          location,
          description,
          createdAt,
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }
          logActivity(user_id, `created a new event successfully`);
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
                var message = "New event create by " + senderUsername;
                const notificationMessage = message;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                var link_href = "/singleevent/" + slug;

                // Insert notifications for each friend
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
                    console.log(item.email);
                    if (item.notification_news_update === "Yes") {
                      await sendEmailFor_createeventNotification(
                        item.email,
                        senderUsername,
                        name
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
          res.status(201).json({
            message: "Event created successfully",
            eventId: result.insertId,
            user_id: user_id,
            slug: slug,
            status: "1", // Return the generated slug
          });
        }
      );
    });
  } catch (error) {
    console.error("Some thing went wrong,Please try again:", error); // Log error to console
    res
      .status(500)
      .json({ message: "Some thing went wrong,Please try again", error });
  }
};
exports.eventseditfile = async (req, res) => {
  const {
    eventId,
    user_id,
    name,
    start_date,
    end_date,
    time,
    location,
    description,
  } = req.body;

  // Validate required fields
  if (
    !eventId ||
    !user_id ||
    !name ||
    !start_date ||
    !end_date ||
    !time ||
    !location ||
    !description
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const eventImage = req.file?.location || null; // For single file upload
  const wss = req.wss;
  try {
    // Create Date objects and validate
    const startDate = moment
      .tz(new Date(start_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    const endDate = moment
      .tz(new Date(end_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    console.log(endDate);
    // Validate date objects

    // Optionally check if start_date is before end_date
    if (startDate >= endDate) {
      return res
        .status(200)
        .json({ message: "Start date must be before end date", status: "2" });
    }

    const createdAt = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImagePrivate;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    EditUniqueSlug(name, eventId, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err, status: "2" });
      }

      // Insert the event data including the slug
      db.query(
        "UPDATE events SET makeImagePrivate = ?, slug = ?, image = ?, user_id = ?, name = ?, start_date = ?, end_date = ?, time = ?, location = ?, description = ?, updated_at = ? WHERE id = ?",
        [
          mp,
          slug,
          eventImage,
          user_id,
          name,
          startDate,
          endDate,
          time,
          location,
          description,
          createdAt,
          eventId, // Ensure eventId is the last parameter
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }
          logActivity(user_id, `update event successfully`);
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
              `SELECT * FROM users WHERE id = ?`,
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
                var message = "Update event by " + senderUsername;
                const notificationMessage = message;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                var link_href = "/singleevent/" + slug;

                // Insert notifications for each friend
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
                    if (item.notification_group_event === "Yes") {
                      await sendEmailFor_editeventNotification(
                        item.email,
                        senderUsername,
                        name
                      );
                    }
                    // Call the email function for each friend
                  });

                  await Promise.all(emailPromises);
                  return res.status(200).json({
                    message: "Successfully updated.",
                  });
                } catch (error) {}
              }
            );
          });
          const broadcastMessage = JSON.stringify({
            event: "eventcreate",
          });

          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
          res.status(201).json({
            message: "Event updated successfully",
            eventId: result.insertId,
            user_id: user_id,
            slug: slug,
            status: "1", // Return the generated slug
          });
        }
      );
    });
  } catch (error) {
    console.error("Some thing went wrong,Please try again:", error); // Log error to console
    res
      .status(500)
      .json({ message: "Some thing went wrong,Please try again", error });
  }
};
exports.eventsedit = async (req, res) => {
  const {
    eventId,
    user_id,
    name,
    start_date,
    end_date,
    time,
    location,
    description,
  } = req.body;

  // Validate required fields
  if (
    !eventId ||
    !user_id ||
    !name ||
    !start_date ||
    !end_date ||
    !time ||
    !location ||
    !description
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  var eventImage = req.body.previewImage;
  const wss = req.wss;
  try {
    // Create Date objects and validate
    const startDate = moment
      .tz(new Date(start_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    const endDate = moment
      .tz(new Date(end_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    // Validate date objects

    // Optionally check if start_date is before end_date
    if (startDate >= endDate) {
      return res
        .status(200)
        .json({ message: "Start date must be before end date", status: "2" });
    }

    const createdAt = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImagePrivate;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    EditUniqueSlug(name, eventId, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err, status: "2" });
      }

      // Insert the event data including the slug
      db.query(
        "UPDATE events SET makeImagePrivate = ?, slug = ?, image = ?, user_id = ?, name = ?, start_date = ?, end_date = ?, time = ?, location = ?, description = ?, updated_at = ? WHERE id = ?",
        [
          mp,
          slug,
          eventImage,
          user_id,
          name,
          startDate,
          endDate,
          time,
          location,
          description,
          createdAt,
          eventId, // Ensure eventId is the last parameter
        ],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database insertion error", error: err });
          }
          logActivity(user_id, `update event successfully`);
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
              `SELECT * FROM users WHERE id = ?`,
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
                var message = "Update event by " + senderUsername;
                const notificationMessage = message;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                var link_href = "/singleevent/" + slug;

                // Insert notifications for each friend
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
                    if (item.notification_group_event === "Yes") {
                      await sendEmailFor_editeventNotification(
                        item.email,
                        senderUsername,
                        name
                      );
                    }
                    // Call the email function for each friend
                  });

                  await Promise.all(emailPromises);
                  return res.status(200).json({
                    message: "Successfully updated.",
                  });
                } catch (error) {}
              }
            );
          });
          const broadcastMessage = JSON.stringify({
            event: "eventcreate",
          });

          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
          res.status(201).json({
            message: "Event updated successfully",
            eventId: result.insertId,
            user_id: user_id,
            slug: slug,
            status: "1", // Return the generated slug
          });
        }
      );
    });
  } catch (error) {
    console.error("Some thing went wrong,Please try again:", error); // Log error to console
    res
      .status(500)
      .json({ message: "Some thing went wrong,Please try again", error });
  }
};
async function sendEmailFor_editeventNotification(
  to,
  createby,
  name,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "Amourette <amourette.no@gmail.com>",
    to: to,
    subject: "🎨 Update Event on Amourette!",
    text: `Hello,\n\nExciting news! Update event titled "${name}" has been updated by ${createby}.\n\nBest regards,\nThe Amourette Team`,
    html: `
      <p>Hello,</p>
      <p>Exciting news! Update event titled "<strong>${name}</strong>" has been updated by <strong>${createby}</strong>.</p>
      <p>Join the event, explore the latest creations, and share your thoughts.</p>
      <p>Best regards,<br>The Amourette Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      if (callback) callback(error);
    } else {
      if (callback) callback(null, info);
    }
  });
}
async function sendEmailFor_createeventNotification(
  to,
  createby,
  name,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "Amourette <amourette.no@gmail.com>",
    to: to,
    subject: "🎨 New Event on Amourette!",
    text: `Hello,\n\nExciting news! A new event titled "${name}" has been created by ${createby}.\n\nBest regards,\nThe Amourette Team`,
    html: `
      <p>Hello,</p>
      <p>Exciting news! A new event titled "<strong>${name}</strong>" has been created by <strong>${createby}</strong>.</p>
      <p>Join the event, explore the latest creations, and share your thoughts.</p>
      <p>Best regards,<br>The Amourette Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      if (callback) callback(error);
    } else {
      if (callback) callback(null, info);
    }
  });
}

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
exports.getallYourevents = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // First, fetch all events
    db.query(
      `SELECT
          e.*,
          ei.id AS inter_id,
          CASE 
              WHEN ei.event_id IS NOT NULL THEN true 
              ELSE false 
          END AS is_interested
      FROM 
          events e
      LEFT JOIN 
          events_intersted ei ON e.id = ei.event_id AND ei.user_id = ?
      WHERE 
          e.user_id =? 
          AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()
      ORDER BY 
          e.id DESC;
      `,
      [user_id, user_id],
      (err, events) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // Now, fetch invited users
        db.query(
          `SELECT 
              ev.event_id,
              ev.sent_id,
              u.id AS user_id,
              u.username AS user_name,
              u.profile_image AS user_image,
              ev.accept
          FROM 
              events_invite ev
          LEFT JOIN 
              users u ON ev.sent_id = u.id
          WHERE 
              ev.accept = 'Yes';`,
          (err, invitedUsers) => {
            if (err) {
              console.error("Database query error:", err);
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            // Group invited users by event_id
            const invitedUsersMap = {};
            invitedUsers.forEach((user) => {
              if (!invitedUsersMap[user.event_id]) {
                invitedUsersMap[user.event_id] = [];
              }
              invitedUsersMap[user.event_id].push({
                user_id: user.user_id,
                user_name: user.user_name,
                user_image: user.user_image,
              });
            });

            // Attach invited users to events
            const finalEvents = events.map((event) => ({
              ...event,
              invited_users: invitedUsersMap[event.id] || [], // If no invited users, return an empty array
            }));
            console.log(finalEvents);
            res.status(200).json({
              message: "Events retrieved successfully",
              events: finalEvents,
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getallYoureventsUser = async (req, res) => {
  const user_id = req.body.user_id;
  const event_id = req.body.event_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id

    db.query(
      `SELECT DISTINCT u.*
FROM users u
LEFT JOIN friendRequest_accept fr ON
  (u.id = fr.sent_to AND fr.user_id = ?) OR
  (u.id = fr.user_id AND fr.sent_to = ?)
WHERE u.id NOT IN (
    SELECT user_id FROM events_invite WHERE event_id = ?
)
AND u.id NOT IN (
    SELECT sent_id FROM events_invite WHERE event_id = ?
)
AND fr.status = "Yes"
AND u.id != ?;
`,
      [user_id, user_id, event_id, event_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "",
          events: results, // This will include all users excluding user with ID 2
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
async function sendEmailFor_InviteInviteNotification(
  too,
  name,
  message,
  groupName,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too,
    subject: `Invite a event on Amourette`, // Corrected grammar
    text: `Hello,\n\nYou have received a event invitation ${groupName} on Amourette.\n\nMessage: "${message}"\n\nBest regards,\nAmourette Team`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
exports.sendEventinvite = async (req, res) => {
  const user_id = req.body.user_id; // Get user_id from the request body
  const eventId = req.body.eventId; // Get user_id from the request body
  const friendIds = req.body.friendIds; // Get friendIds from the request body
  //console.log(req.body); // Log request body for debugging

  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({ message: "Friend IDs are required" });
  }

  try {
    // Prepare insert query
    var datee = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    const insertPromises = friendIds.map((friendId) => {
      return new Promise((resolve, reject) => {
        // Step 1: Get username from users table
        db.query(
          "SELECT username FROM users WHERE id = ?",
          [user_id],
          (err, userResult) => {
            if (err) {
              console.error("Error fetching username:", err);
              return reject(err);
            }

            // Fetch group name from the groups table
            db.query(
              "SELECT * FROM events WHERE id = ?",
              [eventId],
              (err, groupResult) => {
                if (err) {
                  console.error("Error fetching group name:", err);
                  return reject(err);
                }

                const username = userResult[0]?.username || "Unknown"; // Fallback to "Unknown" if no username is found
                const groupName = groupResult[0]?.name || "Unknown Group"; // Fallback to "Unknown Group" if no group name is found

                // Step 2: Insert into groups_invite table
                db.query(
                  `INSERT INTO events_invite (sent_id, user_id, event_id, accept, date) VALUES (?, ?, ?, ?, ?)`,
                  [friendId, user_id, eventId, "No", datee], // Assuming "No" as default acceptance status
                  (err, result) => {
                    if (err) {
                      console.error("Insert error:", err);
                      return reject(err);
                    }

                    // Step 3: Insert into notification table
                    const notificationMessage = `You have been invited to join the event ${groupName} by ${username}`;
                    const link_href = "/singleevent/" + groupResult[0]?.slug;

                    db.query(
                      "INSERT INTO notification (to_id, user_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                      [
                        user_id,
                        friendId,
                        notificationMessage,
                        datee,
                        link_href,
                      ],
                      (err, result) => {
                        if (err) {
                          console.error("Notification insert error:", err);
                          return reject(err);
                        }

                        resolve(result); // Resolve the promise after both inserts succeed
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    });

    const emailPromises = friendIds.map((friendId) => {
      return new Promise((resolve, reject) => {
        const query = `SELECT
                      email,
                      username,
                      notification_group_event
                    FROM users
                    WHERE id = ?`;

        // Query to get user details
        db.query(query, [friendId], (err, row) => {
          if (err) {
            reject({ message: "Database query error", error: err });
          }

          const user2Email = row[0]?.email;
          const user2Username = row[0]?.username;
          const user2NotificationGroupEvent = row[0]?.notification_group_event;

          if (!user2Email || !user2Username) {
            return reject({ message: "User details not found." });
          }

          const groupQuery = `SELECT name FROM events WHERE id = ?;`;
          db.query(groupQuery, [eventId], (err, groupRow) => {
            if (err) {
              reject({ message: "Database query error", error: err });
            }

            const groupName = groupRow[0]?.name;
            if (!groupName) {
              return reject({ message: "Group name not found." });
            }

            const inviteMessage = `invited a member to the event "${groupName}".`;

            // Check if user has opted to receive group event notifications
            if (user2NotificationGroupEvent === "Yes") {
              // Return a promise for the email sending
              sendEmailFor_InviteInviteNotification(
                user2Email,
                user2Username,
                inviteMessage,
                groupName
              )
                .then((info) => {
                  resolve(info); // Resolve the promise once email is sent
                })
                .catch((error) => {
                  reject({ message: "Error sending email", error }); // Reject the promise if email fails
                });
            } else {
              resolve({ message: "No email notification sent." });
            }
          });
        });
      });
    });
    // Wait for all insert queries to complete
    await Promise.all(insertPromises);
    await Promise.all(emailPromises);
    const query = `SELECT * from events where id = ?;`;

    // Fetching the messages
    db.query(query, [eventId], (err, row) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }
      var gname = row[0].name;
      logActivity(user_id, `invited a member to the event "${gname}".`);
    });
    res.status(201).json({
      message: "Invitations sent successfully.",
    });
  } catch (error) {
    console.error("Error sending invitations:", error); // Log error to console
    res.status(500).json({ message: "Error sending invitations", error });
  }
};

exports.get_EventDetail = async (req, res) => {
  const event_id = req.body.event_id;
  // Validate required fields
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT *
      FROM events
      WHERE id = ?`,
      [event_id],
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
          event: results[0], // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.get_EventDetailSlug = async (req, res) => {
  const slug = req.body.slug;
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Event Slug is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT *
      FROM events
      WHERE slug = ?`,
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
          event: results[0], // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.userDeleteEvent = async (req, res) => {
  const event_id = req.body.event_id;

  // Validate required fields
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required." });
  }

  try {
    // Check if the event exists

    db.query(
      `DELETE FROM events WHERE id = ?`,
      [event_id],
      (deleteErr, deleteResults) => {
        if (deleteErr) {
          console.error("Error deleting event:", deleteErr);
          return res
            .status(500)
            .json({ message: "Error deleting event", error: deleteErr });
        }

        // Check if any rows were affected
        if (deleteResults.affectedRows === 0) {
          db.query(
            `DELETE FROM events_invite WHERE event_id = ?`,
            [event_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM events_intersted WHERE event_id = ?`,
            [event_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM event_post WHERE event_id = ?`,
            [event_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM event_post_comment WHERE event_id = ?`,
            [event_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM event_post_favourite WHERE event_id = ?`,
            [event_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );

          return res
            .status(404)
            .json({ message: "Event not found or already deleted." });
        }

        res.status(200).json({ message: "Event deleted successfully." });
      }
    );
  } catch (error) {
    console.error("Event deletion error:", error); // Log error to console
    res.status(500).json({ message: "Event deletion error", error });
  }
};

exports.getallevents = async (req, res) => {
  const user_id = req.body.user_id;
  console.log(req.body);
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query("SELECT * FROM events  ORDER BY id DESC", (err, results) => {
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
          events: results,
        });
      } else {
        res.status(404).json({ message: "No events found for this user" });
      }
    });
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getalleventsWithInterseted = async (req, res) => {
  const { id, user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // First, fetch all events
    db.query(
      `SELECT
          e.*,
          ei.id AS inter_id,
          CASE 
              WHEN ei.event_id IS NOT NULL THEN true 
              ELSE false 
          END AS is_interested
      FROM 
          events e
      LEFT JOIN 
          events_intersted ei ON e.id = ei.event_id AND ei.user_id = ?
      WHERE 
          e.user_id IN (${user_id}) 
          AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()
      ORDER BY 
          e.id DESC;
      `,
      [id],
      (err, events) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // Now, fetch invited users
        db.query(
          `SELECT 
              ev.event_id,
              ev.sent_id,
              u.id AS user_id,
              u.username AS user_name,
              u.profile_image AS user_image,
              ev.accept
          FROM 
              events_invite ev
          LEFT JOIN 
              users u ON ev.sent_id = u.id
          WHERE 
              ev.accept = 'Yes';`,
          (err, invitedUsers) => {
            if (err) {
              console.error("Database query error:", err);
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            // Group invited users by event_id
            const invitedUsersMap = {};
            invitedUsers.forEach((user) => {
              if (!invitedUsersMap[user.event_id]) {
                invitedUsersMap[user.event_id] = [];
              }
              invitedUsersMap[user.event_id].push({
                user_id: user.user_id,
                user_name: user.user_name,
                user_image: user.user_image,
              });
            });

            // Attach invited users to events
            const finalEvents = events.map((event) => ({
              ...event,
              invited_users: invitedUsersMap[event.id] || [], // If no invited users, return an empty array
            }));
            console.log(finalEvents);
            res.status(200).json({
              message: "Events retrieved successfully",
              events: finalEvents,
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.get_EventdetailAllIntersted = async (req, res) => {
  const event_id = req.body.event_id;
  const user_id = req.body.user_id;
  // Validate required fields
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `
SELECT 
    gi.*, 
    u.username, 
    u.profile_image, 
    u.email,u.id as uid
FROM events_invite gi
LEFT JOIN users u ON gi.sent_id = u.id
LEFT JOIN events g ON g.id = gi.event_id 
WHERE gi.event_id = ?
AND gi.accept = 'Yes'
ORDER BY gi.date DESC
`,
      [event_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        if (results.length === 0) {
          return res
            .status(200)
            .json({ message: "Event not found.", results: "" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "Event interested successfully.",
          results: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.userEventIntersted = async (req, res) => {
  const { event_id, user_id } = req.body;

  // Validate required fields
  if (!event_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Event ID and User ID are required." });
  }

  try {
    // Check if the entry already exists
    var status = "Yes";
    var date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    db.query(
      `SELECT * FROM events_intersted WHERE user_id = ? AND event_id = ?`,
      [user_id, event_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        if (results.length > 0) {
          // If exists, update the existing record
          db.query(
            `DELETE FROM events_intersted WHERE user_id = ? AND event_id = ?`,
            [user_id, event_id],
            (deleteErr) => {
              if (deleteErr) {
                console.error("Database delete error:", deleteErr);
                return res
                  .status(500)
                  .json({ message: "Database delete error", error: deleteErr });
              }

              res.status(200).json({
                message: "Event interest deleted successfully.",
                status: "2",
              });
            }
          );
        } else {
          // If not exists, insert a new record
          db.query(
            `INSERT INTO events_intersted (user_id, event_id, status, date) VALUES (?, ?, ?, ?)`,
            [user_id, event_id, status, date],
            (insertErr) => {
              if (insertErr) {
                console.error("Database insert error:", insertErr);
                return res
                  .status(500)
                  .json({ message: "Database insert error", error: insertErr });
              }

              res.status(201).json({
                message: "Event interest created successfully.",
                status: "1",
              });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.get_EventIntersted = async (req, res) => {
  const event_id = req.body.event_id;
  const user_id = req.body.user_id;

  // Validate required fields
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required." });
  }

  try {
    // Fetch the event for the given event_id
    db.query(
      `SELECT * from events_intersted
        WHERE event_id = ? And user_id = ?;

      `,
      [event_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        if (results.length === 0) {
          return res
            .status(200)
            .json({ message: "Event not found.", status: "2" });
        }

        // Return the first event since we expect only one row
        res.status(200).json({
          message: "Event",
          status: "1", // Return the first event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.createEventPost = async (req, res) => {
  const { event_id, user_id, description } = req.body;

  // Validate required fields
  if (!event_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Event ID and User ID are required." });
  }
  const eventImage = req.file?.location || null; // For single file upload
  //console.log(eventImage);
  try {
    var date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    db.query(
      `INSERT INTO event_post (user_id, event_id, file,description, date) VALUES (?, ?, ?, ?, ?)`,
      [user_id, event_id, eventImage, description, date],
      (insertErr) => {
        if (insertErr) {
          console.error("Database insert error:", insertErr);
          return res
            .status(500)
            .json({ message: "Database insert error", error: insertErr });
        }
        const query = `SELECT * from events where id = ?;`;

        // Fetching the messages
        db.query(query, [event_id], (err, row) => {
          if (err) {
            return res.status(500).json({
              message: "Database query error",
              error: err,
            });
          }
          var gname = row[0].name;
          var slug = row[0].slug;
          logActivity(user_id, `upload a post in the event ` + gname + ``);
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
                const notificationMessage =
                  ` uploaded a post to the event ` + gname;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const link_href = "/singleevent/" + slug;

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
                    console.log(item.email);
                    if (item.notification_news_update === "Yes") {
                      await sendEmailFor_postCreateNotification(
                        gname,
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
        });

        res.status(200).json({
          message: "Post created successfully.",
          status: "1",
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
async function sendEmailFor_postCreateNotification(
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
    subject: `Event post created by ${byname}`, // Updated subject for clarity
    text: `Hello,\n\nWe’re excited to inform you that a new post has been created in the event "${gname}" by ${byname} on Amourette.\n\nBest regards,\nThe Amourette Team`, // Updated message text
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
exports.get_postComment = async (req, res) => {
  const event_id = req.body.event_id;
  const user_id = req.body.user_id;
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required" });
  }

  try {
    // Fetch all events for the given event_id and logged_in_user_id
    db.query(
      `SELECT
          ep.*,
          u.username AS event_user_username,
          u.id AS uid,
          u.makeImagePrivate,
          u.profile_image AS event_user_profile_image,
          u.id AS uid,
          epc.id AS post_id,
          epc.description AS post_description,
          epc.user_id AS post_user_id,
          epc.date AS comment_date,
          uc.username AS comment_user_username,
          uc.id AS comt_uid,
          uc.makeImagePrivate AS comment_makeImagePrivate,
          uc.profile_image AS comment_user_profile_image,
          COUNT(ucf.user_id) AS fav_count,
          MAX(CASE WHEN ucf.user_id = ? THEN 1 ELSE 0 END) AS fav -- Check if the logged-in user has favorited the post
       FROM event_post ep
       JOIN users u ON ep.user_id = u.id -- User who created the event post
       LEFT JOIN event_post_comment epc ON ep.id = epc.event_post_id
       LEFT JOIN users uc ON epc.user_id = uc.id
       LEFT JOIN event_post_favourite ucf ON ep.id = ucf.post_id
       WHERE ep.event_id = ?
       GROUP BY ep.id, epc.id, u.id, uc.id
       ORDER BY ep.id DESC;
      `,
      [user_id, event_id], // Pass logged_in_user_id and event_id
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // Create an empty array to hold the formatted posts
        const postsArray = [];

        // Create a map to hold each post and its associated comments
        const postsMap = {};

        results.forEach((row) => {
          // If the post does not already exist in the map, create it
          if (!postsMap[row.id]) {
            postsMap[row.id] = {
              id: row.id,
              makeImagePrivate: row.makeImagePrivate,
              user_id: row.user_id,
              event_id: row.event_id,
              file: row.file,
              description: row.description,
              date: row.date,
              username: row.event_user_username, // Use alias for username
              profile_image: row.event_user_profile_image, // Use alias for profile image
              uid: row.uid,
              fav_count: row.fav_count,
              fav: row.fav === 1, // Set 'fav' as true or false depending on the logged-in user's favorite status
              post: [], // Initialize an empty array for comments
            };
            postsArray.push(postsMap[row.id]);
          }

          // If there is a comment, push it to the 'post' array
          if (row.post_id !== null) {
            postsMap[row.id].post.push({
              post_id: row.post_id,
              comment_makeImagePrivate: row.comment_makeImagePrivate,
              comment_user_username: row.comment_user_username,
              comt_uid: row.comt_uid,
              comment_user_profile_image: row.comment_user_profile_image,
              event_id: row.event_id,
              description: row.post_description,
              comment_date: row.comment_date,
              user_id: row.post_user_id,
            });
          }
        });
        //  / console.log(postsArray);
        // Return the formatted posts array
        res.status(200).json({
          message: "Event posts and comments retrieved successfully",
          results: postsArray,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.CreateEventPostComment = async (req, res) => {
  const { event_id, user_id, comment, post_id } = req.body;
  const wss = req.wss;

  if (!event_id || !user_id || !post_id || !comment) {
    return res.status(400).json({
      message: "Event ID, User ID, Post ID, and Comment are required.",
    });
  }

  try {
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Insert comment into the database
    db.query(
      `INSERT INTO event_post_comment (event_post_id, user_id, event_id, description, date) VALUES (?, ?, ?, ?, ?)`,
      [post_id, user_id, event_id, comment, date],
      (insertErr) => {
        if (insertErr) {
          console.error("Database insert error:", insertErr);
          return res
            .status(500)
            .json({ message: "Database insert error", error: insertErr });
        }

        // WebSocket Broadcast
        if (wss) {
          const broadcastMessage = JSON.stringify({
            event: "eventComments",
            post_id,
          });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastMessage);
            }
          });
        }

        // Log activity
        logActivity(user_id, "commented on an event post");

        // Fetch event details
        db.query(
          `SELECT * FROM events WHERE id = ?`,
          [event_id],
          (err, eventRow) => {
            if (err || eventRow.length === 0) {
              return res.status(500).json({
                message: "Database query error",
                error: err || "Event not found",
              });
            }

            const { name: gname, slug } = eventRow[0];

            // Retrieve sender's username
            db.query(
              `SELECT username FROM users WHERE id = ?`,
              [user_id],
              async (err, userRow) => {
                if (err || userRow.length === 0) {
                  return res
                    .status(500)
                    .json({ message: "User not found", error: err });
                }

                const senderUsername = userRow[0].username;

                logActivity(
                  user_id,
                  `commented on a post in the event ${gname}`
                );

                // Retrieve user's friends for notifications
                db.query(
                  `SELECT u.*, CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
               FROM users u
               JOIN friendRequest_accept fr ON
               (u.id = fr.sent_to AND fr.user_id = ?) OR
               (u.id = fr.user_id AND fr.sent_to = ?)
               WHERE fr.status = 'Yes'`,
                  [user_id, user_id],
                  async (err, friends) => {
                    if (err) {
                      return res
                        .status(500)
                        .json({ message: "Database query error", error: err });
                    }

                    const notificationMessage = `commented on a post in the event ${gname}`;
                    const link_href = `/group/${slug}`;

                    // Insert notifications for each friend
                    const insertNotificationsPromises = friends.map(
                      (friend) => {
                        return new Promise((resolve, reject) => {
                          db.query(
                            `INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)`,
                            [
                              friend.id,
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
                      }
                    );

                    try {
                      await Promise.all(insertNotificationsPromises);

                      // Send email notifications if enabled
                      await Promise.all(
                        friends
                          .filter(
                            (item) => item.notification_group_event === "Yes"
                          )
                          .map((item) =>
                            sendEmailFor_postCommentCreateNotification(
                              gname,
                              item.email,
                              item.username,
                              senderUsername
                            )
                          )
                      );

                      res.status(200).json({
                        message: "Event post comment added successfully.",
                        status: "1",
                      });
                    } catch (error) {
                      console.error("Error sending notifications:", error);
                      res.status(500).json({
                        message: "Error sending notifications",
                        error,
                      });
                    }
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.EventpostFavourite = async (req, res) => {
  const { event_id, user_id, post_id } = req.body;

  // Validate required fields
  if (!event_id || !user_id || !post_id) {
    return res.status(400).json({
      message: "Event ID, User ID, and Post ID are required.",
    });
  }

  try {
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Check if the post is already favorited
    const [existing] = await db
      .promise()
      .query(
        `SELECT * FROM event_post_favourite WHERE user_id = ? AND event_id = ? AND post_id = ?`,
        [user_id, event_id, post_id]
      );

    if (existing.length > 0) {
      // If exists, delete the favorite
      await db
        .promise()
        .query(
          `DELETE FROM event_post_favourite WHERE user_id = ? AND event_id = ? AND post_id = ?`,
          [user_id, event_id, post_id]
        );

      // Fetch event name for logging
      const [eventRow] = await db
        .promise()
        .query(`SELECT name FROM events WHERE id = ?`, [event_id]);
      if (eventRow.length > 0) {
        logActivity(
          user_id,
          `disliked a post in the event ${eventRow[0].name}`
        );
      }

      return res.status(200).json({
        message: "Event Favourite post deleted successfully.",
        status: "2",
      });
    } else {
      // Insert a new favorite
      await db
        .promise()
        .query(
          `INSERT INTO event_post_favourite (post_id, user_id, event_id, fav, date) VALUES (?, ?, ?, ?, ?)`,
          [post_id, user_id, event_id, "Like", date]
        );

      // Fetch event details
      const [eventRow] = await db
        .promise()
        .query(`SELECT name, slug FROM events WHERE id = ?`, [event_id]);

      if (eventRow.length > 0) {
        const gname = eventRow[0].name;
        const slug = eventRow[0].slug;

        logActivity(user_id, `liked a post in the event ${gname}`);

        // Fetch friend information for notifications
        const [friends] = await db.promise().query(
          `SELECT u.*,
                CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
             FROM users u
             JOIN friendRequest_accept fr ON
             (u.id = fr.sent_to AND fr.user_id = ?) OR
             (u.id = fr.user_id AND fr.sent_to = ?)
             WHERE fr.status = 'Yes'`,
          [user_id, user_id]
        );

        const notificationMessage = `liked a post in the event ${gname}`;
        const date = moment
          .tz(new Date(), "Europe/Oslo")
          .format("YYYY-MM-DD HH:mm:ss");
        const link_href = `/singleevent/${slug}`;

        // Fetch sender info for notifications
        const [senderResult] = await db
          .promise()
          .query(
            `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
            [user_id]
          );

        const senderUsername = senderResult[0].username;

        // Insert notifications for each friend
        await Promise.all(
          friends.map((item) => {
            return new Promise((resolve, reject) => {
              db.query(
                "INSERT INTO notification (user_id, to_id, message, date, link_href) VALUES (?, ?, ?, ?, ?)",
                [item.id, user_id, notificationMessage, date, link_href],
                (err) => {
                  if (err) {
                    console.error("Database insertion error:", err);
                    reject(err);
                  } else {
                    resolve();
                  }
                }
              );
            });
          })
        );

        // Send email notifications
        await Promise.all(
          friends.map((item) => {
            if (item.notification_group_event === "Yes") {
              return sendEmailFor_postLikeCreateNotification(
                gname,
                item.email,
                item.username,
                senderUsername
              );
            }
          })
        );

        return res.status(200).json({
          message: "Event Favourite post added successfully.",
        });
      }
    }
  } catch (error) {
    console.error("Error in EventpostFavourite:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
async function sendEmailFor_postLikeCreateNotification(
  gname,
  to,
  name,
  fromby,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const message = `A post in the event "${gname}" was liked by ${fromby}`;

  const mailOptions = {
    from: "Amourette <amourette.no@gmail.com>",
    to: to,
    subject: `Event post liked by ${fromby} on Amourette!`,
    text: `Hello,\n\nExciting news! A post in the event "${gname}" has been liked by ${fromby}.\n\nJoin the conversation, explore the latest creations, and share your thoughts.\n\nBest regards,\nThe Amourette Team`,
    html: `
      <p>Hello,</p>
      <p>Join the conversation, explore the latest creations, and share your thoughts.</p>
      <p>Best regards,<br>The Amourette Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      if (callback) callback(error);
    } else {
      if (callback) callback(null, info);
    }
  });
}
async function sendEmailFor_postCommentCreateNotification(
  gname,
  to,
  name,
  fromby,
  callback
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "Amourette <amourette.no@gmail.com>",
    to: to,
    subject: `New comment on an event post by ${fromby} on Amourette!`,
    text: `Hello ${name},\n\n${fromby} has commented on a post in the event "${gname}".\n\nBest regards,\nThe Amourette Team`,
    html: `
      <p>Hello ${name},</p>
      <p><strong>${fromby}</strong> has commented on a post in the event "<strong>${gname}</strong>".</p>
      <p>Best regards,<br>The Amourette Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (callback) callback(error, info);
  });
}

exports.GetEventPostComments = async (req, res) => {
  const event_id = req.body.event_id;
  console.log("Event ID:", event_id);
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required" });
  }

  try {
    // Fetch comments for the given event_id
    db.query(
      `SELECT

          epc.event_post_id AS post_id,
          epc.id AS comment_id,
          epc.description AS comment_description,
          epc.user_id,
          epc.date AS comment_date,
          epc.event_id,
          uc.username AS comment_user_username,
          uc.profile_image AS comment_user_profile_image
      FROM event_post_comment epc
      JOIN event_post ep ON ep.id = epc.event_post_id
      JOIN users uc ON epc.user_id = uc.id
      WHERE ep.event_id = ?;`,
      [event_id], // Pass the event_id as a parameter
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        console.log("Query Results:", results); // Log the results for debugging

        // Return the results as a response
        res.status(200).json({
          message: "Comments retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getEventInterstedUser = async (req, res) => {
  const { event_id, user_id } = req.body;
  if (!event_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Event ID and User ID are required." });
  }
  console.log(req.body);
  try {
    db.query(
      `SELECT
          ei.*,
          u.username,
          u.profile_image
      FROM
          events_intersted ei
      LEFT JOIN
          users u ON ei.user_id = u.id
      WHERE
          ei.event_id = ? AND
          ei.user_id != ?;
`,
      [event_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }
        res.status(200).json({
          message: "Intersted Users retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.UsercheckAccept = async (req, res) => {
  const { slug, user_id } = req.body;
  if (!slug || !user_id) {
    return res.status(400).json({ message: "User ID are required." });
  }
  console.log(req.body);
  try {
    db.query(
      `SELECT e.id AS event_id, e.name AS event_name,
       e.user_id AS creator_id,
       ei.sent_id AS invited_user_id,
       ei.accept AS invite_status,
       CASE
         WHEN e.user_id = ? THEN 'Created by You'
         WHEN ei.accept = 'Yes' THEN 'Invite Accepted'
         ELSE 'Invite Not Accepted'
       END AS event_status
      FROM events e
      LEFT JOIN events_invite ei
        ON e.id = ei.event_id
        AND ei.sent_id = ?
      WHERE (e.user_id = ? OR ei.sent_id = ?)
        AND e.slug = ?;
`,
      [user_id, user_id, user_id, user_id, slug],
      (err, row) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }
        res.status(200).json({
          message: "Accept successfully",
          results: row,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.DeleteInviteRequest = async (req, res) => {
  const { event_id, user_id, slug } = req.body;

  // Validate required fields
  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required." });
  }

  try {
    // Delete the event invite
    db.query(
      `DELETE FROM events_invite WHERE event_id = ? AND sent_id = ?`,
      [event_id, user_id],
      (deleteErr, deleteResults) => {
        if (deleteErr) {
          console.error("Error deleting event:", deleteErr);
          return res
            .status(500)
            .json({ message: "Error deleting event", error: deleteErr });
        }

        // Fetch friends for notification
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

          // Fetch sender details
          db.query(
            `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
            [user_id],
            (err, senderResult) => {
              if (err) {
                return res
                  .status(500)
                  .json({ message: "Error fetching username", error: err });
              }

              const senderUsername =
                senderResult[0]?.username || "Unknown User";
              const senderEmail =
                senderResult[0]?.email || "no-reply@example.com";
              const notificationGroupEvent =
                senderResult[0]?.notification_group_event;

              const notificationMessage = ` has canceled the event request`;

              const date = moment
                .tz(new Date(), "Europe/Oslo")
                .format("YYYY-MM-DD HH:mm:ss");
              const link_href = "/singleevent/" + slug;

              // Insert notifications for each friend
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

              Promise.all(insertNotificationsPromises)
                .then(() => {
                  // Respond to the client after notifications
                  res.status(200).json({
                    message: "Event invite canceled and notifications sent.",
                  });

                  // If the user has email notifications enabled, send email
                  if (notificationGroupEvent === "Yes") {
                    // Fetch event details
                    db.query(
                      `SELECT name FROM events WHERE id = ?`,
                      [event_id],
                      (err, eventResult) => {
                        if (err) {
                          console.error("Error fetching event data", err);
                          return;
                        }

                        const eventName =
                          eventResult[0]?.name || "Unknown Event";

                        // Send email asynchronously without delaying the response
                        sendEmailFor_cancelNotification(
                          senderEmail,
                          eventName,
                          (info) => {
                            console.log("Email sent: ", info);
                          }
                        );
                      }
                    );
                  }
                })
                .catch((error) => {
                  console.error("Error sending notifications:", error);
                  return res.status(500).json({
                    message: "Error sending notifications",
                    error: error.message || error,
                  });
                });
            }
          );
        });
      }
    );
  } catch (error) {
    console.error("Event deletion error:", error);
    return res.status(500).json({ message: "Event deletion error", error });
  }
};

async function sendEmailFor_InviteJoinNotification(too, name, callback) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too,
    subject: `You've Joined a Event on Amourette`, // Updated subject for clarity
    text: `Hello,\n\nWe’re excited to inform you that you’ve successfully joined the event "${name}" on Amourette.\n\nLog in now to view and participate in the group.\n\nBest regards,\nThe Amourette Team`, // Improved message text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
async function sendEmailFor_cancelNotification(too, name) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too,
    subject: `Event Request Canceled on Amourette`, // Subject corrected for cancellation
    text: `Hello,\n\nWe would like to inform you that the event request for "${name}" has been canceled on Amourette.\n\nIf you have any questions or need further assistance, feel free to reach out.\n\nBest regards,\nThe Amourette Team`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent successfully:", info.response);
    }
  });
}

exports.eventAccepted = async (req, res) => {
  const event_id = req.body.event_id;
  const user_id = req.body.user_id;
  const wss = req.wss;
  const slug = req.body.slug;

  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required." });
  }

  try {
    db.query(
      `UPDATE events_invite SET accept = ? WHERE event_id = ? AND sent_id = ?`,
      ["Yes", event_id, user_id],
      (updateErr, updateResults) => {
        if (updateErr) {
          console.error("Error updating event invite:", updateErr);
          return res
            .status(500)
            .json({ message: "Error updating event invite", error: updateErr });
        }

        if (updateResults.affectedRows === 0) {
          return res
            .status(404)
            .json({ message: "No invite found to update." });
        }

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

          db.query(
            `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
            [user_id],
            (err, senderResult) => {
              if (err) {
                return res
                  .status(500)
                  .json({ message: "Error fetching username", error: err });
              }

              const senderUsername =
                senderResult[0]?.username || "Unknown User";
              const senderEmail =
                senderResult[0]?.email || "no-reply@example.com";
              const notificationGroupEvent =
                senderResult[0]?.notification_group_event;

              const notificationMessage = `${senderUsername} joined the event`;
              const date = moment
                .tz(new Date(), "Europe/Oslo")
                .format("YYYY-MM-DD HH:mm:ss");
              const link_href = "/singleevent/" + slug;
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

              Promise.all(insertNotificationsPromises)
                .then(() => {
                  if (notificationGroupEvent === "Yes") {
                    db.query(
                      `SELECT name FROM events WHERE id = ?`,
                      [event_id],
                      (err, eventResult) => {
                        if (err) {
                          return res.status(500).json({
                            message: "Error fetching event data",
                            error: err,
                          });
                        }

                        const eventName =
                          eventResult[0]?.name || "Unknown Event";

                        sendEmailFor_InviteJoinNotification(
                          senderEmail,
                          eventName,
                          (info) => {
                            return res.status(200).json({
                              message:
                                "Notifications sent successfully with email.",
                              emailInfo: info,
                            });
                          }
                        );
                        return res.status(200).json({
                          message:
                            "Notifications sent successfully without email.",
                        });
                      }
                    );
                  } else {
                    // ✅ Move this response OUTSIDE of the last query
                    return res.status(200).json({
                      message: "Notifications sent successfully without email.",
                    });
                  }
                })
                .catch((error) => {
                  console.error("Error sending notifications:", error);
                  return res.status(500).json({
                    message: "Error sending notifications",
                    error: error,
                  });
                });
            }
          );
        });
      }
    );
  } catch (error) {
    console.error("Event processing error:", error);
    res.status(500).json({ message: "Event processing error", error });
  }
};
exports.getAlleventsSearch = async (req, res) => {
  const { user_id, search, user_ids } = req.body;
  console.log(req.body);

  // Validate required fields
  if (!user_ids) {
    return res.status(400).json({ message: "User IDs are required" });
  }

  try {
    const searchTerm = search ? `%${search}%` : "%";

    const query = `
      SELECT
    e.*,
    ei.id AS inter_id,
    CASE
        WHEN ei.event_id IS NOT NULL THEN true
        ELSE false
    END AS is_interested,
    CONCAT('[', GROUP_CONCAT(
        JSON_OBJECT(
            'user_id', u.id,
            'user_name', u.username,
            'user_image', u.profile_image
        )
    ), ']') AS invited_users
FROM
    events e
LEFT JOIN
    events_intersted ei ON e.id = ei.event_id AND ei.user_id = ?
LEFT JOIN
    events_invite ev ON e.id = ev.event_id AND ev.accept = 'Yes'
LEFT JOIN
    users u ON ev.sent_id = u.id
WHERE
    e.user_id IN (${user_ids})
    AND (e.name LIKE ? 
        OR e.description LIKE ? 
        OR e.location LIKE ? 
        OR e.start_date LIKE ? 
        OR e.end_date LIKE ?)
    AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()
GROUP BY e.id
ORDER BY e.id DESC;

    `;

    db.query(
      query,
      [user_id, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "Events retrieved successfully",
          results: results.map((event) => ({
            ...event,
            invited_users: JSON.parse(event.invited_users || "[]"), // Parse invited users JSON
          })),
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.geteventsSearch = async (req, res) => {
  const { user_id, search } = req.body;
  console.log(req.body);

  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const searchTerm = search ? `%${search}%` : "%";

    const query = `
      SELECT
    e.*,
    ei.id AS inter_id,
    CASE
        WHEN ei.event_id IS NOT NULL THEN true
        ELSE false
    END AS is_interested,
    CONCAT('[', GROUP_CONCAT(
        JSON_OBJECT(
            'user_id', u.id,
            'user_name', u.username,
            'user_image', u.profile_image
        )
    ), ']') AS invited_users
FROM events e
LEFT JOIN events_intersted ei ON e.id = ei.event_id AND ei.user_id = ?
LEFT JOIN events_invite ev ON e.id = ev.event_id AND ev.accept = 'Yes'
LEFT JOIN users u ON ev.sent_id = u.id
WHERE e.user_id = ?
AND (e.name LIKE ? OR e.description LIKE ? OR e.location LIKE ? OR e.start_date LIKE ? OR e.end_date LIKE ?)
AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()
GROUP BY e.id
ORDER BY e.id DESC;

    `;

    db.query(
      query,
      [
        user_id,
        user_id,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "Events retrieved successfully",
          results: results.map((event) => ({
            ...event,
            invited_users: event.invited_users
              ? JSON.parse(event.invited_users)
              : [],
          })),
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getalleventsDiscover = async (req, res) => {
  const { user_id, user_ids } = req.body;

  // Validate required fields
  if (!Array.isArray(user_ids) || user_ids.length === 0 || !user_id) {
    return res.status(400).json({
      message: "user_ids must be a non-empty array and user_id is required",
    });
  }

  try {
    const placeholders = user_ids.map(() => "?").join(", "); // for SQL IN clause

    const sql = `
      SELECT
  e.*,
  ei.id AS inter_id,
  CASE
      WHEN ei.event_id IS NOT NULL THEN true
      ELSE false
  END AS is_interested,
  GROUP_CONCAT(
    CONCAT(
      '{"user_id":', u.id,
      ',"user_name":"', u.username,
      '","user_image":"', u.profile_image, '"}'
    )
    SEPARATOR ','
  ) AS invited_users_json
FROM
  events e
LEFT JOIN
  events_intersted ei ON e.id = ei.event_id AND ei.user_id = ?
LEFT JOIN
  events_invite ev ON e.id = ev.event_id AND ev.accept = 'Yes'
LEFT JOIN
  users u ON ev.sent_id = u.id
WHERE
  e.user_id IN (${placeholders})
  AND e.user_id != ?
  AND e.id NOT IN (
    SELECT event_id FROM events_invite WHERE sent_id = ?
  )
  AND e.id NOT IN (
    SELECT event_id FROM events_intersted WHERE user_id = ?
  )
  AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()
GROUP BY e.id
ORDER BY e.id DESC;

    `;

    const params = [user_id, ...user_ids, user_id, user_id, user_id];

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        message: "Events retrieved successfully",
        events: results.map((event) => ({
          ...event,
          invited_users: JSON.parse(event.invited_users || "[]"),
        })),
      });
    });
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getalleventsDiscoverYour = async (req, res) => {
  const { id, user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    db.query(
      `SELECT
          e.*,
          ei.id AS inter_id,
          CASE 
              WHEN ei.event_id IS NOT NULL THEN 1 
              ELSE 0 
          END AS is_interested,
          COALESCE(
              (
                  SELECT CONCAT('[', 
                      GROUP_CONCAT(
                          JSON_OBJECT(
                              'user_id', u.id,
                              'user_name', u.username,
                              'user_image', u.profile_image
                          )
                      ), ']'
                  )
                  FROM events_invite ev
                  JOIN users u ON ev.sent_id = u.id
                  WHERE ev.event_id = e.id AND ev.accept = 'Yes'
              ), '[]'
          ) AS invited_users
      FROM
          events e
      LEFT JOIN
          events_intersted ei ON e.id = ei.event_id AND ei.user_id = ?
      WHERE
          e.user_id = ?
          AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()
      ORDER BY e.id DESC;`,
      [id, id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // ✅ Parse invited_users properly
        results = results.map((event) => ({
          ...event,
          invited_users: event.invited_users
            ? JSON.parse(event.invited_users)
            : [],
        }));

        res.status(200).json({
          message: "Events retrieved successfully",
          events: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error);
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.get_eventSearch = async (req, res) => {
  console.log(req.body);
  try {
    const search = req.body.search?.trim() || "";
    let user_ids = req.body.user_ids;

    // Ensure user_ids is an array
    if (typeof user_ids === "string") {
      user_ids = user_ids.split(",").map((id) => id.trim());
    }

    // Validation: Check if search and user_ids are provided

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    // Ensure all user_ids are valid numbers (to prevent SQL injection risk)
    if (!user_ids.every((id) => /^\d+$/.test(id))) {
      return res.status(400).json({ message: "Invalid user IDs provided" });
    }

    // Generate placeholders for user IDs dynamically
    const userPlaceholders = user_ids.map(() => "?").join(", ");

    const query = `SELECT
    e.id AS event_id,
    e.slug AS event_slug,
    e.name AS event_name,
    e.description AS event_description,
    e.image AS event_image,
    e.created_at AS event_date,
    u.username AS event_owner_username,
    u.id AS uid,
    u.profile_image AS event_owner_profile_image,
    u.makeImagePrivate,

    -- Count total posts in the event
    COUNT(DISTINCT ep.id) AS total_posts,

    -- Count total comments in the event
    COUNT(DISTINCT epc.id) AS total_comments,

    -- Count total likes (favourites) for posts in the event
    COUNT(DISTINCT epf.id) AS total_likes

FROM events e
JOIN users u ON e.user_id = u.id  -- Get event owner details
LEFT JOIN event_post ep ON e.id = ep.event_id  -- Get posts in the event
LEFT JOIN event_post_comment epc ON ep.id = epc.event_post_id  -- Get comments on posts
LEFT JOIN event_post_favourite epf ON ep.id = epf.post_id  -- Get likes on posts

WHERE
    e.user_id IN (${userPlaceholders})  -- Dynamically generate placeholders
    AND (
        LOWER(COALESCE(epc.description, '')) LIKE ? OR
        LOWER(COALESCE(u.username, '')) LIKE ? OR
        LOWER(COALESCE(ep.description, '')) LIKE ? OR
        LOWER(COALESCE(e.name, '')) LIKE ? OR
        LOWER(COALESCE(e.description, '')) LIKE ?
    )
    -- Ensure only future or ongoing events are retrieved
    AND STR_TO_DATE(CONCAT(e.end_date, ' ', e.time), '%Y-%m-%d %H:%i') >= NOW()

GROUP BY e.id, u.id
ORDER BY e.id DESC;
;`;

    // Prepare query parameters safely
    const searchPattern = `%${search}%`;
    const queryParams = [
      ...user_ids,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    // Execute the query using MySQL2
    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        message: "Filtered event posts and comments retrieved successfully",
        results,
      });
    });
  } catch (error) {
    console.error("Gallery retrieval error:", error);
    res.status(500).json({ message: "Gallery retrieval error", error });
  }
};
exports.eventpostDelete = (req, res) => {
  const { id, user_id } = req.body;

  try {
    // Ensure both id and user_id are provided
    if (!id || !user_id) {
      return res
        .status(400)
        .json({ message: "Both ID and User ID are required" });
    }

    // Fetch the event name BEFORE deleting the post
    db.query(
      `SELECT name FROM events WHERE id = ?`,
      [id],
      (eventErr, eventResults) => {
        if (eventErr) {
          return res
            .status(500)
            .json({ message: "Error fetching event", error: eventErr });
        }
        console.log(eventResults);
        let evname = eventResults.length > 0 ? eventResults[0].name : null;

        // Delete from event_post table
        db.query(
          `DELETE FROM event_post WHERE id = ? AND user_id = ?`,
          [id, user_id],
          (err, result) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            // Check if a record was deleted from event_post
            if (result.affectedRows === 0) {
              return res
                .status(404)
                .json({ message: "No event post record found to delete" });
            }

            // Delete from event_post_comment table
            db.query(
              `DELETE FROM event_post_comment WHERE event_post_id = ? AND user_id = ?`,
              [id, user_id],
              (commentErr) => {
                if (commentErr) {
                  return res.status(500).json({
                    message: "Error deleting comments",
                    error: commentErr,
                  });
                }

                // Delete from event_post_favourite table
                db.query(
                  `DELETE FROM event_post_favourite WHERE post_id = ? AND user_id = ?`,
                  [id, user_id],
                  (favouriteErr) => {
                    if (favouriteErr) {
                      return res.status(500).json({
                        message: "Error deleting favourites",
                        error: favouriteErr,
                      });
                    }

                    // Log activity only if event name exists
                    if (evname) {
                      logActivity(
                        user_id,
                        `A post related to the event "${evname}" has been deleted.`
                      );
                    }

                    // Success response
                    return res.status(200).json({
                      message: "Post and related records deleted successfully",
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getinviteUserEvent = async (req, res) => {
  const { user_id } = req.body; // Extract user_id from request body

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to fetch invited groups
    const query = `
      SELECT 
    e.id AS event_id, 
    e.name AS group_name, 
    e.user_id AS creator_id, 
    u.profile_image AS creator_profile_image, 
    u.username AS creator_username, 
    u.slug AS creator_slug, 
    ei.sent_id AS invited_user_id, 
    ei.accept AS invite_status, 
    u_invited.profile_image AS invited_profile_image, 
    u_invited.username AS invited_username,
    CASE 
        WHEN e.user_id = ? THEN 'Created by You'
        WHEN ei.accept = 'No' THEN 'Invite Not Accepted'
        ELSE 'Invite Accepted'
    END AS group_status
FROM \`events\` e
LEFT JOIN events_invite ei 
    ON e.id = ei.event_id AND ei.accept = 'No' -- Ensure only unaccepted invites
LEFT JOIN users u 
    ON e.user_id = u.id  -- Event creator details
LEFT JOIN users u_invited 
    ON ei.sent_id = u_invited.id  -- Invited user's details
WHERE ei.sent_id = ? 
ORDER BY e.id DESC -- Optional: Fetch latest event first
LIMIT 1; -- Ensuring only one record per sent_id

    `;

    // Execute the query
    db.query(query, [user_id, user_id], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({
          message: "Database query error",
          error: err.message,
        });
      }

      // Respond with the retrieved data
      res.status(200).json({
        message: "Invited groups retrieved successfully",
        result: results,
      });
    });
  } catch (error) {
    console.error("Server error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.getEventDetailSlug = async (req, res) => {
  const slug = req.body.slug;

  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Slug is required." });
  }

  try {
    // Fetch the group for the given group_id
    db.query(
      `SELECT *
      FROM \`events\`
      WHERE slug = ?`,
      [slug],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, group: "" });
        }

        if (results.length === 0) {
          return res
            .status(200)
            .json({ message: "Event not found.", group: "" });
        }

        // Return the first Group since we expect only one row
        res.status(200).json({
          message: "Event retrieved successfully.",
          group: results[0], // Return the first Event object
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.get_postCommentt = async (req, res) => {
  const event_id = req.body.event_id;
  const user_id = req.body.user_id;

  if (!event_id) {
    return res.status(400).json({ message: "Event ID is required" });
  }

  try {
    // Fetch all Group for the given event_id and logged_in_user_id
    db.query(
      `SELECT
          ep.*,
          u.username AS group_user_username,
          u.profile_image AS group_user_profile_image,
          u.id AS uid,
          u.makeImagePrivate,
          epc.id AS post_id,
          epc.description AS post_description,
          epc.user_id AS post_user_id,
          epc.date AS comment_date,
          uc.username AS comment_user_username,
          uc.id AS comt_uid,
          uc.makeImagePrivate AS comment_makeImagePrivate,
          uc.profile_image AS comment_user_profile_image,
          COUNT(ucf.user_id) AS fav_count,
          MAX(CASE WHEN ucf.user_id = ? THEN 1 ELSE 0 END) AS fav
       FROM event_post ep
       JOIN users u ON ep.user_id = u.id
       LEFT JOIN event_post_comment epc ON ep.id = epc.event_post_id
       LEFT JOIN users uc ON epc.user_id = uc.id
       LEFT JOIN event_post_favourite ucf ON ep.id = ucf.post_id
       WHERE ep.event_id = ?
       GROUP BY ep.id, epc.id, u.id, uc.id
       ORDER BY ep.id DESC;
      `,
      [user_id, event_id], // Pass logged_in_user_id and Group
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // Create an empty array to hold the formatted posts
        const postsArray = [];

        // Create a map to hold each post and its associated comments
        const postsMap = {};

        results.forEach((row) => {
          // If the post does not already exist in the map, create it
          if (!postsMap[row.id]) {
            postsMap[row.id] = {
              id: row.id,
              makeImagePrivate: row.makeImagePrivate,
              user_id: row.user_id,
              group_id: row.event_id,
              file: row.file,
              description: row.description,
              date: row.date,
              username: row.group_user_username, // Use alias for username
              profile_image: row.group_user_profile_image, // Use alias for profile image
              uid: row.uid,
              fav_count: row.fav_count,
              fav: row.fav === 1, // Set 'fav' as true or false depending on the logged-in user's favorite status
              post: [], // Initialize an empty array for comments
            };
            postsArray.push(postsMap[row.id]);
          }

          // If there is a comment, push it to the 'post' array
          if (row.post_id !== null) {
            postsMap[row.id].post.push({
              post_id: row.post_id,
              comment_makeImagePrivate: row.comment_makeImagePrivate,
              comment_user_username: row.comment_user_username,
              comt_uid: row.comt_uid,
              comment_user_profile_image: row.comment_user_profile_image,
              group_id: row.group_id,
              description: row.post_description,
              comment_date: row.comment_date,
              user_id: row.post_user_id,
            });
          }
        });
        //console.log(postsArray);
        // Return the formatted posts array
        res.status(200).json({
          message: "Group posts and comments retrieved successfully",
          results: postsArray,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.getEventPostData = async (req, res) => {
  const { event_id, id } = req.body; // No group_id, only user_id and search
  try {
    let sqlQuery = `SELECT event_post.*, users.username, users.profile_image, IFNULL(MAX(CASE WHEN event_post_favourite.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_favorite, IFNULL(SUM(CASE WHEN event_post_comment.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_comments FROM event_post JOIN users ON users.id = event_post.user_id LEFT JOIN event_post_favourite ON event_post_favourite.post_id = event_post.id LEFT JOIN event_post_comment ON event_post_comment.event_post_id = event_post.id WHERE event_post.id = ? AND event_post.event_id = ? GROUP BY event_post.id, users.id;`;

    db.query(sqlQuery, [id, event_id], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        message: "Retrieved successfully",
        results: results,
      });
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search error", error });
  }
};

exports.getEventpostComment = async (req, res) => {
  const { event_id, id } = req.body; // No group_id, only user_id and search
  try {
    let sqlQuery = `SELECT event_post_comment.*, users.username,users.makeImagePrivate, users.profile_image FROM event_post_comment JOIN users ON users.id = event_post_comment.user_id WHERE event_post_comment.event_post_id = ? AND event_post_comment.event_id = ?;`;

    db.query(sqlQuery, [id, event_id], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        message: "Retrieved successfully",
        results: results,
      });
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search error", error });
  }
};
