const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const moment = require("moment-timezone");
require("dotenv").config();
const { Configuration, IPGeolocation } = require("ip2location-io-nodejs");
const { promisify } = require("util"); // To promisify the db.query function

// Promisify the query function
const query = promisify(db.query).bind(db);
exports.getuserchartgraphDoughnut = (req, res) => {
  const user_id = req.body.user_id;

  // SQL Query for overall totals
  const query = `
    SELECT 'Groups' AS category, COUNT(\`groups\`.id) AS total
    FROM \`groups\`
    WHERE \`groups\`.user_id = ?
    
    UNION ALL

    SELECT 'Events' AS category, COUNT(events.id) AS total
    FROM events
    WHERE events.user_id = ?
    
    UNION ALL

    SELECT 'Forum' AS category, COUNT(forum.id) AS total
    FROM forum
    WHERE forum.user_id = ?
    
    UNION ALL

    SELECT 'SpeedDate' AS category, COUNT(speeddate.id) AS total
    FROM speeddate
    WHERE speeddate.user_id = ?
    
    UNION ALL

    SELECT 'Gallery' AS category, COUNT(gallery.id) AS total
    FROM gallery
    WHERE gallery.user_id = ?
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

      // Process results to dynamically set labels and data
      const labels = [];
      const totals = [];
      results.forEach((row) => {
        labels.push(row.category); // 'Groups', 'Events', etc.
        totals.push(row.total); // Corresponding counts
      });

      // Prepare chart data dynamically
      const data = {
        labels: labels,
        datasets: [
          {
            label: "Total",
            data: totals,
            backgroundColor: [
              "#48B7FD",
              "#79C9FC",
              "#FB8EA7",
              "#FBB977",
              "#7DD0D1",
            ],
            borderColor: [
              "#48B7FD",
              "#79C9FC",
              "#FB8EA7",
              "#FBB977",
              "#7DD0D1",
            ],
            borderWidth: 1,
          },
        ],
      };

      // Send the response with dynamic data
      res.status(200).json({ result: data });
    }
  );
};

exports.lastestmessagesent = (req, res) => {
  var id = req.body.id;

  db.query(
    `SELECT chatmessages.id, chatmessages.user_id, chatmessages.to_id, chatmessages.file, chatmessages.message, chatmessages.read, chatmessages.date,
            users.username AS sender, receiver_users.username AS receiver
     FROM chatmessages
     JOIN users ON chatmessages.user_id = users.id
     JOIN users AS receiver_users ON chatmessages.to_id = receiver_users.id
     WHERE chatmessages.user_id = ? And chatmessages.message !=? order by chatmessages.id desc Limit 10`,
    [id, ""],
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

exports.gettotalgender = async (req, res) => {
  try {
    // SQL query to count users based on gender
    const query = `
      SELECT 
        SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS men,
        SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS female,
        SUM(CASE WHEN gender NOT IN ('Male', 'Female') THEN 1 ELSE 0 END) AS other
      FROM users
    `;

    // Fetching the data
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      // Get the counts for men, women, and other categories
      const totals = [
        results[0].men, // Total count of 'Men'
        results[0].female, // Total count of 'Female'
        results[0].other, // Total count of 'Other' gender
      ];
      //console.log(totals);
      // Sending the result in the required format
      return res.status(200).json({ result: totals });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getactiveUsers = async (req, res) => {
  try {
    // SQL query to count users based on gender
    const query = `
      SELECT * from users where online_user = ?`;

    // Fetching the data
    db.query(query, ["Online"], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      return res.status(200).json({ result: results });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getchurnrate = async (req, res) => {
  try {
    // SQL query to count users based on gender
    const query = `
      SELECT users.*,membership.start_date, membership.end_date from users JOIN membership ON membership.user_id = users.id`;

    // Fetching the data
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      if (results.length > 0) {
        const currentDate = moment
          .tz(new Date(), "Europe/Oslo")
          .format("YYYY-MM-DD");

        let lostUsers = [];
        let activeUsers = []; // Counter for active users

        results.forEach((re) => {
          // Convert end_date from the result to the required format
          var enddate = moment
            .tz(new Date(re.end_date), "Europe/Oslo")
            .format("YYYY-MM-DD");

          // Get the current date
          const currentDate = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD");

          // Check if the user is a lost user (end_date <= currentDate)
          if (enddate <= currentDate) {
            lostUsers.push(re); // Add the lost user to the array
          }

          // Check if the user is active (end_date >= currentDate)
          if (enddate >= currentDate) {
            activeUsers.push(re); // Add the active user to the array
          }
        });

        // Calculate the total number of users in both arrays
        var totalLostUsers = lostUsers.length;
        var totalActiveUsers = activeUsers.length;

        // Calculate the percentage of lost users relative to active users
        const lostUsersPercentage =
          totalActiveUsers > 0 ? (totalLostUsers / totalActiveUsers) * 100 : 0; // Avoid division by zero

        // Output the results
        //console.log("Total Lost Users: ", totalLostUsers);
        //console.log("Total Active Users: ", totalActiveUsers);
        //console.log(
        //"Lost Users Percentage: ",
        //lostUsersPercentage.toFixed(2) + "%"
        //);
        var per = lostUsersPercentage.toFixed(2) + "%";
      }
      return res.status(200).json({
        lostuser: totalLostUsers,
        activeuser: totalActiveUsers,
        percentage: per,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getalladmin = async (req, res) => {
  try {
    // SQL query to count users based on gender
    const query = `
      SELECT * from admin order by id desc`;

    // Fetching the data
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }
      return res.status(200).json({
        result: results,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.deleteadmin = async (req, res) => {
  const postid = req.body.id;
  //console.log(req.body);
  try {
    // Start deleting from related tables in the correct order
    await query(`DELETE FROM admin WHERE id = ?`, [postid]);

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
exports.admincreate = async (req, res) => {
  var data = req.body;
  var password = data.password;
  const hashedPassword = await bcrypt.hash(password, 12);
  const roles = data.roles;
  try {
    // Check if the email already exists, excluding the current record if it's an update
    let emailCheckQuery = "SELECT * FROM admin WHERE email = ?";

    if (data.id) {
      // If we are updating, check for email where id is not equal to the current id
      emailCheckQuery += " AND id != ?";
    }

    db.query(
      emailCheckQuery,
      data.id ? [data.email, data.id] : [data.email], // Pass the id if available (for update)
      (err, result) => {
        if (err) {
          console.error("Database query error:", err);
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // If email already exists
        if (result.length > 0) {
          return res.status(200).json({
            message: "Email already exists",
            status: "2",
          });
        }

        // Determine the status (either 'SuperAdmin' or 'Admin')
        var st = data.status === "SuperAdmin" ? "SuperAdmin" : "Admin";

        // If we have an `id`, this means it's an update, else it's an insert
        if (data.id) {
          // Update query
          db.query(
            "UPDATE admin SET name = ?, role=?, email = ?, password = ?, viewpassword = ?, status = ? WHERE id = ?",
            [
              data.name,
              roles,
              data.email,
              hashedPassword,
              data.password,
              st,
              data.id,
            ],
            (err, result) => {
              if (err) {
                console.error("Database update error:", err);
                return res.status(500).json({
                  message: "Database update error",
                  error: err,
                });
              }

              // Respond with success message
              res.status(200).json({
                message: "Updated successfully",
                status: "1", // Return success message
              });
            }
          );
        } else {
          // Insert query
          db.query(
            "INSERT INTO admin (role,name, email, password, viewpassword, status) VALUES (?, ?, ?, ?, ?, ?)",
            [roles, data.name, data.email, hashedPassword, password, st],
            (err, result) => {
              if (err) {
                console.error("Database insertion error:", err);
                return res.status(500).json({
                  message: "Database insertion error",
                  error: err,
                });
              }

              // Respond with success message
              res.status(201).json({
                message: "Created successfully",
                status: "1", // Return success message
              });
            }
          );
        }
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({
      message: "Unexpected error",
      error: err,
    });
  }
};
exports.adminedit = async (req, res) => {
  var data = req.body;
  var password = data.password;

  try {
    // Check if the email already exists, excluding the current record if it's an update
    let emailCheckQuery = "SELECT * FROM admin WHERE email = ?";

    if (data.id) {
      emailCheckQuery += " AND id != ?";
    }

    db.query(
      emailCheckQuery,
      data.id ? [data.email, data.id] : [data.email],
      async (err, result) => {
        if (err) {
          console.error("Database query error:", err);
          return res.status(500).json({
            message: "Database query error",
            error: err,
          });
        }

        // If email already exists
        if (result.length > 0) {
          return res.status(200).json({
            message: "Email already exists",
            status: "2",
          });
        }

        // Fetch the existing admin details by ID
        db.query(
          "SELECT * FROM admin WHERE id=?",
          [data.id],
          async (err, row) => {
            if (err) {
              return res.status(500).json({
                message: "Database query error",
                error: err,
              });
            }

            let hashedPassword;
            let viewPassword;

            if (password) {
              // Hash the new password if provided
              hashedPassword = await bcrypt.hash(password, 12);
              viewPassword = password; // Store plain password if needed
            } else {
              // Use existing password if not changing
              hashedPassword = row[0]?.password || "";
              viewPassword = row[0]?.viewpassword || "";
            }

            // Determine the status
            var status = data.status === "SuperAdmin" ? "SuperAdmin" : "Admin";
            var roles = data.roles.length > 0 ? data.roles : "";

            if (data.id) {
              // Update query
              db.query(
                "UPDATE admin SET name = ?, role = ?, email = ?, password = ?, viewpassword = ?, status = ? WHERE id = ?",
                [
                  data.name,
                  roles,
                  data.email,
                  hashedPassword,
                  viewPassword,
                  status,
                  data.id,
                ],
                (err, result) => {
                  if (err) {
                    console.error("Database update error:", err);
                    return res.status(500).json({
                      message: "Database update error",
                      error: err,
                    });
                  }

                  // Respond with success message
                  res.status(200).json({
                    message: "Updated successfully",
                    status: "1",
                  });
                }
              );
            }
          }
        );
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({
      message: "Unexpected error",
      error: err,
    });
  }
};
exports.getadminLogindetail = async (req, res) => {
  var id = req.body.id;
  try {
    // SQL query to count users based on gender
    const query = `
      SELECT * from admin where id=?`;

    // Fetching the data
    db.query(query, [id], (err, row) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }
      return res.status(200).json({
        result: row[0],
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getalluserlocation = async (req, res) => {
  try {
    // SQL query to fetch all users
    const query = `SELECT 
            usersmulti_login.*, 
            users.*
        FROM 
            usersmulti_login
        JOIN 
            users ON users.id = usersmulti_login.user_id
        WHERE 
            usersmulti_login.id IN (
                SELECT MAX(id) 
                FROM usersmulti_login 
                GROUP BY user_id
            )
        ORDER BY 
            usersmulti_login.id DESC;`;

    db.query(query, async (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }

      return res.status(200).json({
        result: results,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getusertotalgallery = async (req, res) => {
  var id = req.body.user_id;
  try {
    // SQL query to count users based on gender
    const query = `
      SELECT * from gallery where user_id=?`;

    // Fetching the data
    db.query(query, [id], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Database query error",
          error: err,
        });
      }
      return res.status(200).json({
        result: results,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
