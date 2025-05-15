// Constants
const BLOCKS_PER_DAY = 144;
const BILL_CYCLE_DAYS = 30;
const BLOCKS_PER_DIFFICULTY_ADJUSTMENT = 2016;
const DAYS_PER_DIFFICULTY_ADJUSTMENT = BLOCKS_PER_DIFFICULTY_ADJUSTMENT / BLOCKS_PER_DAY;

// Data placeholders
let historicalData = [];
let priceData = [];
let historicalEvents = [];
let hardware = [];
let historicalNetworkHashrate = [];
let tickerHeadlines = [];
let eventQueue = []; // Queue for event pop-ups
let hardwareNotificationQueue = []; // Queue for new hardware notifications
let availableHardware = []; // Track hardware available for purchase
let previouslyAvailableHardware = new Set(); // Track hardware that was previously available to detect new ones
let isSoundMuted = false; // Track mute state

// Toggle mute state for mining sound
function toggleMuteMiningSound() {
    isSoundMuted = !isSoundMuted;
    const muteButton = document.getElementById("mute-sound-button");
    if (muteButton) {
        muteButton.textContent = isSoundMuted ? "Unmute Sound" : "Mute Sound";
    }
    console.log("Sound muted:", isSoundMuted);
}

// Load historical difficulty data
function loadHistoricalData() {
    console.log("Attempting to load HistoricalDifficulty.json");
    return fetch('data/HistoricalDifficulty.json')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch HistoricalDifficulty.json: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            historicalData = data;
            historicalData.forEach(entry => {
                entry.date = new Date(entry.date);
            });
            historicalData.sort((a, b) => a.date - b.date);
            console.log("Loaded historicalData:", historicalData);
        })
        .catch(error => {
            console.error("Error loading historical difficulty data:", error);
            throw error; // Propagate error to halt game initialization
        });
}

// Load historical price data
function loadPriceData() {
    console.log("Attempting to load HistoricalPrices.json");
    return fetch('data/HistoricalPrices.json')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch HistoricalPrices.json: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            priceData = data;
            priceData.forEach(entry => {
                entry.date = new Date(entry.date);
            });
            priceData.sort((a, b) => a.date - b.date);
            console.log("Loaded priceData:", priceData);
        })
        .catch(error => {
            console.error("Error loading historical price data:", error);
            throw error; // Propagate error to halt game initialization
        });
}

// Load historical events
function loadHistoricalEvents() {
    console.log("Attempting to load HistoricalEvents.json");
    return fetch('data/HistoricalEvents.json')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch HistoricalEvents.json: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            historicalEvents = data;
            historicalEvents.forEach(event => {
                event.date = new Date(event.date);
                event.date.setUTCHours(0, 0, 0, 0);
            });
            historicalEvents.sort((a, b) => a.date - b.date);
            console.log("Loaded historicalEvents:", historicalEvents);
        })
        .catch(error => {
            console.error("Error loading historical events:", error);
            throw error; // Propagate error to halt game initialization
        });
}

// Load historical network hashrate data
function loadHistoricalNetworkHashrate() {
    console.log("Attempting to load HistoricalNetworkHashrate.json");
    return fetch('data/HistoricalNetworkHashrate.json')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch HistoricalNetworkHashrate.json: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            historicalNetworkHashrate = data;
            historicalNetworkHashrate.forEach(entry => {
                entry.date = new Date(entry.date);
                entry.date.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
                // Validate hashrate
                entry.hashrate = isNaN(entry.hashrate) || entry.hashrate <= 0 ? 7000000 : entry.hashrate;
            });
            historicalNetworkHashrate.sort((a, b) => a.date - b.date);
            console.log("Loaded historicalNetworkHashrate:", historicalNetworkHashrate);
        })
        .catch(error => {
            console.error("Error loading historical network hashrate data:", error);
            throw error; // Propagate error to halt game initialization
        });
}

// Load hardware data
function loadHardware() {
    console.log("Attempting to load hardware.json");
    return fetch('data/hardware.json')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch hardware.json: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            hardware = data;
            hardware.forEach(item => {
                item.priceUpdateStart = new Date(item.priceUpdateStart);
                item.durability = 100;
            });
            console.log("Loaded hardware:", hardware);
        })
        .catch(error => {
            console.error("Error loading hardware data:", error);
            throw error; // Propagate error to halt game initialization
        });
}

// Load ticker headlines
function loadTickerHeadlines() {
    console.log("Attempting to load TickerHeadlines.json");
    return fetch('data/TickerHeadlines.json')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch TickerHeadlines.json: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            tickerHeadlines = data;
            tickerHeadlines.forEach(headline => {
                headline.startDate = new Date(headline.startDate);
                if (headline.endDate) headline.endDate = new Date(headline.endDate);
            });
            tickerHeadlines.sort((a, b) => a.startDate - b.startDate);
            console.log("Loaded tickerHeadlines:", tickerHeadlines);
        })
        .catch(error => {
            console.error("Error loading ticker headlines:", error);
            throw error; // Propagate error to halt game initialization
        });
}

const defaultGameState = {
    btc: 0,
    usd: 1000,
    miners: [],
    date: new Date(Date.UTC(2009, 0, 3)),
    daysUntilBill: BILL_CYCLE_DAYS,
    totalHashrate: 0,
    priceHistory: [],
    allPriceHistory: [],
    chartTimeframe: '30days',
    speed: 'normal',
    hasReachedMillion: false,
    blocksMined: 0,
    currentDifficulty: 1.0,
    miningPoolsAvailable: false,
    inMiningPool: false,
    poolFee: 0,
    skipHardwareNotifications: false,
    skipEventNotifications: false,
    isSoundMuted: false // Add mute state
};

let gameState = { ...defaultGameState };
let gameLoopInterval;
let currentBTCPrice = 0;
let selectedMinerToSell = null;
let selectedMinerToRepair = null;
let isGamePaused = false;

