/**
 * Mobile-Responsive Popup Controller
 */
document.addEventListener("DOMContentLoaded", () => {
  const bridgeStatus = document.getElementById("bridge-status");
  const activeAccount = document.getElementById("active-account");
  const btnOpenFb = document.getElementById("btn-open-fb");
  const btnSyncSession = document.getElementById("btn-sync-session");

  function refreshUI() {
    chrome.storage.local.get(["bridge_connected", "account_name"], (res) => {
      if (res.bridge_connected) {
        bridgeStatus.textContent = "CONNECTED";
        bridgeStatus.className = "pill connected";
      } else {
        bridgeStatus.textContent = "DISCONNECTED";
        bridgeStatus.className = "pill disconnected";
      }

      if (res.account_name) {
        activeAccount.textContent = res.account_name;
      } else {
        activeAccount.textContent = "Auto-Detecting...";
      }
    });
  }

  btnOpenFb.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.facebook.com/" });
  });

  btnSyncSession.addEventListener("click", async () => {
    btnSyncSession.textContent = "Syncing...";
    const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
    if (tabs.length > 0 && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "CHECK_SESSION", payload: {} }, (res) => {
        btnSyncSession.textContent = "🔄 Sync Session Status";
        if (res && res.success && res.data) {
          activeAccount.textContent = res.data.name || "Logged In";
          chrome.storage.local.set({ account_name: res.data.name });
        }
      });
    } else {
      btnSyncSession.textContent = "🔄 Sync Session Status";
      activeAccount.textContent = "No Facebook Tab Found";
    }
  });

  refreshUI();
  setInterval(refreshUI, 2000);
});
