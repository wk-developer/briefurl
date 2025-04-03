const API_URL = 'https://your-render-app-name.onrender.com'; // Replace with your actual Render.com URL

async function shortenUrl(url) {
    try {
        const response = await fetch(`${API_URL}/api/shorten`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
    } catch (error) {
        console.error('Error shortening URL:', error);
    }
} 