// Initialize game
window.onload = () => {
    console.log("window.onload started");
    try {
        const loadingMessage = document.getElementById("loading-message");
        const startButton = document.getElementById("start-button");

        console.log("Loading message element:", loadingMessage);
        console.log("Start button element:", startButton);

        if (!loadingMessage || !startButton) {
            console.error("Required elements not found: loading-message or start-button");
            throw new Error("Required elements not found");
        }

        console.log("Setting loading message display to block");
        loadingMessage.style.display = "block";
        console.log("Disabling start button");
        startButton.disabled = true;

        console.log("Starting Promise.all for data loading");
        Promise.all([
            loadHistoricalData(),
            loadPriceData(),
            loadHardware(),
            loadHistoricalEvents(),
            loadHistoricalNetworkHashrate(),
            loadTickerHeadlines()
        ])
        .then(() => {
            console.log("All data loaded successfully");
            // Dynamically set default miner from hardware
            if (hardware.length > 0) {
                const firstHardware = hardware[0];
                defaultGameState.miners = [{
                    name: firstHardware.name,
                    hashrate: firstHardware.hashrate,
                    powerCost: firstHardware.powerCost,
                    durability: 100,
                    baseHashrate: firstHardware.hashrate
                }];
                defaultGameState.totalHashrate = firstHardware.hashrate;
                gameState = { ...defaultGameState }; // Reset gameState with dynamic miner
                console.log("Starting miner set to:", defaultGameState.miners[0]); // Debug log

                // Initialize available hardware without notifications
                console.log("Initializing available hardware without notifications");
                updateAvailableHardware(false);
                console.log("Initial available hardware:", availableHardware.map(item => item.name));
            } else {
                throw new Error("No hardware available to initialize game");
            }

            currentBTCPrice = getBTCPrice(gameState.date);
            const saved = localStorage.getItem("bitcoinTycoon");
            if (saved) {
                try {
                    const savedState = JSON.parse(saved);
                    if (savedState.usd <= 0) {
                        document.getElementById("splash-screen").style.display = "none";
                        document.getElementById("lose-screen").style.display = "flex";
                        return;
                    }
                    savedState.btc = isNaN(savedState.btc) ? 0 : parseFloat(savedState.btc);
                    // Ensure saved flags are booleans
                    savedState.skipHardwareNotifications = !!savedState.skipHardwareNotifications;
                    savedState.skipEventNotifications = !!savedState.skipEventNotifications;
                    gameState = savedState;
                    // Ensure saved date is in UTC
                    gameState.date = new Date(savedState.date);
                    gameState.date.setUTCHours(0, 0, 0, 0);
                    console.log("Loaded saved game state:", gameState);
                    // Update available hardware without notifications
                    updateAvailableHardware(false);
                } catch (error) {
                    console.error("Error loading saved game:", error);
                    localStorage.removeItem("bitcoinTycoon");
                }
            }
            // Apply past events for price and mining pools
            historicalEvents.forEach(event => {
                if (event.date.getTime() <= gameState.date.getTime() && event.effect) {
                    if (event.effect.type === "price") {
                        currentBTCPrice = event.effect.value;
                        gameState.priceHistory.push(currentBTCPrice);
                        gameState.allPriceHistory.push({ date: new Date(gameState.date), price: currentBTCPrice });
                    } else if (event.effect.type === "unlock_mining_pools") {
                        gameState.miningPoolsAvailable = true;
                        console.log("Applied initial mining pool unlock: miningPoolsAvailable =", gameState.miningPoolsAvailable);
                    }
                }
            });
        })
        .catch(error => {
            console.error("Critical error during data loading:", error);
            loadingMessage.textContent = "Failed to load game data. Please check your JSON files and refresh.";
            startButton.disabled = true; // Keep button disabled
            return;
        })
        .finally(() => {
            console.log("Finally block reached");
            if (historicalData.length && priceData.length && hardware.length && historicalEvents.length && historicalNetworkHashrate.length && tickerHeadlines.length) {
                console.log("Hiding loading message");
                loadingMessage.style.display = "none";
                console.log("Enabling start button");
                startButton.disabled = false;
                console.log("Showing splash screen");
                document.getElementById("splash-screen").style.display = "flex";
                console.log("Initialization complete, button should be enabled");
            } else {
                console.log("Data loading incomplete, keeping button disabled");
            }
        });
    } catch (error) {
        console.error("Unexpected error in window.onload:", error);
        const startButton = document.getElementById("start-button");
        const loadingMessage = document.getElementById("loading-message");
        if (startButton && loadingMessage) {
            loadingMessage.textContent = "An unexpected error occurred. Please refresh and try again.";
            startButton.disabled = true;
            console.log("Fallback: Button remains disabled after error");
        }
    }
};

// Start game
function startGame() {
    console.log("startGame called");
    try {
        if (!hardware.length) throw new Error("Hardware data not loaded");
        document.getElementById("splash-screen").style.display = "none";
        document.getElementById("lose-screen").style.display = "none";
        document.getElementById("congrats-screen").style.display = "none";
        document.getElementById("game-container").style.display = "block";
        loadGame();
        isGamePaused = false;

        // Process initial events
        eventQueue = [];
        const eventsUpToNow = historicalEvents.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.getTime() <= gameState.date.getTime();
        });
        eventsUpToNow.forEach(event => {
            if (event.effect) {
                if (event.effect.type === "price") {
                    currentBTCPrice = event.effect.value;
                    console.log("Applied initial event price:", currentBTCPrice);
                } else if (event.effect.type === "unlock_mining_pools") {
                    gameState.miningPoolsAvailable = true;
                    console.log("Applied initial mining pool unlock: miningPoolsAvailable =", gameState.miningPoolsAvailable);
                }
            }
        });
        const genesisEvent = historicalEvents.find(event =>
            event.date.getTime() === gameState.date.getTime()
        );
        if (genesisEvent && !gameState.skipEventNotifications) {
            eventQueue.push(genesisEvent);
            displayNextEvent();
        }

        startGameLoop();
        startNewsTicker();
    } catch (error) {
        console.error("Error starting game:", error);
        alert("Failed to start game. Please ensure all JSON files are loaded correctly and refresh.");
        restartGame();
    }
}

// Load game
function loadGame() {
    try {
        const saved = localStorage.getItem("bitcoinTycoon");
        if (saved) {
            gameState = JSON.parse(saved);
            gameState.date = new Date(gameState.date);
            gameState.date.setUTCHours(0, 0, 0, 0);
            gameState.skipHardwareNotifications = !!gameState.skipHardwareNotifications;
            gameState.skipEventNotifications = !!gameState.skipEventNotifications;
            isSoundMuted = !!gameState.isSoundMuted; // Load mute state

            // Correct miner hashrates based on hardware.json
            gameState.miners.forEach(miner => {
                const hardwareEntry = hardware.find(item => item.name === miner.name);
                if (hardwareEntry) {
                    miner.baseHashrate = hardwareEntry.hashrate;
                    miner.hashrate = miner.baseHashrate * (miner.durability / 100);
                    miner.powerCost = hardwareEntry.powerCost;
                } else {
                    console.warn(`Hardware not found for miner ${miner.name}, removing from inventory`);
                    miner.hashrate = 0;
                }
            });
            gameState.miners = gameState.miners.filter(miner => miner.hashrate > 0);
            gameState.totalHashrate = gameState.miners.reduce((sum, miner) => {
                const hr = Number(miner.hashrate) || 0;
                if (isNaN(hr)) {
                    console.warn(`Invalid hashrate for miner ${miner.name}: ${miner.hashrate}`);
                    return sum;
                }
                return sum + hr;
            }, 0);
            console.log("Loaded game, totalHashrate:", gameState.totalHashrate);
        }
        currentBTCPrice = getBTCPrice(gameState.date);
        updateUI();
        // Update mute button text based on loaded state
        const muteButton = document.getElementById("mute-sound-button");
        if (muteButton) {
            muteButton.textContent = isSoundMuted ? "Unmute Sound" : "Mute Sound";
        }
        if (gameState.usd <= 0) {
            document.getElementById("game-container").style.display = "none";
            document.getElementById("lose-screen").style.display = "flex";
            clearInterval(gameLoopInterval);
        }
    } catch (error) {
        console.error("Error loading game state:", error);
        gameState = { ...defaultGameState };
        gameState.date = new Date(Date.UTC(2009, 0, 3));
        localStorage.setItem("bitcoinTycoon", JSON.stringify(gameState));
        updateUI();
    }
}

// Save game
function saveGame() {
    try {
        if (isNaN(gameState.btc)) {
            console.warn("BTC balance is NaN before saving, resetting to 0");
            gameState.btc = 0;
        }
        localStorage.setItem("bitcoinTycoon", JSON.stringify(gameState));
    } catch (error) {
        console.error("Error saving game:", error);
    }
}

// Restart game
function restartGame() {
    gameState = { ...defaultGameState };
    gameState.date = new Date(Date.UTC(2009, 0, 3));
    localStorage.setItem("bitcoinTycoon", JSON.stringify(gameState));
    document.getElementById("game-container").style.display = "none";
    document.getElementById("lose-screen").style.display = "none";
    document.getElementById("congrats-screen").style.display = "none";
    document.getElementById("splash-screen").style.display = "flex";
    clearInterval(gameLoopInterval);
    isGamePaused = true;
    hardware.forEach(item => item.currentPrice = item.basePrice);
    eventQueue = [];
    hardwareNotificationQueue = [];
    availableHardware = [];
    previouslyAvailableHardware.clear();
    updateAvailableHardware(false);
}

// Close congratulations screen
function closeCongratsScreen() {
    document.getElementById("congrats-screen").style.display = "none";
    document.getElementById("game-container").style.display = "block";
    isGamePaused = false;
    startGameLoop();
    startNewsTicker();
}

