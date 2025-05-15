const express = require("express");
const router = express.Router();

const adminaSendNotificationController = require("../controllers/admin/adminSendNotificationController");
// Define the POST /login route
let wss; // WebSocket server instance

// Function to set the WebSocket server
const setWebSocketServerAdminNotification = (webSocketServer) => {
  wss = webSocketServer; // Assign the WebSocket server instance
};

const attachWebSocket = (req, res, next) => {
  req.wss = wss; // Attach the WebSocket server instance to the request
  next();
};

router.post(
  "/sendallusers",
  attachWebSocket,
  adminaSendNotificationController.sendallusers
);
router.post(
  "/getnotificationadmin",
  adminaSendNotificationController.getnotificationadmin
);
router.post(
  "/deletenotifications",
  adminaSendNotificationController.deletenotifications
);
module.exports = { router, setWebSocketServerAdminNotification };
