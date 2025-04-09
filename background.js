chrome.runtime.onInstalled.addListener(() => {
  console.log("JWT EXT INSTALLED");
});

const PROTOCOLS = ["http://", "https://"];

// Check if URL is a valid web URL (not chrome://, etc)
function isValidUrl(url) {
  return PROTOCOLS.some((protocol) => url.startsWith(protocol));
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "copyJWT") {
    console.log("COPY JWT");

    // Wrap in async function to properly handle the Promise
    (async () => {
      try {
        const response = await handleCopyJWT(message, sender);
        sendResponse(response);
      } catch (error) {
        console.error("Error in copyJWT:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

async function handleCopyJWT(message, sender) {
  try {
    const { targetHost: _targetHost, tabId, url } = message;
    // strip protocol and path fromurl
    const urlObj = new URL(_targetHost);
    const targetHost = urlObj.host;

    if (!isValidUrl(url)) {
      throw new Error(
        "Cannot copy JWTs from this type of page. Please try from a regular web page."
      );
    }

    const jwts = await chrome.cookies.getAll({ url }).then((cookies) =>
      cookies
        .filter(
          (cookie) =>
            cookie.name.startsWith("jwt") || cookie.name.startsWith("_jwt")
        )
        .map((cookie) => {
          delete cookie.session;
          delete cookie.hostOnly;
          return { ...cookie, domain: targetHost };
        })
    );

    if (jwts.length === 0) {
      return { success: false, error: "No JWT cookies found on this page" };
    }

    if (isValidUrl(url)) {
      await chrome.scripting.executeScript({
        target: { tabId },
        function: (jwts) => console.log("FOUND JWTS", jwts),
        args: [jwts],
      });
    }

    const tabs = await chrome.tabs.query({});
    let injectedCount = 0;

    for (const tab of tabs) {
      const host = PROTOCOLS.reduce(
        (host, protocol) =>
          tab.url.startsWith(protocol) ? tab.url.slice(protocol.length) : host,
        undefined
      );

      if (host?.startsWith(targetHost)) {
        for (const jwt of jwts) {
          const urlObj = new URL(tab.url);
          await chrome.cookies.set({
            ...jwt,
            url: `${urlObj.protocol}//${urlObj.host}`,
          });
        }

        if (isValidUrl(tab.url)) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: (jwts, url) => {
              console.log("INJECTED", jwts, "INTO", url);
            },
            args: [jwts, tab.url],
          });
        }
        injectedCount++;
      }
    }

    if (injectedCount > 0) {
      return {
        success: true,
        message: `Successfully copied ${jwts.length} JWT(s) to ${injectedCount} tab(s)`,
      };
    } else {
      return {
        success: false,
        error: `No tabs found matching host: ${targetHost}`,
      };
    }
  } catch (err) {
    console.error("Error copying jwt:", err);
    // Only try to execute script if it's a valid URL
    if (isValidUrl(message.url)) {
      await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        function: (err) => console.error("Error copying jwt", err),
        args: [err],
      });
    }
    return { success: false, error: err.message };
  }
}