// Get BTC price with interpolation and future simulation
function getBTCPrice(date) {
    console.log(`getBTCPrice called for date: ${formatDateUTC(date)}`);
    const currentDate = new Date(Date.UTC(2025, 3, 23)); // April 23, 2025, in UTC
    const firstPriceDate = new Date(Date.UTC(2010, 0, 1)); // January 1, 2010

    // Return null for dates before 2010 to indicate BTC cannot be bought/sold
    if (date < firstPriceDate) {
        return null;
    }

    const priceSettingEvent = historicalEvents.find(event =>
        event.date.getTime() === date.getTime() && event.effect && event.effect.type === "price"
    );
    if (priceSettingEvent) {
        console.log("Price set by event:", priceSettingEvent.event, "value:", priceSettingEvent.effect.value);
        return priceSettingEvent.effect.value;
    }

    if (priceData.length > 0) {
        let previous = null;
        let next = null;
        for (const entry of priceData) {
            if (entry.date.getTime() <= date.getTime()) {
                previous = entry;
            } else if (entry.date.getTime() > date.getTime() && !next) {
                next = entry;
            }
        }
        if (previous && previous.date.getTime() === date.getTime()) {
            let price = previous.price * (1 + (Math.random() - 0.5) * 0.1);
            return Math.max(0.001, parseFloat(price.toFixed(2)));
        }
        if (previous && next) {
            const timeDiff = next.date - previous.date;
            const timeSincePrevious = date - previous.date;
            const fraction = timeSincePrevious / timeDiff;
            let price = previous.price + (next.price - previous.price) * fraction;
            price *= (1 + (Math.random() - 0.5) * 0.1);
            return Math.max(0.001, parseFloat(price.toFixed(2)));
        }
        if (previous) {
            if (date > currentDate) {
                const lastPrice = previous.price;
                const lastDate = previous.date;
                const daysSinceLast = (date - lastDate) / (1000 * 60 * 60 * 24);
                const annualGrowthRate = 0.15;
                const dailyGrowthRate = Math.pow(1 + annualGrowthRate, 1 / 365) - 1;
                let price = lastPrice * Math.pow(1 + dailyGrowthRate, daysSinceLast);
                const dailyVolatility = 0.03;
                price *= (1 + (Math.random() - 0.5) * dailyVolatility);
                const daysSince2025 = (date - currentDate) / (1000 * 60 * 60 * 24);
                const correctionChance = (daysSince2025 % 365) / 365;
                if (Math.random() < correctionChance * 0.1) {
                    const correctionFactor = 0.2 + Math.random() * 0.2;
                    price *= (1 - correctionFactor);
                }
                price = Math.min(price, 1000000);
                return Math.max(0.01, parseFloat(price.toFixed(2)));
            }
            let price = previous.price * (1 + (Math.random() - 0.5) * 0.1);
            return Math.max(0.001, parseFloat(price.toFixed(2)));
        }
        return 0.001;
    }
    return 0.001;
}

// Get difficulty with interpolation
function getDifficulty(date) {
    if (historicalData.length > 0) {
        let previous = null;
        let next = null;
        for (const entry of historicalData) {
            if (entry.date <= date) {
                previous = entry;
            } else if (entry.date > date && !next) {
                next = entry;
            }
        }
        if (previous && previous.date.getTime() === date.getTime()) {
            return previous.difficulty;
        }
        if (previous && next) {
            const timeDiff = next.date - previous.date;
            const timeSincePrevious = date - previous.date;
            const fraction = timeSincePrevious / timeDiff;
            return previous.difficulty + (next.difficulty - previous.difficulty) * fraction;
        }
        if (previous) {
            return previous.difficulty;
        }
        return 1.0;
    }
    return 1.0;
}

// Adjust difficulty
function adjustDifficulty() {
    const baseDifficulty = getDifficulty(gameState.date);
    let growthRate = 1.0;
    const previousEntry = historicalData.find(entry => entry.date <= gameState.date);
    const nextEntry = historicalData.find(entry => entry.date > gameState.date);

    if (previousEntry && nextEntry) {
        const timeDiffDays = (nextEntry.date - previousEntry.date) / (1000 * 60 * 60 * 24);
        const adjustmentsInPeriod = timeDiffDays / DAYS_PER_DIFFICULTY_ADJUSTMENT;
        if (adjustmentsInPeriod > 0) {
            growthRate = Math.pow(nextEntry.difficulty / previousEntry.difficulty, 1 / adjustmentsInPeriod);
        }
    } else if (previousEntry) {
        growthRate = 1.1;
    }
    growthRate = Math.min(growthRate, 1.2);
    gameState.currentDifficulty *= growthRate;
    return gameState.currentDifficulty;
}

// Check historical events and add to eventQueue
function checkHistoricalEvents(startDate, endDate) {
    console.log(`Checking events between ${formatDateUTC(startDate)} and ${formatDateUTC(endDate)}`);
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);

    if (gameState.skipEventNotifications) {
        console.log("Skipping event notifications due to gameState.skipEventNotifications");
        return;
    }

    const eventsInRange = historicalEvents.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setUTCHours(0, 0, 0, 0);
        return eventDate > start && eventDate <= end;
    });

    eventsInRange.sort((a, b) => a.date - b.date);
    eventQueue.push(...eventsInRange);
    console.log("Event queue updated:", eventQueue);
    if (!isGamePaused && eventQueue.length > 0) {
        console.log("Pausing game to display event");
        displayNextEvent();
    } else {
        console.log("No events to display, game continues");
    }
}

// Display historical event pop-up
function displayNextEvent() {
    if (eventQueue.length === 0) {
        isGamePaused = false;
        gameState.speed = 'normal';
        document.getElementById("speed-button").textContent = "SPEED: Normal";
        startGameLoop();
        return;
    }
    const event = eventQueue.shift();
    isGamePaused = true;

    // Debug log for the event being processed
    console.log(`Processing event on ${formatDateUTC(event.date)}: ${event.event}, Effect:`, event.effect);

    if (event.effect) {
        if (event.effect.type === "price" || event.effect.type === "price_increase" || event.effect.type === "price_multiplier") {
            currentBTCPrice = event.effect.type === "price" ? event.effect.value : currentBTCPrice * event.effect.value;
            gameState.priceHistory.push(currentBTCPrice);
            if (gameState.priceHistory.length > 30) gameState.priceHistory.shift();
            gameState.allPriceHistory.push({ date: new Date(gameState.date), price: currentBTCPrice });
            if (gameState.allPriceHistory.length > 1200) gameState.allPriceHistory.shift();
        } else if (event.effect.type === "price_drop") {
            currentBTCPrice *= event.effect.value;
            gameState.priceHistory.push(currentBTCPrice);
            if (gameState.priceHistory.length > 30) gameState.priceHistory.shift();
            gameState.allPriceHistory.push({ date: new Date(gameState.date), price: currentBTCPrice });
            if (gameState.allPriceHistory.length > 1200) gameState.allPriceHistory.shift();
        } else if (event.effect.type === "difficulty") {
            gameState.currentDifficulty *= event.effect.value;
        } else if (event.effect.type === "power_cost") {
            gameState.miners.forEach(miner => {
                miner.powerCost *= event.effect.value;
            });
        } else if (event.effect.type === "unlock_mining_pools") {
            gameState.miningPoolsAvailable = true;
            console.log("Mining pools unlocked! miningPoolsAvailable:", gameState.miningPoolsAvailable);
            showNotification("Mining pools are now available! Check the Mining Pool section.");
        }
    }

    const eventModal = document.createElement("div");
    eventModal.className = "modal";
    eventModal.id = "event-modal";
    eventModal.innerHTML = `
        <div class="modal-content">
            <h2>Historical Event</h2>
            <p>${formatDateUTC(event.date)}</p>
            <p>${event.event}</p>
            <button onclick="closeEventModal()">Close</button>
            <button onclick="skipAllEvents()">Skip All Events</button>
        </div>
    `;
    document.body.appendChild(eventModal);
    eventModal.style.display = "flex";
    updateUI();
}

// Close event modal
function closeEventModal() {
    const eventModal = document.getElementById("event-modal");
    if (eventModal) eventModal.remove();
    if (eventQueue.length > 0) {
        displayNextEvent();
    } else {
        isGamePaused = false;
        console.log("Game unpaused after events");
        gameState.speed = 'normal';
        document.getElementById("speed-button").textContent = "SPEED: Normal";
        startGameLoop();
    }
}

