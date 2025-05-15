const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multerConfig"); // Adjust the path as needed
const uploadImageVideo = require("../middlewares/multerConfigImageVideo"); // Adjust the path as needed
const {
  uploadVideo,
  resizeVideoIfNecessary,
} = require("../middlewares/multerConfigVideo"); // Adjust the path as needed

const membersController = require("../controllers/membersController");

let wss; // WebSocket server instance

// Function to set the WebSocket server
const setWebSocketServer = (webSocketServer) => {
  wss = webSocketServer; // Assign the WebSocket server instance
};

const attachWebSocket = (req, res, next) => {
  req.wss = wss; // Attach the WebSocket server instance to the request
  next();
};

// Define the POST routes
router.post("/getAllMembers", membersController.getAllMembers);
router.post("/getUserDetailMember", membersController.getUserDetailMember);
router.post(
  "/getUserDetailMemberOther",
  membersController.getUserDetailMemberOther
);
router.post("/getEvent_s", membersController.getEvent_s);
router.post("/getAllfriend_s", membersController.getAllfriend_s);
router.post("/getAllfriend_viewmore", membersController.getAllfriend_viewmore);
router.post("/getCheck_friend", membersController.getCheck_friend);
router.post("/getCheck_friendUser", membersController.getCheck_friendUser);
router.post(
  "/sendFriendRequest",
  attachWebSocket,
  membersController.sendFriendRequest
);
router.post("/getuserChatmessage", membersController.getuserChatmessage);
router.post("/getSEndMessagequick", membersController.getSEndMessagequick);
router.post("/getSEndMessage", membersController.getSEndMessage);
router.post("/getAllgallery", membersController.getAllgallery);
router.post("/getgallery", membersController.getgallery);
router.post("/getAllMembersPage", membersController.getAllMembersPage);
router.post(
  "/saveUserChat",
  upload.array("files"),
  attachWebSocket,
  membersController.saveUserChat
);
router.post(
  "/gallerysave",
  uploadVideo.single("image"), // Use upload.single() from multerConfigVideo
  (req, res, next) => {
    // Check if the uploaded file is a video and apply the resize middleware if necessary
    if (req.file && req.file.mimetype.startsWith("video")) {
      return resizeVideoIfNecessary(req, res, next); // Apply resize logic only if it's a video
    }
    next(); // If it's not a video, proceed to the next middleware
  },
  attachWebSocket, // Upload the files before the controller
  membersController.gallerysave // Call the controller to handle the chat message saving
);
router.post("/getGalleryDetail", membersController.getGalleryDetail);
router.post(
  "/getGalleryGroupforumDetail",
  membersController.getGalleryGroupforumDetail
);
router.post("/getUserDetail", membersController.getUserDetail);
router.post(
  "/galleryPostLike",
  attachWebSocket,
  membersController.galleryPostLike
);
router.post("/forumPostLike", attachWebSocket, membersController.forumPostLike);
router.post("/getGalleryComments", membersController.getGalleryComments);
router.post(
  "/getGalleryCommentsDashboard",
  membersController.getGalleryCommentsDashboard
);
router.post("/getAllfriends", membersController.getAllfriends);
router.post("/getgallerySearch", membersController.getgallerySearch);
router.post("/getAllgallerySearch", membersController.getAllgallerySearch);
router.post(
  "/GalleryPostSave",
  attachWebSocket, // Attach WebSocket middleware
  membersController.GalleryPostSave
);
router.post(
  "/requestToview",
  attachWebSocket, // Attach WebSocket middleware
  membersController.requestToview
);
router.post(
  "/Requestdelete",
  attachWebSocket, // Attach WebSocket middleware
  membersController.Requestdelete
);
router.post(
  "/RequestConfirm",
  attachWebSocket, // Attach WebSocket middleware
  membersController.RequestConfirm
);
router.post(
  "/forumscommentSave",
  attachWebSocket, // Attach WebSocket middleware
  membersController.forumscommentSave
);
router.post(
  "/forumscommentSaveDashboard",
  attachWebSocket, // Attach WebSocket middleware
  membersController.forumscommentSaveDashboard
);
router.post(
  "/speedcommentSave",
  attachWebSocket, // Attach WebSocket middleware
  membersController.speedcommentSave
);

