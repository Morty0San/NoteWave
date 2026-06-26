import express from "express";
import Note from "../models/Note.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();

// STORAGE AUDIO
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".webm");
  }
});

const upload = multer({ storage });

// CREATE NOTE
router.post("/", authMiddleware, async (req, res) => {
  const note = await Note.create({
    userId: req.user.id,
    folder: req.body.folder,
    title: "",
    content: ""
  });

  res.json(note);
});

// GET NOTES
router.get("/", authMiddleware, async (req, res) => {
  const { folder } = req.query;

  const notes = await Note.find({
    userId: req.user.id,
    folder
  });

  res.json(notes);
});

// UPDATE NOTE
router.patch("/:id", authMiddleware, async (req, res) => {
  const note = await Note.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(note);
});

// DELETE NOTE
router.delete("/:id", authMiddleware, async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ msg: "Note supprimée" });
});

// UPLOAD AUDIO
router.post(
  "/:id/audio",
  authMiddleware,
  upload.single("audio"),
  async (req, res) => {
    const note = await Note.findById(req.params.id);

    note.audios.push({
      filename: req.file.filename,
      duration: req.body.duration
    });

    await note.save();

    res.json(note);
  }
);

export default router;