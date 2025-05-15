const express = require("express");
const router = express.Router();
//const upload = require("../middlewares/multerConfig"); // Adjust the path as needed

const notificationsController = require("../controllers/notificationsController");
let wss; // WebSocket server instance

// Function to set the WebSocket server
const setWebSocketServerNotification = (webSocketServer) => {
  wss = webSocketServer; // Assign the WebSocket server instance
};

const attachWebSocket = (req, res, next) => {
  req.wss = wss; // Attach the WebSocket server instance to the request
  next();
};

router.post(
  "/getnotifications",
  attachWebSocket, // Upload the files before the controller
  notificationsController.getnotifications // Call the controller to handle the chat message saving
);
router.post(
  "/getnotificationsdashboard",
  attachWebSocket, // Upload the files before the controller
  notificationsController.getnotificationsdashboard // Call the controller to handle the chat message saving
);
router.post(
  "/updatenotifications",
  notificationsController.updatenotifications // Call the controller to handle the chat message saving
);
router.post(
  "/notificationfriend_request",
  notificationsController.notificationfriend_request // Call the controller to handle the chat message saving
);
router.post(
  "/notificationnew_message",
  notificationsController.notificationnew_message // Call the controller to handle the chat message saving
);
router.post(
  "/notificationevent_group",
  notificationsController.notificationevent_group // Call the controller to handle the chat message saving
);
router.post(
  "/notificationnew_created",
  notificationsController.notificationnew_created // Call the controller to handle the chat message saving
);
router.post(
  "/notificationnews_update",
  notificationsController.notificationnews_update // Call the controller to handle the chat message saving
);
router.post(
  "/notificationnews_profile",
  notificationsController.notificationnews_profile // Call the controller to handle the chat message saving
);
router.post(
  "/notificationspecial_offers",
  notificationsController.notificationspecial_offers // Call the controller to handle the chat message saving
);
router.post(
  "/notificationother_users",
  notificationsController.notificationother_users // Call the controller to handle the chat message saving
);
router.post(
  "/notificationactive_users",
  notificationsController.notificationactive_users // Call the controller to handle the chat message saving
);
router.post(
  "/album_statussave",
  notificationsController.album_statussave // Call the controller to handle the chat message saving
);
router.post(
  "/setgdprCookies",
  notificationsController.setgdprCookies // Call the controller to handle the chat message saving
);
router.post(
  "/notificationall_request",
  notificationsController.notificationall_request // Call the controller to handle the chat message saving
);
router.post(
  "/getnotificationsall",
  notificationsController.getnotificationsall // Call the controller to handle the chat message saving
);
router.post(
  "/getnotificationsallMessages",
  notificationsController.getnotificationsallMessages // Call the controller to handle the chat message saving
);

module.exports = { router, setWebSocketServerNotification };
