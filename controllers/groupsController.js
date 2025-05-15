const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const moment = require("moment-timezone");
const WebSocket = require("ws");
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
exports.getgroup = async (req, res) => {
  const { user_id, orderBy } = req.body;
  try {
    // Ensure user_id and to_id are provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const validOrderDirections = ["ASC", "DESC"];
    const orderDirection = validOrderDirections.includes(req.body.orderBy)
      ? req.body.orderBy
      : "DESC";
    // Query to fetch chat messages between user_id and to_id
    const query = `
  SELECT g.*,
         u.username, u.profile_type, u.gender,
         COUNT(gi.user_id) AS total_members
  FROM \`groups\` g
  JOIN users u ON g.user_id = u.id
  LEFT JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
  WHERE g.user_id = ?
  GROUP BY g.id, u.username, u.profile_type, u.gender
  ORDER BY g.id ${orderDirection};
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
    "SELECT COUNT(*) as count FROM `groups` WHERE slug = ?",
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
            "SELECT COUNT(*) as count FROM `groups` WHERE slug = ?",
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
function EditUniqueSlug(title, groupId, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM `groups` WHERE slug = ? And id !=?",
    [slug, groupId],
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
            "SELECT COUNT(*) as count FROM `groups` WHERE slug = ?",
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

exports.groupsave = async (req, res) => {
  const {
    user_id,
    name,
    makeImageUse,
    description,
    image, // Optional, depending on your needs
  } = req.body;
  const wss = req.wss;
  // Validate required fields
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const groupImage = req.file?.location || null; // For single file upload

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the group name
    createUniqueSlug(name, (err, slug) => {
      console.log(mp);
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "INSERT INTO `groups` (makeImageUse,slug, image, user_id, name, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [mp, slug, groupImage, user_id, name, description, date],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res.status(500).json({
              message: "Database insertion error",
              error: err,
            });
          }
          const idd = result.insertId;
          logActivity(user_id, `created a new group successfully`);
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
              async (err, senderResult) => {
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

                const notificationMessage = `New group create`;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const to_id = user_id;
                var link_href = "/group/" + slug;
                const insertNotificationsPromises = results.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.query(
                      "INSERT INTO notification (to_id, user_id, message, date,link_href) VALUES (?,?, ?, ?,?)",
                      [to_id, item.id, notificationMessage, date, link_href],
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
                      await sendEmailFor_GroupPostNotification(
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
            message: "Group created successfully",
            GroupId: result.insertId,
            user_id: user_id,
            slug: slug, // Return the generated slug
          });
        }
      );

      // Insert the group data including the slug
    });
  } catch (error) {
    console.error("Group creation error:", error); // Log error to console
    res.status(500).json({ message: "Group creation error", error });
  }
};
exports.groupEdit = async (req, res) => {
  const {
    user_id,
    groupId,
    name,
    makeImageUse,
    description,
    image, // Optional, depending on your needs
  } = req.body;
  const wss = req.wss;
  // Validate required fields
  console.log(req.body);
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const group_Image = req.file?.location || null; // For single file upload
  if (group_Image === null) {
    var groupImage = req.body.previewImage;
  } else {
    var groupImage = group_Image;
  }

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the group name
    EditUniqueSlug(name, groupId, (err, slug) => {
      console.log(mp);
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "UPDATE `groups` SET makeImageUse = ?, slug = ?, image = ?, name = ?, description = ?, date = ? WHERE id = ? AND user_id = ?",
        [mp, slug, groupImage, name, description, date, groupId, user_id],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res.status(500).json({
              message: "Database insertion error",
              error: err,
            });
          }
          const idd = result.insertId;
          logActivity(user_id, `edit a group successfully`);
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
              `SELECT * FROM users WHERE id = ?`,
              [user_id],
              async (err, senderResult) => {
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

                const notificationMessage = `Update group by ` + senderUsername;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const to_id = user_id;
                var link_href = "/group/" + slug;
                const insertNotificationsPromises = results.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.query(
                      "INSERT INTO notification (to_id, user_id, message, date,link_href) VALUES (?,?, ?, ?,?)",
                      [to_id, item.id, notificationMessage, date, link_href],
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
                      await sendEmailFor_GroupPostNotificationEdit(
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
            message: "Group updated successfully",
            GroupId: result.insertId,
            user_id: user_id,
            slug: slug, // Return the generated slug
          });
        }
      );

      // Insert the group data including the slug
    });
  } catch (error) {
    console.error("Group creation error:", error); // Log error to console
    res.status(500).json({ message: "Group creation error", error });
  }
};
exports.groupEditfile = async (req, res) => {
  const {
    user_id,
    groupId,
    name,
    makeImageUse,
    description,
    image, // Optional, depending on your needs
  } = req.body;
  const wss = req.wss;
  // Validate required fields
  console.log(req.body);
  if (!user_id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const group_Image = req.file?.location || null; // For single file upload
  if (group_Image === null) {
    var groupImage = req.body.previewImage;
  } else {
    var groupImage = group_Image;
  }

  try {
    // Create Date objects and validate

    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    var mp = req.body.makeImageUse;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the group name
    EditUniqueSlug(name, groupId, (err, slug) => {
      console.log(mp);
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "UPDATE `groups` SET makeImageUse = ?, slug = ?, image = ?, name = ?, description = ?, date = ? WHERE id = ? AND user_id = ?",
        [mp, slug, groupImage, name, description, date, groupId, user_id],
        (err, result) => {
          if (err) {
            console.error("Database insertion error:", err); // Log error to console
            return res.status(500).json({
              message: "Database insertion error",
              error: err,
            });
          }
          const idd = result.insertId;
          logActivity(user_id, `edit a group successfully`);
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
              `SELECT * FROM users WHERE id = ?`,
              [user_id],
              async (err, senderResult) => {
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

                const notificationMessage = `Update group `;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const to_id = user_id;
                var link_href = "/group/" + slug;
                const insertNotificationsPromises = results.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.query(
                      "INSERT INTO notification (to_id, user_id, message, date,link_href) VALUES (?,?, ?, ?,?)",
                      [to_id, item.id, notificationMessage, date, link_href],
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
                      await sendEmailFor_GroupPostNotificationEdit(
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
            message: "Group updated successfully",
            GroupId: result.insertId,
            user_id: user_id,
            slug: slug, // Return the generated slug
          });
        }
      );

      // Insert the group data including the slug
    });
  } catch (error) {
    console.error("Group creation error:", error); // Log error to console
    res.status(500).json({ message: "Group creation error", error });
  }
};
async function sendEmailFor_GroupPostNotificationEdit(
  to,
  senderUsername,
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
    from: "Amourette <amourette.no@gmail.com>",
    to,
    subject: "🎨 Update the group on Amourette!",
    text: `Hello,

Exciting news! A new group titled "${groupName}" has been created by ${senderUsername}.

Join the conversation, explore the latest creations, and share your thoughts.

Best regards,
The Amourette Team`,
    html: `
      <p>Hello,</p>
      <p>Exciting news! A new group titled "<strong>${groupName}</strong>" has been created by <strong>${senderUsername}</strong>.</p>
      <p>Join the conversation, explore the latest creations, and share your thoughts.</p>
      <p>Best regards,<br>The Amourette Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      //  console.error("Error:", error);
      if (callback) callback(error);
    } else {
      //console.log("Email sent:", info.response);
      if (callback) callback(null, info);
    }
  });
}
async function sendEmailFor_GroupPostNotification(to, message, slug, callback) {
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
    subject: "🎨 New Group  on Amourette!",
    text: `Hello,

Exciting news! A new Group  has been shared by ${message}.

Join the conversation, explore the latest creations, and share your thoughts.
Best regards,
The Amourette Team`,
    html: `
      <p>Hello,</p>
      <p>Exciting news! A new event titled "<strong>${slug}</strong>" has been created by <strong>${message}</strong>.</p>
      <p>Join the conversation, explore the latest creations, and share your thoughts.</p>

      <p>Best regards,<br>The Amourette Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      //  console.error("Error:", error);
      if (callback) callback(error);
    } else {
      //console.log("Email sent:", info.response);
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
exports.checkfrdgroup = async (req, res) => {
  const { user_id } = req.body;
  try {
    // Ensure user_id and to_id are provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch chat messages between user_id and to_id
    const query = `
     SELECT
    u.*,
    CASE
        WHEN fr.status = 'Yes' THEN true
        ELSE false
    END AS is_friend,
    CASE
        WHEN bu.user_id IS NOT NULL THEN true
        ELSE false
    END AS is_blocked
FROM
    users u
JOIN
    friendRequest_accept fr
    ON (u.id = fr.sent_to AND fr.user_id = ?)
    OR (u.id = fr.user_id AND fr.sent_to = ?)
LEFT JOIN
    blockuser bu
    ON (u.id = bu.user_id AND bu.to_id = ?)
    OR (u.id = bu.to_id AND bu.user_id = ?)
WHERE
    fr.status = 'Yes'
    AND (
        bu.user_id IS NULL
        AND bu.to_id IS NULL
    )`;

    // Fetching the messages
    db.query(query, [user_id, user_id, user_id, user_id], (err, results) => {
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
exports.getGroupDetailSlug = async (req, res) => {
  const slug = req.body.slug;
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Slug is required." });
  }

  try {
    // Fetch the group for the given group_id
    db.query(
      `SELECT *
      FROM \`groups\`
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
            .json({ message: "Group not found.", group: "" });
        }

        // Return the first Group since we expect only one row
        res.status(200).json({
          message: "Group retrieved successfully.",
          group: results[0], // Return the first Group object
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.UsercheckAccept = async (req, res) => {
  const { slug, user_id } = req.body;
  if (!slug || !user_id) {
    return res.status(400).json({ message: "User ID are required." });
  }
  // console.log(req.body);
  try {
    db.query(
      `SELECT e.id AS group_id, e.name AS group_name,
       e.user_id AS creator_id,
       ei.sent_id AS invited_user_id,
       ei.accept AS invite_status,
       CASE
         WHEN e.user_id = ? THEN 'Created by You'  -- Placeholder for the logged-in user ID
         WHEN ei.accept = 'Yes' THEN 'Invite Accepted'
         ELSE 'Invite Not Accepted'
       END AS group_status
      FROM \`groups\` e
      LEFT JOIN groups_invite ei
        ON e.id = ei.group_id
        AND ei.sent_id = ?  -- Placeholder for the invited user ID
      WHERE (e.user_id = ? OR ei.sent_id = ?)  -- Placeholder for the logged-in user ID
        AND e.slug = ?;  -- Placeholder for the group slug
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
    console.error("group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "group retrieval error", error });
  }
};

exports.userDeleteGroup = async (req, res) => {
  const group_id = req.body.group_id;
  var user_id = req.body.user_id;
  // Validate required fields
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required." });
  }

  try {
    // Check if the Group exists

    db.query(
      `DELETE FROM \`groups\` WHERE id = ?`,
      [group_id],
      (deleteErr, deleteResults) => {
        if (deleteErr) {
          console.error("Error deleting group:", deleteErr);
          return res
            .status(500)
            .json({ message: "Error deleting group", error: deleteErr });
        }

        // Check if any rows were affected
        if (deleteResults.affectedRows === 0) {
          db.query(
            `DELETE FROM groups_invite WHERE group_id = ?`,
            [group_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM groups_intersted WHERE group_id = ?`,
            [group_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM group_post WHERE group_id = ?`,
            [group_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM group_post_comment WHERE group_id = ?`,
            [group_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );
          db.query(
            `DELETE FROM group_post_favourite WHERE group_id = ?`,
            [group_id],
            (deleteErr, deleteResults) => {
              // Check if any rows were affected
            }
          );

          return res
            .status(404)
            .json({ message: "Group not found or already deleted." });
        }
        logActivity(user_id, `deleted a group`);
        res.status(200).json({ message: "Group deleted successfully." });
      }
    );
  } catch (error) {
    console.error("Group deletion error:", error); // Log error to console
    res.status(500).json({ message: "Group deletion error", error });
  }
};

exports.getGroupdetailAllIntersted = async (req, res) => {
  //console.log(req.body);
  const group_id = req.body.group_id;
  const user_id = req.body.user_id;
  const user_ids = req.body.user_ids;
  // Validate required fields
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required." });
  }

  try {
    // Fetch the Group for the given group_id
    db.query(
      `SELECT 
    gi.*, 
    u.username, 
    u.profile_image, 
    u.email,u.id as uid 
FROM groups_invite gi
LEFT JOIN users u ON gi.sent_id = u.id
LEFT JOIN \`groups\` g ON g.id = gi.group_id  -- Get group creator
WHERE gi.group_id = ?  
AND gi.accept = 'Yes'
ORDER BY gi.date DESC;
      `,
      [group_id, user_id, user_id],
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
            .json({ message: "Group not found.", results: "" });
        }

        // Return the first Group since we expect only one row
        res.status(200).json({
          message: "Get group interested successfully.",
          results: results, // Return the first Group object
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};
// exports.getGroupdetailAllIntersted = async (req, res) => {
//   //console.log(req.body);
//   const group_id = req.body.group_id;
//   const user_id = req.body.user_id;
//   // Validate required fields
//   if (!group_id) {
//     return res.status(400).json({ message: "Group ID is required." });
//   }

//   try {
//     // Fetch the Group for the given group_id
//     db.query(
//       `SELECT
//     ei.*,
//     u.username,
//     u.profile_image
// FROM
//     groups_intersted ei
// LEFT JOIN
//     users u ON ei.user_id = u.id
// WHERE
//     ei.group_id = ?
//     AND ei.status = 'Yes';

//       `,
//       [group_id],
//       (err, results) => {
//         if (err) {
//           console.error("Database query error:", err);
//           return res
//             .status(500)
//             .json({ message: "Database query error", error: err });
//         }

//         if (results.length === 0) {
//           return res
//             .status(200)
//             .json({ message: "Group not found.", results: "" });
//         }

//         // Return the first Group since we expect only one row
//         res.status(200).json({
//           message: "Get group interested successfully.",
//           results: results, // Return the first Group object
//         });
//       }
//     );
//   } catch (error) {
//     console.error("Group retrieval error:", error); // Log error to console
//     res.status(500).json({ message: "Group retrieval error", error });
//   }
// };

exports.getallYourgroupsUser = async (req, res) => {
  const user_id = req.body.user_id;
  const group_id = req.body.group_id;

  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all Group for the given user_id

    db.query(
      `SELECT u.*
FROM users u
LEFT JOIN friendRequest_accept fr ON
  (u.id = fr.sent_to AND fr.user_id = ?) OR
  (u.id = fr.user_id AND fr.sent_to = ?)
WHERE u.id NOT IN (
    SELECT user_id FROM groups_invite WHERE group_id = ?
)
AND u.id NOT IN (
    SELECT sent_id FROM groups_invite WHERE group_id = ?
)
AND fr.status = 'Yes'
AND u.id != ?
GROUP BY u.id;
`,
      [user_id, user_id, group_id, group_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "",
          groups: results, // This will include all users excluding user with ID 2
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.sendGroupinvite = async (req, res) => {
  const user_id = req.body.user_id;
  const groupId = req.body.groupId;
  const friendIds = req.body.friendIds;

  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({ message: "Friend IDs are required" });
  }

  try {
    var datee = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Step 1: Insert invitation data into the database
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
              `SELECT * FROM \`groups\` WHERE id = ?;`,
              [groupId],
              (err, groupResult) => {
                if (err) {
                  console.error("Error fetching group name:", err);
                  return reject(err);
                }

                const username = userResult[0]?.username || "Unknown"; // Fallback to "Unknown" if no username is found
                const groupName = groupResult[0]?.name || "Unknown Group"; // Fallback to "Unknown Group" if no group name is found

                // Step 2: Insert into groups_invite table
                db.query(
                  `INSERT INTO groups_invite (sent_id, user_id, group_id, accept, date) VALUES (?, ?, ?, ?, ?)`,
                  [friendId, user_id, groupId, "No", datee], // Assuming "No" as default acceptance status
                  (err, result) => {
                    if (err) {
                      console.error("Insert error:", err);
                      return reject(err);
                    }

                    // Step 3: Insert into notification table
                    const notificationMessage = `You have been invited to join the group ${groupName} by ${username}`;
                    const link_href = "/group/" + groupResult[0]?.slug;

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

    // Step 2: Fetch user details and send email notifications if required
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

          const groupQuery = `SELECT name FROM \`groups\` WHERE id = ?;`;

          db.query(groupQuery, [groupId], (err, groupRow) => {
            if (err) {
              reject({ message: "Database query error", error: err });
            }

            const groupName = groupRow[0]?.name;
            if (!groupName) {
              return reject({ message: "Group name not found." });
            }

            const inviteMessage = `invited a member to the group "${groupName}".`;

            // Check if user has opted to receive group event notifications
            if (user2NotificationGroupEvent === "Yes") {
              // Return a promise for the email sending
              sendEmailFor_GroupInviteNotification(
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

    // Step 3: Wait for all insert and email promises to complete
    await Promise.all(insertPromises);
    await Promise.all(emailPromises);

    res.status(201).json({ message: "Invitations sent successfully." });
  } catch (error) {
    console.error("Error sending invitations:", error);
    res.status(500).json({ message: "Error sending invitations", error });
  }
};

async function sendEmailFor_GroupInviteNotification(
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
    subject: `Invite a group on Amourette`, // Corrected grammar
    text: `Hello,\n\nYou have received a group invitation ${groupName} on Amourette.\n\nMessage: "${message}"\n\nBest regards,\nAmourette Team`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
exports.get__groupDetailSetId = async (req, res) => {
  const slug = req.body.slug;
  //console.log(slug);
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Slug is required." });
  }

  try {
    // Fetch the group for the given group_id
    db.query(
      `SELECT *
      FROM \`groups\`
      WHERE slug = ?`,
      [slug],
      (err, row) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err, group: "" });
        }

        // Return the first Group since we expect only one row
        res.status(200).json({
          message: "Group retrieved successfully.",
          group: row[0], // Return the first Group object
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};
exports.getAllgroup = async (req, res) => {
  const { user_id, orderby } = req.body;
  const orderBy = orderby === true ? "DESC" : "ASC";

  try {
    if (!user_id || !Array.isArray(user_id) || user_id.length === 0) {
      return res.status(400).json({ message: "User ID array is required" });
    }

    const placeholders = user_id.map(() => "?").join(","); // e.g., "?,?,?"
    console.log(user_id);
    const query = `
      SELECT 
          g.*, 
          COALESCE(COUNT(gi.group_id), 0) AS total_members,
          COALESCE(
            (SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u.id, 
                    ',"user_name":"', u.username, 
                    '","user_image":"', IFNULL(u.profile_image, ''), '"}'
                ) SEPARATOR ','
            )
            FROM groups_invite gi2
            JOIN users u ON gi2.sent_id = u.id  
            WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
          ), '[]') AS invited_users
      FROM \`groups\` g
      left JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
      WHERE g.user_id IN (${placeholders})
      GROUP BY g.id
      ORDER BY g.id ${orderBy};
    `;

    db.query(query, user_id, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      results = results.map((group) => ({
        ...group,
        invited_users:
          group.invited_users && group.invited_users !== "[]"
            ? JSON.parse(`[${group.invited_users}]`)
            : [],
      }));

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getAllgroupsearch = async (req, res) => {
  const { user_id, search = "", orderby } = req.body;
  const orderBy = orderby === true ? "DESC" : "ASC";

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const userIdArray = Array.isArray(user_id) ? user_id : [user_id];

    // Generate placeholders for user_id array
    const userIdPlaceholders = userIdArray.map(() => "?").join(", "); // Query to fetch groups with invited users
    const query = `
      SELECT 
          g.*, 
          COALESCE(COUNT(gi.group_id), 0) AS total_members,
          COALESCE(
            (SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u.id, 
                    ',"user_name":"', u.username, 
                    '","user_image":"', IFNULL(u.profile_image, ''), '"}'
                ) SEPARATOR ','
            )
            FROM groups_invite gi2
            JOIN users u ON gi2.sent_id = u.id  
            WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
          ), '[]') AS invited_users
      FROM \`groups\` g
      LEFT JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
      WHERE g.user_id IN (?) AND (g.name LIKE ? OR g.description LIKE ?)
      GROUP BY g.id
      ORDER BY g.id ${orderBy};
    `;

    db.query(query, [user_id, `%${search}%`, `%${search}%`], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Convert `invited_users` JSON string into an array
      results = results.map((group) => ({
        ...group,
        invited_users:
          group.invited_users && group.invited_users !== "[]"
            ? JSON.parse(`[${group.invited_users}]`)
            : [],
      }));

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// exports.DeleteInviteRequest = async (req, res) => {
//   const group_id = req.body.group_id;
//   const user_id = req.body.user_id;
//   console.log(req.body);
//   // Validate required fields
//   if (!group_id) {
//     return res.status(400).json({ message: "Group ID is required." });
//   }

//   try {
//     // Check if the Group exists

//     db.query(
//       `DELETE FROM groups_invite WHERE group_id = ? And sent_id =?`,
//       [group_id, user_id],
//       (deleteErr, deleteResults) => {
//         if (deleteErr) {
//           console.error("Error deleting Group:", deleteErr);
//           return res
//             .status(500)
//             .json({ message: "Error deleting Group", error: deleteErr });
//         }

//         // Check if any rows were affected

//         res.status(200).json({ message: "Group deleted successfully." });
//       }
//     );
//   } catch (error) {
//     console.error("Group deletion error:", error); // Log error to console
//     res.status(500).json({ message: "Group deletion error", error });
//   }
// };
exports.DeleteInviteRequest = async (req, res) => {
  const group_id = req.body.group_id;
  const user_id = req.body.user_id;
  const slug = req.body.slug;

  // Validate required fields
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required." });
  }

  try {
    // Delete the event invite
    db.query(
      `DELETE FROM groups_invite WHERE group_id = ? AND sent_id = ?`,
      [group_id, user_id],
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

              const notificationMessage = ` has canceled the group request`;

              const date = moment
                .tz(new Date(), "Europe/Oslo")
                .format("YYYY-MM-DD HH:mm:ss");
              const link_href = "/group/" + slug;

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
                  if (notificationGroupEvent === "Yes") {
                    // Fetch event details
                    db.query(
                      `SELECT name FROM events WHERE id = ?`,
                      [group_id],
                      (err, eventResult) => {
                        if (err) {
                          return res.status(500).json({
                            message: "Error fetching event data",
                            error: err,
                          });
                        }

                        const eventName =
                          eventResult[0]?.name || "Unknown Event";

                        sendEmailFor_cancelNotification(
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
                      }
                    );
                  } else {
                    return res.status(200).json({
                      message: "Notifications sent successfully without email.",
                    });
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
    subject: `Group Request Canceled on Amourette`, // Subject corrected for cancellation
    text: `Hello,\n\nWe would like to inform you that the group request for "${name}" has been canceled on Amourette.\n\nIf you have any questions or need further assistance, feel free to reach out.\n\nBest regards,\nThe Amourette Team`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent successfully:", info.response);
    }
  });
}
exports.userGroupIntersted = async (req, res) => {
  const { group_id, user_id } = req.body;

  // Validate required fields
  if (!group_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Group ID and User ID are required." });
  }

  try {
    // Check if the entry already exists
    var status = "Yes";
    var date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    db.query(
      `SELECT * FROM groups_intersted WHERE user_id = ? AND group_id = ?`,
      [user_id, group_id],
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
            `DELETE FROM groups_intersted WHERE user_id = ? AND group_id = ?`,
            [user_id, group_id],
            (deleteErr) => {
              if (deleteErr) {
                console.error("Database delete error:", deleteErr);
                return res
                  .status(500)
                  .json({ message: "Database delete error", error: deleteErr });
              }

              res.status(200).json({
                message: "Group interest deleted successfully.",
                status: "2",
              });
            }
          );
        } else {
          // If not exists, insert a new record
          db.query(
            `INSERT INTO groups_intersted (user_id, group_id, status, date) VALUES (?, ?, ?, ?)`,
            [user_id, group_id, status, date],
            (insertErr) => {
              if (insertErr) {
                console.error("Database insert error:", insertErr);
                return res
                  .status(500)
                  .json({ message: "Database insert error", error: insertErr });
              }

              res.status(201).json({
                message: "Group interest created successfully.",
                status: "1",
              });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.get_userGroupIntersted = async (req, res) => {
  const { group_id, user_id } = req.body;
  console.log("int");
  console.log(req.body);
  // Validate required fields
  if (!group_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Group ID and User ID are required." });
  }

  try {
    // Check if the entry already exists

    db.query(
      `SELECT * FROM groups_intersted WHERE user_id = ? AND group_id = ?`,
      [user_id, group_id],
      (err, row) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(201).json({
          message: "Group interested.",
          results: row,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};
async function sendEmailFor_GroupJoinNotification(too, name, callback) {
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
    subject: `You've Joined a Group on Amourette`, // Updated subject for clarity
    text: `Hello,\n\nWe’re excited to inform you that you’ve successfully joined the group "${name}" on Amourette.\n\nBest regards,\nThe Amourette Team`, // Improved message text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
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
    subject: `Group post created by ${byname}`, // Updated subject for clarity
    text: `Hello,\n\nWe’re excited to inform you that a new post has been created in the group "${gname}" by ${byname} on Amourette.\n\nBest regards,\nThe Amourette Team`, // Updated message text
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

exports.groupAccepted = async (req, res) => {
  const group_id = req.body.group_id;
  const user_id = req.body.user_id;
  const slug = req.body.slug;
  const wss = req.wss;

  // Validate required fields
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required." });
  }

  try {
    // Check if the Group exists
    db.query(
      `UPDATE groups_invite SET accept = ? WHERE group_id = ? AND sent_id = ?`,
      ["Yes", group_id, user_id],
      (updateErr, updateResults) => {
        if (updateErr) {
          console.error("Error updating group invite:", updateErr);
          return res
            .status(500)
            .json({ message: "Error updating group invite", error: updateErr });
        }

        // Check if any rows were affected
        if (updateResults.affectedRows === 0) {
          return res
            .status(404)
            .json({ message: "No invite found to update." });
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
            fr.status = 'Yes';`;

        // Fetching the users who are affected
        db.query(query, [user_id, user_id], (err, results) => {
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
            (err, senderResult) => {
              if (err) {
                return res.status(500).json({
                  message: "Error fetching user data for sender",
                  error: err,
                });
              }

              const senderUsername =
                senderResult[0]?.username || "Unknown User";
              const senderEmail =
                senderResult[0]?.email || "no-reply@example.com";
              const notificationGroupEvent =
                senderResult[0]?.notification_group_event;

              const notificationMessage = ` joined the group`;
              const date = moment
                .tz(new Date(), "Europe/Oslo")
                .format("YYYY-MM-DD HH:mm:ss");
              const link_href = "/group/" + slug;

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

              // After all notifications are inserted
              Promise.all(insertNotificationsPromises)
                .then(() => {
                  if (notificationGroupEvent === "Yes") {
                    // Fetch group details if email notification is enabled
                    db.query(
                      `SELECT name FROM \`groups\` WHERE id = ?`,
                      [group_id], // Fetch the group name
                      (err, groupResult) => {
                        if (err) {
                          return res.status(500).json({
                            message: "Error fetching group data",
                            error: err,
                          });
                        }

                        const groupName =
                          groupResult[0]?.name || "Unknown Group";

                        // Ensure that the email sending is awaited
                        sendEmailFor_GroupJoinNotification(
                          senderEmail,
                          groupName,
                          (info) => {
                            return res.status(200).json({
                              message: "Notifications sent successfully.",
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
                    // If no email notification is required, send success response
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
    console.error("Group accepted error:", error);
    return res.status(500).json({ message: "Group accepted error", error });
  }
};

exports.createGroupPost = async (req, res) => {
  const { group_id, user_id, description } = req.body;
  // Validate required fields
  if (!group_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Group ID and User ID are required." });
  }
  const groupImage = req.file?.location || null; // For single file upload
  //console.log(Group);
  try {
    var date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");
    db.query(
      `INSERT INTO group_post (user_id, group_id, file,description, date) VALUES (?, ?, ?, ?, ?)`,
      [user_id, group_id, groupImage, description, date],
      (insertErr) => {
        if (insertErr) {
          console.error("Database insert error:", insertErr);
          return res
            .status(500)
            .json({ message: "Database insert error", error: insertErr });
        }
        const query = `SELECT * from \`groups\` where id = ?;`;

        // Fetching the messages
        db.query(query, [group_id], (err, row) => {
          if (err) {
            return res.status(500).json({
              message: "Database query error",
              error: err,
            });
          }
          var gname = row[0].name;
          var slug = row[0].slug;
          logActivity(user_id, ` uploaded a post to the group ` + gname);
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
                  ` uploaded a post to the group ` + gname;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                const link_href = "/group/" + slug;

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
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.get_postComment = async (req, res) => {
  const group_id = req.body.group_id;
  const user_id = req.body.user_id;
  //console.log(req.body);
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required" });
  }

  try {
    // Fetch all Group for the given group_id and logged_in_user_id
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
       FROM group_post ep
       JOIN users u ON ep.user_id = u.id
       LEFT JOIN group_post_comment epc ON ep.id = epc.group_post_id
       LEFT JOIN users uc ON epc.user_id = uc.id
       LEFT JOIN group_post_favourite ucf ON ep.id = ucf.post_id
       WHERE ep.group_id = ?
       GROUP BY ep.id, epc.id, u.id, uc.id
       ORDER BY ep.id DESC;
      `,
      [user_id, group_id], // Pass logged_in_user_id and Group
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
              group_id: row.group_id,
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

exports.CreateGroupPostComment = async (req, res) => {
  const { group_id, user_id, comment, post_id } = req.body;
  const wss = req.wss;

  // Validate required fields
  if (!group_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Group ID and User ID are required." });
  }

  try {
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Insert comment into the database
    db.query(
      `INSERT INTO group_post_comment (group_post_id, user_id, group_id, description, date) VALUES (?, ?, ?, ?, ?)`,
      [post_id, user_id, group_id, comment, date],
      (insertErr, results) => {
        if (insertErr) {
          console.error("Database insert error:", insertErr);
          return res
            .status(500)
            .json({ message: "Database insert error", error: insertErr });
        }

        const latestCommentId = results.insertId; // Get the latest inserted comment ID

        // Get the comment details along with user info
        db.query(
          `SELECT group_post_comment.*, users.username, users.profile_image
           FROM group_post_comment
           JOIN users ON users.id = group_post_comment.user_id
           WHERE group_post_comment.id = ?`,
          [latestCommentId],
          (err, row) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Database query error", error: err });
            }

            const rr = row[0];
            const broadcastMessage = JSON.stringify({
              event: "groupComments",
              post_id: post_id,
              post: {
                post_id: latestCommentId,
                comment_user_username: rr.username,
                comment_user_profile_image: rr.profile_image,
                group_id: group_id,
                description: comment,
                comment_date: rr.date,
                user_id: user_id,
              },
            });

            // Send the broadcast message to all clients
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }

            logActivity(user_id, `commented on the group post`);

            // Retrieve the group details
            db.query(
              `SELECT * FROM \`groups\` WHERE id = ?`,
              [group_id],
              (err, row) => {
                if (err) {
                  return res
                    .status(500)
                    .json({ message: "Database query error", error: err });
                }

                const gname = row[0].name;
                const slug = row[0].slug;
                logActivity(user_id, `commented a post in the group ${gname}`);

                // Retrieve the friend requests
                db.query(
                  `SELECT u.*,
                          CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
                   FROM users u
                   JOIN friendRequest_accept fr ON
                   (u.id = fr.sent_to AND fr.user_id = ?) OR
                   (u.id = fr.user_id AND fr.sent_to = ?)
                   WHERE fr.status = 'Yes'`,
                  [user_id, user_id],
                  (err, results) => {
                    if (err) {
                      return res
                        .status(500)
                        .json({ message: "Database query error", error: err });
                    }
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
                        const senderUsername = senderResult[0].username;
                        const notificationMessage = `commented a post in the group ${gname}`;
                        const date = moment
                          .tz(new Date(), "Europe/Oslo")
                          .format("YYYY-MM-DD HH:mm:ss");
                        const link_href = `/group/${slug}`;

                        // Insert notifications for each user
                        results.forEach((item) => {
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
                              }
                            }
                          );
                          sendEmailFor_groupcommentNotification(
                            gname,
                            item.email,
                            item.username,
                            senderUsername
                          );
                        });
                      }
                    );

                    res.status(200).json({
                      message: "Event Favourite post added successfully.",
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
    console.error("Group retrieval error:", error);
    res.status(500).json({ message: "Group retrieval error", error });
  }
};
exports.CreateGroupPostCommentDashboard = async (req, res) => {
  const { user_id, comment, post_id } = req.body;
  const wss = req.wss;
  console.log(req.body);
  // Validate required fields
  if (!post_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Group ID and User ID are required." });
  }

  try {
    const date = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Insert comment into the database
    db.query(
      `SELECT * FROM  group_post WHERE id = ?`,
      [post_id],
      (err, row) => {
        const group_id = row[0].group_id;
        db.query(
          `INSERT INTO group_post_comment (group_post_id, user_id, group_id, description, date) VALUES (?, ?, ?, ?, ?)`,
          [post_id, user_id, group_id, comment, date],
          (insertErr, results) => {
            if (insertErr) {
              console.error("Database insert error:", insertErr);
              return res
                .status(500)
                .json({ message: "Database insert error", error: insertErr });
            }

            const latestCommentId = results.insertId; // Get the latest inserted comment ID

            // Get the comment details along with user info
            db.query(
              `SELECT group_post_comment.*, users.username, users.profile_image
           FROM group_post_comment
           JOIN users ON users.id = group_post_comment.user_id
           WHERE group_post_comment.id = ?`,
              [latestCommentId],
              (err, row) => {
                if (err) {
                  return res
                    .status(500)
                    .json({ message: "Database query error", error: err });
                }

                const rr = row[0];
                const broadcastMessage = JSON.stringify({
                  event: "groupComments",
                  post_id: post_id,
                  post: {
                    post_id: latestCommentId,
                    comment_user_username: rr.username,
                    comment_user_profile_image: rr.profile_image,
                    group_id: group_id,
                    description: comment,
                    comment_date: rr.date,
                    user_id: user_id,
                  },
                });

                // Send the broadcast message to all clients
                if (wss) {
                  wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(broadcastMessage);
                    }
                  });
                }

                logActivity(user_id, `commented on the group post`);

                // Retrieve the group details
                db.query(
                  `SELECT * FROM \`groups\` WHERE id = ?`,
                  [group_id],
                  (err, row) => {
                    if (err) {
                      return res
                        .status(500)
                        .json({ message: "Database query error", error: err });
                    }

                    const gname = row[0].name;
                    const slug = row[0].slug;
                    logActivity(
                      user_id,
                      `commented a post in the group ${gname}`
                    );

                    // Retrieve the friend requests
                    db.query(
                      `SELECT u.*,
                          CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
                   FROM users u
                   JOIN friendRequest_accept fr ON
                   (u.id = fr.sent_to AND fr.user_id = ?) OR
                   (u.id = fr.user_id AND fr.sent_to = ?)
                   WHERE fr.status = 'Yes'`,
                      [user_id, user_id],
                      (err, results) => {
                        if (err) {
                          return res.status(500).json({
                            message: "Database query error",
                            error: err,
                          });
                        }
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
                            const senderUsername = senderResult[0].username;
                            const notificationMessage = `commented a post in the group ${gname}`;
                            const date = moment
                              .tz(new Date(), "Europe/Oslo")
                              .format("YYYY-MM-DD HH:mm:ss");
                            const link_href = `/group/${slug}`;

                            // Insert notifications for each user
                            results.forEach((item) => {
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
                                    console.error(
                                      "Database insertion error:",
                                      err
                                    );
                                  }
                                }
                              );
                              sendEmailFor_groupcommentNotification(
                                gname,
                                item.email,
                                item.username,
                                senderUsername
                              );
                            });
                          }
                        );

                        res.status(200).json({
                          message: "Event Favourite post added successfully.",
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error);
    res.status(500).json({ message: "Group retrieval error", error });
  }
};
exports.GrouppostFavourite = async (req, res) => {
  const { group_id, user_id, post_id } = req.body;
  const wss = req.wss;
  const date = moment
    .tz(new Date(), "Europe/Oslo")
    .format("YYYY-MM-DD HH:mm:ss");

  // Validate required fields
  if (!group_id || !user_id || !post_id) {
    return res
      .status(400)
      .json({ message: "Group ID, User ID, and Post ID are required." });
  }

  try {
    // Check if the entry already exists
    db.query(
      `SELECT * FROM group_post_favourite WHERE user_id = ? AND group_id = ? AND post_id = ?`,
      [user_id, group_id, post_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // Function to handle notifications and broadcasting
        const sendNotificationsAndBroadcast = (event, messageData) => {
          const broadcastMessage = JSON.stringify({ event, ...messageData });
          // Send broadcast message to WebSocket clients
          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
        };

        // Handle deletion of favourite post
        if (results.length > 0) {
          db.query(
            `DELETE FROM group_post_favourite WHERE user_id = ? AND group_id = ? AND post_id = ?`,
            [user_id, group_id, post_id],
            (deleteErr) => {
              if (deleteErr) {
                console.error("Database delete error:", deleteErr);
                return res
                  .status(500)
                  .json({ message: "Database delete error", error: deleteErr });
              }

              sendNotificationsAndBroadcast("groupfav", { post_id });

              // Fetch group info for logging
              db.query(
                `SELECT * FROM \`groups\` WHERE id = ?`,
                [group_id],
                (err, row) => {
                  if (err) {
                    return res
                      .status(500)
                      .json({ message: "Database query error", error: err });
                  }
                  logActivity(
                    user_id,
                    `disliked a post in the group ${row[0].name}`
                  );
                }
              );

              return res.status(200).json({
                message: "Event Favourite post deleted successfully.",
                status: "2",
              });
            }
          );
        } else {
          // If not exists, insert a new record
          db.query(
            `INSERT INTO group_post_favourite (post_id, user_id, group_id, fav, date) VALUES (?, ?, ?, ?, ?)`,
            [post_id, user_id, group_id, "Like", date],
            (insertErr) => {
              if (insertErr) {
                console.error("Database insert error:", insertErr);
                return res
                  .status(500)
                  .json({ message: "Database insert error", error: insertErr });
              }

              sendNotificationsAndBroadcast("groupfav", { post_id });

              // Fetch group info for logging
              db.query(
                `SELECT * FROM \`groups\` WHERE id = ?`,
                [group_id],
                (err, row) => {
                  if (err) {
                    return res
                      .status(500)
                      .json({ message: "Database query error", error: err });
                  }
                  const gname = row[0].name;
                  const slug = row[0].slug;
                  logActivity(user_id, `liked a post in the group ${gname}`);

                  // Handle friend request notifications
                  db.query(
                    `SELECT u.*,
    CASE WHEN fr.status = 'Yes' THEN true ELSE false END AS is_friend
   FROM users u
   JOIN friendRequest_accept fr ON
   (u.id = fr.sent_to AND fr.user_id = ?) OR
   (u.id = fr.user_id AND fr.sent_to = ?)
   WHERE fr.status = 'Yes'`,
                    [user_id, user_id],
                    (err, results) => {
                      if (err) {
                        return res.status(500).json({
                          message: "Database query error",
                          error: err,
                        });
                      }

                      const notificationMessage = `liked a post in the group ${gname}`;
                      const date = moment
                        .tz(new Date(), "Europe/Oslo")
                        .format("YYYY-MM-DD HH:mm:ss");
                      const link_href = `/group/${slug}`;

                      // Fetch the username and email of the user who sent the request
                      db.query(
                        `SELECT username, email, notification_group_event FROM users WHERE id = ?`,
                        [user_id],
                        async (err, senderResult) => {
                          if (err) {
                            return res.status(500).json({
                              message: "Error fetching user data for sender",
                              error: err,
                            });
                          }

                          const senderUsername = senderResult[0].username;

                          // Insert notifications for each user
                          const insertNotificationsPromises = results.map(
                            (item) => {
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
                                      console.error(
                                        "Database insertion error:",
                                        err
                                      );
                                      reject(err);
                                    } else {
                                      resolve(result);
                                    }
                                  }
                                );
                              });
                            }
                          );

                          Promise.all(insertNotificationsPromises)
                            .then(() => {
                              res.status(200).json({
                                message:
                                  "Event Favourite post added successfully.",
                              });
                            })
                            .catch((error) => {
                              console.error(
                                "Error sending notifications:",
                                error
                              );
                              res.status(500).json({
                                message: "Error sending notifications",
                                error,
                              });
                            });

                          // Send email notifications
                          results.forEach((item) => {
                            if (item.notification_group_event === "Yes") {
                              sendEmailFor_postLikeCreateNotification(
                                gname,
                                item.email,
                                item.username,
                                senderUsername
                              );
                            }
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error);
    res.status(500).json({ message: "Group retrieval error", error });
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

  const message = `A post in the group "${gname}" was liked by ${fromby}`;

  const mailOptions = {
    from: "Amourette <amourette.no@gmail.com>",
    to: to,
    subject: `Group post liked by ${fromby} on Amourette!`,
    text: `Hello,\n\nExciting news! A post in the group "${gname}" has been liked by ${fromby}.\n\nJoin the conversation, explore the latest creations, and share your thoughts.\n\nBest regards,\nThe Amourette Team`,
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
async function sendEmailFor_groupcommentNotification(
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

  const message = `A post in the group "${gname}" was commented by ${fromby}`;

  const mailOptions = {
    from: "Amourette <amourette.no@gmail.com>",
    to: to,
    subject: `Group post commented by ${fromby} on Amourette!`,
    text: `Hello ${name},\n\nExciting news! A post in the group "${gname}" has been commented by ${fromby}.\n\nBest regards,\nThe Amourette Team`,
    html: `
      <p>Hello ${name},</p>
      <p>Exciting news! A post in the group "<strong>${gname}</strong>" has been commented by <strong>${fromby}</strong>.</p>
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

// controllers/groupsController.js
exports.get_AllMygroup = async (req, res) => {
  const { user_id } = req.body; // Destructure user_id from req.body
  console.log(user_id);

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch groups that the user is part of
    db.query(
      `SELECT * FROM \`groups\` WHERE user_id = ? ORDER BY id DESC;`,
      [user_id],
      (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Sending the group data in the response
        res.status(200).json({
          message: "",
          result: results,
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getmostpopularGroups = async (req, res) => {
  const { user_id, orderby, search } = req.body; // Destructure user_id from req.body
  const orderBy = orderby === true ? "DESC" : "ASC";
  console.log(orderBy);
  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const userIdArray = Array.isArray(user_id) ? user_id : [user_id];
    // Query to fetch groups that the user is part of
    db.query(
      `SELECT
            g.id AS group_id,
            g.slug,
            g.name,
            g.description,
            g.image,
            g.user_id,
            COUNT(gi.group_id) AS total_accepted_invites
        FROM
            \`groups\` g
        JOIN
            groups_invite gi ON g.id = gi.group_id
        WHERE
            gi.accept = 'Yes'
            AND g.user_id IN (?) AND (g.name LIKE ? OR g.description LIKE ?)
        GROUP BY
            g.id, g.slug, g.name, g.description, g.image, g.user_id
        ORDER BY
           total_accepted_invites  Desc
        LIMIT 10;
`,
      [userIdArray, `%${search}%`, `%${search}%`],
      (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Sending the group data in the response
        res.status(200).json({
          message: "",
          result: results,
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getinviteUserGroup = async (req, res) => {
  const { user_id } = req.body; // Extract user_id from request body

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // SQL query to fetch invited groups
    const query = `
      SELECT 
    e.id AS group_id, 
    e.name AS group_name, 
    e.user_id AS creator_id, 
    u.profile_image AS creator_profile_image, 
    u.username AS creator_username, 
    u.slug AS creator_slug, 
    ei.sent_id AS invited_user_id,  -- Single invited user ID
    ei.accept AS invite_status,  -- Single invite status
    u_invited.profile_image AS invited_profile_image,  -- Single invited profile image
    u_invited.username AS invited_username,  -- Single invited username
    CASE 
        WHEN e.user_id = ? THEN 'Created by You'
        WHEN ei.accept = 'No' THEN 'Invite Not Accepted'
        ELSE 'Invite Accepted'
    END AS group_status
FROM \`groups\` e
LEFT JOIN groups_invite ei 
    ON e.id = ei.group_id AND ei.sent_id = ? -- Ensure only one invited user
LEFT JOIN users u 
    ON e.user_id = u.id  -- Group creator details
LEFT JOIN users u_invited 
    ON ei.sent_id = u_invited.id  -- Invited user's details
WHERE EXISTS (
    SELECT 1 FROM groups_invite ei_sub 
    WHERE ei_sub.group_id = e.id 
    AND ei_sub.sent_id = ?
    LIMIT 1 -- Ensuring only one record per sent_id
)
GROUP BY e.id, e.name, e.user_id, u.profile_image, u.username, u.slug, ei.sent_id, ei.accept, u_invited.profile_image, u_invited.username
LIMIT 1; -- Ensuring only one record is returned



    `;

    // Execute the query
    db.query(query, [user_id, user_id, user_id], (err, results) => {
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

exports.getgroupSearch = async (req, res) => {
  const { user_id, search, orderBy } = req.body;
  console.log(req.body);
  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Prepare the search term for SQL query
    const searchTerm = `%${search}%`;

    // Query to fetch groups with search functionality and invited users
    const query = `
      SELECT 
          g.*, 
          u.username, u.profile_type, u.gender,
          COUNT(gi.user_id) AS total_members,
          COALESCE(
            (SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u2.id, 
                    ',"user_name":"', u2.username, 
                    '","user_image":"', IFNULL(u2.profile_image, ''), '"}'
                ) SEPARATOR ','
            )
            FROM groups_invite gi2
            JOIN users u2 ON gi2.sent_id = u2.id  
            WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
          ), '[]') AS invited_users
      FROM \`groups\` g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
      WHERE g.user_id = ?
      AND (g.name LIKE ? OR g.description LIKE ? OR g.slug LIKE ?)
      GROUP BY g.id, u.username, u.profile_type, u.gender
      ORDER BY g.id ${orderBy};
    `;

    // Fetching the groups based on user_id and search criteria
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

        // Convert `invited_users` JSON string into an array
        results = results.map((group) => ({
          ...group,
          invited_users:
            group.invited_users && group.invited_users !== "[]"
              ? JSON.parse(`[${group.invited_users}]`)
              : [],
        }));

        // Sending the groups in the response
        return res.status(200).json({ results });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getgroup_s = async (req, res) => {
  const { user_id } = req.body;
  console.log(user_id);
  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch groups that the user is part of
    db.query(
      `SELECT *
          FROM \`groups\`
          where user_id=?
          ORDER BY id DESC;

      `,
      [user_id],
      (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Sending the group data in the response
        return res.status(200).json({ results });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getgroupdiscover = async (req, res) => {
  const { user_ids, user_id, orderBy } = req.body;
  const oby = orderBy === true ? "DESC" : "ASC";

  if (!Array.isArray(user_ids) || user_ids.length === 0 || !user_id) {
    return res
      .status(400)
      .json({ message: "user_ids must be an array and user_id is required" });
  }

  try {
    const query = `
      SELECT 
          g.*, 
          COUNT(gi.group_id) AS total_members,
          COALESCE(
            (
              SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u.id, 
                    ',"user_name":"', u.username, 
                    '","user_image":"', IFNULL(u.profile_image, ''), '"}'
                ) SEPARATOR ','
              )
              FROM groups_invite gi2
              JOIN users u ON gi2.sent_id = u.id 
              WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
            ), 
            '[]'
          ) AS invited_users
      FROM \`groups\` g
      LEFT JOIN groups_invite gi ON gi.group_id = g.id
      WHERE 
        g.user_id IN (?) AND
        g.user_id != ? AND
        g.id NOT IN (
          SELECT group_id 
          FROM groups_invite 
          WHERE sent_id = ?
        )
      GROUP BY g.id
      ORDER BY g.id ${oby}
      LIMIT 0, 25;
    `;

    db.query(query, [user_ids, user_id, user_id], (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      results = results.map((group) => ({
        ...group,
        invited_users:
          group.invited_users && group.invited_users !== "[]"
            ? JSON.parse(`[${group.invited_users}]`)
            : [],
      }));

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getgroupdiscoveryour = async (req, res) => {
  const { user_id, orderBy } = req.body;
  const oby = orderBy === true ? "DESC" : "ASC";

  try {
    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch groups with invited users (Workaround using GROUP_CONCAT)
    const query = `
      SELECT 
          g.*, 
          COUNT(gi.group_id) AS total_members,
          COALESCE(
            (SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u.id, 
                    ',"user_name":"', u.username, 
                    '","user_image":"', IFNULL(u.profile_image, ''), '"}'
                ) SEPARATOR ','
            )
            FROM groups_invite gi2
            JOIN users u ON gi2.sent_id = u.id  -- ✅ Corrected this line
            WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
          ), '[]') AS invited_users
      FROM \`groups\` g
      JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
      WHERE g.user_id =?
      GROUP BY g.id
      ORDER BY g.id ${oby}
      LIMIT 0, 25;
    `;

    db.query(query, [user_id], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Convert GROUP_CONCAT JSON string into an actual array
      results = results.map((group) => ({
        ...group,
        invited_users:
          group.invited_users && group.invited_users !== "[]"
            ? JSON.parse(`[${group.invited_users}]`)
            : [],
      }));

      return res.status(200).json({ results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.grouppostDelete = (req, res) => {
  const { id, user_id } = req.body;

  try {
    // Ensure both id and user_id are provided
    if (!id || !user_id) {
      return res
        .status(400)
        .json({ message: "Both ID and User ID are required" });
    }

    // Fetch the group ID and group name before deleting the post
    db.query(
      `SELECT gp.group_id, g.name AS group_name
       FROM group_post gp
       JOIN \`groups\` g ON gp.group_id = g.id
       WHERE gp.id = ?`,
      [id],
      (fetchErr, results) => {
        if (fetchErr) {
          return res.status(500).json({
            message: "Error fetching group details",
            error: fetchErr,
          });
        }

        // Check if post exists
        if (!results || results.length === 0) {
          return res.status(404).json({ message: "Group post not found" });
        }

        const { group_id, group_name } = results[0];

        // Delete from the group_post table
        db.query(
          `DELETE FROM group_post WHERE id = ? AND user_id = ?`,
          [id, user_id],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                message: "Database query error",
                error: err,
              });
            }

            // Check if a record was deleted
            if (result.affectedRows === 0) {
              return res
                .status(404)
                .json({ message: "No group post record found to delete" });
            }

            // Delete related comments
            db.query(
              `DELETE FROM group_post_comment WHERE group_post_id = ? AND user_id = ?`,
              [id, user_id],
              (commentErr) => {
                if (commentErr) {
                  return res.status(500).json({
                    message: "Error deleting comments",
                    error: commentErr,
                  });
                }

                // Delete related favourites
                db.query(
                  `DELETE FROM group_post_favourite WHERE post_id = ? AND user_id = ?`,
                  [id, user_id],
                  (favouriteErr) => {
                    if (favouriteErr) {
                      return res.status(500).json({
                        message: "Error deleting favourites",
                        error: favouriteErr,
                      });
                    }

                    // Log activity with group name
                    logActivity(
                      user_id,
                      `A post in the group "${group_name}" has been deleted.`
                    );

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

exports.get_postCommentSearch = async (req, res) => {
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
        gg.id AS group_id,
        gg.slug AS groupslug,
        gg.name AS gname,
        gg.description AS gdescription,
        gg.image AS gimage,
        gg.date as group_date,
        u.username AS group_owner_username,
        u.id AS uid,
        u.profile_image AS group_owner_profile_image,
        u.makeImagePrivate,
        COUNT(DISTINCT ep.id) AS total_posts,
        COUNT(DISTINCT epc.id) AS total_comments,
        COUNT(DISTINCT ucf.id) AS total_likes

    FROM \`groups\` gg
    JOIN users u ON gg.user_id = u.id  -- Get group owner details
    LEFT JOIN group_post ep ON gg.id = ep.group_id  -- Get posts in the group
    LEFT JOIN group_post_comment epc ON ep.id = epc.group_post_id  -- Get comments on posts
    LEFT JOIN group_post_favourite ucf ON ep.id = ucf.post_id  -- Get likes on posts

    WHERE
        gg.user_id IN (${userPlaceholders})  -- Dynamically generate placeholders
        AND (
            LOWER(COALESCE(epc.description, '')) LIKE ? OR
            LOWER(COALESCE(u.username, '')) LIKE ? OR
            LOWER(COALESCE(ep.description, '')) LIKE ? OR
            LOWER(COALESCE(gg.name, '')) LIKE ? OR
            LOWER(COALESCE(gg.description, '')) LIKE ?
        )

    GROUP BY gg.id, u.id
    ORDER BY gg.id DESC;`;

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
        message: "Filtered group posts and comments retrieved successfully",
        results,
      });
    });
  } catch (error) {
    console.error("Group retrieval error:", error);
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.get_postCommentGroupSearch = async (req, res) => {
  const { user_id, search } = req.body; // No group_id, only user_id and search

  try {
    const searchTerm = `%${search}%`; // Prepare search term for SQL LIKE operator

    let sqlQuery = `
      SELECT
          ep.*,
          u.username AS group_user_username,
          u.profile_image AS group_user_profile_image,
          u.makeImagePrivate,
          epc.id AS post_id,
          epc.description AS post_description,
          epc.user_id AS post_user_id,
          epc.date AS comment_date,
          uc.username AS comment_user_username,
          uc.makeImagePrivate AS comment_makeImagePrivate,
          uc.profile_image AS comment_user_profile_image,
          COUNT(ucf.user_id) AS fav_count,
          MAX(CASE WHEN ucf.user_id = ? THEN 1 ELSE 0 END) AS fav
      FROM group_post ep
      JOIN users u ON ep.user_id = u.id
      LEFT JOIN group_post_comment epc ON ep.id = epc.group_post_id
      LEFT JOIN users uc ON epc.user_id = uc.id
      LEFT JOIN group_post_favourite ucf ON ep.id = ucf.post_id
      WHERE (ep.description LIKE ? OR epc.description LIKE ?) -- Search condition
      GROUP BY ep.id, epc.id, u.id, uc.id
      ORDER BY ep.id DESC;
    `;

    db.query(sqlQuery, [user_id, searchTerm, searchTerm], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      const postsArray = [];
      const postsMap = {};

      results.forEach((row) => {
        if (!postsMap[row.id]) {
          postsMap[row.id] = {
            id: row.id,
            makeImagePrivate: row.makeImagePrivate,
            user_id: row.user_id,
            file: row.file,
            description: row.description,
            date: row.date,
            username: row.group_user_username,
            profile_image: row.group_user_profile_image,
            fav_count: row.fav_count,
            fav: row.fav === 1,
            post: [],
          };
          postsArray.push(postsMap[row.id]);
        }

        if (row.post_id !== null) {
          postsMap[row.id].post.push({
            post_id: row.post_id,
            comment_makeImagePrivate: row.comment_makeImagePrivate,
            comment_user_username: row.comment_user_username,
            comment_user_profile_image: row.comment_user_profile_image,
            description: row.post_description,
            comment_date: row.comment_date,
            user_id: row.post_user_id,
          });
        }
      });

      res.status(200).json({
        message: "Search results retrieved successfully",
        results: postsArray,
      });
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search error", error });
  }
};

exports.getGroupPostData = async (req, res) => {
  const { group_id, id } = req.body; // No group_id, only user_id and search
  try {
    let sqlQuery = `SELECT group_post.*, users.username, users.profile_image, IFNULL(MAX(CASE WHEN group_post_favourite.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_favorite, IFNULL(SUM(CASE WHEN group_post_comment.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_comments FROM group_post JOIN users ON users.id = group_post.user_id LEFT JOIN group_post_favourite ON group_post_favourite.post_id = group_post.id LEFT JOIN group_post_comment ON group_post_comment.group_post_id = group_post.id WHERE group_post.id = ? AND group_post.group_id = ? GROUP BY group_post.id, users.id;`;

    db.query(sqlQuery, [id, group_id], (err, results) => {
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

exports.getGrouppostComment = async (req, res) => {
  const { group_id, id } = req.body; // No group_id, only user_id and search
  try {
    let sqlQuery = `SELECT group_post_comment.*, users.username,users.makeImagePrivate, users.profile_image FROM group_post_comment JOIN users ON users.id = group_post_comment.user_id WHERE group_post_comment.group_post_id = ? AND group_post_comment.group_id = ?;`;

    db.query(sqlQuery, [id, group_id], (err, results) => {
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

exports.getAllgroupFilter = async (req, res) => {
  const { user_id, search_by } = req.body;
  var orderBy = "";
  var ord = "";
  if (search_by === "Newest_first") {
    var orderBy = "Desc";
    var ord = `ORDER BY g.id ${orderBy}`;
  }
  if (search_by === "Oldest_first") {
    var orderBy = "Asc";
    var ord = `ORDER BY g.id ${orderBy}`;
  }

  if (search_by === "Alphabetical") {
    var orderBy = "Asc";
    var ord = `ORDER BY g.name ${orderBy}`;
  }
  if (search_by === "Most_active") {
    try {
      // Ensure user_id is provided
      if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const userIdArray = Array.isArray(user_id) ? user_id : [user_id];

      // Generate placeholders for user_id array
      const userIdPlaceholders = userIdArray.map(() => "?").join(", "); // Query to fetch groups with invited users

      const query = `
  SELECT 
    g.*, 
    COUNT(gpc.id) AS total_comments,
    COALESCE(
      (
        SELECT GROUP_CONCAT(
          CONCAT(
            '{"user_id":', u.id, 
            ',"user_name":"', u.username, 
            '","user_image":"', IFNULL(u.profile_image, ''), '"}'
          ) SEPARATOR ','
        )
        FROM groups_invite gi2
        JOIN users u ON gi2.sent_id = u.id  
        WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
      ), '[]'
    ) AS invited_users
  FROM \`groups\` g
  LEFT JOIN group_post_comment gpc ON g.id = gpc.group_id
  WHERE g.user_id IN (?)
  GROUP BY g.id
  ORDER BY total_comments DESC;
`;

      db.query(query, [user_id], (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Convert `invited_users` JSON string into an array
        results = results.map((group) => ({
          ...group,
          invited_users:
            group.invited_users && group.invited_users !== "[]"
              ? JSON.parse(`[${group.invited_users}]`)
              : [],
        }));

        return res.status(200).json({ results });
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error });
    }
  } else {
    try {
      // Ensure user_id is provided
      if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const userIdArray = Array.isArray(user_id) ? user_id : [user_id];

      // Generate placeholders for user_id array
      const userIdPlaceholders = userIdArray.map(() => "?").join(", "); // Query to fetch groups with invited users
      const query = `
      SELECT 
          g.*, 
          COALESCE(COUNT(gi.group_id), 0) AS total_members,
          COALESCE(
            (SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u.id, 
                    ',"user_name":"', u.username, 
                    '","user_image":"', IFNULL(u.profile_image, ''), '"}'
                ) SEPARATOR ','
            )
            FROM groups_invite gi2
            JOIN users u ON gi2.sent_id = u.id  
            WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
          ), '[]') AS invited_users
      FROM \`groups\` g
      LEFT JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
      WHERE g.user_id IN (?)
      GROUP BY g.id
      ${ord};
    `;

      db.query(query, [user_id], (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Convert `invited_users` JSON string into an array
        results = results.map((group) => ({
          ...group,
          invited_users:
            group.invited_users && group.invited_users !== "[]"
              ? JSON.parse(`[${group.invited_users}]`)
              : [],
        }));

        return res.status(200).json({ results });
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error });
    }
  }
};

exports.getAllgroupMostpopular = async (req, res) => {
  const { user_id } = req.body; // Destructure user_id from req.body

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userIdArray = Array.isArray(user_id) ? user_id : [user_id];

    const query = `
  SELECT 
    g.id,
    g.date,
    g.slug,
    g.name,
    g.description,
    g.image,
    g.user_id,
    COUNT(gi.group_id) AS total_members,
    COALESCE(
      (
        SELECT GROUP_CONCAT(
          CONCAT(
            '{"user_id":', u.id, 
            ',"user_name":"', u.username, 
            '","user_image":"', IFNULL(u.profile_image, ''), '"}'
          ) SEPARATOR ','
        )
        FROM groups_invite gi2
        JOIN users u ON gi2.sent_id = u.id
        WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
      ), '[]'
    ) AS invited_users
  FROM \`groups\` g
  INNER JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
  WHERE g.user_id IN (?)
  GROUP BY g.id
  ORDER BY total_members DESC;
`;

    db.query(query, [userIdArray], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Parse invited_users string to array
      results = results.map((group) => ({
        ...group,
        invited_users:
          group.invited_users && group.invited_users !== "[]"
            ? JSON.parse(`[${group.invited_users}]`)
            : [],
      }));

      return res.status(200).json({
        results,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getYourgroupMostpopular = async (req, res) => {
  const { user_id } = req.body; // Destructure user_id from req.body

  try {
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const query = `
  SELECT 
    g.id,
    g.date,
    g.slug,
    g.name,
    g.description,
    g.image,
    g.user_id,
    COUNT(gi.group_id) AS total_members,
    COALESCE(
      (
        SELECT GROUP_CONCAT(
          CONCAT(
            '{"user_id":', u.id, 
            ',"user_name":"', u.username, 
            '","user_image":"', IFNULL(u.profile_image, ''), '"}'
          ) SEPARATOR ','
        )
        FROM groups_invite gi2
        JOIN users u ON gi2.sent_id = u.id
        WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
      ), '[]'
    ) AS invited_users
  FROM \`groups\` g
  INNER JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
  WHERE g.user_id =?
  GROUP BY g.id
  ORDER BY total_members DESC;
`;

    db.query(query, [user_id], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Parse invited_users string to array
      results = results.map((group) => ({
        ...group,
        invited_users:
          group.invited_users && group.invited_users !== "[]"
            ? JSON.parse(`[${group.invited_users}]`)
            : [],
      }));

      return res.status(200).json({
        results,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getYourgroupFilter = async (req, res) => {
  const { user_id, search_by } = req.body;
  var orderBy = "";
  var ord = "";
  if (search_by === "Newest_first") {
    var orderBy = "Desc";
    var ord = `ORDER BY g.id ${orderBy}`;
  }
  if (search_by === "Oldest_first") {
    var orderBy = "Asc";
    var ord = `ORDER BY g.id ${orderBy}`;
  }

  if (search_by === "Alphabetical") {
    var orderBy = "Asc";
    var ord = `ORDER BY g.name ${orderBy}`;
  }
  if (search_by === "Most_active") {
    try {
      // Ensure user_id is provided
      if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const query = `
  SELECT 
    g.*, 
    COUNT(gpc.id) AS total_comments,
    COALESCE(
      (
        SELECT GROUP_CONCAT(
          CONCAT(
            '{"user_id":', u.id, 
            ',"user_name":"', u.username, 
            '","user_image":"', IFNULL(u.profile_image, ''), '"}'
          ) SEPARATOR ','
        )
        FROM groups_invite gi2
        JOIN users u ON gi2.sent_id = u.id  
        WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
      ), '[]'
    ) AS invited_users
  FROM \`groups\` g
  LEFT JOIN group_post_comment gpc ON g.id = gpc.group_id
  WHERE g.user_id = ?
  GROUP BY g.id
  ORDER BY total_comments DESC;
`;

      db.query(query, [user_id], (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Convert `invited_users` JSON string into an array
        results = results.map((group) => ({
          ...group,
          invited_users:
            group.invited_users && group.invited_users !== "[]"
              ? JSON.parse(`[${group.invited_users}]`)
              : [],
        }));

        return res.status(200).json({ results });
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error });
    }
  } else {
    try {
      // Ensure user_id is provided
      if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const query = `
      SELECT 
          g.*, 
          COALESCE(COUNT(gi.group_id), 0) AS total_members,
          COALESCE(
            (SELECT GROUP_CONCAT(
                CONCAT(
                    '{"user_id":', u.id, 
                    ',"user_name":"', u.username, 
                    '","user_image":"', IFNULL(u.profile_image, ''), '"}'
                ) SEPARATOR ','
            )
            FROM groups_invite gi2
            JOIN users u ON gi2.sent_id = u.id  
            WHERE gi2.group_id = g.id AND gi2.accept = 'Yes'
          ), '[]') AS invited_users
      FROM \`groups\` g
      LEFT JOIN groups_invite gi ON g.id = gi.group_id AND gi.accept = 'Yes'
      WHERE g.user_id =?
      GROUP BY g.id
      ${ord};
    `;

      db.query(query, [user_id], (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // Convert `invited_users` JSON string into an array
        results = results.map((group) => ({
          ...group,
          invited_users:
            group.invited_users && group.invited_users !== "[]"
              ? JSON.parse(`[${group.invited_users}]`)
              : [],
        }));

        return res.status(200).json({ results });
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", error });
    }
  }
};
