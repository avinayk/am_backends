const bcrypt = require("bcryptjs");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const nodemailer = require("nodemailer");
require("dotenv").config();

exports.gettotalgroups = (req, res) => {
  db.query("SELECT * FROM `groups`", (err, results) => {
    if (err) {
      console.error("Database Query Error:", err);
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: results });
  });
};

exports.gettotalevents = (req, res) => {
  db.query(`SELECT * from events`, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: results });
  });
};
exports.gettotalforum = (req, res) => {
  db.query(`SELECT * from forum`, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: results });
  });
};
exports.gettotalspeeddate = (req, res) => {
  db.query(`SELECT * from speeddate`, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: results });
  });
};
exports.getallusersreport = (req, res) => {
  const query = `
    SELECT 
  userreport.id, 
  userreport.user_id, 
  userreport.to_id, 
  userreport.report, 
  userreport.otherReport, 
  userreport.date, 
  reportedUser.username AS reportedUser,  -- The username of the reported user (user_id)
  reportedUser.email AS reportedUserEmail,  -- The email of the reported user
  reporterUser.username AS reporterUser,  -- The username of the user who reported (to_id)
  reporterUser.email AS reporterUserEmail  -- The email of the user who reported
FROM userreport
INNER JOIN users AS reportedUser ON userreport.user_id = reportedUser.id  -- Joining for the reported user
INNER JOIN users AS reporterUser ON userreport.to_id = reporterUser.id  -- Joining for the user who reported

  `;

  db.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: results });
  });
};
exports.getuserdetail = (req, res) => {
  var slug = req.body.slug; // Use req.params.slug for URL parameters
  const query = `
    SELECT * from users WHERE slug = ?`;

  db.query(query, [slug], (err, row) => {
    // Pass 'slug' as an array
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: row[0] });
  });
};
exports.getuserdetailAll = (req, res) => {
  var slug = req.body.slug; // Use req.params.slug for URL parameters
  const query = `
    SELECT u.*, COUNT(uml.user_id) AS total_logins
FROM users u
LEFT JOIN usersmulti_login uml ON u.id = uml.user_id
GROUP BY u.id
ORDER BY u.id DESC;
`;

  db.query(query, [slug], (err, results) => {
    // Pass 'slug' as an array
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }
    res.status(200).json({ result: results });
  });
};
function createUniqueSlug(title, email) {
  return new Promise((resolve, reject) => {
    const slug = generateSlug(title);

    // Check if the slug already exists
    db.query(
      "SELECT COUNT(*) as count FROM users WHERE slug = ? And email != ?",
      [slug, email],
      (err, rows) => {
        if (err) {
          return reject(err); // Handle the error
        }

        // If the slug exists, add a number to the end and check again
        if (rows[0].count > 0) {
          let i = 1;
          const checkSlug = () => {
            const newSlug = `${slug}-${i}`;
            db.query(
              "SELECT COUNT(*) as count FROM users WHERE slug = ?",
              [newSlug],
              (err, newRows) => {
                if (err) {
                  return reject(err); // Handle the error
                }
                if (newRows[0].count === 0) {
                  return resolve(newSlug); // Return the new unique slug
                }
                i++;
                checkSlug(); // Check again with the incremented slug
              }
            );
          };
          checkSlug(); // Start checking with the incremented slug
        } else {
          resolve(slug); // Return the original slug if it's unique
        }
      }
    );
  });
}
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove invalid characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/--+/g, "-"); // Replace multiple hyphens with a single one
}
exports.updateProfile = async (req, res) => {
  const {
    subregion,
    sexuality,
    interstedin,
    connectwith,
    genders,
    token,
    email,
    looking_for,
    username,
    location,
    town,
    preferences_text,
    nationality,
    bodytype,
    height_feet,
    height_inches,
    sexual_orientation,
    relationship_status,
    search_looking_for,
    degree,
    drinker,
    smoker,
    tattos,
    body_piercings,
    fetish,
  } = req.body;

  // Fetch existing user data from the database
  db.query(
    `SELECT * FROM users WHERE email = ?`,
    [email],
    async (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database fetch error", error: err });
      }

      if (result.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate the slug from username
      const slug = await createUniqueSlug(username, email);
      const profileImageUrl =
        req.files["profile_image"]?.[0]?.location || existingUser.profile_image;
      // Get existing values
      const existingUser = result[0];

      const sexualityValues = Array.isArray(sexuality)
        ? JSON.stringify(sexuality)
        : sexuality; // Ensure sexuality is stored as a JSON string
      try {
        if (!email) {
          return res
            .status(400)
            .json({ message: "Email is required to update profile" });
        }

        // Check if username is being changed and if the new username is available
        if (username !== existingUser.username) {
          // Ensure username is not the same as email
          if (username.toLowerCase() === email.toLowerCase()) {
            return res
              .status(400)
              .json({ message: "Username cannot be the same as email" });
          }

          // Check if the new username already exists
          db.query(
            "SELECT * FROM users WHERE username = ?",
            [username],
            (err, rows) => {
              if (err) {
                return res
                  .status(500)
                  .json({ message: "Database query error", error: err });
              }

              if (rows.length > 0) {
                return res
                  .status(400)
                  .json({ message: "Username already exists" });
              }

              // Proceed with updating the profile if username is unique

              updateUserProfile();
            }
          );
        } else {
          // If username is not changed, proceed to update the profile

          updateUserProfile();
        }

        function updateUserProfile() {
          // Update user in the database
          db.query(
            `UPDATE users SET subregion=?,sexuality=?,
               interstedin=?, connectwith=?, gender=?,
              looking_for=?, username=?, location=?,town=?, preferences_text=?, nationality=?,
              bodytype=?, height_feet=?, height_inches=?, sexual_orientation=?, relationship_status=?,
              search_looking_for=?, degree=?, drinker=?, smoker=?, tattos=?, body_piercings=?, fetish=?,profile_image=?,
              slug=?
              WHERE email=?`,
            [
              subregion,
              sexualityValues,
              interstedin,
              connectwith,
              genders,
              looking_for,
              username,
              location,
              town,
              preferences_text,
              nationality,
              bodytype,
              height_feet,
              height_inches,
              sexual_orientation,
              relationship_status,
              search_looking_for,
              degree,
              drinker,
              smoker,
              tattos,
              body_piercings,
              fetish,
              profileImageUrl,
              slug,
              email,
            ],
            (err, result) => {
              if (err) {
                return res
                  .status(500)
                  .json({ message: "Database update error", error: err });
              }

              if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User not found" });
              }

              res.status(200).json({
                message: "User profile updated successfully",
                slug: slug,
              });
            }
          );
        }
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    }
  );
};
exports.getallmediaComments = (req, res) => {
  const gallery_id = req.body.id;

  // Validate that gallery_id is provided
  if (!gallery_id) {
    return res.status(400).json({ message: "Gallery ID is required" });
  }

  const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM gallery_comment u
    JOIN users m ON u.user_id = m.id
    WHERE u.gallery_id = ? -- Filter by gallery_id
    ORDER BY u.id ASC
  `;

  db.query(query, [gallery_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};
exports.getallmediaLikes = (req, res) => {
  const gallery_id = req.body.id;

  // Validate that gallery_id is provided
  if (!gallery_id) {
    return res.status(400).json({ message: "Gallery ID is required" });
  }

  const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM gallery_favourite u
    JOIN users m ON u.user_id = m.id
    WHERE u.gallery_id = ? -- Filter by gallery_id
    ORDER BY u.id ASC
  `;

  db.query(query, [gallery_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};

exports.getallgroupsComments = (req, res) => {
  const group_id = req.body.id;

  // Validate that gallery_id is provided
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required" });
  }

  const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM group_post_comment	 u
    JOIN users m ON u.user_id = m.id
    WHERE u.group_id = ?
    ORDER BY u.id ASC
  `;

  db.query(query, [group_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};

exports.getallgroupLikes = (req, res) => {
  const group_id = req.body.id;

  // Validate that group_id is provided
  if (!group_id) {
    return res.status(400).json({ message: "Group ID is required" });
  }

  const query = `
    SELECT 
      u.*, 
      m.username, 
      m.profile_image
    FROM group_post_favourite u
    JOIN users m ON u.user_id = m.id
    WHERE u.group_id = ?
    ORDER BY u.id ASC
  `;

  db.query(query, [group_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};
exports.gettotalSaleRevenue = (req, res) => {
  const query = `
    SELECT
      YEAR(start_date) AS year,
      SUM(CAST(amount AS DECIMAL(10, 2))) AS total_sale,
      SUM(CAST(amount AS DECIMAL(10, 2))) AS total_revenue
    FROM allmembership
    GROUP BY YEAR(start_date)
    ORDER BY YEAR(start_date) ASC;
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    // Format the response to match your chart structure
    const data = {
      labels: results.map((row) => row.year), // Years (e.g., ["2016", "2017", "2018", ...])
      datasets: [
        {
          label: "Sale",
          data: results.map((row) => row.total_sale), // Sale values
          backgroundColor: "rgba(0, 156, 255, .7)",
        },
        {
          label: "Revenue",
          data: results.map((row) => row.total_revenue), // Revenue values
          backgroundColor: "rgba(0, 156, 255, .5)",
        },
      ],
    };

    res.status(200).json({ result: data });
  });
};
exports.getrecentSale = (req, res) => {
  const query = `SELECT allmembership.*, users.username
              FROM allmembership
              JOIN users ON allmembership.user_id = users.id
              WHERE allmembership.plan != ?
              ORDER BY allmembership.id DESC
              LIMIT 10;
            `;

  db.query(query, ["Free"], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};
exports.getrecentMessage = (req, res) => {
  const query = `SELECT chatmessages.*, users.username,users.profile_image
              FROM chatmessages
              JOIN users ON chatmessages.user_id = users.id
              ORDER BY chatmessages.id DESC
              LIMIT 10;
            `;

  db.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};
exports.getLatestUsers = (req, res) => {
  const query = `SELECT * from users
              ORDER BY id DESC
              LIMIT 10;
            `;

  db.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};

exports.getcheckSiteSpeed = (req, res) => {};
async function sendEmailForInvoicedata(pdf, to, subjecttext, callback) {
  try {
    const pdfBuffer = Buffer.from(pdf, "base64"); // Convert base64 to Buffer
    const filePath = "invoice.pdf";

    fs.writeFileSync(filePath, pdfBuffer); // Save PDF file

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "amourette.no@gmail.com",
        pass: "ozox fcff dftd mguf", // Use an App Password
      },
    });

    const mailOptions = {
      from: "amourette.no@gmail.com",
      to: to, // Use the email provided
      subject: subjecttext,
      text: "Dear User,\n\nPlease find your invoice attached.\n\nThank you,\nAmourette Team",
      attachments: [
        {
          filename: "invoice.pdf",
          path: filePath,
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      fs.unlinkSync(filePath); // Delete PDF after sending

      if (error) {
        console.error("Error sending email:", error);
        callback({ error: "Email sending failed" });
      } else {
        console.log("Email sent:", info.response);
        callback({ message: "Email sent successfully", info });
      }
    });
  } catch (err) {
    console.error("Error processing email:", err);
    callback({ error: "Internal Server Error" });
  }
}
exports.send_invoice = (req, res) => {
  const { pdf, email, subjecttext } = req.body;

  if (!pdf || !email) {
    return res.status(400).json({ error: "Missing PDF data or email address" });
  }

  sendEmailForInvoicedata(pdf, email, subjecttext, (response) => {
    res.json(response);
  });
};

