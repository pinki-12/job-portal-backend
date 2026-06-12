const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const path = require("path");

// ─── Resume / Document Storage (PDF, DOC, DOCX) ───────────────────────────────
const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "abilitybridge/resumes",
    resource_type: "raw",                          // required for non-image files
    public_id: `${req.user._id}-resume-${Date.now()}`,
    format: path.extname(file.originalname).replace(".", ""),
  }),
});

// ─── Image Storage (profile pictures, company logos) ─────────────────────────
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "abilitybridge/images",
    resource_type: "image",
    public_id: `${req.user._id}-img-${Date.now()}`,
    transformation: [{ width: 500, height: 500, crop: "limit", quality: "auto" }],
  }),
});

// ─── File filter ──────────────────────────────────────────────────────────────
const documentFilter = (req, file, cb) => {
  const allowed = [".pdf", ".doc", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only PDF and Word documents are allowed"), false);
};

const imageFilter = (req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only JPG, PNG, and WEBP images are allowed"), false);
};

// ─── Multer instances ─────────────────────────────────────────────────────────
const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 },   // 5 MB
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },   // 2 MB
});

// ─── Combined: resume OR image in a single upload field ───────────────────────
const mixedStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    return {
      folder: isImage ? "abilitybridge/images" : "abilitybridge/resumes",
      resource_type: isImage ? "image" : "raw",
      public_id: `${req.user._id}-${isImage ? "img" : "resume"}-${Date.now()}`,
      ...(isImage && { transformation: [{ width: 500, height: 500, crop: "limit", quality: "auto" }] }),
    };
  },
});

const mixedFilter = (req, file, cb) => {
  const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only PDF, Word documents and images are allowed"), false);
};

const upload = multer({
  storage: mixedStorage,
  fileFilter: mixedFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Attach named variants for convenience
upload.resume = uploadResume;
upload.image  = uploadImage;

module.exports = upload;