// Skip all events
function skipAllEvents() {
    eventQueue = [];
    gameState.skipEventNotifications = true; // Set flag to skip future event notifications
    console.log("Skipping all event notifications, skipEventNotifications set to true");
    const eventModal = document.getElementById("event-modal");
    if (eventModal) eventModal.remove();
    isGamePaused = false;
    gameState.speed = 'normal';
    document.getElementById("speed-button").textContent = "SPEED: Normal";
    startGameLoop();
    saveGame(); // Save game state to persist the flag
}

// Format hashrate
function formatHashrate(hashrate) {
    if (hashrate < 1000000) return `${(hashrate / 1000).toFixed(2)} KH/s`;      // < 1 MH/s
    else if (hashrate < 1000000000) return `${(hashrate / 1000000).toFixed(2)} MH/s`; // < 1 GH/s
    else if (hashrate < 1000000000000) return `${(hashrate / 1000000000).toFixed(2)} GH/s`; // < 1 TH/s
    else return `${(hashrate / 1000000000000).toFixed(2)} TH/s`;
}

function displayHardware(hardware) {
    console.log(`${hardware.name}: ${formatHashrate(hardware.hashrate)}`);
}

// Update hardware prices
function updateHardwarePrices() {
    const sixMonthsInDays = 182.5;
    const currentDate = new Date(gameState.date);
    hardware.forEach(item => {
        const releaseDate = new Date(item.availableYear, item.availableMonth || 0, 1);
        if (currentDate < releaseDate) {
            item.currentPrice = item.basePrice;
            return;
        }
        const daysSinceRelease = (currentDate - releaseDate) / (1000 * 60 * 60 * 24);
        const reductions = Math.floor(daysSinceRelease / sixMonthsInDays);
        let price = item.basePrice;
        for (let i = 0; i < reductions; i++) {
            price = Math.max(100, price * 0.5);
        }
        item.currentPrice = price;
    });
}

// Update available hardware based on current date
function updateAvailableHardware(showNotifications = true) {
    const currentYear = gameState.date.getUTCFullYear();
    const currentMonth = gameState.date.getUTCMonth();
    const gameStartDate = new Date(Date.UTC(2009, 0, 3)); // January 3, 2009

    const currentAvailableHardware = hardware.filter(item => {
        const isAvailable = (currentYear > item.availableYear) ||
                           (currentYear === item.availableYear && (!item.availableMonth || currentMonth >= item.availableMonth));
        console.log(`Checking availability for ${item.name}: availableYear=${item.availableYear}, availableMonth=${item.availableMonth || 'N/A'}, currentYear=${currentYear}, currentMonth=${currentMonth}, isAvailable=${isAvailable}`);
        return isAvailable;
    });

    if (showNotifications && !gameState.skipHardwareNotifications) {
        const newHardware = currentAvailableHardware.filter(item => {
            const releaseDate = new Date(item.availableYear, item.availableMonth || 0, 1);
            const isNew = releaseDate > gameStartDate && !previouslyAvailableHardware.has(item.name);
            if (isNew) {
                console.log(`New hardware detected: ${item.name}, releaseDate: ${formatDateUTC(releaseDate)}`);
            }
            return isNew;
        });
        newHardware.forEach(item => {
            previouslyAvailableHardware.add(item.name);
            hardwareNotificationQueue.push(item);
            console.log(`Queued hardware notification for: ${item.name}`);
        });
        if (!isGamePaused && hardwareNotificationQueue.length > 0) {
            console.log("Pausing game to display hardware notification");
            displayNextHardwareNotification();
        }
    } else {
        currentAvailableHardware.forEach(item => {
            previouslyAvailableHardware.add(item.name);
            console.log(`Marked as previously available during init: ${item.name}`);
        });
    }

    availableHardware = currentAvailableHardware;
    console.log("Updated available hardware:", availableHardware.map(item => item.name));
}

// Show notification for newly available hardware
function showNewHardwareNotification(hardwareItem) {
    if (isGamePaused) {
        setTimeout(() => showNewHardwareNotification(hardwareItem), 1000);
        return;
    }

    isGamePaused = true;
    const networkHashrate = getNetworkHashrate(gameState.date);
    const blockReward = gameState.date.getUTCFullYear() < 2012 ? 50 : gameState.date.getUTCFullYear() < 2016 ? 25 : gameState.date.getUTCFullYear() < 2020 ? 12.5 : 6.25;
    const blockFindProbability = hardwareItem.hashrate / (networkHashrate + hardwareItem.hashrate);
    const blocksMinedPerDay = blockFindProbability * BLOCKS_PER_DAY;
    const btcMinedPerDay = blocksMinedPerDay * blockReward;
    const btcMinedPerMonth = btcMinedPerDay * 30;
    const monthlyRevenue = currentBTCPrice === null ? 0 : (btcMinedPerDay * 30 * currentBTCPrice).toFixed(2);

    const notificationModal = document.createElement("div");
    notificationModal.className = "modal";
    notificationModal.id = "new-hardware-modal";
    notificationModal.innerHTML = `
        <div class="modal-content">
            <h2>New Mining Hardware Available!</h2>
            <p>${hardwareItem.name} is now available for purchase!</p>
            <p>Price: $${hardwareItem.currentPrice}</p>
            <p>Hashrate: ${formatHashrate(hardwareItem.hashrate)}</p>
            <p>Power Cost: $${hardwareItem.powerCost}/mo</p>
            <p>Est. ${btcMinedPerMonth.toFixed(2)} BTC/mo ($${monthlyRevenue}/mo)</p>
            <button onclick="openShopModalFromNotification()">Buy Now</button>
            <button onclick="closeNewHardwareModal()">Close</button>
            <button onclick="skipAllHardwareNotifications()">Skip All Hardware Notifications</button>
        </div>
    `;
    document.body.appendChild(notificationModal);
    notificationModal.style.display = "flex";
}

// Close new hardware notification modal
function closeNewHardwareModal() {
    const modal = document.getElementById("new-hardware-modal");
    if (modal) modal.remove();
    if (hardwareNotificationQueue.length > 0) {
        displayNextHardwareNotification();
    } else {
        isGamePaused = false;
        gameState.speed = 'normal';
        document.getElementById("speed-button").textContent = "SPEED: Normal";
        startGameLoop();
    }
}

// Display next hardware notification
function displayNextHardwareNotification() {
    if (hardwareNotificationQueue.length === 0) {
        isGamePaused = false;
        gameState.speed = 'normal';
        document.getElementById("speed-button").textContent = "SPEED: Normal";
        startGameLoop();
        return;
    }
    const hardwareItem = hardwareNotificationQueue.shift();
    showNewHardwareNotification(hardwareItem);
}

// Skip all hardware notifications
function skipAllHardwareNotifications() {
    hardwareNotificationQueue = [];
    gameState.skipHardwareNotifications = true; // Set flag to skip future hardware notifications
    console.log("Skipping all hardware notifications, skipHardwareNotifications set to true");
    const modal = document.getElementById("new-hardware-modal");
    if (modal) modal.remove();
    isGamePaused = false;
    gameState.speed = 'normal';
    document.getElementById("speed-button").textContent = "SPEED: Normal";
    startGameLoop();
    saveGame(); // Save game state to persist the flag
}

// Open shop modal from new hardware notification
function openShopModalFromNotification() {
    closeNewHardwareModal();
    openShopModal();
}

// Open shop modal to buy miners
function openShopModal() {
    isGamePaused = true;
    const networkHashrate = getNetworkHashrate(gameState.date);
    const blockReward = gameState.date.getUTCFullYear() < 2012 ? 50 : gameState.date.getUTCFullYear() < 2016 ? 25 : gameState.date.getUTCFullYear() < 2020 ? 12.5 : 6.25;

    const shopModal = document.createElement("div");
    shopModal.className = "modal";
    shopModal.id = "shop-modal";
    const hardwareList = availableHardware.map((item, index) => {
        const blockFindProbability = item.hashrate / (networkHashrate + item.hashrate);
        const blocksMinedPerDay = blockFindProbability * BLOCKS_PER_DAY;
        const btcMinedPerDay = blocksMinedPerDay * blockReward;
        const btcMinedPerMonth = btcMinedPerDay * 30;
        const monthlyRevenue = currentBTCPrice === null ? 0 : (btcMinedPerDay * 30 * currentBTCPrice).toFixed(2);
        return `
            <li>
                ${item.name} - $${item.currentPrice} (${formatHashrate(item.hashrate)}, $${item.powerCost}/mo, Est. ${btcMinedPerMonth.toFixed(2)} BTC/mo ($${monthlyRevenue}/mo))
                <button onclick="buyHardware(${index})" ${gameState.usd < item.currentPrice ? "disabled" : ""}>Buy</button>
            </li>
        `;
    }).join("");

    shopModal.innerHTML = `
        <div class="modal-content">
            <h2>Mining Hardware Shop</h2>
            <p>Key: (Hashrate, Electricity Cost $/mo, Est. Revenue $/mo)</p>
            <ul>${hardwareList || "<li>No hardware available yet.</li>"}</ul>
            <button onclick="closeShopModal()">Close</button>
        </div>
    `;
    document.body.appendChild(shopModal);
    shopModal.style.display = "flex";
}

