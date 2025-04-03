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

// MongoDB connection state
let isConnectedToMongo = false;

// Connect to MongoDB with better error handling
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')); // Log URI without credentials

mongoose.connection.on('connected', () => {
  console.log('Successfully connected to MongoDB');
  isConnectedToMongo = true;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', {
    name: err.name,
    message: err.message,
    code: err.code
  });
  isConnectedToMongo = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB');
  isConnectedToMongo = false;
});

// Connect with retries
const connectWithRetry = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
  } catch (err) {
    console.error('MongoDB connection failed, retrying in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

// Middleware to check MongoDB connection
app.use((req, res, next) => {
  if (!isConnectedToMongo && !req.path.includes('.')) {
    return res.status(503).json({ 
      error: 'Database connection is not ready. Please try again in a moment.' 
    });
  }
  next();
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
    if (!isConnectedToMongo) {
      return res.status(503).json({ 
        error: 'Database connection is not ready. Please try again in a moment.' 
      });
    }

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
    return res.status(500).json({ 
      error: 'Server error. Please try again.',
      details: error.message 
    });
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

    if (!isConnectedToMongo) {
      return res.status(503).json({ 
        error: 'Database connection is not ready. Please try again in a moment.' 
      });
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
  res.status(500).json({ 
    error: 'Server error. Please try again.',
    details: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 


const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for URLs (temporary solution)
const urlDatabase = {};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  console.log('Rendering home page');
  res.render('index');
});

app.post('/shorten', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    let { url } = req.body;

    // Basic URL validation
    if (!url) {
      console.log('No URL provided');
      // Check if this is an API request or a form submission
      const wantsJson = req.headers['content-type'] === 'application/json';
      
      if (wantsJson) {
        return res.status(400).json({ error: 'Please provide a URL' });
      } else {
        return res.render('index', { error: 'Please provide a URL' });
      }
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Generate short ID
    const shortId = nanoid(6);
    
    // Store in memory
    urlDatabase[shortId] = {
      originalUrl: url,
      clicks: 0,
      createdAt: new Date()
    };

    console.log('Created short URL:', shortId, 'for', url);

    // Construct the short URL
    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    
    // Check if this is an API request or a form submission
    const wantsJson = req.headers['content-type'] === 'application/json';
    
    if (wantsJson) {
      return res.json({ shortUrl });
    } else {
      return res.render('index', { shortUrl });
    }
  } catch (error) {
    console.error('Error shortening URL:', error);
    
    // Check if this is an API request or a form submission
    const wantsJson = req.headers['content-type'] === 'application/json';
    
    if (wantsJson) {
      return res.status(500).json({ error: 'Server error. Please try again.' });
    } else {
      return res.render('index', { error: 'Server error. Please try again.' });
    }
  }
});

// API endpoint for JSON requests
app.post('/api/shorten', async (req, res) => {
  try {
    console.log('API Request body:', req.body);
    let { url } = req.body;

    // Basic URL validation
    if (!url) {
      console.log('No URL provided');
      return res.status(400).json({ error: 'Please provide a URL' });
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Generate short ID
    const shortId = nanoid(6);
    
    // Store in memory
    urlDatabase[shortId] = {
      originalUrl: url,
      clicks: 0,
      createdAt: new Date()
    };

    console.log('Created short URL:', shortId, 'for', url);

    // Construct the short URL
    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    
    return res.json({ shortUrl });
  } catch (error) {
    console.error('Error shortening URL:', error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Redirect route
app.get('/:shortId', (req, res) => {
  try {
    const { shortId } = req.params;
    const urlData = urlDatabase[shortId];

    if (!urlData) {
      console.log('URL not found:', shortId);
      return res.status(404).render('index', { error: 'URL not found' });
    }

    // Increment clicks
    urlData.clicks += 1;
    
    console.log('Redirecting to:', urlData.originalUrl);
    res.redirect(urlData.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.render('index', { error: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('index', { error: 'Server error. Please try again.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
