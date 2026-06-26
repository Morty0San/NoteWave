import mongoose from "mongoose";

const audioSchema = new mongoose.Schema({
  filename: String,
  duration: Number
});

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: String,
    content: String,
    folder: String,
    audios: [audioSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Note", noteSchema);