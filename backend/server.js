const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// User
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
  password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Audio memo
const audioSchema = new mongoose.Schema({
  filename: String,
  duration: Number,
  createdAt: { type: Date, default: Date.now },
});

// Note
const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  folder: { type: String, default: 'Personnel' },
  audios: [audioSchema],
}, { timestamps: true });

const Note = mongoose.model('Note', noteSchema);

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}.webm`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Fichier audio uniquement'));
  },
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 min)' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashed });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notes', auth, async (req, res) => {
  try {
    const { folder } = req.query;
    const filter = { userId: req.user.id };
    if (folder) filter.folder = folder;

    const notes = await Note.find(filter).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', auth, async (req, res) => {
  try {
    const { title, content, folder } = req.body;
    const note = await Note.create({
      userId: req.user.id,
      title: title || '',
      content: content || '',
      folder: folder || 'Personnel',
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notes/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ error: 'Note introuvable' });

    const { title, content, folder } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (folder !== undefined) note.folder = folder;

    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ error: 'Note introuvable' });

    // Supprimer les fichiers audio du disque
    note.audios.forEach(a => {
      const filePath = path.join(__dirname, 'uploads', a.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    await note.deleteOne();
    res.json({ message: 'Note supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/:id/audio', auth, upload.single('audio'), async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ error: 'Note introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });

    const duration = parseInt(req.body.duration) || 0;
    if (duration > 120) return res.status(400).json({ error: 'Durée max 2 minutes' });

    const audio = { filename: req.file.filename, duration };
    note.audios.push(audio);
    await note.save();

    // Retourner le mémo avec l'URL publique
    const saved = note.audios[note.audios.length - 1];
    res.status(201).json({
      ...saved.toObject(),
      url: `${req.protocol}://${req.get('host')}/uploads/${saved.filename}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id/audio/:audioId', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ error: 'Note introuvable' });

    const audio = note.audios.id(req.params.audioId);
    if (!audio) return res.status(404).json({ error: 'Mémo introuvable' });

    // Supprimer le fichier du disque
    const filePath = path.join(__dirname, 'uploads', audio.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    audio.deleteOne();
    await note.save();
    res.json({ message: 'Mémo supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connecté');
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`🚀 Serveur sur http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB :', err.message);
    process.exit(1);
  });