router.post("/visitprofile", membersController.visitprofile);
router.post("/getcheckfriendss", membersController.getcheckfriendss);
router.post("/getdashboardpost", membersController.getdashboardpost);

router.post("/messageseen", attachWebSocket, membersController.messageseen);
router.post("/searchfilter", attachWebSocket, membersController.searchfilter);
router.post("/membersearch", membersController.membersearch);
router.post(
  "/membersearchleftsidebar",
  membersController.membersearchleftsidebar
);
router.post("/areafilter", membersController.areafilter);
router.post("/agefilter", membersController.agefilter);
router.post("/sexfilter", membersController.sexfilter);
router.post("/checkmembership", membersController.checkmembership);
router.post("/userblock", membersController.userblock);
router.post("/getcheckuserblock", membersController.getcheckuserblock);
router.post("/getcheckuserblockend", membersController.getcheckuserblockend);
router.post("/userunblock", membersController.userunblock);
router.post("/checkuserblock", membersController.checkuserblock);
router.post("/create_payment_intent", membersController.create_payment_intent);
router.post("/galleryfilter", membersController.galleryfilter);
router.post("/getonlineuser", attachWebSocket, membersController.getonlineuser);
router.post("/useractivity", attachWebSocket, membersController.useractivity);
router.post("/paymentdatasave", membersController.paymentdatasave);
router.post(
  "/getallgallerySearchfilter",
  membersController.getallgallerySearchfilter
);
router.post(
  "/statusupdateUser",
  attachWebSocket,
  membersController.statusupdateUser
);
router.post(
  "/saveprivateAlbum",
  uploadImageVideo.array("images"),
  membersController.saveprivateAlbums
);
router.post(
  "/saveprivateAlbumGallery",
  uploadImageVideo.array("images"),
  membersController.saveprivateAlbumGallery
);
router.post("/getalbumStatus", membersController.getalbumStatus);
router.post(
  "/checkprotectedpassword",
  membersController.checkprotectedpassword
);
router.post("/checkOTP", membersController.checkOTP);
router.post("/checkpassword", membersController.checkpassword);
router.post("/sendOTP", membersController.sendOTP);
router.post("/create_customer", membersController.create_customer);

