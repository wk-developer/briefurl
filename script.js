document.addEventListener("DOMContentLoaded", function () {
    const shortenButton = document.querySelector(".shorten-button");
    const urlInput = document.querySelector(".url-input");
    const resultContainer = document.getElementById("result");
    const shortUrlSpan = document.querySelector(".short-url");
    const copyButton = document.querySelector(".copy-button");
  
    shortenButton.addEventListener("click", async () => {
      const longUrl = urlInput.value.trim();
      
      if (!longUrl) {
        alert("Please enter a URL to shorten.");
        return;
      }
  
      try {
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        const shortUrl = await response.text();
  
        if (shortUrl.includes("http")) {
          shortUrlSpan.textContent = shortUrl;
          shortUrlSpan.href = shortUrl;
          resultContainer.classList.add("active");
        } else {
          alert("Failed to shorten the URL. Please try again.");
        }
      } catch (error) {
        console.error("Error shortening URL:", error);
        alert("An error occurred. Please try again.");
      }
    });
  
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(shortUrlSpan.textContent).then(() => {
        alert("Shortened URL copied to clipboard!");
      });
    });
  });
  