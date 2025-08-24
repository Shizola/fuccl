// Simple data cache to avoid refetching the same data
const dataCache = {
    playerData: null,
    gameWeek: null,
    lastFetch: 0,
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutes in milliseconds
};

// Function to check if cached data is still valid
function isCacheValid() {
    return dataCache.playerData && 
           dataCache.gameWeek && 
           (Date.now() - dataCache.lastFetch) < dataCache.CACHE_DURATION;
}

// Function to create a player card
function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card';

    // Add player shirt image with lazy loading optimization
    const shirtImg = document.createElement('img');
    shirtImg.src = player.shirtImage;
    shirtImg.alt = `${player.name}'s Shirt`;
    shirtImg.className = 'player-shirt';
    
    // PERFORMANCE OPTIMIZATION: Add lazy loading for better performance
    shirtImg.loading = 'lazy';
    
    // Add intersection observer for progressive loading if supported
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        imageObserver.observe(shirtImg);
    }

    // Fallback to template.svg if the shirt image fails to load
    shirtImg.onerror = function () {
        this.src = 'images/shirts/template.svg';
    };

    card.appendChild(shirtImg);

    // Add player name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = player.name;
    card.appendChild(nameDiv);

    // Add player points - use weeklyPoints instead of total points
    const pointsDiv = document.createElement('div');
    pointsDiv.className = 'player-points';
    // Display weekly points if available, otherwise fall back to total points
    const pointsToShow = player.weeklyPoints !== undefined ? player.weeklyPoints : player.points;
    pointsDiv.textContent = `${pointsToShow} pts`;
    card.appendChild(pointsDiv);

    return card;
}

// Function to render players on the pitch based on their position (optimized)
function renderPlayersOnPitch(players) {
    // Get the pitch container
    const pitch = document.querySelector('.pitch');
    if (!pitch) {
        console.error("Pitch container not found - cannot render players");
        return;
    }

    // Clear existing players
    pitch.innerHTML = '<img src="images/pitch.svg" alt="Football Pitch" class="pitch-image">';

    // OPTIMIZATION: Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();

    // Define vertical positions for each row, including substitutes
    const positionStyles = {
        gk: { top: '10%' },
        df: { top: '30%' },
        md: { top: '50%' },
        at: { top: '70%' },
        sb: { top: '90%' } // Substitutes row
    };

    // Group players by position
    const positions = {
        gk: [],
        df: [],
        md: [],
        at: [],
        sb: [] // Substitutes
    };

    // Separate substitutes (last 4 players)
    const substitutes = players.slice(-4);
    const mainPlayers = players.slice(0, players.length - 4);

    // Assign main players to their positions
    mainPlayers.forEach(player => {
        positions[player.position].push(player);
    });

    // Assign substitutes to the 'sb' position
    substitutes.forEach(player => {
        positions.sb.push(player);
    });

    // Render players for each position
    Object.keys(positions).forEach(position => {
        const rowPlayers = positions[position];

        rowPlayers.forEach((player, index) => {
            const playerCard = createPlayerCard(player);

            // Calculate dynamic left position to avoid overlap
            const left = `${(index + 1) * (100 / (rowPlayers.length + 1))}%`;

            // Apply inline styles for positioning
            playerCard.style.position = 'absolute';
            playerCard.style.top = positionStyles[position].top;
            playerCard.style.left = left;

            // Add to fragment instead of DOM
            fragment.appendChild(playerCard);
        });
    });

    // Append all player cards at once to minimize layout thrashing
    pitch.appendChild(fragment);
}

