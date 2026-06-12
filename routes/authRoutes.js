const express = require("express");
const router  = express.Router();
const {
  register, login, getMe, updateProfile, changePassword,
  updateProfilePicture, updateCompanyLogo,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.post("/register", register);
router.post("/login",    login);
router.get("/me",        protect, getMe);

// General profile update (handles resume uploads via upload.single("file"))
router.put("/profile", protect, upload.single("file"), updateProfile);

// Dedicated image endpoints
router.put("/profile/picture",     protect, upload.image.single("profilePicture"), updateProfilePicture);
router.put("/profile/company-logo", protect, upload.image.single("companyLogo"),   updateCompanyLogo);

router.post("/change-password", protect, changePassword);

module.exports = router;