// Close shop modal
function closeShopModal() {
    const shopModal = document.getElementById("shop-modal");
    if (shopModal) shopModal.remove();
    isGamePaused = false;
    gameState.speed = 'normal';
    document.getElementById("speed-button").textContent = "SPEED: Normal";
    startGameLoop();
    updateUI();
}

// Pay electricity bill
function payElectricityBill() {
    let totalPowerCost = gameState.miners.reduce((sum, miner) => sum + miner.powerCost, 0);
    gameState.usd -= totalPowerCost;
    if (gameState.usd <= 0) {
        gameState.usd = 0;
        clearInterval(gameLoopInterval);
        document.getElementById("game-container").style.display = "none";
        document.getElementById("lose-screen").style.display = "flex";
        saveGame();
    }
}

// Join a mining pool
function joinMiningPool() {
    if (!gameState.miningPoolsAvailable) {
        showNotification("Mining pools are not yet available!");
        return;
    }
    gameState.inMiningPool = true;
    gameState.poolFee = 0.02;
    showNotification("Joined Slush Pool! You'll now earn more consistent rewards (2% fee).");
    updateUI();
    saveGame();
}

// Leave a mining pool
function leaveMiningPool() {
    gameState.inMiningPool = false;
    gameState.poolFee = 0;
    console.log("Left mining pool. inMiningPool:", gameState.inMiningPool, "poolFee:", gameState.poolFee);
    showNotification("Left Slush Pool. You're now mining solo again.");
    updateUI();
    saveGame();
    gameState.totalHashrate = gameState.miners.reduce((sum, miner) => {
        const hr = Number(miner.hashrate) || 0;
        if (isNaN(hr)) {
            console.warn(`Invalid hashrate for miner ${miner.name}: ${miner.hashrate}`);
            return sum;
        }
        return sum + hr;
    }, 0);
    console.log("Hashrate after leaving pool:", gameState.totalHashrate);
}

// Advance time
function advanceTime() {
    if (isGamePaused) {
        console.log("advanceTime skipped: game is paused");
        return;
    }
    console.log("advanceTime started, date:", formatDateUTC(gameState.date));
    try {
        const daysToAdvance = gameState.speed === 'normal' ? 1 : gameState.speed === 'fast' ? 7 : 30;
        const oldDate = new Date(gameState.date);
        const newDate = new Date(gameState.date);

        for (let i = 0; i < daysToAdvance; i++) {
            newDate.setUTCDate(newDate.getUTCDate() + 1);
            currentBTCPrice = getBTCPrice(newDate);
            gameState.priceHistory.push(currentBTCPrice || 0);
            if (gameState.priceHistory.length > 30) gameState.priceHistory.shift();
            if (newDate.getUTCDate() === 1 || gameState.chartTimeframe === '30days') {
                gameState.allPriceHistory.push({ date: new Date(newDate), price: currentBTCPrice || 0 });
                if (gameState.allPriceHistory.length > 1200) gameState.allPriceHistory.shift();
            }

            const totalMiners = gameState.miners.length;
            const durabilityDecrease = totalMiners > 0 ? 1.0 / totalMiners : 0;
            gameState.miners.forEach(miner => {
                miner.durability = Math.max(0, miner.durability - durabilityDecrease);
                miner.hashrate = miner.baseHashrate * (miner.durability / 100);
                if (isNaN(miner.hashrate)) {
                    console.warn(`Invalid hashrate for miner ${miner.name} after durability update: ${miner.hashrate}, resetting to 0`);
                    miner.hashrate = 0;
                }
                if (miner.durability === 0) miner.hashrate = 0;
            });
            gameState.totalHashrate = gameState.miners.reduce((sum, miner) => {
                const hr = Number(miner.hashrate) || 0;
                if (isNaN(hr)) {
                    console.warn(`Invalid hashrate for miner ${miner.name}: ${miner.hashrate}`);
                    return sum;
                }
                return sum + hr;
            }, 0);
            console.log("Total hashrate after durability update:", gameState.totalHashrate);
        }

        checkHistoricalEvents(oldDate, newDate);
        gameState.date = newDate;
        console.log("New date after increment:", formatDateUTC(newDate));

        gameState.blocksMined += BLOCKS_PER_DAY * daysToAdvance;
        if (gameState.blocksMined >= BLOCKS_PER_DIFFICULTY_ADJUSTMENT) {
            adjustDifficulty();
            gameState.blocksMined -= BLOCKS_PER_DIFFICULTY_ADJUSTMENT;
        }

        gameState.daysUntilBill -= daysToAdvance;
        while (gameState.daysUntilBill <= 0) {
            payElectricityBill();
            gameState.daysUntilBill += BILL_CYCLE_DAYS;
        }

        const difficulty = gameState.currentDifficulty;
        const blockReward = gameState.date.getUTCFullYear() < 2012 ? 50 : gameState.date.getUTCFullYear() < 2016 ? 25 : gameState.date.getUTCFullYear() < 2020 ? 12.5 : 6.25;
        const networkHashrate = getNetworkHashrate(gameState.date);
        const totalDailyBTC = BLOCKS_PER_DAY * blockReward;
        let btcMined = 0;
        if (gameState.totalHashrate > 0 && difficulty > 0 && !isNaN(networkHashrate)) {
            console.log("Mining started", { totalHashrate: gameState.totalHashrate, difficulty, networkHashrate });
            if (gameState.inMiningPool) {
                const poolBaseHashrate = getPoolBaseHashrate();
                const totalPoolHashrate = poolBaseHashrate + gameState.totalHashrate;
                const yourPoolShare = gameState.totalHashrate / totalPoolHashrate;
                const poolNetworkShare = totalPoolHashrate / networkHashrate;
                const poolBTC = totalDailyBTC * poolNetworkShare * (1 - gameState.poolFee);
                btcMined = poolBTC * yourPoolShare * daysToAdvance;
                console.log("Pool mining stats:", { yourPoolShare, poolNetworkShare, poolBTC, btcMined });
            } else {
                const totalBlocks = BLOCKS_PER_DAY * daysToAdvance;
                const blockFindProbability = gameState.totalHashrate / networkHashrate;
                console.log("Solo mining stats:", { totalBlocks, blockFindProbability });
                for (let block = 0; block < totalBlocks; block++) {
                    if (Math.random() < blockFindProbability) {
                        btcMined += blockReward;
                        console.log(`Block found! +${blockReward} BTC (Block ${block + 1}/${totalBlocks})`);
                    }
                }
                btcMined = Math.min(btcMined, totalDailyBTC * daysToAdvance);
            }
            btcMined = Math.max(0, isNaN(btcMined) ? 0 : btcMined);
            if (btcMined > 0) {
                const btcBalance = document.getElementById("btc-balance");
                if (btcBalance) btcBalance.classList.add("highlight");
                const miningSound = document.getElementById("mining-sound");
                if (miningSound && !isSoundMuted) { // Check if sound is not muted
                    miningSound.currentTime = 0;
                    miningSound.play().catch(error => console.error("Error playing sound:", error));
                }
                console.log(`Total mined this cycle: ${btcMined.toFixed(8)} BTC`);
                showNotification(`Mined ${btcMined.toFixed(8)} BTC!`);
            } else {
                console.log("No blocks found this cycle.");
            }
        } else {
            console.warn("Skipping mining due to invalid inputs:", {
                totalHashrate: gameState.totalHashrate,
                difficulty,
                blockReward,
                daysToAdvance,
                networkHashrate
            });
        }
        gameState.btc += btcMined;

        if (isNaN(gameState.btc)) {
            console.error("gameState.btc became NaN after mining, resetting to 0");
            gameState.btc = 0;
        }

        if (!gameState.hasReachedMillion && gameState.usd >= 1000000) {
            gameState.hasReachedMillion = true;
            clearInterval(gameLoopInterval);
            document.getElementById("game-container").style.display = "none";
            document.getElementById("congrats-screen").style.display = "flex";
        }

        updateHardwarePrices();
        updateAvailableHardware(true); // Show notifications during gameplay
        updateUI();
        saveGame();
        console.log("advanceTime completed");
    } catch (error) {
        console.error("Error in advanceTime:", error);
        restartGame();
    }
}

