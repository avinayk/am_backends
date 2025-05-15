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
const { promisify } = require("util"); // To promisify the db.query function

// Promisify the query function
const query = promisify(db.query).bind(db);
app.use((req, res, next) => {
  req.wss = wss;
  next();
});
exports.getusergallery = (req, res) => {
  var user_id = req.body.user_id;
  try {
    // Ensure the email is provided
    if (!user_id) {
      return res.status(400).json({ message: "User id  is required" });
    }

    // Query the database to get the user's profile details
    db.query(
      `SELECT 
      g.*,
      COALESCE(COUNT(DISTINCT gc.id), 0) AS total_comments,
      COALESCE(COUNT(DISTINCT gf.id), 0) AS total_likes
    FROM 
      gallery g
    LEFT JOIN 
      gallery_comment gc ON g.id = gc.gallery_id
    LEFT JOIN 
      gallery_favourite gf ON g.id = gf.gallery_id
    WHERE 
      g.user_id = ?
    GROUP BY 
      g.id
    ORDER BY 
      g.id DESC;`,
      [user_id],
      (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        res.status(200).json({
          message: "",
          results: results, // Return the first event object
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getgallerycomments = (req, res) => {
  var id = req.body.id;
  try {
    // Ensure the email is provided
    if (!id) {
      return res.status(400).json({ message: "Gallery id  is required" });
    }
    const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM gallery_comment u
    JOIN users m ON u.user_id = m.id
    WHERE u.gallery_id = ?
    ORDER BY u.id ASC
  `;
    // Query the database to get the user's profile details
    db.query(query, [id], (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        message: "",
        results: results, // Return the first event object
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deletegallerycomment = async (req, res) => {
  const postid = req.body.id;
  const user_id = req.body.user_id;
  const gallery_id = req.body.gallery_id;
  const wss = req.wss;

  try {
    db.query(
      "SELECT * FROM gallery WHERE id = ?",
      [gallery_id],
      (err, rows) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }
        if (rows.length === 0) {
          return res.status(404).json({ message: "Event not found" });
        }

        db.query(
          `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
          [user_id, user_id, "Yes"],
          (err, results) => {
            if (err) {
              console.error("Database query error:", err);
              return res
                .status(500)
                .json({ message: "Database error", error: err });
            }
            var ename = rows[0].name;

            const date = moment
              .tz(new Date(), "Europe/Oslo")
              .format("YYYY-MM-DD HH:mm:ss");
            var readStatus = "No";
            var messages =
              "The post comment for the gallery " +
              ename +
              " has been deleted by admin";
            var results = [];
            if (results.length > 0) {
              results.forEach((user) => {
                // Insert notification for the user
                db.query(
                  "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                  ["Admin", user.id, messages, readStatus, date],
                  (err, result) => {
                    if (err) {
                      console.error(
                        `Error inserting notification for user :`,
                        err
                      );
                    } else {
                      console.log(`Notification inserted for user `);

                      // Insert into notificationforadmin table
                    }
                  }
                );
              });
            }

            db.query(
              "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
              ["Admin", user_id, messages, readStatus, date],
              (err, result) => {
                if (err) {
                } else {
                }
              }
            );
            db.query(
              "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
              [messages, date], // Use the insertId from the first query
              (err) => {
                if (err) {
                } else {
                }
              }
            );

            const userIds = [user_id, ...results.map((user) => user.sent_id)];

            const broadcastMessage = JSON.stringify({
              event: "adminGalleryPostdelete",
              user_id: userIds, // Send combined user IDs
              message: "",
            });

            // Broadcast to all WebSocket clients
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }
          }
        );
      }
    );

    await query(`DELETE FROM gallery_comment WHERE id = ?`, [postid]);

    // Return success response after all deletions
    return res.status(200).json({
      message: "",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database delete error",
      error: err,
    });
  }
};

exports.editgallerycomment = async (req, res) => {
  const postid = req.body.id;
  const user_id = req.body.user_id;
  const gallery_id = req.body.gallery_id;
  const desc = req.body.description;
  const wss = req.wss;
  console.log(req.body);
  // return;
  try {
    db.query(
      "SELECT * FROM gallery WHERE id = ?",
      [gallery_id],
      (err, rows) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }
        if (rows.length === 0) {
          return res.status(404).json({ message: "Event not found" });
        }

        db.query(
          `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
          [user_id, user_id, "Yes"],
          (err, results) => {
            if (err) {
              console.error("Database query error:", err);
              return res
                .status(500)
                .json({ message: "Database error", error: err });
            }
            var ename = rows[0].name;

            const date = moment
              .tz(new Date(), "Europe/Oslo")
              .format("YYYY-MM-DD HH:mm:ss");
            var readStatus = "No";
            var messages =
              "The post comment for the gallery " +
              ename +
              " has been updated by admin";
            var results = [];
            if (results.length > 0) {
              results.forEach((user) => {
                // Insert notification for the user
                db.query(
                  "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                  ["Admin", user.id, messages, readStatus, date],
                  (err, result) => {
                    if (err) {
                      console.error(
                        `Error inserting notification for user :`,
                        err
                      );
                    } else {
                      console.log(`Notification inserted for user `);

                      // Insert into notificationforadmin table
                    }
                  }
                );
              });
            }

            db.query(
              "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
              ["Admin", user_id, messages, readStatus, date],
              (err, result) => {
                if (err) {
                } else {
                }
              }
            );
            db.query(
              "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
              [messages, date], // Use the insertId from the first query
              (err) => {
                if (err) {
                } else {
                }
              }
            );

            const userIds = [user_id, ...results.map((user) => user.sent_id)];

            const broadcastMessage = JSON.stringify({
              event: "adminGalleryPostdelete",
              user_id: userIds, // Send combined user IDs
              message: "",
            });

            // Broadcast to all WebSocket clients
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }
          }
        );
      }
    );

    await query(
      `UPDATE gallery_comment 
       SET description = ? 
       WHERE id = ?`,
      [desc, postid]
    );

    // Return success response after all deletions
    return res.status(200).json({
      message: "",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
  }
};

exports.deletegallery = async (req, res) => {
  const gallery_id = req.body.id;
  const user_id = req.body.user_id;
  const wss = req.wss;
  try {
    db.query(
      "SELECT * FROM gallery WHERE id = ?",
      [gallery_id],
      (err, rows) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }
        if (rows.length === 0) {
          return res.status(404).json({ message: "Event not found" });
        }

        db.query(
          `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
          [user_id, user_id, "Yes"],
          (err, results) => {
            if (err) {
              console.error("Database query error:", err);
              return res
                .status(500)
                .json({ message: "Database error", error: err });
            }
            var ename = rows[0].name;

            const date = moment
              .tz(new Date(), "Europe/Oslo")
              .format("YYYY-MM-DD HH:mm:ss");
            var readStatus = "No";
            var messages = "The event " + ename + " has been deleted by admin.";
            var results = [];
            if (results.length > 0) {
              results.forEach((user) => {
                // Insert notification for the user
                db.query(
                  "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                  ["Admin", user.id, messages, readStatus, date],
                  (err, result) => {
                    if (err) {
                      console.error(
                        `Error inserting notification for user :`,
                        err
                      );
                    } else {
                      console.log(`Notification inserted for user `);

                      // Insert into notificationforadmin table
                    }
                  }
                );
              });
            }

            db.query(
              "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
              ["Admin", user_id, messages, readStatus, date],
              (err, result) => {
                if (err) {
                } else {
                }
              }
            );
            db.query(
              "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
              [messages, date], // Use the insertId from the first query
              (err) => {
                if (err) {
                } else {
                }
              }
            );

            const userIds = [user_id, ...results.map((user) => user.sent_id)];

            const broadcastMessage = JSON.stringify({
              event: "adminGallerydelete",
              user_id: userIds, // Send combined user IDs
              message: "",
            });

            // Broadcast to all WebSocket clients
            if (wss) {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }
          }
        );
      }
    );
    await query(`DELETE FROM gallery WHERE id = ?`, [gallery_id]);
    await query(`DELETE FROM gallery_comment WHERE gallery_id = ?`, [
      gallery_id,
    ]);
    await query(`DELETE FROM gallery_favourite WHERE gallery_id = ?`, [
      gallery_id,
    ]);

    // Return success response after all deletions
    return res.status(200).json({
      message: "",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database delete error",
      error: err,
    });
  }
};

