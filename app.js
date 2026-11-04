(() => {
  "use strict";

  const JW_LIBRARY_ID = "YOUR_JWPLAYER_LIBRARY_ID"; // index.html-এও একই library ID বসাবেন
  const SERVER_JSON = "server.json";
  const RETRY_LIMIT_MS = 60000;
  const RETRY_INTERVAL_MS = 3000;

  const playerElement = document.getElementById("player");
  const overlay = document.getElementById("overlay-message");
  const playerContainer = document.getElementById("player-container");
  const fullscreenButton = document.getElementById("custom-fullscreen");
  const channelsContainer = document.getElementById("channels-container");
  const categoryTabs = document.getElementById("category-tabs");

  let player = null;
  let retryTimer = null;
  let retryDeadline = 0;
  let activeUrl = "";
  let activeCard = null;
  let playToken = 0;

  function showMessage(message) {
    overlay.textContent = message;
    overlay.classList.remove("hidden");
  }
  function hideMessage() {
    overlay.classList.add("hidden");
  }

  function waitForJWPlayer() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const timer = setInterval(() => {
        if (typeof window.jwplayer === "function") {
          clearInterval(timer);
          resolve();
        } else if (++attempts > 100) {
          clearInterval(timer);
          reject(new Error("JW Player library পাওয়া যায়নি। index.html-এ সঠিক JW Player Library ID বসান।"));
        }
      }, 100);
    });
  }

  async function initializePlayer() {
    try {
      if (JW_LIBRARY_ID === "YOUR_JWPLAYER_LIBRARY_ID") {
        showMessage("JW Player চালু করতে index.html এবং app.js-এ আপনার JW Player Library ID বসান।");
      }
      await waitForJWPlayer();
      player = window.jwplayer("player").setup({
        file: "",
        width: "100%",
        height: "100%",
        autostart: false,
        mute: false,
        controls: true,
        stretching: "exactfit",
        displaytitle: false,
        displaydescription: false,
        preload: "auto"
      });

      player.on("play", hideMessage);
      player.on("buffer", () => {
        if (activeUrl) showMessage("চ্যানেল লোড হচ্ছে, একটু অপেক্ষা করুন...");
      });
      player.on("error", () => {
        if (activeUrl && Date.now() < retryDeadline) {
          showMessage("স্ট্রিমে সমস্যা হচ্ছে। আবার চেষ্টা করা হচ্ছে...");
          scheduleRetry(playToken);
        } else if (activeUrl) {
          showMessage("চ্যানেলটি চালু করা যাচ্ছে না। অন্য চ্যানেল চেষ্টা করুন।");
        }
      });
      player.on("fullscreen", event => {
        if (event.fullscreen) applyFullscreenLayout();
        else restoreFullscreenLayout();
      });
    } catch (error) {
      console.error(error);
      showMessage(error.message || "JW Player চালু করা যায়নি।");
    }
  }

  function scheduleRetry(token) {
    clearTimeout(retryTimer);
    if (Date.now() >= retryDeadline || token !== playToken) return;
    retryTimer = setTimeout(() => {
      if (token === playToken && activeUrl && player) {
        try { player.load([{ file: activeUrl, type: "hls" }]); player.play(); }
        catch (error) { console.warn("Retry failed:", error); }
      }
    }, RETRY_INTERVAL_MS);
  }

  function changeChannel(url, channelCard) {
    if (!url || !player) {
      if (!player) showMessage("প্লেয়ার প্রস্তুত হচ্ছে অথবা JW Player Library ID সেট করা হয়নি।");
      return;
    }
    playToken++;
    const thisToken = playToken;
    activeUrl = url;
    activeCard = channelCard || null;
    retryDeadline = Date.now() + RETRY_LIMIT_MS;
    clearTimeout(retryTimer);

    showMessage("১০ সেকেন্ড অপেক্ষা করুন, চ্যানেলটি চালু হচ্ছে...");
    document.querySelectorAll(".channel-card").forEach(card => card.classList.remove("active"));
    if (activeCard) {
      activeCard.classList.add("active");
      activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    try {
      player.load([{ file: url, type: "hls" }]);
      player.play();
      // Retry is also scheduled in case the stream silently stalls without an error event.
      retryTimer = setTimeout(() => {
        if (thisToken === playToken && Date.now() < retryDeadline) {
          try { player.play(); } catch (_) {}
        }
      }, 10000);
    } catch (error) {
      console.error("Channel load error:", error);
      scheduleRetry(thisToken);
    }
  }

  async function enterFullscreen() {
    try {
      if (player && typeof player.setFullscreen === "function") {
        // Use browser fullscreen on the complete player area, not only the video element.
        if (playerContainer.requestFullscreen) {
          await playerContainer.requestFullscreen();
        } else {
          document.body.classList.add("player-fullscreen-fallback");
        }
        applyFullscreenLayout();
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock("landscape"); } catch (_) {
            // CSS rotation below is the fallback on browsers that deny orientation lock.
          }
        }
      }
    } catch (error) {
      console.warn("Fullscreen request was not accepted:", error);
      document.body.classList.add("player-fullscreen-fallback");
      applyFullscreenLayout();
    }
  }

  function applyFullscreenLayout() {
    document.body.classList.add("rotated-fullscreen");
    fullscreenButton.textContent = "×";
    fullscreenButton.setAttribute("aria-label", "ফুলস্ক্রিন বন্ধ করুন");
  }

  function restoreFullscreenLayout() {
    document.body.classList.remove("rotated-fullscreen", "player-fullscreen-fallback");
    fullscreenButton.textContent = "⛶";
    fullscreenButton.setAttribute("aria-label", "ভিডিও ফুলস্ক্রিন করুন");
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) {}
  }

  async function exitFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch (_) {}
    restoreFullscreenLayout();
  }

  fullscreenButton.addEventListener("click", () => {
    const isFullscreen = document.fullscreenElement === playerContainer ||
      document.body.classList.contains("player-fullscreen-fallback");
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === playerContainer) applyFullscreenLayout();
    else if (!document.fullscreenElement) restoreFullscreenLayout();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") restoreFullscreenLayout();
  });

  function setupTabScrolling() {
    const tabsContainer = document.querySelector(".category-tabs-scroll");
    const leftButton = document.querySelector(".scroll-button.left");
    const rightButton = document.querySelector(".scroll-button.right");
    if (!tabsContainer || !leftButton || !rightButton) return;

    leftButton.addEventListener("click", () => tabsContainer.scrollBy({ left: -200, behavior: "smooth" }));
    rightButton.addEventListener("click", () => tabsContainer.scrollBy({ left: 200, behavior: "smooth" }));

    const updateButtons = () => {
      leftButton.style.display = tabsContainer.scrollLeft > 0 ? "block" : "none";
      rightButton.style.display =
        tabsContainer.scrollLeft < tabsContainer.scrollWidth - tabsContainer.clientWidth - 1 ? "block" : "none";
    };
    tabsContainer.addEventListener("scroll", updateButtons);
    window.addEventListener("resize", updateButtons);
    updateButtons();
  }

  function showChannels(categoryName, channels) {
    channelsContainer.innerHTML = "";
    if (!Array.isArray(channels) || channels.length === 0) {
      channelsContainer.innerHTML = '<div class="empty-message">এই ক্যাটাগরিতে কোনো চ্যানেল পাওয়া যায়নি।</div>';
      return;
    }

    channels.forEach(channel => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "channel-card";
      card.setAttribute("aria-label", channel.channel_name || "চ্যানেল");
      const image = document.createElement("img");
      image.src = channel.image || "";
      image.alt = channel.channel_name || "Channel logo";
      image.loading = "lazy";
      image.onerror = () => { image.style.visibility = "hidden"; };
      const info = document.createElement("div");
      info.className = "channel-info";
      const name = document.createElement("div");
      name.className = "channel-name";
      name.textContent = channel.channel_name || "Unnamed channel";
      info.appendChild(name);
      card.append(image, info);
      card.addEventListener("click", () => changeChannel(channel.url, card));
      channelsContainer.appendChild(card);
    });

    const firstCard = channelsContainer.querySelector(".channel-card");
    if (firstCard) firstCard.click();
  }

  function loadPlaylist() {
    fetch(SERVER_JSON, { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("server.json পাওয়া যায়নি (HTTP " + response.status + ")");
        return response.json();
      })
      .then(data => {
        categoryTabs.innerHTML = "";
        const categories = Object.keys(data || {});
        if (!categories.length) throw new Error("server.json-এ কোনো ক্যাটাগরি নেই।");

        categories.forEach((category, index) => {
          const tab = document.createElement("button");
          tab.type = "button";
          tab.className = "category-tab" + (index === 0 ? " active" : "");
          tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
          tab.addEventListener("click", () => {
            document.querySelectorAll(".category-tab").forEach(item => item.classList.remove("active"));
            tab.classList.add("active");
            showChannels(category, data[category]);
          });
          categoryTabs.appendChild(tab);
        });

        showChannels(categories[0], data[categories[0]]);
        setupTabScrolling();
      })
      .catch(error => {
        console.error("Playlist loading error:", error);
        channelsContainer.innerHTML = "";
        showMessage("চ্যানেল তালিকা লোড হয়নি: " + error.message);
      });
  }

  initializePlayer().then(() => {
    // Start playlist loading independently; cards remain available even if JW setup fails.
    loadPlaylist();
  });
})();
