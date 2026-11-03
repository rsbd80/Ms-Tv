<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Live TV Player</title>
    <!-- JW Player Script -->
    <script src="https://content.jwplatform.com/libraries/YOUR_JW_PLAYER_KEY.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #121212;
            color: #ffffff;
            font-family: sans-serif;
        }
        #player-container {
            position: relative;
            width: 100%;
            height: 50vh;
            background: #000;
        }
        #player {
            width: 100%;
            height: 100%;
        }
        #overlay-message {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 18px;
            z-index: 10;
            text-align: center;
            padding: 20px;
        }
        .category-tabs-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            background: #1e1e1e;
            padding: 10px;
        }
        .category-tabs-scroll {
            display: flex;
            overflow-x: auto;
            scroll-behavior: smooth;
            gap: 10px;
            white-space: nowrap;
            width: 100%;
            scrollbar-width: none;
        }
        .category-tabs-scroll::-webkit-scrollbar {
            display: none;
        }
        .category-tab {
            padding: 8px 16px;
            background: #2a2a2a;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
        }
        .category-tab.active {
            background: #ff0000;
            color: #fff;
        }
        .scroll-button {
            background: rgba(0,0,0,0.5);
            border: none;
            color: white;
            padding: 10px;
            cursor: pointer;
            z-index: 5;
        }
        #channels-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
            padding: 10px;
        }
        .channel-card {
            background: #1e1e1e;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            border: 2px solid transparent;
        }
        .channel-card.active {
            border-color: #ff0000;
        }
        .channel-card img {
            width: 100%;
            height: 80px;
            object-fit: cover;
        }
        .channel-info {
            padding: 8px;
        }
        .channel-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .channel-category {
            font-size: 12px;
            color: #aaa;
        }

        /* Fullscreen Cover & Notch Fix */
        .jwplayer.jw-flag-fullscreen video {
            object-fit: cover !important;
        }
    </style>
</head>
<body>

    <div id="player-container">
        <div id="player"></div>
        <div id="overlay-message">চ্যানেল টি লোড হচ্ছে...</div>
    </div>

    <div class="category-tabs-wrapper">
        <button class="scroll-button left" style="display:none;">&lt;</button>
        <div class="category-tabs-scroll" id="category-tabs"></div>
        <button class="scroll-button right" style="display:none;">&gt;</button>
    </div>

    <div id="channels-container"></div>

    <script>
        // Initialize JW Player with playlist support
        var player = jwplayer("player").setup({
            playlist: [{
                file: "F92YWxIZTO0UOezeus/fet-1/playlist.m3u8"
            }],
            autostart: true,
            mute: false,
            height: '100%',
            width: '100%',
            stretching: 'fill', // নচ বা ফাঁকা অংশ ছাড়া পুরো স্ক্রিন জুড়ে দেখানোর জন্য
            controls: true
        });

        // Function to change channel with retry logic
        function changeChannel(url, channelCard) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.textContent = '১০ সেকেন্ড অপেক্ষা করুন চ্যানেল টি চালু হচ্ছে......';
            overlayMessage.style.display = 'flex';

            // JW Player-এ প্লেলিস্ট ফরম্যাটে নতুন URL লোড করা
            player.load([{
                file: url
            }]);
            player.play();

            let streamStarted = false;
            const maxRetryDuration = 60000; // 60 seconds
            const retryStartTime = Date.now();

            // Remove previous listeners to avoid stacking
            player.off('error');
            player.off('play');

            // On successful play
            player.once('play', function () {
                streamStarted = true;
                overlayMessage.style.display = 'none';
            });

            // On error, retry for 60 seconds
            player.on('error', function (error) {
                if (streamStarted) return;

                const elapsed = Date.now() - retryStartTime;
                if (elapsed < maxRetryDuration) {
                    console.warn("Stream error, retrying...", error);
                    setTimeout(() => {
                        player.load([{ file: url }]);
                        player.play();
                    }, 2000); // retry every 2s
                } else {
                    overlayMessage.textContent = 'Error: Stream not available. Please try another channel.';
                }
            });

            // Call backend to notify play attempt
            const streamName = url.split('/')[3];
            fetch(`http://100.100.100.100/play-channel/${streamName}`)
                .then(response => response.json())
                .then(data => console.log("Play-channel API response:", data))
                .catch(error => console.error("Error calling play-channel API:", error));

            // Highlight the active channel card
            document.querySelectorAll('.channel-card').forEach(card => {
                card.classList.remove('active');
            });
            channelCard.classList.add('active');

            // Scroll to selected card
            channelCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Scrollable tab setup
        function setupTabScrolling() {
            const tabsContainer = document.querySelector('.category-tabs-scroll');
            const leftButton = document.querySelector('.scroll-button.left');
            const rightButton = document.querySelector('.scroll-button.right');

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

        // Show channels under selected category
        function showChannels(categoryName, channels) {
            const channelsContainer = document.getElementById('channels-container');
            channelsContainer.innerHTML = '';

            channels.forEach(channel => {
                const channelCard = document.createElement('div');
                channelCard.className = 'channel-card';
                channelCard.onclick = () => changeChannel(channel.url, channelCard);

                channelCard.innerHTML = `
                    <img src="${channel.image}" alt="${channel.channel_name}">
                    <div class="channel-info">
                        <div class="channel-name">${channel.channel_name}</div>
                        <div class="channel-category">${categoryName}</div>
                    </div>
                `;

                channelsContainer.appendChild(channelCard);
            });

            // Auto-select the first channel
            if (channels.length > 0) {
                const firstChannelCard = channelsContainer.querySelector('.channel-card');
                changeChannel(channels[0].url, firstChannelCard);
            }
        }

        // Fetch categories and channels
        fetch('server.json')
            .then(response => response.json())
            .then(data => {
                const categoryTabs = document.getElementById('category-tabs');
                let firstCategory = true;

                for (const category in data) {
                    if (data.hasOwnProperty(category)) {
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

                // Auto-select first category
                if (Object.keys(data).length > 0) {
                    const firstCategoryKey = Object.keys(data)[0];
                    showChannels(firstCategoryKey, data[firstCategoryKey]);
                }

                setupTabScrolling();
            })
            .catch(error => {
                console.error('Error fetching playlist:', error);
                document.getElementById('channels-container').innerHTML =
                    '<div style="padding: 20px; text-align: center; color: #606060;">Error loading channels. Please try again later.</div>';
            });
    </script>
</body>
</html>
