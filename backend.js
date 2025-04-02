// backend.js - Node.js Express backend for Brief.ly URL shortener

const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const mongoose = require('mongoose');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB (replace with your MongoDB connection string)
mongoose.connect('mongodb://wkdevs:TEEtXVCw0OPMFSwY@clusterbrieflyn-shard-00-00.v6l6z.mongodb.net:27017,clusterbrieflyn-shard-00-01.v6l6z.mongodb.net:27017,clusterbrieflyn-shard-00-02.v6l6z.mongodb.net:27017/?replicaSet=atlas-mersvm-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=ClusterBrieflyn', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define URL schema
const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true
  },
  shortId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  clicks: {
    type: Number,
    default: 0
  },
  analytics: {
    type: Map,
    of: Number,
    default: {}
  }
});

// Create URL model
const URL = mongoose.model('URL', urlSchema);

// API Routes

// Create a shortened URL
app.post('/api/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;
    
    // Basic validation
    if (!originalUrl) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Check if URL already exists in database
    const existingUrl = await URL.findOne({ originalUrl });
    if (existingUrl) {
      return res.json({
        shortUrl: `${req.protocol}://${req.get('host')}/${existingUrl.shortId}`
      });
    }
    
    // Generate a short ID (6 characters)
    const shortId = nanoid(6);
    
    // Create new URL document
    const newUrl = new URL({
      originalUrl,
      shortId
    });
    
    // Save to database
    await newUrl.save();
    
    // Return the shortened URL
    return res.status(201).json({
      shortUrl: `${req.protocol}://${req.get('host')}/${shortId}`
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Redirect to original URL
app.get('/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    
    // Find the URL in the database
    const url = await URL.findOne({ shortId });
    
    if (!url) {
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    // Update click count
    url.clicks += 1;
    
    // Update analytics (store referrer data)
    const referrer = req.get('Referrer') || 'direct';
    const refHost = referrer !== 'direct' ? new URL(referrer).hostname : 'direct';
    
    if (url.analytics.has(refHost)) {
      url.analytics.set(refHost, url.analytics.get(refHost) + 1);
    } else {
      url.analytics.set(refHost, 1);
    }
    
    // Save updates
    await url.save();
    
    // Redirect to the original URL
    return res.redirect(url.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get URL statistics
app.get('/api/stats/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    
    // Find the URL in the database
    const url = await URL.findOne({ shortId });
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }
    
    // Return statistics
    return res.json({
      originalUrl: url.originalUrl,
      shortUrl: `${req.protocol}://${req.get('host')}/${shortId}`,
      createdAt: url.createdAt,
      clicks: url.clicks,
      analytics: Object.fromEntries(url.analytics)
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard API - Get all URLs for a user (would require authentication in a real app)
app.get('/api/urls', async (req, res) => {
  try {
    // In a real app, you would filter by user ID after authentication
    const urls = await URL.find().sort({ createdAt: -1 }).limit(50);
    
    const formattedUrls = urls.map(url => ({
      id: url._id,
      originalUrl: url.originalUrl,
      shortUrl: `${req.protocol}://${req.get('host')}/${url.shortId}`,
      shortId: url.shortId,
      createdAt: url.createdAt,
      clicks: url.clicks
    }));
    
    return res.json(formattedUrls);
  } catch (error) {
    console.error('Error getting URLs:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete a URL
app.delete('/api/urls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real app, you would check if the URL belongs to the authenticated user
    await URL.findByIdAndDelete(id);
    
    return res.json({ message: 'URL deleted successfully' });
  } catch (error) {
    console.error('Error deleting URL:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export app for testing
module.exports = app;