// Start game loop
function startGameLoop() {
    clearInterval(gameLoopInterval);
    const interval = gameState.speed === 'normal' ? 1000 : gameState.speed == 'fast' ? 500 : 200;
    gameLoopInterval = setInterval(() => {
        if (!isGamePaused && eventQueue.length === 0 && hardwareNotificationQueue.length === 0) {
            console.log("Game loop tick, speed:", gameState.speed, "interval:", interval);
            advanceTime();
        } else {
            console.log("Game loop paused, waiting for events, hardware notifications, or unpause");
        }
    }, interval);
}

// Toggle speed
function toggleSpeed() {
    if (gameState.speed === 'normal') {
        gameState.speed = 'fast';
        document.getElementById("speed-button").textContent = "SPEED: Fast";
    } else if (gameState.speed === 'fast') {
        gameState.speed = 'faster';
        document.getElementById("speed-button").textContent = "SPEED: Faster";
    } else {
        gameState.speed = 'normal';
        document.getElementById("speed-button").textContent = "SPEED: Normal";
    }
    startGameLoop();
}

// Set chart timeframe
function setChartTimeframe(timeframe) {
    gameState.chartTimeframe = timeframe;
    updateUI();
}

// Format date in UTC
function formatDateUTC(date) {
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    };
    return date.toLocaleDateString('en-US', options);
}

// Draw price chart
function drawPriceChart() {
    const canvas = document.getElementById("price-chart");
    canvas.width = Math.min(window.innerWidth - 40, 700);
    canvas.height = canvas.width / 3;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 40;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;

    let prices = [];
    let dates = [];
    let labelInterval = 1;

    if (gameState.chartTimeframe === '30days') {
        prices = gameState.priceHistory.map(Number);
        dates = Array.from({ length: prices.length }, (_, i) => {
            const d = new Date(gameState.date);
            d.setUTCDate(d.getUTCDate() - (prices.length - 1 - i));
            return d;
        });
        labelInterval = Math.max(1, Math.floor(prices.length / 5));
    } else if (gameState.chartTimeframe === 'monthly') {
        prices = gameState.allPriceHistory
            .filter((_, i) => i % 30 === 0)
            .map(entry => entry.price);
        dates = gameState.allPriceHistory
            .filter((_, i) => i % 30 === 0)
            .map(entry => entry.date);
        labelInterval = Math.max(1, Math.floor(prices.length / 5));
    } else if (gameState.chartTimeframe === 'yearly') {
        prices = gameState.allPriceHistory
            .filter((_, i) => i % 365 === 0)
            .map(entry => entry.price);
        dates = gameState.allPriceHistory
            .filter((_, i) => i % 365 === 0)
            .map(entry => entry.date);
        labelInterval = Math.max(1, Math.floor(prices.length / 5));
    } else if (gameState.chartTimeframe === 'all') {
        const step = Math.max(1, Math.floor(gameState.allPriceHistory.length / 100));
        prices = gameState.allPriceHistory
            .filter((_, i) => i % step === 0)
            .map(entry => entry.price);
        dates = gameState.allPriceHistory
            .filter((_, i) => i % step === 0)
            .map(entry => entry.date);
        labelInterval = Math.max(1, Math.floor(prices.length / 5));
    }

    if (prices.length < 1) {
        prices.push(currentBTCPrice || 0);
        dates.push(gameState.date);
    }

    let maxPrice = Math.max(...prices);
    let minPrice = Math.min(...prices);
    if (maxPrice === minPrice) {
        maxPrice += 0.001;
        minPrice -= 0.001;
    }
    const priceRange = maxPrice - minPrice;

    ctx.strokeStyle = "#0a0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight * i) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
    }

    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    prices.forEach((price, i) => {
        const x = padding + (i / (Math.max(prices.length - 1, 1))) * chartWidth;
        const y = padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = "#0f0";
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();

    ctx.fillStyle = "#0f0";
    ctx.font = "12px Courier New";
    for (let i = 0; i <= 5; i++) {
        const price = minPrice + (priceRange * (5 - i)) / 5;
        const y = padding + (chartHeight * i) / 5;
        ctx.fillText(`$${price.toFixed(2)}`, padding - 35, y + 5);
    }

    for (let i = 0; i < prices.length; i += labelInterval) {
        const x = padding + (i / (Math.max(prices.length - 1, 1))) * chartWidth;
        const date = dates[i] ? formatDateUTC(dates[i]) : '';
        ctx.save();
        ctx.translate(x, padding + chartHeight + 20);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(date, 0, 0);
        ctx.restore();
    }
}

// News ticker logic
let currentHeadlineIndex = 0;
let tickerInterval = null;

function startNewsTicker() {
    clearInterval(tickerInterval);
    displayNextHeadline();
}

function displayNextHeadline() {
    const ticker = document.getElementById("news-ticker");
    const tickerText = document.getElementById("ticker-text");
    if (!ticker || !tickerText) return;

    // Filter headlines based on current game date
    const currentDate = gameState.date;
    const availableHeadlines = tickerHeadlines.filter(headline => {
        const startDate = headline.startDate;
        const endDate = headline.endDate;
        return startDate <= currentDate && (!endDate || endDate >= currentDate);
    });

    if (availableHeadlines.length === 0) {
        tickerText.textContent = "No news available.";
        return;
    }

    const headline = availableHeadlines[currentHeadlineIndex % availableHeadlines.length];
    tickerText.textContent = headline.text;
    currentHeadlineIndex = (currentHeadlineIndex + 1) % availableHeadlines.length;

    const tickerWidth = ticker.offsetWidth;
    const textWidth = tickerText.offsetWidth;
    const totalDistance = tickerWidth + textWidth + 200;
    const speed = 30;
    const duration = (totalDistance / speed) * 1000;

    tickerText.style.left = `${tickerWidth}px`;

    let startTime = null;
    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = elapsed / duration;
        const position = tickerWidth - (progress * totalDistance);

        tickerText.style.left = `${position}px`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            setTimeout(displayNextHeadline, 4000);
        }
    }

    requestAnimationFrame(animate);
}

// Show notification with stacking
function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    document.body.appendChild(notification);

    const notificationContainer = document.getElementById("notification-container") || createNotificationContainer();
    notificationContainer.appendChild(notification);

    notification.classList.add("show");

    setTimeout(() => {
        notification.classList.add("fade-out");
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 1000);
}

function createNotificationContainer() {
    const container = document.createElement("div");
    container.id = "notification-container";
    document.body.appendChild(container);
    return container;
}

// Update sell preview
function updateSellPreview() {
    const amount = parseFloat(document.getElementById("btc-sell-amount")?.value);
    const preview = document.getElementById("sell-preview");
    if (!preview) return;
    if (currentBTCPrice === null) {
        preview.textContent = "BTC market not available yet.";
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        preview.textContent = "";
        return;
    }
    const usdValue = (amount * currentBTCPrice).toFixed(2);
    preview.textContent = `= $${usdValue}`;
}