exports.getallgalleryLikes = (req, res) => {
  const post_id = req.body.id;

  // Validate that post_id is provided
  if (!post_id) {
    return res.status(400).json({ message: "Post ID is required" });
  }

  const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM gallery_favourite u
    JOIN users m ON u.user_id = m.id
    WHERE u.gallery_id = ?
    ORDER BY u.id ASC
  `;

  db.query(query, [post_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};
exports.getuserforum = (req, res) => {
  const user_id = req.body.user_id;
  console.log(req.body);
  // Validate that user_id is provided
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = `
    SELECT 
    forum.*,
    COUNT(forum_comment.id) AS total_comments
FROM 
    forum
LEFT JOIN 
    forum_comment ON forum.id = forum_comment.forum_id
WHERE 
    forum.user_id = ?
GROUP BY 
    forum.id
ORDER BY 
    forum.id DESC;
`;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ results: results });
  });
};

exports.getforumcomments = (req, res) => {
  var id = req.body.id;
  try {
    // Ensure the email is provided
    if (!id) {
      return res.status(400).json({ message: "Gallery id  is required" });
    }
    const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM forum_comment u
    JOIN users m ON u.user_id = m.id
    WHERE u.forum_id = ?
    ORDER BY u.id ASC
  `;
    // Query the database to get the user's profile details
    db.query(query, [id], (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      res.status(200).json({
        message: "",
        results: results, // Return the first event object
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.editforumcomment = async (req, res) => {
  const postid = req.body.id;
  const user_id = req.body.user_id;
  const forum_id = req.body.gallery_id;
  const desc = req.body.description;
  const wss = req.wss;

  // return;
  try {
    db.query("SELECT * FROM forum WHERE id = ?", [forum_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
        [user_id, user_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;

          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post comment for the forum " +
            ename +
            " has been updated by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.id, messages, readStatus, date],
                (err, result) => {
                  if (err) {
                    console.error(
                      `Error inserting notification for user :`,
                      err
                    );
                  } else {
                    console.log(`Notification inserted for user `);

                    // Insert into notificationforadmin table
                  }
                }
              );
            });
          }

          db.query(
            "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
            ["Admin", user_id, messages, readStatus, date],
            (err, result) => {
              if (err) {
              } else {
              }
            }
          );
          db.query(
            "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
            [messages, date], // Use the insertId from the first query
            (err) => {
              if (err) {
              } else {
              }
            }
          );

          const userIds = [user_id, ...results.map((user) => user.sent_id)];

          const broadcastMessage = JSON.stringify({
            event: "adminForumPostdelete",
            user_id: userIds, // Send combined user IDs
            message: "",
          });

          // Broadcast to all WebSocket clients
          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
        }
      );
    });

    await query(
      `UPDATE forum_comment 
       SET description = ? 
       WHERE id = ?`,
      [desc, postid]
    );

    // Return success response after all deletions
    return res.status(200).json({
      message: "",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
  }
};

exports.deleteforum = async (req, res) => {
  const forum_id = req.body.id;
  const user_id = req.body.user_id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM forum WHERE id = ?", [forum_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
        [user_id, user_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;

          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages = "The forum " + ename + " has been deleted by admin.";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.id, messages, readStatus, date],
                (err, result) => {
                  if (err) {
                    console.error(
                      `Error inserting notification for user :`,
                      err
                    );
                  } else {
                    console.log(`Notification inserted for user `);

                    // Insert into notificationforadmin table
                  }
                }
              );
            });
          }

          db.query(
            "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
            ["Admin", user_id, messages, readStatus, date],
            (err, result) => {
              if (err) {
              } else {
              }
            }
          );
          db.query(
            "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
            [messages, date], // Use the insertId from the first query
            (err) => {
              if (err) {
              } else {
              }
            }
          );

          const userIds = [user_id, ...results.map((user) => user.sent_id)];

          const broadcastMessage = JSON.stringify({
            event: "adminGallerydelete",
            user_id: userIds, // Send combined user IDs
            message: "",
          });

          // Broadcast to all WebSocket clients
          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
        }
      );
    });
    await query(`DELETE FROM forum WHERE id = ?`, [forum_id]);
    await query(`DELETE FROM forum_comment WHERE forum_id = ?`, [forum_id]);

    // Return success response after all deletions
    return res.status(200).json({
      message: "",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database delete error",
      error: err,
    });
  }
};
exports.deleteforumcomment = async (req, res) => {
  const postid = req.body.id;
  const user_id = req.body.user_id;
  const forum_id = req.body.gallery_id;
  const wss = req.wss;

  try {
    db.query("SELECT * FROM forum WHERE id = ?", [forum_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
        [user_id, user_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;

          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post comment for the forum " +
            ename +
            " has been deleted by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.id, messages, readStatus, date],
                (err, result) => {
                  if (err) {
                    console.error(
                      `Error inserting notification for user :`,
                      err
                    );
                  } else {
                    console.log(`Notification inserted for user `);

                    // Insert into notificationforadmin table
                  }
                }
              );
            });
          }

          db.query(
            "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
            ["Admin", user_id, messages, readStatus, date],
            (err, result) => {
              if (err) {
              } else {
              }
            }
          );
          db.query(
            "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
            [messages, date], // Use the insertId from the first query
            (err) => {
              if (err) {
              } else {
              }
            }
          );

          const userIds = [user_id, ...results.map((user) => user.sent_id)];

          const broadcastMessage = JSON.stringify({
            event: "adminGalleryPostdelete",
            user_id: userIds, // Send combined user IDs
            message: "",
          });

          // Broadcast to all WebSocket clients
          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
        }
      );
    });

    await query(`DELETE FROM forum_comment WHERE id = ?`, [postid]);

    // Return success response after all deletions
    return res.status(200).json({
      message: "",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database delete error",
      error: err,
    });
  }
};

