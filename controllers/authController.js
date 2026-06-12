const jwt = require("jsonwebtoken");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// ─── Helper: delete a Cloudinary asset by URL ────────────────────────────────
const deleteCloudinaryAsset = async (url, resourceType = "image") => {
  if (!url || !url.includes("cloudinary")) return;
  try {
    // Extract public_id from the URL  (everything between /upload/ and the file extension)
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    if (matches && matches[1]) {
      await cloudinary.uploader.destroy(matches[1], { resource_type: resourceType });
    }
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      disabilityType, skills, accommodationsNeeded, openToRemote,
      companyName, companyWebsite, companyDescription,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    const userData = { name, email, password, role: role || "candidate" };

    if (role === "candidate") {
      if (disabilityType) userData.disabilityType = disabilityType;
      if (skills) userData.skills = Array.isArray(skills) ? skills : skills.split(",").map(s => s.trim());
      if (accommodationsNeeded) userData.accommodationsNeeded = accommodationsNeeded;
      if (openToRemote !== undefined) userData.openToRemote = openToRemote;
    }

    if (role === "employer") {
      if (!companyName) return res.status(400).json({ message: "Company name is required for employers." });
      userData.companyName = companyName;
      if (companyWebsite) userData.companyWebsite = companyWebsite;
      if (companyDescription) userData.companyDescription = companyDescription;
    }

    const user = await User.create(userData);

    res.status(201).json({
      message: "Account created successfully!",
      token: generateToken(user._id),
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Contact support." });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      message: "Login successful!",
      token: generateToken(user._id),
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json(req.user);
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const userId  = req.user._id;

    // Don't allow role/password/email change via this route
    delete updates.password;
    delete updates.role;
    delete updates.email;

    if (updates.skills && typeof updates.skills === "string") {
      updates.skills = updates.skills.split(",").map(s => s.trim()).filter(Boolean);
    }

    // ── File uploaded via Cloudinary ──────────────────────────────────────────
    if (req.file) {
      const ext = req.file.originalname
        ? require("path").extname(req.file.originalname).toLowerCase()
        : "";
      const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);

      if (isImage) {
        // Delete old profile picture from Cloudinary
        if (req.user.profilePicture) {
          await deleteCloudinaryAsset(req.user.profilePicture, "image");
        }
        updates.profilePicture = req.file.path; // Cloudinary secure URL
      } else {
        // It's a resume/document
        if (req.user.resume) {
          await deleteCloudinaryAsset(req.user.resume, "raw");
        }
        updates.resume = req.file.path; // Cloudinary secure URL
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.json({ message: "Profile updated successfully!", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password changed successfully!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/auth/profile/picture  — dedicated endpoint for profile picture upload
exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    // Delete old picture
    if (req.user.profilePicture) {
      await deleteCloudinaryAsset(req.user.profilePicture, "image");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: req.file.path },
      { new: true }
    );
    res.json({ message: "Profile picture updated!", user, imageUrl: req.file.path });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/auth/profile/company-logo  — dedicated endpoint for company logo upload
exports.updateCompanyLogo = async (req, res) => {
  try {
    if (req.user.role !== "employer") {
      return res.status(403).json({ message: "Only employers can upload a company logo." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    // Delete old logo
    if (req.user.companyLogo) {
      await deleteCloudinaryAsset(req.user.companyLogo, "image");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { companyLogo: req.file.path },
      { new: true }
    );
    res.json({ message: "Company logo updated!", user, imageUrl: req.file.path });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
