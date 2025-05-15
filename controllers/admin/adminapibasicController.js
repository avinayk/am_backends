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
exports.getuserfriendlist = (req, res) => {
  var user_id = req.body.user_id;
  try {
    // Ensure the email is provided
    if (!user_id) {
      return res.status(400).json({ message: "User id  is required" });
    }

    // Query the database to get the user's profile details
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
          fr.status = ?;
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
exports.getusereventlist = async (req, res) => {
  const user_id = req.body.user_id;
  //console.log(req.body);
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      "SELECT * FROM events WHERE user_id = ? ORDER BY id DESC",
      [user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Events retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.getusergrouplist = async (req, res) => {
  const user_id = req.body.user_id;
  //console.log(req.body);
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      `SELECT * FROM \`groups\` WHERE user_id = ? ORDER BY id DESC`,
      [user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Groups retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.getusereventJoin = async (req, res) => {
  const user_id = req.body.user_id;
  const event_id = req.body.event_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      "SELECT a.*,c.username,c.profile_image FROM events a Join events_invite b on a.id = b.event_id join users c on b.sent_id = c.id WHERE  a.id =? And b.accept = 'Yes'  ORDER BY a.id DESC;",
      [event_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Join events retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getusereventinterested = async (req, res) => {
  const user_id = req.body.user_id;
  const event_id = req.body.event_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      "SELECT a.*,c.username,c.profile_image FROM events a Join events_intersted b on a.id = b.event_id join users c on b.user_id = c.id WHERE b.event_id =?  ORDER BY a.id DESC;",
      [event_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Join events retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.getusereventInvite = async (req, res) => {
  const user_id = req.body.user_id;
  const event_id = req.body.event_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      "SELECT a.*,c.username,c.profile_image FROM events a Join events_invite b on a.id = b.event_id join users c on b.sent_id = c.id WHERE b.user_id = ? And a.id =? And b.accept =?  ORDER BY a.id DESC;",
      [user_id, event_id, "No"],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Join events retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getusergroupinterested = async (req, res) => {
  const user_id = req.body.user_id;
  const group_id = req.body.group_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all Group for the given user_id
    db.query(
      `SELECT a.*,c.username,c.profile_image FROM \`groups\` a Join groups_intersted b on a.id = b.group_id join users c on b.user_id = c.id WHERE b.group_id =?  ORDER BY a.id DESC`,
      [group_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If Group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Result successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.getusergroupinvite = async (req, res) => {
  const user_id = req.body.user_id;
  const group_id = req.body.group_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all group for the given user_id
    db.query(
      `SELECT a.*,c.username,c.profile_image FROM \`groups\` a Join  groups_invite b on a.id = b.group_id join users c on b.sent_id = c.id WHERE b.sent_id = ? And a.id =? And b.accept =?  ORDER BY a.id DESC;`,
      [user_id, group_id, "No"],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Group successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getuserjoinGroup = async (req, res) => {
  const user_id = req.body.user_id;
  const group_id = req.body.group_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all group for the given user_id
    db.query(
      `SELECT a.*,c.username,c.profile_image FROM \`groups\` a Join groups_invite b on a.id = b.group_id join users c on b.sent_id = c.id WHERE a.id =? And b.accept = 'Yes'  ORDER BY a.id DESC;`,
      [group_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Group successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};
exports.getgroupPostData = async (req, res) => {
  const slug = req.body.slug;
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Slug is required" });
  }

  try {
    // Fetch all group for the given user_id
    db.query(
      `SELECT 
    a.*, b.id as post_id,b.file as image,
    COUNT(DISTINCT c.id) AS total_comments,
    COUNT(DISTINCT f.id) AS total_likes
  FROM 
    \`groups\` a
  JOIN 
    group_post b ON a.id = b.group_id
  LEFT JOIN 
    group_post_comment c ON b.id = c.group_post_id
  LEFT JOIN 
    group_post_favourite f ON b.id = f.post_id
  WHERE 
    a.slug = ?
  GROUP BY 
    a.id, b.id
  ORDER BY 
    b.id DESC`,
      [slug],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }
        // If group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Group post successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.getgroupData = async (req, res) => {
  const slug = req.body.slug;
  // Validate required fields
  if (!slug) {
    return res.status(400).json({ message: "Slug is required" });
  }

  try {
    // Fetch all group for the given user_id
    db.query(`SELECT * from \`groups\` where slug = ?`, [slug], (err, row) => {
      if (err) {
        console.error("Database query error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      // If group are found, return them; otherwise, return a message
      res.status(200).json({
        message: "Group post successfully",
        results: row[0],
      });
    });
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

const { promisify } = require("util"); // To promisify the db.query function

// Promisify the query function
const query = promisify(db.query).bind(db);

exports.deletegrouppost = async (req, res) => {
  const postid = req.body.id;

  try {
    // Start deleting from related tables in the correct order
    await query(`DELETE FROM group_post WHERE id = ?`, [postid]);
    await query(`DELETE FROM group_post_comment WHERE group_id = ?`, [postid]);
    await query(`DELETE FROM group_post_favourite WHERE group_id = ?`, [
      postid,
    ]);

    // Return success response after all deletions
    return res.status(200).json({
      message: "Group and related data deleted successfully",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database delete error",
      error: err,
    });
  }
};
exports.deletegrouppostComment = async (req, res) => {
  const postid = req.body.id;

  try {
    // Start deleting from related tables in the correct order

    await query(`DELETE FROM group_post_comment WHERE id = ?`, [postid]);

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
exports.deletegrouppostLike = async (req, res) => {
  const postid = req.body.id;
  //console.log(postid);
  try {
    // Start deleting from related tables in the correct order

    await query(`DELETE FROM group_post_favourite WHERE id = ?`, [postid]);

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

exports.getallgroupinteresteduser = async (req, res) => {
  const id = req.body.id;
  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required" });
  }

  try {
    // Fetch all group for the given user_id
    db.query(
      "SELECT a.*,b.username,b.profile_image from groups_intersted a Left join users b on a.user_id = b.id  where a.group_id = ?",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }
        // If group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Group post successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};
exports.deletemediacomment = async (req, res) => {
  const postid = req.body.id;

  try {
    // Start deleting from related tables in the correct order

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

exports.getallforumComments = async (req, res) => {
  const id = req.body.id;
  // Validate required fields
  if (!id) {
    return res.status(400).json({ message: "Id is required" });
  }

  try {
    // Fetch all group for the given user_id
    db.query(
      "SELECT a.*,b.username,b.profile_image from forum_comment a Left join users b on a.user_id = b.id  where a.forum_id = ?",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }
        // If group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.deleteforumComment = async (req, res) => {
  const postid = req.body.id;

  try {
    // Start deleting from related tables in the correct order

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

exports.gettotalSaleRevenueYearly = (req, res) => {
  const query = `
    SELECT
      MONTH(start_date) AS month,
      SUM(CAST(amount AS DECIMAL(10, 2))) AS total_sale,
      SUM(CAST(amount AS DECIMAL(10, 2))) AS total_revenue
    FROM allmembership
    WHERE YEAR(start_date) = YEAR(CURRENT_DATE)
    GROUP BY MONTH(start_date)
    ORDER BY MONTH(start_date) ASC;
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    // Initialize data with all months set to 0
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const totalSales = Array(12).fill(0);
    const totalRevenues = Array(12).fill(0);

    // Map results to the corresponding month
    results.forEach((row) => {
      const index = row.month - 1; // Months are 1-based in SQL
      totalSales[index] = row.total_sale;
      totalRevenues[index] = row.total_revenue;
    });

    // Format the response to match the required chart structure
    const data = {
      labels: months,
      datasets: [
        {
          label: "Sale",
          data: totalSales,
          backgroundColor: "rgba(0, 156, 255, .7)",
        },
        {
          label: "Revenue",
          data: totalRevenues,
          backgroundColor: "rgba(0, 156, 255, .5)",
        },
      ],
    };

    res.status(200).json({ result: data });
  });
};

exports.adminEditevent = async (req, res) => {
  const { id, name, start_date, end_date, time, location, description } =
    req.body;
  const wss = req.wss;
  // Validate required fields
  if (
    !id ||
    !name ||
    !start_date ||
    !end_date ||
    !time ||
    !location ||
    !description
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  let eventImage = req.file?.location || null; // For single file upload, defaults to null if no file uploaded

  try {
    // Create Date objects and validate
    const startDate = moment
      .tz(new Date(start_date), "Europe/Oslo")
      .format("YYYY-MM-DD");
    const endDate = moment
      .tz(new Date(end_date), "Europe/Oslo")
      .format("YYYY-MM-DD");

    // Optionally check if start_date is before end_date
    if (startDate >= endDate) {
      return res
        .status(200)
        .json({ message: "Start date must be before end date", status: "2" });
    }

    const updatedAt = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    var mp = req.body.makeImagePrivatee;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    createUniqueSlug(name, id, "events", (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err, status: "2" });
      }

      // First, get the current image from the database
      db.query("SELECT * FROM events WHERE id = ?", [id], (err, rows) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }

        // If no event found with the given ID
        if (rows.length === 0) {
          return res.status(404).json({ message: "Event not found" });
        }

        // If no new image is uploaded, use the current image from the database
        if (!eventImage) {
          eventImage = rows[0].image;
        }

        // Update the event data including the slug and image
        db.query(
          "UPDATE events SET makeImagePrivate = ?, slug = ?, image = ?, name = ?, start_date = ?, end_date = ?, time = ?, location = ?, description = ?, updated_at = ? WHERE id = ?",
          [
            mp, // makeImagePrivate
            slug, // slug
            eventImage, // image
            name, // name
            startDate, // start_date
            endDate, // end_date
            time, // time
            location, // location
            description, // description
            updatedAt, // updated_at
            id, // id (the ID of the event to update)
          ],
          (err, result) => {
            if (err) {
              console.error("Database update error:", err); // Log error to console
              return res
                .status(500)
                .json({ message: "Database update error", error: err });
            }

            // Check if any rows were affected
            if (result.affectedRows === 0) {
              return res.status(404).json({ message: "Event not found" });
            }

            db.query(
              `SELECT 
                  ei.id AS invite_id,
                  ei.user_id,
                  ei.sent_id,
                  ei.event_id,
                  e.name,
                  e.id,
                  ei.accept,
                  ei.date AS invite_date
              FROM 
                  events_invite ei
              JOIN 
                  events e ON ei.event_id = e.id
              WHERE 
                  ei.event_id = ?;`,
              [id],
              (err, results) => {
                if (err) {
                  console.error("Database query error:", err);
                  return res
                    .status(500)
                    .json({ message: "Database error", error: err });
                }
                var ename = rows[0].name;
                var user_id = rows[0].user_id;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                var readStatus = "No";
                var messages =
                  "The event " +
                  ename +
                  " has been updated. Check out the latest details and stay tuned";
                var results = [];
                if (results.length > 0) {
                  results.forEach((user) => {
                    // Insert notification for the user
                    db.query(
                      "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                      ["Admin", user.sent_id, messages, readStatus, date],
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
                      // console.error(
                      //   `Error inserting notification for user :`,
                      //   err
                      // );
                    } else {
                      //console.log(`Notification inserted for user `);
                      // Insert into notificationforadmin table
                    }
                  }
                );
                db.query(
                  "INSERT INTO notificationforadmin (message, date) VALUES ( ?, ?)",
                  [messages, date], // Use the insertId from the first query
                  (err) => {
                    if (err) {
                      // console.error(
                      //   `Error inserting into notificationforadmin for notification :`,
                      //   err
                      // );
                    } else {
                      // console.log(
                      //   `Notification entry added to notificationforadmin for notification `
                      // );
                    }
                  }
                );

                const userIds = [
                  user_id,
                  ...results.map((user) => user.sent_id),
                ];

                const broadcastMessage = JSON.stringify({
                  event: "adminEventupdate",
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

            res.status(200).json({
              message: "Event updated successfully",
              eventId: id,
              slug: slug,
              status: "1",
            });
          }
        );
      });
    });
  } catch (error) {
    console.error("Something went wrong, please try again:", error); // Log error to console
    res
      .status(500)
      .json({ message: "Something went wrong, please try again", error });
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
function createUniqueSlug(title, id, table, callback) {
  const slug = generateSlug(title);

  // Check if the slug already exists
  db.query(
    "SELECT COUNT(*) as count FROM ?? WHERE slug = ? AND id != ?",
    [table, slug, id],
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
exports.adminEditgroup = async (req, res) => {
  const { id, name, description } = req.body;
  const wss = req.wss;
  // Validate required fields
  if (!id || !name) {
    return res.status(400).json({ message: "All fields are required" });
  }

  let eventImage = req.file?.location || null; // For single file upload, defaults to null if no file uploaded

  try {
    // Create Date objects and validate

    const updatedAt = moment
      .tz(new Date(), "Europe/Oslo")
      .format("YYYY-MM-DD HH:mm:ss");

    var mp = req.body.makeImagePrivatee;
    mp = mp === true || mp === "true" ? 1 : 0;

    // Generate a unique slug for the event name
    createUniqueSlug(name, id, `groups`, (err, slug) => {
      if (err) {
        console.error("Slug generation error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Slug generation error", error: err, status: "2" });
      }

      // First, get the current image from the database
      db.query(`SELECT * FROM \`groups\` WHERE id = ?`, [id], (err, rows) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }

        // If no event found with the given ID
        if (rows.length === 0) {
          return res.status(404).json({ message: "Group not found" });
        }

        // If no new image is uploaded, use the current image from the database
        if (!eventImage) {
          eventImage = rows[0].image;
        }

        // Update the event data including the slug and image
        db.query(
          "UPDATE groups SET makeImageUse = ?, slug = ?, image = ?, name = ?, description = ?, updated_at = ? WHERE id = ?",
          [
            mp, // makeImagePrivate
            slug, // slug
            eventImage, // image
            name, // name
            description, // description
            updatedAt, // updated_at
            id, // id (the ID of the event to update)
          ],
          (err, result) => {
            if (err) {
              console.error("Database update error:", err); // Log error to console
              return res
                .status(500)
                .json({ message: "Database update error", error: err });
            }

            // Check if any rows were affected
            if (result.affectedRows === 0) {
              return res.status(404).json({ message: "Group not found" });
            }
            db.query(
              `SELECT 
                        ei.id AS invite_id,
                        ei.user_id,
                        ei.sent_id,
                        ei.group_id,
                        e.name,
                        e.id,
                        ei.accept,
                        ei.date AS invite_date
                    FROM 
                        groups_invite ei
                    JOIN 
                        groups e ON ei.group_id = e.id
                    WHERE 
                        ei.group_id = ? And ei.accept = ?`,
              [id, "Yes"],
              (err, results) => {
                if (err) {
                  console.error("Database query error:", err);
                  return res
                    .status(500)
                    .json({ message: "Database error", error: err });
                }
                var ename = rows[0].name;
                var user_id = rows[0].user_id;
                const date = moment
                  .tz(new Date(), "Europe/Oslo")
                  .format("YYYY-MM-DD HH:mm:ss");
                var readStatus = "No";

                var messages =
                  "The group " +
                  ename +
                  " has been updated. Check out the latest details and stay tuned";
                var results = [];
                if (results.length > 0) {
                  results.forEach((user) => {
                    // Insert notification for the user
                    db.query(
                      "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                      ["Admin", user.sent_id, messages, readStatus, date],
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

                const userIds = [
                  user_id,
                  ...results.map((user) => user.sent_id),
                ];

                const broadcastMessage = JSON.stringify({
                  event: "adminGroupedit",
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
            res.status(200).json({
              message: "Group updated successfully",
              groupId: id,
              slug: slug,
              status: "1",
            });
          }
        );
      });
    });
  } catch (error) {
    console.error("Something went wrong, please try again:", error); // Log error to console
    res
      .status(500)
      .json({ message: "Something went wrong, please try again", error });
  }
};

exports.getusertotalgroups = (req, res) => {
  var user_id = req.body.user_id;
  db.query(
    `SELECT * from \`groups\` where user_id =? `,
    [user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      res.status(200).json({ result: results });
    }
  );
};
exports.getusertotalevents = (req, res) => {
  var user_id = req.body.user_id;
  db.query(
    `SELECT * from events where user_id =? `,
    [user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      res.status(200).json({ result: results });
    }
  );
};
exports.getusertotalforum = (req, res) => {
  var user_id = req.body.user_id;
  db.query(
    `SELECT * from forum where user_id =? `,
    [user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      res.status(200).json({ result: results });
    }
  );
};
exports.getusertotalspeeddate = (req, res) => {
  var user_id = req.body.user_id;
  db.query(
    `SELECT * from speeddate where user_id =? `,
    [user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      res.status(200).json({ result: results });
    }
  );
};
exports.getUserSentMessage = (req, res) => {
  var user_id = req.body.user_id;
  //console.log(req.body);
  db.query(
    `SELECT 
    chatmessages.*, 
    sender.username AS sender_username, 
    sender.profile_image AS sender_profile_image,
    recipient.username AS recipient_username, 
    recipient.profile_image AS recipient_profile_image
    FROM chatmessages
    LEFT JOIN users AS sender ON chatmessages.user_id = sender.id
    LEFT JOIN users AS recipient ON chatmessages.to_id = recipient.id
    WHERE chatmessages.user_id = ? order by chatmessages.id desc;`,
    [user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      //console.log(results);
      res.status(200).json({ result: results });
    }
  );
};

exports.deleteusersmessage = async (req, res) => {
  const postid = req.body.id;

  try {
    // Start deleting from related tables in the correct order
    await query(`DELETE FROM chatmessages WHERE id = ?`, [postid]);

    // Return success response after all deletions
    return res.status(200).json({
      message: "deleted successfully",
    });
  } catch (err) {
    // If any of the queries fail, return a 500 error with the error message
    return res.status(500).json({
      message: "Database delete error",
      error: err,
    });
  }
};

exports.chatFileupdate = async (req, res) => {
  const { id } = req.body;

  try {
    // Ensure the id is provided
    if (!id) {
      return res
        .status(400)
        .json({ message: "Missing required parameter: id" });
    }

    // Retrieve file URLs from the request (S3 URLs)
    const fileUrls = req.files ? req.files.map((file) => file.location) : []; // Get S3 URLs from uploaded files

    // Prepare data to update in the database
    const files = JSON.stringify(fileUrls); // Store the files array as a JSON string

    // Update the file URLs in the database for the given id
    db.query(
      "UPDATE chatmessages SET file = ? WHERE id = ?",
      [files, id],
      (updateErr, result) => {
        if (updateErr) {
          return res.status(500).json({
            message: "Database update error",
            error: updateErr,
          });
        }

        // Check if any rows were updated
        if (result.affectedRows === 0) {
          return res.status(404).json({
            message: "No matching record found to update",
          });
        }

        // Return success response
        res.status(200).json({
          status: "1",
          message: "File updated successfully",
        });
      }
    );
  } catch (error) {
    console.error("Error:", error); // Log the error for debugging
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.chatupdate = async (req, res) => {
  const { id, message } = req.body;

  try {
    // Ensure the id is provided
    if (!id) {
      return res
        .status(400)
        .json({ message: "Missing required parameter: id" });
    }

    // Retrieve file URLs from the request (S3 URLs)

    // Prepare data to update in the database

    // Update the file URLs in the database for the given id
    db.query(
      "UPDATE chatmessages SET message = ? WHERE id = ?",
      [message, id],
      (updateErr, result) => {
        if (updateErr) {
          return res.status(500).json({
            message: "Database update error",
            error: updateErr,
          });
        }

        // Check if any rows were updated
        if (result.affectedRows === 0) {
          return res.status(404).json({
            message: "No matching record found to update",
          });
        }

        // Return success response
        res.status(200).json({
          status: "1",
          message: "File updated successfully",
        });
      }
    );
  } catch (error) {
    console.error("Error:", error); // Log the error for debugging
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getJoinedGroups = (req, res) => {
  var id = req.body.id;

  db.query(
    `SELECT 
    gi.id,
    gi.user_id,
    gi.sent_id,
    gi.group_id,
    gi.accept,
    gi.date,
    u.username,
    g.name,g.image
FROM 
    groups_invite gi
JOIN 
    users u ON gi.user_id = u.id  
JOIN 
    \`groups\` g ON gi.group_id = g.id 
WHERE 
    gi.sent_id = ?                  
    AND gi.accept = 'Yes';`,
    [id, "Yes"],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      //console.log(results);
      res.status(200).json({ result: results });
    }
  );
};
exports.getJoinedevents = (req, res) => {
  var id = req.body.id;

  db.query(
    `SELECT 
    gi.id,
    gi.user_id,
    gi.sent_id,
    gi.event_id,
    gi.accept,
    gi.date,
    u.username,
    g.name,g.image
FROM 
    events_invite gi
JOIN 
    users u ON gi.user_id = u.id  
JOIN 
    events g ON gi.event_id = g.id 
WHERE 
    gi.sent_id = ?                  
    AND gi.accept = 'Yes';`,
    [id, "Yes"],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      //console.log(results);
      res.status(200).json({ result: results });
    }
  );
};
exports.sentmessage = (req, res) => {
  var id = req.body.id;

  db.query(
    `SELECT * from chatmessages where user_id = ?`,
    [id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      //console.log(results);
      res.status(200).json({ result: results });
    }
  );
};
exports.receivemessage = (req, res) => {
  var id = req.body.id;

  db.query(
    `SELECT * from chatmessages where to_id = ?`,
    [id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }
      //console.log(results);
      res.status(200).json({ result: results });
    }
  );
};

exports.getuserchartgraph = (req, res) => {
  var user_id = req.body.user_id;

  // SQL Query
  const query = `
  SELECT
    MONTH(\`groups\`.date) AS month,
    COUNT(\`groups\`.id) AS total_sale,
    0 AS total_revenue,
    'groups' AS source
  FROM \`groups\`
  WHERE YEAR(\`groups\`.date) = YEAR(CURRENT_DATE)
    AND \`groups\`.user_id = ?
  GROUP BY MONTH(\`groups\`.date)

  UNION ALL

  SELECT
    MONTH(events.created_at) AS month,
    0 AS total_sale,
    COUNT(events.id) AS total_revenue,
    'events' AS source
  FROM events
  WHERE YEAR(events.created_at) = YEAR(CURRENT_DATE)
    AND events.user_id = ?
  GROUP BY MONTH(events.created_at)

  UNION ALL

  SELECT
    MONTH(forum.date) AS month,
    COUNT(forum.id) AS total_sale,
    0 AS total_revenue,
    'forum' AS source
  FROM forum
  WHERE YEAR(forum.date) = YEAR(CURRENT_DATE)
    AND forum.user_id = ?
  GROUP BY MONTH(forum.date)

  UNION ALL

  SELECT
    MONTH(speeddate.date) AS month,
    COUNT(speeddate.id) AS total_sale,
    0 AS total_revenue,
    'speeddate' AS source
  FROM speeddate
  WHERE YEAR(speeddate.date) = YEAR(CURRENT_DATE)
    AND speeddate.user_id = ?
  GROUP BY MONTH(speeddate.date)

  UNION ALL

  SELECT
    MONTH(gallery.date) AS month,
    COUNT(gallery.id) AS total_sale,
    0 AS total_revenue,
    'gallery' AS source
  FROM gallery
  WHERE YEAR(gallery.date) = YEAR(CURRENT_DATE)
    AND gallery.user_id = ?
  GROUP BY MONTH(gallery.date)
`;

  db.query(
    query,
    [user_id, user_id, user_id, user_id, user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Initialize data arrays for months and categories
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const totalSales = Array(12).fill(0);
      const totalRevenues = Array(12).fill(0);
      const forumSales = Array(12).fill(0);
      const speeddateSales = Array(12).fill(0);
      const gallerySales = Array(12).fill(0);

      // Process results
      results.forEach((row) => {
        const index = row.month - 1; // Convert month to zero-based index

        if (row.source === "groups") {
          totalSales[index] += row.total_sale;
        } else if (row.source === "events") {
          totalRevenues[index] += row.total_revenue;
        } else if (row.source === "forum") {
          forumSales[index] += row.total_sale;
        } else if (row.source === "speeddate") {
          speeddateSales[index] += row.total_sale;
        } else if (row.source === "gallery") {
          gallerySales[index] += row.total_sale;
        }
      });

      // Prepare chart data
      const data = {
        labels: months,
        datasets: [
          {
            label: "Groups",
            data: totalSales,
            backgroundColor: "rgba(0, 156, 255, .7)",
          },
          {
            label: "Events",
            data: totalRevenues,
            backgroundColor: "rgba(0, 156, 255, .5)",
          },
          {
            label: "Forum",
            data: forumSales,
            backgroundColor: "rgba(255, 99, 132, .7)",
          },
          {
            label: "SpeedDate",
            data: speeddateSales,
            backgroundColor: "rgba(255, 159, 64, .7)",
          },
          {
            label: "Gallery",
            data: gallerySales,
            backgroundColor: "rgba(75, 192, 192, .7)", // Choose any color
          },
        ],
      };

      // Send the response
      res.status(200).json({ result: data });
    }
  );
};

exports.getuserchartgraphYear = (req, res) => {
  const user_id = req.body.user_id;

  // SQL Query
  const query = `
    SELECT
      YEAR(\`groups\`.date) AS year,
      COUNT(\`groups\`.id) AS total_sale,
      0 AS total_revenue,
      'groups' AS source
    FROM \`groups\`
    WHERE \`groups\`.user_id = ?
    GROUP BY YEAR(\`groups\`.date)

    UNION ALL

    SELECT
      YEAR(events.created_at) AS year,
      0 AS total_sale,
      COUNT(events.id) AS total_revenue,
      'events' AS source
    FROM events
    WHERE events.user_id = ?
    GROUP BY YEAR(events.created_at)

    UNION ALL

    SELECT
      YEAR(forum.date) AS year,
      COUNT(forum.id) AS total_sale,
      0 AS total_revenue,
      'forum' AS source
    FROM forum
    WHERE forum.user_id = ?
    GROUP BY YEAR(forum.date)

    UNION ALL

    SELECT
      YEAR(speeddate.date) AS year,
      COUNT(speeddate.id) AS total_sale,
      0 AS total_revenue,
      'speeddate' AS source
    FROM speeddate
    WHERE speeddate.user_id = ?
    GROUP BY YEAR(speeddate.date)

    UNION ALL

    SELECT
      YEAR(gallery.date) AS year,
      COUNT(gallery.id) AS total_sale,
      0 AS total_revenue,
      'gallery' AS source
    FROM gallery
    WHERE gallery.user_id = ?
    GROUP BY YEAR(gallery.date)
  `;

  db.query(
    query,
    [user_id, user_id, user_id, user_id, user_id],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Initialize data objects for yearly totals
      const yearlyData = {};

      // Process results
      results.forEach((row) => {
        const year = row.year;

        if (!yearlyData[year]) {
          yearlyData[year] = {
            groups: 0,
            events: 0,
            forum: 0,
            speeddate: 0,
            gallery: 0,
          };
        }

        if (row.source === "groups") {
          yearlyData[year].groups += row.total_sale;
        } else if (row.source === "events") {
          yearlyData[year].events += row.total_revenue;
        } else if (row.source === "forum") {
          yearlyData[year].forum += row.total_sale;
        } else if (row.source === "speeddate") {
          yearlyData[year].speeddate += row.total_sale;
        } else if (row.source === "gallery") {
          yearlyData[year].gallery += row.total_sale;
        }
      });

      // Prepare chart data
      const labels = Object.keys(yearlyData);
      const data = {
        labels,
        datasets: [
          {
            label: "Groups",
            data: labels.map((year) => yearlyData[year].groups),
            backgroundColor: "rgba(0, 156, 255, .7)",
          },
          {
            label: "Events",
            data: labels.map((year) => yearlyData[year].events),
            backgroundColor: "rgba(0, 156, 255, .5)",
          },
          {
            label: "Forum",
            data: labels.map((year) => yearlyData[year].forum),
            backgroundColor: "rgba(255, 99, 132, .7)",
          },
          {
            label: "SpeedDate",
            data: labels.map((year) => yearlyData[year].speeddate),
            backgroundColor: "rgba(255, 159, 64, .7)",
          },
          {
            label: "Gallery",
            data: labels.map((year) => yearlyData[year].gallery),
            backgroundColor: "rgba(75, 192, 192, .7)",
          },
        ],
      };

      // Send the response
      res.status(200).json({ result: data });
    }
  );
};

exports.deleteevents = async (req, res) => {
  const postid = req.body.id;
  const id = req.body.id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM events WHERE id = ?", [postid], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.event_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                events_invite ei
            JOIN 
                events e ON ei.event_id = e.id
            WHERE 
                ei.event_id = ? And ei.accept = ?`,
        [id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
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
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminEventdelete",
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
    await query(`DELETE FROM events WHERE id = ?`, [postid]);
    await query(`DELETE FROM events_intersted WHERE event_id = ?`, [postid]);
    await query(`DELETE FROM events_invite WHERE event_id = ?`, [postid]);
    await query(`DELETE FROM event_post WHERE event_id = ?`, [postid]);
    await query(`DELETE FROM event_post_comment WHERE event_id = ?`, [postid]);
    await query(`DELETE FROM event_post_favourite WHERE event_id = ?`, [
      postid,
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

exports.getusereventpostlist = async (req, res) => {
  const user_id = req.body.user_id;
  const event_id = req.body.event_id;
  //console.log(req.body);
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      `SELECT 
    ep.*, 
    COUNT(DISTINCT epc.id) AS total_comments, 
    COUNT(DISTINCT epf.id) AS total_likes
  FROM 
    event_post AS ep
  LEFT JOIN 
    event_post_comment AS epc ON epc.event_post_id = ep.id
  LEFT JOIN 
    event_post_favourite AS epf ON epf.post_id = ep.id
  WHERE 
    ep.event_id = ? AND ep.user_id = ?
  GROUP BY 
    ep.id
  ORDER BY 
    ep.id DESC;`,
      [event_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If events are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Events retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.getusereventdetail = async (req, res) => {
  const event_id = req.body.id;

  try {
    // Fetch all events for the given user_id
    db.query(`SELECT * from events where id = ?`, [event_id], (err, row) => {
      if (err) {
        console.error("Database query error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // If events are found, return them; otherwise, return a message
      res.status(200).json({
        message: "Events retrieved successfully",
        results: row[0],
      });
    });
  } catch (error) {
    console.error("Event retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Event retrieval error", error });
  }
};

exports.deleteeventspost = async (req, res) => {
  const postid = req.body.id;
  const event_id = req.body.event_id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM events WHERE id = ?", [event_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.event_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                events_invite ei
            JOIN 
                events e ON ei.event_id = e.id
            WHERE 
                ei.event_id = ? And ei.accept = ?`,
        [event_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post for the event " + ename + " has been deleted by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminEventPostdelete",
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

    await query(`DELETE FROM event_post WHERE id = ?`, [postid]);
    await query(`DELETE FROM event_post_comment WHERE event_post_id = ?`, [
      postid,
    ]);
    await query(`DELETE FROM event_post_favourite WHERE post_id = ?`, [postid]);

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

exports.getalleventComments = (req, res) => {
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
    FROM event_post_comment u
    JOIN users m ON u.user_id = m.id
    WHERE u.event_post_id = ?
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

exports.deleteeventcomment = async (req, res) => {
  const postid = req.body.id;
  const event_id = req.body.event_id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM events WHERE id = ?", [event_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.event_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                events_invite ei
            JOIN 
                events e ON ei.event_id = e.id
            WHERE 
                ei.event_id = ? And ei.accept = ?`,
        [event_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post comment for the event " +
            ename +
            " has been deleted by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminEventPostdelete",
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

    await query(`DELETE FROM event_post_comment WHERE id = ?`, [postid]);

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
exports.editeventcomment = async (req, res) => {
  const postid = req.body.id;
  const event_id = req.body.event_id;
  const desc = req.body.description;
  const wss = req.wss;
  console.log(req.body);
  // return;
  try {
    db.query("SELECT * FROM events WHERE id = ?", [event_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.event_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                events_invite ei
            JOIN 
                events e ON ei.event_id = e.id
            WHERE 
                ei.event_id = ? And ei.accept = ?`,
        [event_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post comment for the event " +
            ename +
            " has been edit by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminEventPostCommentEdit",
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
      `UPDATE event_post_comment 
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

exports.getalleventpostLikes = (req, res) => {
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
    FROM event_post_favourite u
    JOIN users m ON u.user_id = m.id
    WHERE u.post_id = ?
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

exports.deletegroups = async (req, res) => {
  const postid = req.body.id;
  const id = req.body.id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM groups WHERE id = ?", [postid], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Group not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.group_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                groups_invite ei
            JOIN 
                groups e ON ei.group_id = e.id
            WHERE 
                ei.group_id = ? And ei.accept = ?`,
        [id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages = "The group " + ename + " has been deleted.";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminGroupdelete",
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
    await query(`DELETE FROM groups WHERE id = ?`, [postid]);
    await query(`DELETE FROM groups_intersted WHERE group_id = ?`, [postid]);
    await query(`DELETE FROM groups_invite WHERE group_id = ?`, [postid]);
    await query(`DELETE FROM group_post WHERE group_id = ?`, [postid]);
    await query(`DELETE FROM group_post_comment WHERE group_id = ?`, [postid]);
    await query(`DELETE FROM group_post_favourite WHERE group_id = ?`, [
      postid,
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

exports.getusergroupdetail = async (req, res) => {
  const group_id = req.body.id;

  try {
    // Fetch all Groups for the given user_id
    db.query(`SELECT * from groups where id = ?`, [group_id], (err, row) => {
      if (err) {
        console.error("Database query error:", err); // Log error to console
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // If Groups are found, return them; otherwise, return a message
      res.status(200).json({
        message: "Groups retrieved successfully",
        results: row[0],
      });
    });
  } catch (error) {
    console.error("Groups retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Groups retrieval error", error });
  }
};

exports.getusergrouppostlist = async (req, res) => {
  const user_id = req.body.user_id;
  const group_id = req.body.group_id;
  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all events for the given user_id
    db.query(
      `SELECT 
    ep.*, 
    COUNT(DISTINCT epc.id) AS total_comments, 
    COUNT(DISTINCT epf.id) AS total_likes
  FROM 
    group_post AS ep
  LEFT JOIN 
    group_post_comment AS epc ON epc.group_post_id = ep.id
  LEFT JOIN 
    group_post_favourite AS epf ON epf.post_id = ep.id
  WHERE 
    ep.group_id = ? AND ep.user_id = ?
  GROUP BY 
    ep.id
  ORDER BY 
    ep.id DESC`,
      [group_id, user_id],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err); // Log error to console
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        // If Group are found, return them; otherwise, return a message
        res.status(200).json({
          message: "Group retrieved successfully",
          results: results,
        });
      }
    );
  } catch (error) {
    console.error("Group retrieval error:", error); // Log error to console
    res.status(500).json({ message: "Group retrieval error", error });
  }
};

exports.getallgroupComments = (req, res) => {
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
    FROM group_post_comment u
    JOIN users m ON u.user_id = m.id
    WHERE u.group_post_id = ?
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

exports.editgroupcomment = async (req, res) => {
  const postid = req.body.id;
  const group_id = req.body.group_id;
  const desc = req.body.description;
  const wss = req.wss;
  console.log(req.body);
  // return;
  try {
    db.query("SELECT * FROM groups WHERE id = ?", [group_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.group_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                groups_invite ei
            JOIN 
                groups e ON ei.group_id = e.id
            WHERE 
                ei.group_id = ? And ei.accept = ?`,
        [group_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post comment for the group " +
            ename +
            " has been edit by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminGroupPostCommentEdit",
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
      `UPDATE group_post_comment 
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

exports.deletegroupspost = async (req, res) => {
  const postid = req.body.id;
  const group_id = req.body.group_id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM groups WHERE id = ?", [group_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.group_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                groups_invite ei
            JOIN 
                groups e ON ei.group_id = e.id
            WHERE 
                ei.group_id = ? And ei.accept = ?`,
        [group_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post for the group " + ename + " has been deleted by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminEventPostdelete",
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

    await query(`DELETE FROM group_post WHERE id = ?`, [postid]);
    await query(`DELETE FROM group_post_comment WHERE group_post_id = ?`, [
      postid,
    ]);
    await query(`DELETE FROM group_post_favourite WHERE post_id = ?`, [postid]);

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

exports.getallgrouppostLikes = (req, res) => {
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
    FROM group_post_favourite u
    JOIN users m ON u.user_id = m.id
    WHERE u.post_id = ?
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

exports.deletegroupcomment = async (req, res) => {
  const postid = req.body.id;
  const group_id = req.body.group_id;
  const wss = req.wss;
  try {
    db.query("SELECT * FROM groups WHERE id = ?", [group_id], (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: "Group not found" });
      }

      db.query(
        `SELECT 
                ei.id AS invite_id,
                ei.user_id,
                ei.sent_id,
                ei.group_id,
                e.name,
                e.id,
                ei.accept,
                ei.date AS invite_date
            FROM 
                groups_invite ei
            JOIN 
                groups e ON ei.group_id = e.id
            WHERE 
                ei.group_id = ? And ei.accept = ?`,
        [group_id, "Yes"],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }
          var ename = rows[0].name;
          var user_id = rows[0].user_id;
          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");
          var readStatus = "No";
          var messages =
            "The post comment for the group " +
            ename +
            " has been deleted by admin";
          var results = [];
          if (results.length > 0) {
            results.forEach((user) => {
              // Insert notification for the user
              db.query(
                "INSERT INTO notification (status, user_id, message, `read`, date) VALUES (?, ?, ?, ?, ?)",
                ["Admin", user.sent_id, messages, readStatus, date],
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
            event: "adminGroupPostdelete",
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

    await query(`DELETE FROM group_post_comment WHERE id = ?`, [postid]);

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