exports.adminforumUpdate = async (req, res) => {
  const postid = req.body.id;
  var data = req.body;
  const wss = req.wss;
  console.log(data);
  // return;
  try {
    db.query("SELECT * FROM forum WHERE id = ?", [postid], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!image) {
        image = rows[0].image;
      }
      var user_id = rows[0].user_id;
      db.query(
        `SELECT 
          u.*, 
          fr.status 
      FROM 
          users u 
      JOIN 
          friendRequest_accept fr 
      ON 
          (u.id = fr.sent_to AND fr.user_id = ?) OR 
          (u.id = fr.user_id AND fr.sent_to = ?) 
      WHERE 
          fr.status = ?`,
        [user_id, user_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;

          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post for the forum " + ename + " has been updated by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.id, messages, readStatus, date],
                (err, result) => {
                  if (err) {
                    console.error(
                      `Error inserting notification for user :`,
                      err
                    );
                  } else {
                    console.log(`Notification inserted for user `);

                    // Insert into notificationforadmin table
                  }
                }
              );
            });
          }

          db.query(
            "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
            ["Admin", user_id, messages, readStatus, date],
            (err, result) => {
              if (err) {
              } else {
              }
            }
          );
          db.query(
            "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
            [messages, date], // Use the insertId from the first query
            (err) => {
              if (err) {
              } else {
              }
            }
          );

          const userIds = [user_id, ...results.map((user) => user.sent_id)];

          const broadcastMessage = JSON.stringify({
            event: "adminForumPostupdate",
            user_id: userIds, // Send combined user IDs
            message: "",
          });

          // Broadcast to all WebSocket clients
          if (wss) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMessage);
              }
            });
          }
        }
      );
    });
    var image = req.file?.location || null;
    createUniqueSlugForum(data.name, data.id, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err });
      }

      db.query(
        "UPDATE forum SET forum_section =?, category = ?, slug = ?, image = ?, name = ?, description = ? WHERE id = ?",
        [
          data.forum_section,
          data.category,
          slug,
          image,
          data.name,
          data.description,
          data.id,
        ],
        (err, result) => {
          if (err) {
            console.error("Database update error:", err); // Log error to console
            return res
              .status(500)
              .json({ message: "Database update error", error: err });
          }

          res.status(200).json({
            message: "Forum updated successfully",
          });
        }
      );

      // Insert the event data including the slug
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
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
function createUniqueSlugForum(title, id, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM forum WHERE slug = ? And id !=?",
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

exports.getuserlogslist = async (req, res) => {
  // return;
  try {
    db.query(
      `SELECT logsactivity.*, users.username, users.profile_image
FROM logsactivity
JOIN users ON logsactivity.user_id = users.id
ORDER BY logsactivity.id DESC;
`,
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }

        // Return success response after all deletions
        return res.status(200).json({
          message: "",
          results: results,
        });
      }
    );
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
  }
};
exports.deletelogs = async (req, res) => {
  var id = req.body.id;
  try {
    db.query(
      `DELETE FROM logsactivity WHERE id = ?`,
      [id], // Use parameterized query to prevent SQL injection
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }

        // Return success response after deletion
        return res.status(200).json({
          message: "Log deleted successfully",
          results: results,
        });
      }
    );
  } catch (err) {
    // If any error occurs, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
  }
};
exports.gettotalCookies = async (req, res) => {
  try {
    db.query(`SELECT * FROM gdpr_cookies order by id desc`, (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      return res.status(200).json({
        message: "Log deleted successfully",
        results: results,
      });
    });
  } catch (err) {
    // If any error occurs, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
  }
};
exports.getlastdate = async (req, res) => {
  try {
    db.query(
      `SELECT * FROM gdpr_cookies order by id desc Limit 1`,
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }

        return res.status(200).json({
          message: "",
          results: results,
        });
      }
    );
  } catch (err) {
    // If any error occurs, return a 500 error with the error message
    return res.status(500).json({
      message: "Database update error",
      error: err,
    });
  }
};

exports.getuserchartCookies = (req, res) => {
  const user_id = req.body.user_id;

  // SQL query to count totals grouped by consent_status for a specific user_id
  const query = `
    SELECT consent_status AS category, COUNT(*) AS total
    FROM gdpr_cookies
    GROUP BY consent_status
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    // Process results to dynamically set labels and data
    const labels = [];
    const totals = [];
    results.forEach((row) => {
      labels.push(row.category); // 'Accept' or 'Decline'
      totals.push(row.total); // Corresponding counts
    });

    // Prepare chart data dynamically
    const data = {
      labels: labels,
      datasets: [
        {
          label: "Total",
          data: totals,
          backgroundColor: ["#FB8EA7", "#48B7FD"], // Colors for 'Accept' and 'Decline'
          borderColor: ["#FB8EA7", "#48B7FD"],
          borderWidth: 1,
        },
      ],
    };

    // Send the response with dynamic data
    res.status(200).json({ result: data });
  });
};
