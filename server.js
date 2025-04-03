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
  shortId: String,
  originalUrl: String,
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Url = mongoose.model('Url', urlSchema);

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files
console.log('Static directory:', path.join(__dirname, 'docs'));
app.use(express.static(path.join(__dirname, 'docs')));

// Connect to MongoDB with better error handling
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')); // Log URI without credentials
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Successfully connected to MongoDB');
})
.catch(err => {
  console.error('MongoDB connection error details:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });
  process.exit(1);
});

// Routes
app.get('/', (req, res) => {
  console.log('Serving index.html from:', path.join(__dirname, 'docs', 'index.html'));
  res.sendFile(path.join(__dirname, 'docs', 'index.html'), err => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).json({ error: 'Error serving the file' });
    }
  });
});

app.post('/api/shorten', async (req, res) => {
  try {
    console.log('API Request body:', req.body);
    let { url } = req.body;

    if (!url) {
      console.log('No URL provided');
      return res.status(400).json({ error: 'Please provide a URL' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const shortId = nanoid(6);
    console.log('Generated shortId:', shortId);
    
    const newUrl = new Url({
      shortId,
      originalUrl: url
    });
    
    console.log('Attempting to save URL to MongoDB...');
    await newUrl.save();
    console.log('Successfully saved URL to MongoDB');

    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    console.log('Generated shortUrl:', shortUrl);
    
    return res.json({ shortUrl });
  } catch (error) {
    console.error('Error shortening URL:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Redirect route
app.get('/:shortId', async (req, res, next) => {
  try {
    const { shortId } = req.params;
    console.log('Redirect request for shortId:', shortId);
    
    // Don't try to redirect static file requests
    if (shortId.includes('.')) {
      console.log('Static file request detected, passing to next handler');
      return next();
    }

    console.log('Looking up URL in MongoDB...');
    const urlData = await Url.findOne({ shortId });

    if (!urlData) {
      console.log('URL not found:', shortId);
      return res.status(404).sendFile(path.join(__dirname, 'docs', 'index.html'));
    }

    console.log('Found URL:', urlData.originalUrl);
    // Increment clicks
    urlData.clicks += 1;
    await urlData.save();
    
    console.log('Redirecting to:', urlData.originalUrl);
    res.redirect(urlData.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).sendFile(path.join(__dirname, 'docs', 'index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });
  res.status(500).json({ error: 'Server error. Please try again.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 