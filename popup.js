document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup initialized");
  const targetHostInput = document.getElementById("targetHost");
  const copyButton = document.getElementById("copyButton");

  copyButton.addEventListener("click", async () => {
    const targetHost = targetHostInput.value.trim();
    console.log("Copy button clicked with target host:", targetHost);

    if (!targetHost) {
      console.error("No target host provided");
      alert("Please enter a target host");
      return;
    }

    try {
      // Get the current active tab
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      console.log("Active tab:", activeTab);

      // Send message to background script to copy JWT
      console.log("Sending message to background script...");
      chrome.runtime.sendMessage(
        {
          action: "copyJWT",
          targetHost,
          tabId: activeTab.id,
          url: activeTab.url,
        },
        (response) => {
          console.log("Received response:", response);
          if (chrome.runtime.lastError) {
            console.error("Error:", chrome.runtime.lastError);
            alert(`Error: ${chrome.runtime.lastError.message}`);
            return;
          }

          if (response.success) {
            alert(response.message);
          } else {
            alert(`Error: ${response.error}`);
          }
          // Close the popup after showing the message
          window.close();
        }
      );
    } catch (error) {
      console.error("Error:", error);
      alert(`Error: ${error.message}`);
    }
  });
});