// Update buy preview
function updateBuyPreview() {
    const amount = parseFloat(document.getElementById("btc-buy-amount")?.value);
    const preview = document.getElementById("buy-preview");
    if (!preview) return;
    if (currentBTCPrice === null) {
        preview.textContent = "BTC market not available yet.";
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        preview.textContent = "";
        return;
    }
    const usdCost = (amount * currentBTCPrice).toFixed(2);
    preview.textContent = `= $${usdCost}`;
}

// Open sell miner modal
function openSellModal(name) {
    selectedMinerToSell = name;
    document.getElementById("sell-miner-name").textContent = `Selling ${name}`;
    document.getElementById("sell-miner-amount").value = "";
    document.getElementById("sell-miner-modal").style.display = "flex";
    isGamePaused = true;
}

// Close sell miner modal
function closeSellModal() {
    selectedMinerToSell = null;
    document.getElementById("sell-miner-modal").style.display = "none";
    isGamePaused = false;
    gameState.speed = 'normal';
    document.getElementById("speed-button").textContent = "SPEED: Normal";
    startGameLoop();
}

// Confirm sell miners
function confirmSellMiners() {
    if (!selectedMinerToSell) return;

    const amount = parseInt(document.getElementById("sell-miner-amount").value);
    const minerCounts = {};
    gameState.miners.forEach(miner => {
        if (!minerCounts[miner.name]) {
            minerCounts[miner.name] = { count: 0, hashrate: miner.hashrate, powerCost: miner.powerCost };
        }
        minerCounts[miner.name].count++;
    });

    if (isNaN(amount) || amount <= 0 || amount > minerCounts[selectedMinerToSell].count) {
        alert(`Invalid amount! You have ${minerCounts[selectedMinerToSell].count} ${selectedMinerToSell}(s).`);
        return;
    }

    const hardwareItem = hardware.find(item => item.name === selectedMinerToSell);
    if (!hardwareItem) {
        alert("Error: Miner not found!");
        return;
    }

    const sellPrice = (hardwareItem.basePrice * 0.1) * amount;
    gameState.usd += sellPrice;

    let remaining = amount;
    gameState.miners = gameState.miners.filter(miner => {
        if (miner.name === selectedMinerToSell && remaining > 0) {
            remaining--;
            const hr = Number(miner.hashrate) || 0;
            if (!isNaN(hr)) {
                gameState.totalHashrate -= hr;
            }
            return false;
        }
        return true;
    });

    if (isNaN(gameState.totalHashrate)) {
        console.warn("totalHashrate became NaN after selling miners, recalculating");
        gameState.totalHashrate = gameState.miners.reduce((sum, miner) => {
            const hr = Number(miner.hashrate) || 0;
            if (isNaN(hr)) {
                console.warn(`Invalid hashrate for miner ${miner.name}: ${miner.hashrate}`);
                return sum;
            }
            return sum + hr;
        }, 0);
    }

    showNotification(`Sold ${amount} ${selectedMinerToSell}(s) for $${sellPrice.toFixed(2)}!`);
    closeSellModal();
    updateUI();
    saveGame();
}

// Open repair miner modal
function openRepairModal(name) {
    selectedMinerToRepair = name;
    const minerCounts = {};
    gameState.miners.forEach(miner => {
        if (!minerCounts[miner.name]) {
            minerCounts[miner.name] = { count: 0, durability: miner.durability };
        }
        minerCounts[miner.name].count++;
        minerCounts[miner.name].durability = miner.durability;
    });

    const repairCost = 50 * minerCounts[name].count;
    document.getElementById("repair-miner-name").textContent = `Repairing ${name} x${minerCounts[name].count}`;
    document.getElementById("repair-cost").textContent = `Cost: $${repairCost.toFixed(2)}`;
    document.getElementById("repair-miner-modal").style.display = "flex";
    isGamePaused = true;
}

// Close repair miner modal
function closeRepairModal() {
    selectedMinerToRepair = null;
    document.getElementById("repair-miner-modal").style.display = "none";
    isGamePaused = false;
    gameState.speed = 'normal';
    document.getElementById("speed-button").textContent = "SPEED: Normal";
    startGameLoop();
}

// Confirm repair miners
function confirmRepairMiners() {
    if (!selectedMinerToRepair) return;

    const minerCounts = {};
    gameState.miners.forEach(miner => {
        if (!minerCounts[miner.name]) {
            minerCounts[miner.name] = { count: 0, hashrate: miner.hashrate, powerCost: miner.powerCost, durability: miner.durability };
        }
        minerCounts[miner.name].count++;
    });

    const repairCost = 50 * minerCounts[selectedMinerToRepair].count;
    if (gameState.usd < repairCost) {
        showNotification("Not enough USD to repair miners!");
        closeRepairModal();
        return;
    }

    gameState.usd -= repairCost;
    gameState.miners.forEach(miner => {
        if (miner.name === selectedMinerToRepair) {
            miner.durability = 100;
            miner.hashrate = miner.baseHashrate;
            if (isNaN(miner.hashrate)) {
                console.warn(`Invalid hashrate for miner ${miner.name} after repair: ${miner.hashrate}, resetting to 0`);
                miner.hashrate = 0;
            }
        }
    });
    gameState.totalHashrate = gameState.miners.reduce((sum, miner) => {
        const hr = Number(miner.hashrate) || 0;
        if (isNaN(hr)) {
            console.warn(`Invalid hashrate for miner ${miner.name}: ${miner.hashrate}`);
            return sum;
        }
        return sum + hr;
    }, 0);
    console.log("Hashrate after repair:", gameState.totalHashrate);
    showNotification(`Repaired ${selectedMinerToRepair} miners for $${repairCost.toFixed(2)}!`);
    closeRepairModal();
    updateUI();
    saveGame();
}

