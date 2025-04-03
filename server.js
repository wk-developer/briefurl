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

// Fallback in-memory storage in case MongoDB fails
const urlDatabase = {};

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Determine the static files directory based on environment
const staticDir = process.env.NODE_ENV === 'production' ? 'public' : 'public';
console.log('Static directory:', path.join(__dirname, staticDir));
app.use(express.static(path.join(__dirname, staticDir)));

// MongoDB connection state
let isConnectedToMongo = false;

// Connect to MongoDB with better error handling
console.log('Attempting to connect to MongoDB...');
const redactedUri = MONGODB_URI.includes('@') 
  ? MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@') 
  : MONGODB_URI;
console.log('MongoDB URI:', redactedUri);

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
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    console.error('MongoDB connection failed, retrying in 5 seconds...', err.message);
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

// Routes
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, staticDir, 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath, err => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Error serving the file. Please try again.');
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
    
    // Store URL in both MongoDB and in-memory database as fallback
    if (isConnectedToMongo) {
      try {
        const newUrl = new Url({
          shortId,
          originalUrl: url
        });
        
        console.log('Attempting to save URL to MongoDB...');
        await newUrl.save();
        console.log('Successfully saved URL to MongoDB');
      } catch (dbError) {
        console.error('Failed to save to MongoDB, using in-memory storage:', dbError.message);
        // Fall back to in-memory storage
        urlDatabase[shortId] = {
          originalUrl: url,
          clicks: 0,
          createdAt: new Date()
        };
        console.log('Saved URL to in-memory storage');
      }
    } else {
      // Use in-memory storage if MongoDB is not connected
      urlDatabase[shortId] = {
        originalUrl: url,
        clicks: 0,
        createdAt: new Date()
      };
      console.log('Saved URL to in-memory storage (MongoDB not available)');
    }

    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    console.log('Generated shortUrl:', shortUrl);
    
    return res.json({ shortUrl });
  } catch (error) {
    console.error('Error shortening URL:', {
      name: error.name,
      message: error.message,
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

    let originalUrl = null;

    // Try to find URL in MongoDB first
    if (isConnectedToMongo) {
      try {
        console.log('Looking up URL in MongoDB...');
        const urlData = await Url.findOne({ shortId });

        if (urlData) {
          console.log('Found URL in MongoDB:', urlData.originalUrl);
          // Increment clicks
          urlData.clicks += 1;
          await urlData.save();
          originalUrl = urlData.originalUrl;
        }
      } catch (dbError) {
        console.error('Error querying MongoDB:', dbError.message);
        // Continue to in-memory fallback
      }
    }

    // If not found in MongoDB, check in-memory database
    if (!originalUrl && urlDatabase[shortId]) {
      console.log('Found URL in in-memory database:', urlDatabase[shortId].originalUrl);
      urlDatabase[shortId].clicks += 1;
      originalUrl = urlDatabase[shortId].originalUrl;
    }

    if (!originalUrl) {
      console.log('URL not found:', shortId);
      return res.status(404).sendFile(path.join(__dirname, staticDir, 'index.html'));
    }
    
    console.log('Redirecting to:', originalUrl);
    return res.redirect(originalUrl);
  } catch (error) {
    console.error('Error redirecting:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).sendFile(path.join(__dirname, staticDir, 'index.html'));
  }
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, staticDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    name: err.name,
    message: err.message,
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
