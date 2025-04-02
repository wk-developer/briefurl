const isValidUrl = (urlString) => {
  const urlPattern = new RegExp(
    "^(https?:\/\/)" + // validate protocol
      "((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|" + // validate domain name
      "((\d{1,3}\.){3}\d{1,3}))" + // validate OR ip (v4) address
      "(\:\d+)?(\/[-a-z\d%_.~+]*)*" + // validate port and path
      "(\?[;&a-z\d%_.~+=-]*)?" + // validate query string
      "(\#[-a-z\d_]*)?$",
    "i"
  ); // validate fragment locator
  return !!urlPattern.test(urlString);
};

// Event listener for the shorten button
document.querySelector(".shorten-button").addEventListener("click", async function () {
  const urlInput = document.querySelector(".url-input");
  const longURL = urlInput.value.trim();

  if (longURL === "") {
    alert("Please enter a URL");
    return;
  }
  if (!isValidUrl(longURL)) {
    alert("Please enter a valid URL");
    return;
  }

  try {
    const res = await fetch("/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: longURL }),
    });
    
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }

    if (data.hash) {
      const shortenedLink = window.location.href + data.hash;
      document.querySelector(".short-url").textContent = shortenedLink;
      document.querySelector(".short-url").href = shortenedLink;
      document.getElementById("result").style.display = "block";
    }

    // Clear the input field
    urlInput.value = "";
  } catch (error) {
    console.error("Error shortening URL:", error);
    alert("An error occurred. Please try again.");
  }
});

// Event listener for the copy button
document.querySelector(".copy-button").addEventListener("click", function () {
  const shortUrlElement = document.querySelector(".short-url");
  const shortenedLink = shortUrlElement.textContent;

  navigator.clipboard.writeText(shortenedLink)
    .then(() => {
      alert("Copied: " + shortenedLink);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
});
