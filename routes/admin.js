const express = require("express");
const router = express.Router();
const loginController = require("../controllers/admin/loginController");
const upload = require("../middlewares/multerConfig"); // Adjust the path as needed
const {
  uploadVideo,
  resizeVideoIfNecessary,
} = require("../middlewares/multerConfigVideo");
const userController = require("../controllers/admin/userController");
const paymentController = require("../controllers/admin/paymentController");
const adminapiController = require("../controllers/admin/adminapiController");
const adminapibasicController = require("../controllers/admin/adminapibasicController");
const adminapiproController = require("../controllers/admin/adminapiproController");
const adminapiVipController = require("../controllers/admin/adminapiVipController");
let wss; // WebSocket server instance

// Function to set the WebSocket server
const setWebSocketServerAdminMain = (webSocketServer) => {
  wss = webSocketServer; // Assign the WebSocket server instance
};

const attachWebSocket = (req, res, next) => {
  req.wss = wss; // Attach the WebSocket server instance to the request
  next();
};
// Define the POST /login route
router.post("/login", loginController.login);

router.post("/getallusers", userController.getallusers);
router.post("/deleteusers", userController.deleteusers);
router.post("/editprofile", userController.editprofile);
router.post("/getallmedia", userController.getallmedia);
router.post("/deletemedia", userController.deletemedia);
router.post("/getallgroups", userController.getallgroups);
router.post("/deletegroup", userController.deletegroup);
router.post("/getallforum", userController.getallforum);
router.post("/deleteforum", userController.deleteforum);
router.post("/getallmessaging", userController.getallmessaging);
router.post("/deletemessage", userController.deletemessage);
router.post("/getallpayment", paymentController.getallpayment);
router.post("/getallpaymentrefund", paymentController.getallpaymentrefund);
router.post("/getallpaymentdispute", paymentController.getallpaymentdispute);

router.post("/gettotalgroups", adminapiController.gettotalgroups);
router.post("/gettotalevents", adminapiController.gettotalevents);
router.post("/gettotalforum", adminapiController.gettotalforum);
router.post("/gettotalspeeddate", adminapiController.gettotalspeeddate);
router.post("/getallusersreport", adminapiController.getallusersreport);
router.post("/getuserdetail", adminapiController.getuserdetail);
router.post(
  "/updateProfile",
  upload.fields([
    { name: "profile_image", maxCount: 1 },
    // Add more fields if necessary
  ]),
  adminapiController.updateProfile
);
router.post("/getallmediaComments", adminapiController.getallmediaComments);
router.post("/getallmediaLikes", adminapiController.getallmediaLikes);
router.post("/getallgroupsComments", adminapiController.getallgroupsComments);
router.post("/getallgroupLikes", adminapiController.getallgroupLikes);
router.post("/paymentrefund", paymentController.paymentrefund);
router.post("/paymentdispute", paymentController.paymentdispute);
router.post("/sendmailuserrefund", paymentController.sendmailuserrefund);
router.post("/getuserdetailAll", adminapiController.getuserdetailAll);
router.post("/gettotalSaleRevenue", adminapiController.gettotalSaleRevenue);
router.post("/getrecentSale", adminapiController.getrecentSale);
router.post("/getrecentMessage", adminapiController.getrecentMessage);
router.post("/getLatestUsers", adminapiController.getLatestUsers);
router.post("/getinvoieData", adminapiController.getinvoieData);
router.post("/getUserMultipleLogin", adminapiController.getUserMultipleLogin);
router.post(
  "/privacyinformationSave",
  adminapiController.privacyinformationSave
);
router.post("/getprivacydetail", adminapiController.getprivacydetail);
//adminapibasicController
router.post("/getuserfriendlist", adminapibasicController.getuserfriendlist);
router.post("/getusereventlist", adminapibasicController.getusereventlist);
router.post("/getusergrouplist", adminapibasicController.getusergrouplist);
router.post("/getusereventJoin", adminapibasicController.getusereventJoin);
router.post(
  "/getusereventinterested",
  adminapibasicController.getusereventinterested
);
router.post("/getusereventInvite", adminapibasicController.getusereventInvite);
router.post(
  "/getusergroupinterested",
  adminapibasicController.getusergroupinterested
);
router.post("/getusergroupinvite", adminapibasicController.getusergroupinvite);
router.post("/getuserjoinGroup", adminapibasicController.getuserjoinGroup);
router.post("/getgroupPostData", adminapibasicController.getgroupPostData);
router.post("/getgroupData", adminapibasicController.getgroupData);
router.post("/deletegrouppost", adminapibasicController.deletegrouppost);
router.post(
  "/deletegrouppostComment",
  adminapibasicController.deletegrouppostComment
);
router.post(
  "/deletegrouppostLike",
  adminapibasicController.deletegrouppostLike
);
router.post(
  "/getallgroupinteresteduser",
  adminapibasicController.getallgroupinteresteduser
);
router.post("/deletemediacomment", adminapibasicController.deletemediacomment);
router.post(
  "/getallforumComments",
  adminapibasicController.getallforumComments
);
router.post(
  "/deleteforumComment",
  attachWebSocket,
  adminapibasicController.deleteforumComment
);
router.post(
  "/gettotalSaleRevenueYearly",
  adminapibasicController.gettotalSaleRevenueYearly
);
router.post(
  "/adminEditevent",
  upload.single("image"),
  attachWebSocket,
  adminapibasicController.adminEditevent
);
router.post(
  "/adminEditgroup",
  uploadVideo.single("image"),
  (req, res, next) => {
    // Check if the uploaded file is a video and apply the resize middleware if necessary
    if (req.file && req.file.mimetype.startsWith("video")) {
      return resizeVideoIfNecessary(req, res, next); // Apply resize logic only if it's a video
    }
    next(); // If it's not a video, proceed to the next middleware
  },
  attachWebSocket,
  adminapibasicController.adminEditgroup
);
router.post("/getusertotalgroups", adminapibasicController.getusertotalgroups);
router.post("/getusertotalevents", adminapibasicController.getusertotalevents);
router.post("/getusertotalforum", adminapibasicController.getusertotalforum);
router.post(
  "/getusertotalspeeddate",
  adminapibasicController.getusertotalspeeddate
);