router.post("/checkoutpay", membersController.checkoutpayy);
router.post(
  "/paymentdatasaveafterpay",
  membersController.paymentdatasaveafterpay
);
router.post("/getUserMediaDetails", membersController.getUserMediaDetails);
router.post(
  "/getUserMediaAlbumDetails",
  membersController.getUserMediaAlbumDetails
);
router.post("/getallmediaa", membersController.getallmediaa);
router.post(
  "/getdashboardpostSearch",
  membersController.getdashboardpostSearch
);
router.post("/get_gallerySearch", membersController.get_gallerySearch);
router.post("/get_forumSearch", membersController.get_forumSearch);
router.post("/get_friendsearch", membersController.get_friendsearch);
router.post("/handlerequestcancel", membersController.handlerequestcancel);
router.post("/handlerequestadd", membersController.handlerequestadd);
router.post("/getalbumStatusonly", membersController.getalbumStatusonly);
router.post("/privatealbumdelete", membersController.privatealbumdelete);
router.post("/getprivatemediaalbum", membersController.getprivatemediaalbum);
router.post(
  "/getGalleryDetailnextprevious",
  membersController.getGalleryDetailnextprevious
);
router.post(
  "/getGalleryDetailnextpreviousspecificuser",
  membersController.getGalleryDetailnextpreviousspecificuser
);
router.post(
  "/profileconfimationComment",
  attachWebSocket,
  membersController.profileconfimationComment
);
router.post(
  "/get_albumStatusonlyfriend",
  membersController.get_albumStatusonlyfriend
);
router.post(
  "/uploadprivateAlbums",
  uploadImageVideo.array("images"),
  membersController.uploadprivateAlbums
);
router.post(
  "/getallprofileconfrmation",
  membersController.getallprofileconfrmation
);
router.post("/profiledeleteComment", membersController.profiledeleteComment);
router.post(
  "/deletePostDashboard",
  attachWebSocket,
  membersController.deletePostDashboard
);
router.post(
  "/deletemessagechat",
  attachWebSocket,
  membersController.deletemessagechat
);
router.post(
  "/deletemessagechat_Left",
  attachWebSocket,
  membersController.deletemessagechat_Left
);
router.post(
  "/deletemultiplemessagechat",
  attachWebSocket,
  membersController.deletemultiplemessagechat
);
router.post(
  "/deletemultiplemessagechat_left",
  attachWebSocket,
  membersController.deletemultiplemessagechat_left
);
router.post("/getUserDetailsfav", membersController.getUserDetailsfav);
router.post("/favmemberinsert", membersController.favmemberinsert);
router.post("/getlastestpost", membersController.getlastestpost);
router.post("/getAllforumLatest", membersController.getAllforumLatest);
router.post("/getAllgrouplatest", membersController.getAllgrouplatest);
router.post("/getAlleventsLatest", membersController.getAlleventsLatest);
router.post("/getmediaAlbumName", membersController.getmediaAlbumName);
router.post("/movetoFile", membersController.movetoFile);
router.post("/getUserDetailsFriends", membersController.getUserDetailsFriends);
router.post("/getUserDetailsOwn", membersController.getUserDetailsOwn);
router.post(
  "/get_albumStatusonlyPublic",
  membersController.get_albumStatusonlyPublic
);
router.post(
  "/getpreviewtemediaalbum",
  membersController.getpreviewtemediaalbum
);
router.post("/checkfrdevent", membersController.checkfrdevent);

router.post("/getmessageCount", membersController.getmessageCount);

router.post("/messageseenall", membersController.messageseenall);
router.post("/getprofilegallery", membersController.getprofilegallery);

router.post("/getallblockuser", membersController.getallblockuser);
router.post("/getalbums", membersController.getalbums);
router.post("/profileMovetoAlbum", membersController.profileMovetoAlbum);

router.post(
  "/profileMovetoAlbumPublic",
  membersController.profileMovetoAlbumPublic
);
router.post(
  "/profileMovetoAlbumFriend",
  membersController.profileMovetoAlbumFriend
);
router.post("/getPageEditAlbums", membersController.getPageEditAlbums);
router.post(
  "/forumlikepostforumpage",
  attachWebSocket,
  membersController.forumlikepostforumpage
);
router.post(
  "/grouplikepostgrouppage",
  attachWebSocket,
  membersController.grouplikepostgrouppage
);

router.post("/getGallerlikedislike", membersController.getGallerlikedislike);
router.post(
  "/getGallerforumgroupcomment",
  membersController.getGallerforumgroupcomment
);

router.post("/getuseralbumFile", membersController.getuseralbumFile);
router.post("/getUseralbumsComments", membersController.getUseralbumsComments);
router.post(
  "/UserPhotoCommentSave",
  attachWebSocket,
  membersController.UserPhotoCommentSave
);
router.post(
  "/getUseralbumsCommentsSeperate",
  membersController.getUseralbumsCommentsSeperate
);
router.post(
  "/UseralbumPostLike",
  attachWebSocket,
  membersController.UseralbumPostLike
);
router.post(
  "/deletePostUserAlbum",
  attachWebSocket,
  membersController.deletePostUserAlbum
);
router.post("/checkaccessuserAlbum", membersController.checkaccessuserAlbum);
router.post("/checkaccessTopage", membersController.checkaccessTopage);
router.post("/setCoverphoto", membersController.setCoverphoto);
router.post("/getGalleryallAlbum", membersController.getGalleryallAlbum);
router.post("/readmessageuser", membersController.readmessageuser);
router.post("/gallerymovetoAlbum", membersController.gallerymovetoAlbum);

// Export the router and the setWebSocketServer function
module.exports = { router, setWebSocketServer };