exports.getinvoieData = (req, res) => {
  var id = req.body.id;
  const query = `SELECT allmembership.*, users.username
              FROM allmembership
              JOIN users ON allmembership.user_id = users.id
              WHERE allmembership.id = ?`;

  db.query(query, [id], (err, row) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: row[0] });
  });
};
exports.getUserMultipleLogin = (req, res) => {
  var id = req.body.id;
  const query = `SELECT * from usersmulti_login WHERE user_id = ? order by id desc`;
  db.query(query, [id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: results });
  });
};

exports.privacyinformationSave = (req, res) => {
  const {
    about_us,
    privacy_policy,
    information_collection,
    cookies_text,
    information_sharing,
    data_security,
    contact_information,
    support_and,
    delivery_time,
    membership,
    right_of_withdrawal,
    sale_to,
    payment_solution,
  } = req.body;

  // Query to check if there's an existing privacy policy
  const query = `SELECT * from privacypolicy LIMIT 1`;

  db.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    if (results.length > 0) {
      // If there's an existing record, update it
      const updateQuery = `
        UPDATE privacypolicy
        SET 
          about_us = ?, 
          privacy_policy = ?, 
          information_collection = ?, 
          cookies_text = ?, 
          information_sharing = ?, 
          data_security = ?, 
          contact_information = ?, 
          support_and = ?, 
          delivery_time = ?, 
          membership = ?, 
          right_of_withdrawal = ?, 
          sale_to = ?, 
          payment_solution = ?
        WHERE id = ?`;

      const updateValues = [
        about_us,
        privacy_policy,
        information_collection,
        cookies_text,
        information_sharing,
        data_security,
        contact_information,
        support_and,
        delivery_time,
        membership,
        right_of_withdrawal,
        sale_to,
        payment_solution,
        results[0].id, // Update based on the existing record's ID
      ];

      db.query(updateQuery, updateValues, (err, updateResult) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database update error", error: err });
        }
        return res.status(200).json({
          message: "Privacy policy updated successfully",
          result: updateResult,
        });
      });
    } else {
      // If no record exists, insert a new one
      const insertQuery = `
        INSERT INTO privacypolicy (
          about_us,
          privacy_policy,
          information_collection,
          cookies_text,
          information_sharing,
          data_security,
          contact_information,
          support_and,
          delivery_time,
          membership,
          right_of_withdrawal,
          sale_to,
          payment_solution
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const insertValues = [
        about_us,
        privacy_policy,
        information_collection,
        cookies_text,
        information_sharing,
        data_security,
        contact_information,
        support_and,
        delivery_time,
        membership,
        right_of_withdrawal,
        sale_to,
        payment_solution,
      ];

      db.query(insertQuery, insertValues, (err, insertResult) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database insert error", error: err });
        }
        return res.status(200).json({
          message: "Privacy policy inserted successfully",
          result: insertResult,
        });
      });
    }
  });
};

exports.getprivacydetail = (req, res) => {
  const query = `SELECT * from privacypolicy`;
  db.query(query, (err, row) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Database query error", error: err });
    }

    res.status(200).json({ result: row[0] });
  });
};
exports.forgotPassword = (req, res) => {
  const { email, question, securityAnswer } = req.body;

  // Query the database to get the user by email
  db.query(
    "SELECT * FROM admin WHERE email = ?",
    [email],
    async (err, rows) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      if (rows.length > 0) {
        const user = rows[0];

        // Generate and update password
        var password = generateRandomPassword(8);
        const hashedPassword = await bcrypt.hash(password, 12);

        db.query(
          "UPDATE admin  SET viewpassword = ?, password = ? WHERE email = ?",
          [password, hashedPassword, email],
          (updateErr, updateRes) => {
            if (updateErr) {
              return res.status(500).json({
                message: "Password update error",
                error: updateErr,
              });
            }

            // Send email for password reset
            sendEmailForResetpassword(user.email, password, (info) => {
              res.send(info);
            });
          }
        );
        // If no question & answer provided, return stored password
        return res.status(200).json({
          message: "Password retrieved successfully,Please check your email",
          viewpassword: user.viewpassword,
          status: "1",
        });
      } else {
        return res.status(200).json({ message: "Invalid email", status: "2" });
      }
    }
  );
};

async function sendEmailForResetpassword(to, pass, callback) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf", // Consider using environment variables for better security
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: to,
    subject: "Password Reset Request for Amourette",
    text: `Hello,

We received a request to reset the password for your Amourette account.

Your new password is: ${pass}

Please use this password to log in. We recommend updating your password after you log in to ensure the security of your account.

If you did not request this reset, please ignore this email or contact support.

Best regards,
Amourette Team`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      return callback(error, null); // Handle error by passing it to the callback
    } else {
      console.log("Email sent:", info.response); // Log email success response
      return callback(null, info.response); // Pass successful response to callback
    }
  });
}
function generateRandomPassword(length) {
  const lowerCase = "abcdefghijklmnopqrstuvwxyz";
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const specialChars = "!@#$%^&*()_+[]{}|;:,.<>?";

  // Ensure the password meets the minimum length of 8 characters
  if (length < 8) {
    throw new Error("Password length must be at least 8 characters");
  }

  // Generate a random password that contains at least one character from each category
  let password = "";
  password += lowerCase[Math.floor(Math.random() * lowerCase.length)];
  password += upperCase[Math.floor(Math.random() * upperCase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the rest of the password with random characters from all categories
  const allChars = lowerCase + upperCase + digits + specialChars;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to ensure random distribution of character types
  password = password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");

  return password;
}
