const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../db");
const moment = require("moment-timezone");
const Stripe = require("stripe");
const stripe = Stripe(
  "sk_test_51ODoJFAQYHZn8ah9WDYZSBSjs4pRWQshcZfYhaSBJNQnVzi6kbDisu9wIqlrdbmcTOmmG95HHujZ1PvEYLp6ORhe00K0D8eLz5"
); // Replace with your actual secret key
const nodemailer = require("nodemailer");
require("dotenv").config();

exports.getallpayment = (req, res) => {
  var user_id = req.body.user_id;
  // Query the database to get the user by email
  db.query(
    `SELECT u.id,u.profile_image,u.username,u.email, m.*
     FROM users u
     JOIN allmembership m ON u.id = m.user_id
     WHERE PaymentrefundDispute_status = 'History' And user_id =? ORDER BY m.id DESC`,
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
exports.getallpaymentrefund = (req, res) => {
  // Query the database to get the user by email
  var user_id = req.body.user_id;
  db.query(
    `SELECT u.id,u.profile_image,u.username,u.email, m.*
     FROM users u
     JOIN allmembership m ON u.id = m.user_id
     where m.PaymentrefundDispute_status ='Refund'  And user_id =? ORDER BY m.id DESC`,
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
exports.getallpaymentdispute = (req, res) => {
  // Query the database to get the user by email
  var user_id = req.body.user_id;
  db.query(
    `SELECT u.id,u.profile_image,u.username,u.email, m.*
     FROM users u
     JOIN allmembership m ON u.id = m.user_id
     where m.PaymentrefundDispute_status ='Dispute'  And user_id =? ORDER BY m.id DESC`,
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
exports.paymentrefund = async (req, res) => {
  const { paymentIntentId } = req.body; // Extract the payment intent ID from the request body

  try {
    // Refund the payment using the Stripe API
    // const refund = await stripe.refunds.create({
    //   payment_intent: paymentIntentId, // The ID of the payment intent to refund
    // });
    updatemembership(paymentIntentId);
    // Respond with the refund result
    return res.status(200).json({
      success: true,
      message: "Refund processed successfully",
    });
  } catch (error) {
    // Handle any errors that occur during the refund process
    //console.error("Refund Error:", error);
    res.status(200).json({
      success: false,
      message: "Error processing the refund",
      error: error.message,
    });
  }
};
exports.paymentdispute = async (req, res) => {
  const { paymentIntentId } = req.body; // Extract the payment intent ID from the request body

  try {
    // Refund the payment using the Stripe API

    updatemembershipDispute(paymentIntentId);
    // Respond with the refund result
    res.status(200).json({
      success: true,
      result: "",
    });
  } catch (error) {
    // Handle any errors that occur during the refund process
    //console.error("Refund Error:", error);
    res.status(200).json({
      success: false,
      message: "Error processing the refund",
      error: error.message,
    });
  }
};
exports.sendmailuserrefund = async (req, res) => {
  const { paymentIntentId } = req.body; // Extract the payment intent ID from the request body

  try {
    // Refund the payment using the Stripe API

    db.query(
      `SELECT allmembership.*, users.email
       FROM allmembership
       INNER JOIN users ON allmembership.user_id = users.id
       WHERE allmembership.unique_code = ?`,
      [paymentIntentId],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ message: "Database query error", error: err });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: "No records found" });
        }

        const userEmail = results[0].email; // Extract the email from the first result
        const amounts = results[0].amount;
        // Call function to send email
        sendEmailFor_Refund(userEmail, amounts, (info) => {
          res.send(info);
        });
      }
    );
  } catch (error) {
    // Handle any errors that occur during the refund process
    //console.error("Refund Error:", error);
    res.status(200).json({
      success: false,
      message: "Error processing the refund",
      error: error.message,
    });
  }
};
function updatemembership(paymentIntentId) {
  // Check if already refunded before updating
  db.query(
    "SELECT PaymentrefundDispute_status FROM membership WHERE unique_code = ?",
    [paymentIntentId],
    (err, rows) => {
      if (err) {
        console.error("Error checking membership status:", err);
        return;
      }

      if (rows.length > 0 && rows[0].PaymentrefundDispute_status === "Refund") {
        console.log("Already refunded");
        return;
      }

      // Proceed with updating membership table
      db.query(
        "UPDATE membership SET PaymentrefundDispute_status = 'Refund' WHERE unique_code = ?",
        [paymentIntentId],
        (updateErr, result) => {
          if (updateErr) {
            console.error("Error updating membership table:", updateErr);
            return;
          }

          const date = moment
            .tz(new Date(), "Europe/Oslo")
            .format("YYYY-MM-DD HH:mm:ss");

          // Update allmembership table
          db.query(
            "UPDATE allmembership SET PaymentrefundDispute_status = 'Refund', PaymentrefundDispute_date=? WHERE unique_code = ?",
            [date, paymentIntentId],
            (updateErr, result) => {
              if (updateErr) {
                console.error("Error updating allmembership table:", updateErr);
                return;
              }

              console.log("Both tables updated successfully");
            }
          );
        }
      );
    }
  );
}
function updatemembershipDispute(paymentIntentId) {
  // First update the membership table
  db.query(
    "UPDATE membership SET PaymentrefundDispute_status = 'Dispute' WHERE unique_code = ?",
    [paymentIntentId],
    (updateErr, result) => {
      if (updateErr) {
        console.error("Error updating membership table:", updateErr);
        return;
      }
      var date = moment
        .tz(new Date(), "Europe/Oslo")
        .format("YYYY-MM-DD HH:mm:ss");
      // After the first update is successful, update the allmembership table
      db.query(
        "UPDATE allmembership SET PaymentrefundDispute_status = 'Dispute',PaymentrefundDispute_date=? WHERE unique_code = ?",
        [date, paymentIntentId],
        (updateErr, result) => {
          if (updateErr) {
            console.error("Error updating allmembership table:", updateErr);
            return;
          }
          db.query(
            `SELECT allmembership.*, users.email
             FROM allmembership
             INNER JOIN users ON allmembership.user_id = users.id
             WHERE allmembership.unique_code = ?`,
            [paymentIntentId],
            (err, results) => {
              if (err) {
                console.error("Database query error:", err);
              }

              if (results.length === 0) {
              }

              const userEmail = results[0].email; // Extract the email from the first result

              // Call function to send email
              sendEmailFor_Dispute(userEmail, (info) => {
                //res.send(info);
              });
            }
          );

          console.log("Both tables updated successfully");
        }
      );
    }
  );
}

async function sendEmailFor_Dispute(too, callback) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "amourette.no@gmail.com",
      pass: "ozox fcff dftd mguf",
    },
  });

  const mailOptions = {
    from: "amourette.no@gmail.com",
    to: too, // Recipient (Atul's email)
    subject: "Regarding Your Dispute",
    text: "We are sorry, but we do not agree with your refund request. Please tell us more about your experience.",
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
async function sendEmailFor_Refund(to, amount) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "amourette.no@gmail.com",
        pass: "ozox fcff dftd mguf", // Consider using environment variables for security
      },
    });

    const mailOptions = {
      from: "amourette.no@gmail.com",
      to,
      subject: "Regarding Your Refunded",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
          <h2 style="color: #333;">Refund Confirmation</h2>
          <p>Dear Customer,</p>
          <p>This email is to confirm that your refund of <strong>${amount}kr</strong> has been issued by <strong>Amourette</strong>. It can take approximately <strong>10 days</strong> to appear on your statement. If it takes longer, please contact your bank for assistance.</p>
          <p>For any questions, feel free to reach out to our support team.</p>
          <p>Best regards,<br><strong>Amourette Support Team</strong></p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