router.post("/getUserSentMessage", adminapibasicController.getUserSentMessage);
router.post("/deleteusersmessage", adminapibasicController.deleteusersmessage);
router.post(
  "/chatFileupdate",
  upload.array("files"),
  adminapibasicController.chatFileupdate
);
router.post("/chatupdate", adminapibasicController.chatupdate);
router.post("/getJoinedGroups", adminapibasicController.getJoinedGroups);
router.post("/getJoinedevents", adminapibasicController.getJoinedevents);
router.post("/sentmessage", adminapibasicController.sentmessage);
router.post("/receivemessage", adminapibasicController.receivemessage);
router.post("/getuserchartgraph", adminapibasicController.getuserchartgraph);
router.post(
  "/deletegroups",
  attachWebSocket,
  adminapibasicController.deletegroups
);
router.post(
  "/deleteevents",
  attachWebSocket,
  adminapibasicController.deleteevents
);
router.post(
  "/deleteeventcomment",
  attachWebSocket,
  adminapibasicController.deleteeventcomment
);
router.post(
  "/deletegroupcomment",
  attachWebSocket,
  adminapibasicController.deletegroupcomment
);
router.post(
  "/getallgrouppostLikes",
  adminapibasicController.getallgrouppostLikes
);
router.post(
  "/getalleventpostLikes",
  adminapibasicController.getalleventpostLikes
);
router.post(
  "/editeventcomment",
  attachWebSocket,
  adminapibasicController.editeventcomment
);
router.post(
  "/editgroupcomment",
  attachWebSocket,
  adminapibasicController.editgroupcomment
);
router.post(
  "/getalleventComments",
  adminapibasicController.getalleventComments
);
router.post(
  "/getallgroupComments",
  adminapibasicController.getallgroupComments
);
router.post(
  "/deleteeventspost",
  attachWebSocket,
  adminapibasicController.deleteeventspost
);
router.post(
  "/deletegroupspost",
  attachWebSocket,
  adminapibasicController.deletegroupspost
);
router.post(
  "/getusereventpostlist",
  adminapibasicController.getusereventpostlist
);
router.post(
  "/getusergrouppostlist",
  adminapibasicController.getusergrouppostlist
);
router.post("/getusereventdetail", adminapibasicController.getusereventdetail);
router.post("/getusergroupdetail", adminapibasicController.getusergroupdetail);

router.post(
  "/getuserchartgraphYear",
  adminapibasicController.getuserchartgraphYear
);

//Pro file
router.post(
  "/getuserchartgraphDoughnut",
  adminapiproController.getuserchartgraphDoughnut
);
router.post("/lastestmessagesent", adminapiproController.lastestmessagesent);
router.post("/gettotalgender", adminapiproController.gettotalgender);
router.post("/getactiveUsers", adminapiproController.getactiveUsers);
router.post("/getchurnrate", adminapiproController.getchurnrate);
router.post("/getalladmin", adminapiproController.getalladmin);
router.post("/deleteadmin", adminapiproController.deleteadmin);
router.post("/admincreate", adminapiproController.admincreate);
router.post("/adminedit", adminapiproController.adminedit);
router.post("/getadminLogindetail", adminapiproController.getadminLogindetail);
router.post("/getalluserlocation", adminapiproController.getalluserlocation);
router.post("/getusertotalgallery", adminapiproController.getusertotalgallery);

//
router.post("/getusergallery", adminapiVipController.getusergallery);
router.post("/getgallerycomments", adminapiVipController.getgallerycomments);
router.post(
  "/deletegallerycomment",
  attachWebSocket,
  adminapiVipController.deletegallerycomment
);

router.post(
  "/editgallerycomment",
  attachWebSocket,
  adminapiVipController.editgallerycomment
);
router.post(
  "/deletegallery",
  attachWebSocket,
  adminapiVipController.deletegallery
);
router.post("/getallgalleryLikes", adminapiVipController.getallgalleryLikes);
router.post("/getuserforum", adminapiVipController.getuserforum);
router.post("/getforumcomments", adminapiVipController.getforumcomments);
router.post(
  "/editforumcomment",
  attachWebSocket,
  adminapiVipController.editforumcomment
);
router.post("/deleteforum", attachWebSocket, adminapiVipController.deleteforum);

router.post(
  "/adminforumUpdate",
  upload.single("image"),
  attachWebSocket,
  adminapiVipController.adminforumUpdate
);
router.post("/getuserlogslist", adminapiVipController.getuserlogslist);
router.post("/deletelogs", adminapiVipController.deletelogs);
router.post("/gettotalCookies", adminapiVipController.gettotalCookies);
router.post("/getlastdate", adminapiVipController.getlastdate);
router.post("/getuserchartCookies", adminapiVipController.getuserchartCookies);
router.post("/send_invoice", adminapiController.send_invoice);
router.post("/forgotPassword", adminapiController.forgotPassword);
module.exports = { router, setWebSocketServerAdminMain };
