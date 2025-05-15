const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
require("dotenv").config();

exports.getallusers = (req, res) => {
  //console.log("oo");
  // Query the database to get the user by email
  db.query(
    `SELECT u.*, m.user_id,m.start_date,m.end_date,m.days,m.plan 
     FROM users u 
     Left JOIN membership m ON u.id = m.user_id 
     ORDER BY u.id DESC`,
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Return results with status 200 if the query is successful
      res.status(200).json({ result: results });
    }
  );
};
// exports.gettotalgroups = (req, res) => {
//   console.log("oo");
//   // Query the database to get the user by email
//   db.query(
//     `SELECT * from groups`,
//     (err, results) => {
//       if (err) {
//         return res
//           .status(500)
//           .json({ message: "Database query error", error: err });
//       }

//       // Return results with status 200 if the query is successful
//       res.status(200).json({ result: results });
//     }
//   );
// };

exports.deleteusers = (req, res) => {
  const userId = req.body.id;

  // Delete the membership record first
  db.query(
    "DELETE FROM membership WHERE user_id = ?",
    [userId],
    (deleteErr) => {
      if (deleteErr) {
        return res.status(500).json({
          message: "Error deleting from membership table",
          error: deleteErr,
        });
      }

      // If membership record is deleted successfully, delete the user record
      db.query("DELETE FROM users WHERE id = ?", [userId], (userErr) => {
        if (userErr) {
          return res.status(500).json({
            message: "Error deleting from users table",
            error: userErr,
          });
        }
        db.query(
          "DELETE FROM blockuser WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM chatmessages WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM events WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM events_intersted WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM events_invite WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM event_post WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM event_post_comment WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM 	event_post_favourite WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query("DELETE FROM 	forum WHERE user_id = ?", [userId], (userErr) => {
          if (userErr) {
            return res.status(500).json({
              message: "Error deleting from users table",
              error: userErr,
            });
          }

          // If both queries succeed, return success message
        });
        db.query(
          "DELETE FROM forum_comment WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM friendRequest_accept WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM gallery WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM gallery WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM gallery_comment WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM gallery_favourite WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM groups WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM groups_intersted WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM groups_invite WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM group_post WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM group_post_comment WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM group_post_favourite WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM notification WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM speeddate WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM userphotoprivate WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM userreport WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM usersalbum WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        db.query(
          "DELETE FROM usersmulti_login WHERE user_id = ?",
          [userId],
          (userErr) => {
            if (userErr) {
              return res.status(500).json({
                message: "Error deleting from users table",
                error: userErr,
              });
            }

            // If both queries succeed, return success message
          }
        );
        // If both queries succeed, return success message
        res.status(200).json({
          message: "User and membership deleted successfully",
        });
      });
    }
  );
};

exports.editprofile = (req, res) => {
  const { id, status } = req.body; // Destructure the id and status from the request body
  //console.log(id, status); // Optional: to check if the values are correct

  // SQL query to update the user's status
  const query = "UPDATE users SET status = ? WHERE id = ?";

  // Execute the query
  db.query(query, [status, id], (err, result) => {
    if (err) {
      console.error(err); // Log the error for debugging
      return res.status(500).json({
        message: "Error updating user status",
        error: err,
      });
    }

    // If the query is successful, send a response
    return res.status(200).json({
      message: "User status updated successfully",
      result: result,
    });
  });
};

