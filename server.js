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