const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multerConfig"); // Adjust the path as needed
const profileController = require("../controllers/profileController");

let wss; // WebSocket server instance

// Function to set the WebSocket server
const setWebSocketServerProfile = (webSocketServer) => {
  wss = webSocketServer; // Assign the WebSocket server instance
};

const attachWebSocket = (req, res, next) => {
  req.wss = wss; // Attach the WebSocket server instance to the request
  next();
};
router.post("/getAllFriend", profileController.getAllFriend);
router.post("/getAllFriendfav", profileController.getAllFriendfav);
router.post("/getUsersFriendRequest", profileController.getUsersFriendRequest);
router.post("/AcceptRequest", attachWebSocket, profileController.AcceptRequest);

router.post("/getReceivedMessage", profileController.getReceivedMessage);
router.post(
  "/getReceivedMessageheader",
  profileController.getReceivedMessageheader
);
router.post(
  "/getReceivedMessageheaderSearch",
  profileController.getReceivedMessageheaderSearch
);
router.post("/getSendMessage", profileController.getSendMessage);
router.post("/getSendMessageunread", profileController.getSendMessageunread);
router.post(
  "/getSendMessageSearchunread",
  profileController.getSendMessageSearchunread
);
router.post("/getSendMessageSearch", profileController.getSendMessageSearch);
router.post(
  "/getReceivedMessageSearch",
  profileController.getReceivedMessageSearch
);
router.post(
  "/getReceivedMessageSearchunread",
  profileController.getReceivedMessageSearchunread
);
router.post("/getUserSlug", profileController.getUserSlug);
router.post("/getUsercheckPermisson", profileController.getUsercheckPermisson);

router.post("/setonline", profileController.setonline);
router.post("/setoffline", profileController.setoffline);
router.post("/gettotalOnline", profileController.gettotalOnline);
router.post("/gettotalImages", profileController.gettotalImages);
router.post("/gettotalGroups", profileController.gettotalGroups);
router.post("/gettotalNewMembers", profileController.gettotalNewMembers);
router.post("/gettotalMembers", profileController.gettotalMembers);
router.post("/gettotalEvents", profileController.gettotalEvents);
router.post("/getvisitprofile", profileController.getvisitprofile);
router.post(
  "/speeddateSave",
  upload.single("image"),
  profileController.speeddateSave
);
router.post("/getAlldates", profileController.getAlldates);
router.post("/getAlldatesleftsearch", profileController.getAlldatesleftsearch);
router.post("/getdates", profileController.getdates);
router.post("/getdatesSearch", profileController.getdatesSearch);
router.post("/getAlldatesSearch", profileController.getAlldatesSearch);
router.post("/getAllforum", profileController.getAllforum);
router.post("/getforum", profileController.getforum);
router.post("/getAllforumSearch", profileController.getAllforumSearch);
router.post("/getforumSearch", profileController.getforumSearch);
router.post("/get_ForumDetailSlug", profileController.get_ForumDetailSlug);
router.post(
  "/get_SpeeddateDetailSlug",
  profileController.get_SpeeddateDetailSlug
);
router.post("/speeddelete", profileController.speeddelete);
router.post("/getfforumComments", profileController.get_ForumComments);
router.post("/getspeedComments", profileController.getspeedComments);
router.post("/forumdelete", profileController.forumdelete);
router.post("/forumSave", upload.single("image"), profileController.forumSave);
router.post("/forumedit", upload.single("image"), profileController.forumedit);
router.post(
  "/forumeditfile",
  upload.single("image"),
  profileController.forumeditfile
);
router.post("/userreport", profileController.userreport);
router.post("/getdatesSearchfilter", profileController.getdatesSearchfilter);
router.post(
  "/getalldatesSearchfilter",
  profileController.getalldatesSearchfilter
);
router.post("/allforumfilter", profileController.allforumfilter);
router.post("/handlepostDelete", profileController.handlepostDelete);
router.post("/getdatesedit", profileController.getdatesedit);
router.post("/speeddateUpdatess", profileController.speeddateUpdate);
router.post("/areafilterspeedDates", profileController.areafilterspeedDates);

router.post(
  "/updatespeed_dates",
  upload.single("image"),
  profileController.updatespeed_dates
);
router.post("/getrec", profileController.getrec);
router.post("/getallforumDiscover", profileController.getallforumDiscover);
//module.exports = router;
module.exports = { router, setWebSocketServerProfile };
