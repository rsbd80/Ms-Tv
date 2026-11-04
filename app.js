// ===== Initialize Clappr player with HLS support =====
var player = new Clappr.Player({
    // শুরুতে ফাঁকা রাখা হলো, নিচে server.json থেকে প্রথম চ্যানেল অটো লোড হবে
    source: "", 
    parentId: "#player",
    autoPlay: true,
    mute: false,
    height: '100%',
    width: '100%',
    disableVideoTagContextMenu: true,
    plugins: [HlsjsPlayback],   // ✅ HLS প্লাগইন
});

// ===== Change channel with retry logic =====
function changeChannel(url, channelCard) {
    if (!url) return;

    const overlayMessage = document.getElementById('overlay-message');
    overlayMessage.textContent = '১০ সেকেন্ড অপেক্ষা করুন চ্যানেল টি চালু হচ্ছে......';
    overlayMessage.style.display = 'flex';

    // পুরনো listener সরান
    player.off(Clappr.Events.PLAYER_ERROR);
    player.off(Clappr.Events.PLAYER_PLAY);

    player.load(url);

    let streamStarted = false;
    let retryTimer = null;
    const maxRetryDuration = 60000; // 60 seconds
    const retryStartTime = Date.now();

    // সফলভাবে চালু হলে
    player.once(Clappr.Events.PLAYER_PLAY, function () {
        streamStarted = true;
        if (retryTimer) clearTimeout(retryTimer);
        overlayMessage.style.display = 'none';
    });

    // এরর হলে ৬০ সেকেন্ড পর্যন্ত retry
    const onError = function (error) {
        if (streamStarted) return;

        const elapsed = Date.now() - retryStartTime;
        if (elapsed < maxRetryDuration) {
            console.warn("Stream error, retrying...", error);
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
                player.off(Clappr.Events.PLAYER_ERROR);
                player.load(url);
                player.once(Clappr.Events.PLAYER_ERROR, onError);
            }, 2000);
        } else {
            overlayMessage.textContent = 'Error: Stream not available. Please try another channel.';
            player.off(Clappr.Events.PLAYER_ERROR, onError);
        }
    };

    player.once(Clappr.Events.PLAYER_ERROR, onError);

    // Backend notify (URL-এ যথেষ্ট অংশ থাকলে)
    if (url && url.split('/').length > 3) {
        const streamName = url.split('/')[3];
        fetch(`http://100.100.100.100/play-channel/${streamName}`)
            .then(response => response.json())
            .then(data => console.log("Play-channel API response:", data))
            .catch(error => console.error("Error calling play-channel API:", error));
    }

    // Active channel highlight
    document.querySelectorAll('.channel-card').forEach(card => {
        card.classList.remove('active');
    });
    if (channelCard) {
        channelCard.classList.add('active');
        channelCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ===== Scrollable tab setup =====
function setupTabScrolling() {
    const tabsContainer = document.querySelector('.category-tabs-scroll');
    const leftButton = document.querySelector('.scroll-button.left');
    const rightButton = document.querySelector('.scroll-button.right');

    if (!tabsContainer || !leftButton || !rightButton) return;

    leftButton.addEventListener('click', () => {
        tabsContainer.scrollBy({ left: -200, behavior: 'smooth' });
    });

    rightButton.addEventListener('click', () => {
        tabsContainer.scrollBy({ left: 200, behavior: 'smooth' });
    });

    tabsContainer.addEventListener('scroll', () => {
        const scrollLeft = tabsContainer.scrollLeft;
        const scrollWidth = tabsContainer.scrollWidth;
        const clientWidth = tabsContainer.clientWidth;

        leftButton.style.display = scrollLeft > 0 ? 'flex' : 'none';
        rightButton.style.display = scrollLeft < (scrollWidth - clientWidth - 1) ? 'flex' : 'none';
    });

    tabsContainer.dispatchEvent(new Event('scroll'));
}

// ===== Show channels under selected category =====
function showChannels(categoryName, channels) {
    const channelsContainer = document.getElementById('channels-container');
    if (!channelsContainer) return;
    channelsContainer.innerHTML = '';

    if (!channels || !Array.isArray(channels)) {
        channelsContainer.innerHTML =
            '<div style="padding: 20px; text-align: center; color: #aaa; grid-column: 1/-1;">কোনো চ্যানেল পাওয়া যায়নি</div>';
        return;
    }

    channels.forEach(channel => {
        const channelCard = document.createElement('div');
        channelCard.className = 'channel-card';
        channelCard.onclick = () => changeChannel(channel.url, channelCard);

        // কার্ডের ভেতরের ডিজাইন আগের মতোই রাখা হয়েছে
        channelCard.innerHTML = `
            <img src="${channel.image}" alt="${channel.channel_name}">
            <div class="channel-info">
                <div class="channel-name">${channel.channel_name}</div>
                <div class="channel-category">${categoryName}</div>
            </div>
        `;

        channelsContainer.appendChild(channelCard);
    });

    // Auto-select first channel
    if (channels.length > 0) {
        const firstChannelCard = channelsContainer.querySelector('.channel-card');
        changeChannel(channels[0].url, firstChannelCard);
    }
}

// ===== Fetch categories and channels from server.json =====
fetch('server.json')
    .then(response => {
        if (!response.ok) throw new Error('server.json লোড করা যায়নি');
        return response.json();
    })
    .then(data => {
        const categoryTabs = document.getElementById('category-tabs');
        if (!categoryTabs) return;
        categoryTabs.innerHTML = '';

        let firstCategory = true;
        let firstCategoryKey = null;
        let firstCategoryData = null;

        for (const category in data) {
            if (data.hasOwnProperty(category)) {
                if (!firstCategoryKey) {
                    firstCategoryKey = category;
                    firstCategoryData = data[category];
                }

                const tab = document.createElement('div');
                tab.className = 'category-tab';
                if (firstCategory) {
                    tab.classList.add('active');
                    firstCategory = false;
                }
                tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);

                tab.addEventListener('click', function () {
                    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    showChannels(category, data[category]);
                });

                categoryTabs.appendChild(tab);
            }
        }

        if (firstCategoryKey) {
            showChannels(firstCategoryKey, firstCategoryData);
        }

        setupTabScrolling();
    })
    .catch(error => {
        console.error('Error fetching playlist:', error);
        const container = document.getElementById('channels-container');
        if (container) {
            container.innerHTML =
                '<div style="padding: 20px; text-align: center; color: #ff5555; grid-column: 1/-1;">চ্যানেল লোড করতে সমস্যা হচ্ছে। server.json ফাইলটি চেক করুন।</div>';
        }
    });