// Update UI
function updateUI() {
    document.getElementById("date").textContent = formatDateUTC(gameState.date);
    // Show $0.001 if BTC price is not yet available
    document.getElementById("btc-price").textContent = currentBTCPrice === null ? "0.001" : currentBTCPrice.toFixed(2);
    document.getElementById("btc-balance").textContent = isNaN(gameState.btc) ? "0.00000000" : gameState.btc.toFixed(8);
    document.getElementById("usd-balance").textContent = `$${gameState.usd.toFixed(2)}`;

    const networkHashrate = getNetworkHashrate(gameState.date);
    const totalNetworkHashrate = !isNaN(networkHashrate) && networkHashrate > 0 ? networkHashrate + gameState.totalHashrate : gameState.totalHashrate || 1;
    const networkPercentage = !isNaN(networkHashrate) && totalNetworkHashrate > 0 ? (gameState.totalHashrate / totalNetworkHashrate) * 100 : 0;
    console.log("Updating hashrate UI:", {
        playerHashrate: gameState.totalHashrate,
        networkHashrate,
        totalNetworkHashrate,
        networkPercentage
    });
    document.getElementById("hashrate").textContent = `${formatHashrate(gameState.totalHashrate)} (${networkPercentage.toFixed(4)}% of network)`;

    document.getElementById("electricity-bill").textContent = gameState.miners.reduce((sum, m) => sum + m.powerCost, 0).toFixed(2);
    document.getElementById("bill-days").textContent = gameState.daysUntilBill;

    const minerCounts = {};
    gameState.miners.forEach(miner => {
        if (!minerCounts[miner.name]) {
            minerCounts[miner.name] = { count: 0, hashrate: miner.hashrate, powerCost: miner.powerCost, durability: 0, baseHashrate: miner.baseHashrate };
        }
        minerCounts[miner.name].count++;
        minerCounts[miner.name].durability = miner.durability;
    });

    const inventory = document.getElementById("miner-inventory");
    const blockReward = gameState.date.getUTCFullYear() < 2012 ? 50 : gameState.date.getUTCFullYear() < 2016 ? 25 : gameState.date.getUTCFullYear() < 2020 ? 12.5 : 6.25;
    inventory.innerHTML = Object.keys(minerCounts).map(name => {
        const miner = minerCounts[name];
        const blockFindProbability = miner.hashrate / (networkHashrate + miner.hashrate);
        const blocksMinedPerDay = blockFindProbability * BLOCKS_PER_DAY;
        const btcMinedPerDay = blocksMinedPerDay * blockReward;
        const btcMinedPerMonth = btcMinedPerDay * 30;
        const monthlyRevenue = currentBTCPrice === null ? 0 : (btcMinedPerDay * 30 * currentBTCPrice).toFixed(2);
        return `<li>${name} x${miner.count} (${formatHashrate(miner.hashrate)}, $${miner.powerCost}/mo each, Durability: ${miner.durability.toFixed(1)}%, Est. ${btcMinedPerMonth.toFixed(2)} BTC/mo ($${monthlyRevenue}/mo))
                <button onclick="openSellModal('${name}')">Sell</button>
                <button onclick="openRepairModal('${name}')">Repair</button></li>`;
    }).join("");

    const miningPoolSection = document.getElementById("mining-pool-section");
    const miningPoolStatus = document.getElementById("mining-pool-status");
    const joinPoolButton = document.getElementById("join-pool-button");
    const leavePoolButton = document.getElementById("leave-pool-button");
    if (gameState.miningPoolsAvailable) {
        miningPoolSection.style.display = "block";
        if (gameState.inMiningPool) {
            const poolBaseHashrate = getPoolBaseHashrate();
            const totalPoolHashrate = poolBaseHashrate + gameState.totalHashrate;
            const userPercentage = (gameState.totalHashrate / totalPoolHashrate) * 100;
            miningPoolStatus.textContent = `You are in Slush Pool (2% fee). Your hashrate: ${userPercentage.toFixed(2)}% of pool.`;
            joinPoolButton.style.display = "none";
            leavePoolButton.style.display = "inline-block";
        } else {
            miningPoolStatus.textContent = "You are not in a mining pool.";
            joinPoolButton.style.display = "inline-block";
            leavePoolButton.style.display = "none";
        }
    } else {
        miningPoolSection.style.display = "none";
    }

    // Replace hardware shop list with a "Buy Miner" button
    const shop = document.getElementById("hardware-shop");
    shop.innerHTML = `<button onclick="openShopModal()">Buy Miner</button>`;

    // Disable buy/sell BTC buttons if market is not available, with error handling
    const buyBTCButton = document.getElementById("buy-btc-button");
    const sellBTCButton = document.getElementById("sell-btc-button");
    const btcBuyAmount = document.getElementById("btc-buy-amount");
    const btcSellAmount = document.getElementById("btc-sell-amount");
    if (buyBTCButton && sellBTCButton && btcBuyAmount && btcSellAmount) {
        if (currentBTCPrice === null) {
            buyBTCButton.disabled = true;
            sellBTCButton.disabled = true;
            btcBuyAmount.disabled = true;
            btcSellAmount.disabled = true;
        } else {
            buyBTCButton.disabled = false;
            sellBTCButton.disabled = false;
            btcBuyAmount.disabled = false;
            btcSellAmount.disabled = false;
        }
    } else {
        console.warn("One or more BTC buy/sell elements not found in the DOM. Please check HTML for IDs: buy-btc-button, sell-btc-button, btc-buy-amount, btc-sell-amount");
    }

    drawPriceChart();
}

// Buy hardware
function buyHardware(index) {
    const item = availableHardware[index]; // Use availableHardware instead of hardware
    if (!item) {
        showNotification("Error: Hardware not available!");
        return;
    }
    if (gameState.usd >= item.currentPrice) {
        gameState.usd -= item.currentPrice;

        const existingMiners = gameState.miners.filter(miner => miner.name === item.name);
        const totalDurability = existingMiners.reduce((sum, miner) => sum + miner.durability, 0);
        const newMinerCount = existingMiners.length + 1;
        const averageDurability = (totalDurability + 100) / newMinerCount;

        gameState.miners.forEach(miner => {
            if (miner.name === item.name) {
                miner.durability = averageDurability;
                miner.hashrate = miner.baseHashrate * (miner.durability / 100);
                if (isNaN(miner.hashrate)) {
                    console.warn(`Invalid hashrate for miner ${miner.name} after buying: ${miner.hashrate}, resetting to 0`);
                    miner.hashrate = 0;
                }
            }
        });

        gameState.miners.push({ name: item.name, hashrate: item.hashrate, baseHashrate: item.hashrate, powerCost: item.powerCost, durability: averageDurability });
        gameState.totalHashrate = gameState.miners.reduce((sum, miner) => {
            const hr = Number(miner.hashrate) || 0;
            if (isNaN(hr)) {
                console.warn(`Invalid hashrate for miner ${miner.name}: ${miner.hashrate}`);
                return sum;
            }
            return sum + hr;
        }, 0);
        console.log("Hashrate after buying hardware:", gameState.totalHashrate);

        showNotification(`Purchased ${item.name} for $${item.currentPrice}!`);
        updateUI();
        saveGame();
        closeShopModal(); // Close the shop modal after purchase
    } else {
        showNotification("Not enough USD to purchase this miner!");
    }
}

// Sell BTC
function sellBTC() {
    if (currentBTCPrice === null) {
        alert("BTC market is not available yet!");
        return;
    }
    const amount = parseFloat(document.getElementById("btc-sell-amount").value);
    if (isNaN(amount) || amount <= 0 || amount > gameState.btc) {
        alert("Invalid amount or insufficient BTC!");
        return;
    }
    const usdEarned = (amount * currentBTCPrice).toFixed(2);
    gameState.usd += parseFloat(usdEarned);
    gameState.btc -= amount;
    if (isNaN(gameState.btc)) {
        console.error("gameState.btc became NaN after selling BTC, resetting to 0");
        gameState.btc = 0;
    }
    showNotification(`Sold ${amount.toFixed(8)} BTC for $${usdEarned}!`);
    document.getElementById("btc-sell-amount").value = "";
    document.getElementById("sell-preview").textContent = "";
    updateUI();
    saveGame();
}

// Buy BTC
function buyBTC() {
    if (currentBTCPrice === null) {
        alert("BTC market is not available yet!");
        return;
    }
    const amount = parseFloat(document.getElementById("btc-buy-amount").value);
    const usdCost = amount * currentBTCPrice;
    if (isNaN(amount) || amount <= 0 || usdCost > gameState.usd) {
        alert("Invalid amount or insufficient USD!");
        return;
    }
    gameState.usd -= usdCost;
    gameState.btc += amount;
    if (isNaN(gameState.btc)) {
        console.error("gameState.btc became NaN after buying BTC, resetting to 0");
        gameState.btc = 0;
    }
    showNotification(`Bought ${amount.toFixed(8)} BTC for $${usdCost.toFixed(2)}!`);
    document.getElementById("btc-buy-amount").value = "";
    document.getElementById("buy-preview").textContent = "";
    updateUI();
    saveGame();
}

// Get pool base hashrate
function getPoolBaseHashrate() {
    const networkHashrate = getNetworkHashrate(gameState.date);
    return networkHashrate * 0.3; // Pool has 30% of network hashrate, making it harder to dominate
}

// Get network hashrate
function getNetworkHashrate(date) {
    const fallbackHashrate = 7000000; // 7 MH/s
    if (historicalNetworkHashrate.length === 0) {
        console.warn("historicalNetworkHashrate is empty, using fallback hashrate:", fallbackHashrate);
        return fallbackHashrate;
    }

    let previous = null;
    let next = null;
    for (const entry of historicalNetworkHashrate) {
        if (entry.date.getTime() <= date.getTime()) {
            previous = entry;
        } else if (entry.date.getTime() > date.getTime() && !next) {
            next = entry;
        }
    }

    if (previous && previous.date.getTime() === date.getTime()) {
        return previous.hashrate;
    }
    if (previous && next) {
        const timeDiff = next.date - previous.date;
        const timeSincePrevious = date - previous.date;
        const fraction = timeDiff > 0 ? timeSincePrevious / timeDiff : 0;
        const interpolatedHashrate = previous.hashrate + (next.hashrate - previous.hashrate) * fraction;
        return isNaN(interpolatedHashrate) ? fallbackHashrate : interpolatedHashrate;
    }
    if (previous) {
        return previous.hashrate;
    }
    console.warn("No valid historical network hashrate data found for date:", formatDateUTC(date), "using fallback:", fallbackHashrate);
    return historicalNetworkHashrate[0]?.hashrate || fallbackHashrate;
}
