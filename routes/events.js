const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multerConfig"); // Adjust the path as needed

const eventsController = require("../controllers/eventsController");
let wss; // WebSocket server instance

// Function to set the WebSocket server
const setWebSocketServerEvent = (webSocketServer) => {
  wss = webSocketServer; // Assign the WebSocket server instance
};

const attachWebSocket = (req, res, next) => {
  req.wss = wss; // Attach the WebSocket server instance to the request
  next();
};
// Define the POST /register route
router.post(
  "/events",
  upload.single("image"),
  attachWebSocket,
  eventsController.events
);
router.post("/getallYourevents", eventsController.getallYourevents);
router.post("/getallYoureventsUser", eventsController.getallYoureventsUser);
router.post("/sendEventinvite", eventsController.sendEventinvite);
router.post("/get_EventDetail", eventsController.get_EventDetail);
router.post("/get_EventDetailSlug", eventsController.get_EventDetailSlug);
router.post("/userDeleteEvent", eventsController.userDeleteEvent);
router.post("/getallevents", eventsController.getallevents);
router.post(
  "/get_EventdetailAllIntersted",
  eventsController.get_EventdetailAllIntersted
);
router.post("/userEventIntersted", eventsController.userEventIntersted);
router.post("/get_EventIntersted", eventsController.get_EventIntersted);

router.post(
  "/createEventPost",
  upload.single("image"), // Upload the image before the controller
  (req, res, next) => {
    // This middleware runs after the upload and before the controller
    next();
  },
  eventsController.createEventPost // Call the controller to handle the event post creation
);
router.post("/get_postComment", eventsController.get_postComment);
router.post(
  "/CreateEventPostComment",
  attachWebSocket,
  eventsController.CreateEventPostComment
);
router.post("/EventpostFavourite", eventsController.EventpostFavourite);
router.post("/GetEventPostComments", eventsController.GetEventPostComments);
router.post(
  "/getalleventsWithInterseted",
  eventsController.getalleventsWithInterseted
);
router.post("/getEventInterstedUser", eventsController.getEventInterstedUser);
router.post("/UsercheckAccept", eventsController.UsercheckAccept);
router.post("/DeleteInviteRequest", eventsController.DeleteInviteRequest);
router.post("/eventAccepted", attachWebSocket, eventsController.eventAccepted);
router.post("/getAlleventsSearch", eventsController.getAlleventsSearch);
router.post("/geteventsSearch", eventsController.geteventsSearch);
router.post("/getalleventsDiscover", eventsController.getalleventsDiscover);
router.post(
  "/getalleventsDiscoverYour",
  eventsController.getalleventsDiscoverYour
);
router.post("/get_eventSearch", eventsController.get_eventSearch);
router.post("/eventpostDelete", eventsController.eventpostDelete);
router.post("/getinviteUserEvent", eventsController.getinviteUserEvent);
router.post(
  "/eventseditfile",
  upload.single("image"),
  attachWebSocket,
  eventsController.eventseditfile
);
router.post("/eventsedit", attachWebSocket, eventsController.eventsedit);
router.post("/getEventDetailSlug", eventsController.getEventDetailSlug);
router.post("/get_postCommentt", eventsController.get_postCommentt);

router.post("/getEventPostData", eventsController.getEventPostData);
router.post("/getEventpostComment", eventsController.getEventpostComment);
module.exports = { router, setWebSocketServerEvent };