exports.getallmedia = (req, res) => {
  // Query the database to get the user by email
  db.query(
    `SELECT 
        u.*, 
        m.username, 
        COUNT(gc.gallery_id) AS total_comments, 
        COUNT(gf.gallery_id) AS total_favorites
     FROM gallery u 
     JOIN users m ON u.user_id = m.id 
     LEFT JOIN gallery_comment gc ON u.id = gc.gallery_id 
     LEFT JOIN gallery_favourite gf ON u.id = gf.gallery_id
     GROUP BY u.id, m.username
     ORDER BY u.id DESC`,
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Return results with status 200 if the query is successful
      res.status(200).json({ result: results });
    }
  );
};
exports.deletemedia = (req, res) => {
  // Query the database to get the user by email
  var galleryId = req.body.id;
  db.query(
    `DELETE FROM gallery WHERE id = ?`,
    [galleryId], // Passing the galleryId to the query
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Database delete error",
          error: err,
        });
      }

      db.query(
        `DELETE FROM gallery_comment WHERE gallery_id = ?`,
        [galleryId], // Passing the galleryId to the query
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: "Database delete error",
              error: err,
            });
          }

          db.query(
            `DELETE FROM gallery_favourite WHERE gallery_id = ?`,
            [galleryId], // Passing the galleryId to the query
            (err, result) => {
              if (err) {
                return res.status(500).json({
                  message: "Database delete error",
                  error: err,
                });
              }

              // Return success response
            }
          );
        }
      );
      return res.status(200).json({
        message: "Gallery item deleted successfully",
      });
    }
  );
};

exports.getallgroups = (req, res) => {
  // Query the database to get the user by email
  db.query(
    `SELECT 
    u.*, 
    m.username, 
    COUNT(gc.group_id) AS total_post
FROM 
    groups u 
JOIN 
    users m ON u.user_id = m.id 
LEFT JOIN 
    group_post gc ON u.id = gc.group_id 
GROUP BY 
    u.id, m.username 
ORDER BY 
    u.id DESC;
`,
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Return results with status 200 if the query is successful
      res.status(200).json({ result: results });
    }
  );
};

const { promisify } = require("util"); // To promisify the db.query function

// Promisify the query function
const query = promisify(db.query).bind(db);

exports.deletegroup = async (req, res) => {
  const groupId = req.body.id;

  try {
    // Start deleting from related tables in the correct order
    await query(`DELETE FROM groups WHERE id = ?`, [groupId]);
    await query(`DELETE FROM group_post_comment WHERE group_id = ?`, [groupId]);
    await query(`DELETE FROM group_post_favourite WHERE group_id = ?`, [
      groupId,
    ]);
    await query(`DELETE FROM group_post WHERE group_id = ?`, [groupId]);
    await query(`DELETE FROM groups_invite WHERE group_id = ?`, [groupId]);
    await query(`DELETE FROM groups_intersted WHERE group_id = ?`, [groupId]);

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

exports.getallforum = (req, res) => {
  // Query the database to get the user by email
  db.query(
    `SELECT 
        u.*, 
        m.username, 
        COUNT(gc.forum_id) AS total_comments
     FROM forum u 
     JOIN users m ON u.user_id = m.id 
     LEFT JOIN forum_comment gc ON u.id = gc.forum_id 
     GROUP BY u.id, m.username
     ORDER BY u.id DESC`,
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Return results with status 200 if the query is successful
      res.status(200).json({ result: results });
    }
  );
};

exports.deleteforum = (req, res) => {
  // Query the database to get the user by email
  var forumid = req.body.id;
  db.query(
    `DELETE FROM forum WHERE id = ?`,
    [forumid], // Passing the forumid to the query
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Database delete error",
          error: err,
        });
      }

      db.query(
        `DELETE FROM forum_comment WHERE forum_id = ?`,
        [forumid], // Passing the forumid to the query
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: "Database delete error",
              error: err,
            });
          }
        }
      );
      return res.status(200).json({
        message: "Gallery item deleted successfully",
      });
    }
  );
};

exports.getallmessaging = (req, res) => {
  // Query the database to get the user by email
  db.query(
    `SELECT 
        u.*, 
        m.username
     FROM chatmessages u 
     JOIN users m ON u.user_id = m.id 
     ORDER BY u.id DESC`,
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      // Return results with status 200 if the query is successful
      res.status(200).json({ result: results });
    }
  );
};
exports.deletemessage = (req, res) => {
  var id = req.body.id;
  // Query the database to get the user by email

  db.query(
    `DELETE FROM chatmessages WHERE id = ?`,
    [id], // Passing the forumid to the query
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Database delete error",
          error: err,
        });
      }

      return res.status(200).json({
        message: "",
      });
    }
  );
};
