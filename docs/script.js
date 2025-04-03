const API_URL = 'https://briefurl.onrender.com'; // Your Render.com URL

async function shortenUrl(url) {
    try {
        const response = await fetch(`${API_URL}/api/shorten`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.shortUrl;
    } catch (error) {
        console.error('Error shortening URL:', error);
        throw error;
    }
} 