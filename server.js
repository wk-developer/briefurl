const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { nanoid } = require('nanoid');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/briefurl';

// MongoDB Schema
const urlSchema = new mongoose.Schema({
  shortId: { type: String, required: true, unique: true },
  originalUrl: { type: String, required: true },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Url = mongoose.model('Url', urlSchema);

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection Handling
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => console.log('✅ MongoDB Connected'));
mongoose.connection.on('error', err => console.error('❌ MongoDB Connection Error:', err));
mongoose.connection.on('disconnected', () => console.log('⚠️ Disconnected from MongoDB'));

// Homepage Route
app.get('/', (req, res) => {
  res.render('index');
});

// Shorten URL Route
app.post('/shorten', async (req, res) => {
  try {
    let { url } = req.body;

    if (!url) return res.render('index', { error: 'Please provide a URL' });

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const shortId = nanoid(6);
    const newUrl = new Url({ shortId, originalUrl: url });
    await newUrl.save();

    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    res.render('index', { shortUrl });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.render('index', { error: 'Server error. Please try again.' });
  }
});

// API Shorten Endpoint
app.post('/api/shorten', async (req, res) => {
  try {
    let { url } = req.body;

    if (!url) return res.status(400).json({ error: 'Please provide a URL' });

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const shortId = nanoid(6);
    const newUrl = new Url({ shortId, originalUrl: url });
    await newUrl.save();

    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    res.json({ shortUrl });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Redirect Route
app.get('/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    const urlData = await Url.findOne({ shortId });

    if (!urlData) return res.status(404).render('index', { error: 'URL not found' });

    urlData.clicks += 1;
    await urlData.save();

    res.redirect(urlData.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.render('index', { error: 'Server error' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('index', { error: 'Server error. Please try again.' });
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