// Function to get test player data
function getTestPlayerData() {
    return [
        // Goalkeeper
        { name: 'John Doe', points: 12, shirtImage: 'images/shirts/highfields.svg', position: 'gk' },
    
        // Defenders (4)
        { name: 'Jane Smith', points: 8, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
        { name: 'Chris Johnson', points: 5, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
        { name: 'Michael Brown', points: 7, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
        { name: 'Sarah Wilson', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
    
        // Midfielders (4)
        { name: 'Anna Lee', points: 7, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
        { name: 'James Taylor', points: 9, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
        { name: 'Laura White', points: 8, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
        { name: 'Robert King', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
    
        // Attackers (2)
        { name: 'David Brown', points: 10, shirtImage: 'images/shirts/highfields.svg', position: 'at' },
        { name: 'Emily Davis', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'at' }
    ];
}

// Function to load player data and gameweek from PlayFab (optimized with caching)
function loadPlayersFromPlayFab(callback) {
    // Check cache first
    if (isCacheValid()) {
        console.log("Using cached data");
        
        // Update the HTML elements with cached data
        const cachedData = dataCache.playerData;
        updatePointsDisplay(cachedData.gameWeek, cachedData.weeklyPointsTotal, cachedData.cumulativePointsTotal);
        
        callback(null, cachedData);
        return;
    }

    console.log("Cache miss - fetching fresh data");
    
    // Fetch user data to get the selectedPlayers key
    PlayFab.ClientApi.GetUserData({}, function (result, error) {
        if (error) {
            console.error("Error retrieving user data from PlayFab:", error);
            callback(error, null);
        } else {
            // Parse the selectedPlayers key
            const selectedPlayersString = result.data.Data.selectedPlayers ? result.data.Data.selectedPlayers.Value : null;
            if (!selectedPlayersString) {
                console.error("No selectedPlayers key found for the user.");
                callback("No selectedPlayers key found", null);
                return;
            }

            let selectedPlayerIds;
            try {
                // Parse the JSON string into an array
                selectedPlayerIds = JSON.parse(selectedPlayersString);
            } catch (e) {
                console.error("Error parsing selectedPlayersString:", e);
                callback("Error parsing selectedPlayersString", null);
                return;
            }

            // OPTIMIZATION: Batch all title data requests into a single API call
            const titleDataKeys = selectedPlayerIds.map(id => `player_${id}`);
            titleDataKeys.push("gameWeek"); // Add gameWeek to the keys to fetch it in the same API call

            console.log(`Fetching ${titleDataKeys.length} keys in single API call:`, titleDataKeys);

            // Single API call to fetch all player data + gameweek
            PlayFab.ClientApi.GetTitleData({ Keys: titleDataKeys }, function (titleDataResult, titleDataError) {
                if (titleDataError) {
                    console.error("Error retrieving title data from PlayFab:", titleDataError);
                    callback(titleDataError, null);
                } else {
                    // Check if titleDataResult.data.Data exists
                    if (titleDataResult.data && titleDataResult.data.Data) {
                        // Get the current gameweek
                        const gameWeek = parseInt(titleDataResult.data.Data.gameWeek);
                        console.log("Current Gameweek:", gameWeek);

                        // Parse the players and calculate points
                        let weeklyPointsTotal = 0;         // For displaying current week's points
                        let cumulativePointsTotal = 0;     // For the leaderboard (all weeks combined)
                        
                        const players = selectedPlayerIds.map(id => {
                            const key = `player_${id}`;
                            const playerDataString = titleDataResult.data.Data[key];

                            if (playerDataString) {
                                const player = parsePlayerData(playerDataString);
                                
                                // Skip invalid players that couldn't be parsed
                                if (!player) {
                                    console.warn(`Failed to parse player data for ID: ${id}`);
                                    return null;
                                }
                                
                                // Calculate points for current week only (for display)
                                const weeklyPoints = calculateWeeklyPoints(playerDataString, gameWeek);
                                player.weeklyPoints = weeklyPoints;
                                weeklyPointsTotal += weeklyPoints;
                                
                                // Calculate cumulative points for all weeks up to current
                                const cumulativePoints = calculateTotalPointsUpToCurrentWeek(playerDataString, gameWeek);
                                player.cumulativePoints = cumulativePoints;
                                cumulativePointsTotal += cumulativePoints;
                                
                                console.log(`Player ${player.name}: Week ${gameWeek} points = ${weeklyPoints}, Cumulative = ${cumulativePoints}`);
                                
                                return player;
                            } else {
                                console.warn(`No data found for player ID: ${id}`);
                                return null;
                            }
                        }).filter(player => player !== null); // Filter out any null values

                        // Update all the display elements using the helper function
                        updatePointsDisplay(gameWeek, weeklyPointsTotal, cumulativePointsTotal);
                        
                        // Log the total cumulative points for leaderboard
                        console.log(`Team total cumulative points: ${cumulativePointsTotal} (across all ${gameWeek} weeks)`);

                        // Prepare data for response
                        const responseData = {
                            players,
                            weeklyPointsTotal,         // Current week points
                            cumulativePointsTotal,     // Total points across all weeks
                            gameWeek,                  // Current gameweek
                            selectedPlayerIds
                        };

                        // Cache the successful response
                        dataCache.playerData = responseData;
                        dataCache.gameWeek = gameWeek;
                        dataCache.lastFetch = Date.now();
                        console.log("Data cached successfully");

                        // Pass all data to the callback
                        callback(null, responseData);
                    } else {
                        console.error("No title data returned.");
                        callback("No title data returned", null);
                    }
                }
            });
        }
    });
}

// Function to calculate weekly points for a player
function calculateWeeklyPoints(playerDataString, gameWeek) {
    try {
        const parts = playerDataString.split('|');
        const pointsArray = parts[4].split(','); // Weekly points are stored as a comma-separated string

        // Log the points array for debugging
        console.log(`Points Array for Gameweek ${gameWeek}:`, pointsArray);

        // Return the points for the current gameweek (1-based index)
        return parseInt(pointsArray[gameWeek - 1] || 0);
    } catch (error) {
        console.error("Error calculating weekly points:", error, "Player Data:", playerDataString);
        return 0; // Return 0 points if there's an error
    }
}

// Function to calculate total points for a player across all gameweeks up to the current one
function calculateTotalPointsUpToCurrentWeek(playerDataString, currentGameWeek) {
    try {
        const parts = playerDataString.split('|');
        const pointsArray = parts[4].split(','); // Weekly points are stored as a comma-separated string
        
        // Log the points array for debugging
        console.log(`Points Array up to Gameweek ${currentGameWeek}:`, pointsArray);
        
        // Sum up points for all weeks up to the current gameweek
        let totalPoints = 0;
        for (let week = 0; week < currentGameWeek; week++) {
            // Add points for each week (using 0 if the week doesn't exist in the array)
            const weeklyPoints = parseInt(pointsArray[week] || 0);
            totalPoints += weeklyPoints;
            
            console.log(`Week ${week + 1}: ${weeklyPoints} points`);
        }
        
        console.log(`Total accumulated points up to week ${currentGameWeek}: ${totalPoints}`);
        return totalPoints;
    } catch (error) {
        console.error("Error calculating total points:", error, "Player Data:", playerDataString);
        return 0; // Return 0 points if there's an error
    }
}

// Function to parse player data from PlayFab
function parsePlayerData(playerDataString) {
    // Validate input
    if (!playerDataString || typeof playerDataString !== 'string') {
        console.error("Invalid player data string:", playerDataString);
        return null;
    }
    
    const parts = playerDataString.split('|');
    
    // Validate data format - should have at least 6 parts
    if (parts.length < 6) {
        console.error("Invalid player data format - insufficient parts:", playerDataString);
        return null;
    }
    
    const name = parts[0] || 'Unknown Player'; // Provide fallback
    const teamName = parts[1] || 'Unknown Team'; // Provide fallback
    const position = parts[2] || 'Unknown'; // Provide fallback
    const totalPoints = parseInt(parts[5]) || 0; // Fallback to 0 if parsing fails

    // Convert position to match the test player format
    const positionMap = {
        Goalkeeper: 'gk',
        Defender: 'df',
        Midfielder: 'md',
        Attacker: 'at'
    };

    // Map team names to shirt images
    const shirtImageMap = {
        'Highfields FC': 'images/shirts/highfields.svg',
        'Vinyard FC': 'images/shirts/vineyard.svg',
        'Bethel Town FC': 'images/shirts/bethel.svg',
        'Lifepoint Church AFC': 'images/shirts/lifepoint.svg',
        'DC United FC': 'images/shirts/dc.svg',
        'FC United': 'images/shirts/fc_united.svg',
        'Emmanuel Baptist Church FC': 'images/shirts/emmanuel.svg',
        'Parklands AFC': 'images/shirts/parklands.svg',
        'Bridgend Deanery FC': 'images/shirts/bridgend.svg',
        'Rhondda Royals FC': 'images/shirts/rhondda.svg',
        'Libanus Evangelical Church': 'images/shirts/libanus.svg',
        'Waterfront Community Church FC': 'images/shirts/waterfront.svg',
    };

    // Determine the shirt image
    let shirtImage = shirtImageMap[teamName] || 'images/shirts/template.svg';
    if (positionMap[position] === 'gk') {
        // Append "_gk" for goalkeepers
        const teamKey = Object.keys(shirtImageMap).find(key => shirtImageMap[key] === shirtImage);
        if (teamKey) {
            shirtImage = shirtImage.replace('.svg', '_gk.svg');
        }
    }

    return {
        name,
        position: positionMap[position] || 'unknown', // Map position or default to 'unknown'
        points: totalPoints,
        shirtImage // Use the determined shirt image
    };
}

// Helper function to update the points display elements
function updatePointsDisplay(gameWeek, weeklyPointsTotal, cumulativePointsTotal) {
    // Update the gameweek
    const gameweekElement = document.getElementById('gameweek');
    if (gameweekElement) {
        gameweekElement.textContent = gameWeek;
    } else {
        console.warn("Gameweek element not found in DOM");
    }
    
    // Update the weekly points
    const weeklyPointsElement = document.getElementById('weeklyPoints');
    if (weeklyPointsElement) {
        weeklyPointsElement.textContent = weeklyPointsTotal;
    } else {
        console.warn("Weekly points element not found in DOM");
    }
    
    // Update the total points
    const totalPointsElement = document.getElementById('totalPoints');
    if (totalPointsElement) {
        totalPointsElement.textContent = cumulativePointsTotal;
    } else {
        console.warn("Total points element not found in DOM");
    }
    
    console.log(`Updated display: Week ${gameWeek}, Weekly: ${weeklyPointsTotal}, Total: ${cumulativePointsTotal}`);
}

// Function to load the current gameweek from PlayFab Title Data
function loadGameWeek() {
    PlayFab.ClientApi.GetTitleData({}, function (titleDataResult, titleDataError) {
        if (titleDataError) {
            console.error("Error retrieving title data from PlayFab:", titleDataError);
        } else {
            // Check if gameWeek exists in the title data
            if (titleDataResult.data && titleDataResult.data.Data.gameWeek) {
                const gameWeek = parseInt(titleDataResult.data.Data.gameWeek); // Parse the gameWeek value as an integer
                
                // Validate gameWeek is a reasonable number
                if (isNaN(gameWeek) || gameWeek < 1 || gameWeek > 38) {
                    console.error("Invalid gameWeek value:", gameWeek);
                    callback("Invalid game week data", null);
                    return;
                }
                console.log("Current Gameweek:", gameWeek);

                // Update the gameweek placeholder in the HTML
                document.getElementById('gameweek').textContent = gameWeek;
            } else {
                console.error("gameWeek not found in title data.");
            }
        }
    });
}

// Function to submit weekly points to PlayFab leaderboard
function submitWeeklyPointsToLeaderboard(weeklyPointsTotal, cumulativePointsTotal) {
    // Make sure cumulativePointsTotal is a valid integer
    const points = parseInt(cumulativePointsTotal) || 0;
    
    console.log(`Submitting to leaderboard: Current week points = ${weeklyPointsTotal}, Cumulative total = ${points}`);
    
    // First get the user's data to get team name
    // NOTE: If we ever need PlayFab ID here, we can use getPlayFabId() helper from common.js
    fetchUserData(function(error, userData) {
        if (error) {
            console.error("Error fetching user data:", error);
            return;
        }
        
        // 1. Update the player statistics (leaderboard entry) with CUMULATIVE points
        PlayFab.ClientApi.UpdatePlayerStatistics({
            Statistics: [{
                StatisticName: "PlayerTotalPoints",
                Value: points  // Using cumulative points instead of weekly points
            }]
        }, function (result, error) {
            if (error) {
                console.error("Error submitting weekly points to leaderboard:", error);
                console.error("Error details:", JSON.stringify(error));
            } else {
                console.log("Successfully submitted weekly points to leaderboard:", result);
                
                // 2. Store the team and manager info in a shared data location for leaderboard use
                PlayFab.ClientApi.UpdateUserData({
                    Data: {
                        "leaderboardInfo": JSON.stringify({
                            teamName: userData.teamName,
                            managerName: userData.managerName || "Unknown"
                        })
                    },
                    // Make this data readable by other players
                    Permission: "Public"
                }, function(updateResult, updateError) {
                    if (updateError) {
                        console.error("Error storing leaderboard metadata:", updateError);
                    } else {
                        console.log("Successfully stored leaderboard metadata");
                    }
                });
                
                // 3. Update DisplayName to show team name
                PlayFab.ClientApi.UpdateUserTitleDisplayName({
                    DisplayName: userData.teamName
                }, function(displayResult, displayError) {
                    if (displayError) {
                        console.error("Error updating display name:", displayError);
                    } else {
                        console.log("Successfully updated display name to team name");
                    }
                });
            }
        });
    });
}

// Test function to call the submission method
function testLeaderboardSubmission() {
    // Load players and gameweek from PlayFab to get points data
    loadPlayersFromPlayFab(function (error, data) {
        if (error) {
            console.error("Failed to load player data:", error);
        } else {
            const { weeklyPointsTotal, cumulativePointsTotal } = data;
            
            console.log("Weekly points:", weeklyPointsTotal);
            console.log("Cumulative points for leaderboard:", cumulativePointsTotal);
            
            // Submit the cumulative points to the leaderboard
            submitWeeklyPointsToLeaderboard(weeklyPointsTotal, cumulativePointsTotal);
        }
    });
}

// Add event listener to the test button
const testButton = document.getElementById('testLeaderboardBtn');
if (testButton) {
    testButton.addEventListener('click', testLeaderboardSubmission);
}

// PERFORMANCE OPTIMIZATION: Memory and event management
let eventListeners = [];

// Optimized event listener management
function addManagedEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    eventListeners.push({ element, event, handler });
}

// Cleanup function for memory management
function cleanup() {
    // Remove all managed event listeners
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    // Clear cached data to free memory
    dataCache.playerData = null;
    dataCache.gameWeek = null;
    dataCache.lastFetch = null;
    
    console.log("Memory cleanup completed");
}

// Add page visibility API to cleanup when tab is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Clear expired cache when tab is hidden to save memory
        if (!isCacheValid()) {
            dataCache.playerData = null;
            dataCache.gameWeek = null;
            dataCache.lastFetch = null;
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
