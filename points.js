// Use shared data cache from common.js
const dataCache = sharedDataCache;

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
    nameDiv.textContent = extractSurname(player.name);
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
function renderPlayersOnPitch(players, selectedPlayerIds = []) {
    console.log("renderPlayersOnPitch called with:");
    console.log("- players:", players);
    console.log("- selectedPlayerIds:", selectedPlayerIds);
    console.log("- selectedPlayerIds type:", typeof selectedPlayerIds);
    console.log("- selectedPlayerIds isArray:", Array.isArray(selectedPlayerIds));
    console.log("- selectedPlayerIds length:", selectedPlayerIds ? selectedPlayerIds.length : 'undefined');
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

    // Position mapping from full names to abbreviations
    const positionMapping = {
        'goalkeeper': 'gk',
        'defender': 'df',
        'midfielder': 'md',
        'attacker': 'at'
    };

    // Separate substitutes (last 4 players)
    const substitutes = players.slice(-4);
    const mainPlayers = players.slice(0, players.length - 4);

    // Identify captain (first player in selectedPlayerIds if available)
    const captainId = selectedPlayerIds.length > 0 ? selectedPlayerIds[0] : null;
    console.log("Captain ID identified:", captainId);
    console.log("Selected Player IDs:", selectedPlayerIds);

    // Assign main players to their positions (with mapping)
    mainPlayers.forEach(player => {
        const mappedPosition = positionMapping[player.position] || player.position;
        if (positions[mappedPosition]) {
            positions[mappedPosition].push(player);
        } else {
            console.warn(`Unknown position: ${player.position} for player ${player.name}`);
        }
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

            // Add substitute styling if this is a substitute
            if (position === 'sb') {
                playerCard.classList.add('substitute-player');
            }

            // Add captain styling if this is the captain
            if (captainId && player.id && String(player.id) === String(captainId)) {
                playerCard.classList.add('captain-player');
                console.log(`Captain badge added to player: ${player.name} (ID: ${player.id})`);
            }

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
    // Use shared function from common.js
    loadSharedPlayersFromPlayFab(callback, updatePointsDisplay);
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

// Initialize the points page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Points page initialized");
    
    // Clear cache to force fresh data (temporary debug measure)
    console.log("Clearing cache to force fresh data load");
    dataCache.playerData = null;
    dataCache.gameWeek = null;
    dataCache.lastFetch = 0;
    
    // Load and render players
    loadPlayersFromPlayFab(function(error, data) {
        if (error) {
            console.error("Failed to load player data:", error);
            
            // Check if the error is due to missing selectedPlayers key
            if (error === "No selectedPlayers key found") {
                console.log("User has no team data - redirecting to create team page");
                alert("No team found. You'll be redirected to create your team.");
                window.location.href = "create-team.html";
                return;
            }
            
            // Show error message to user for other errors
            const pitch = document.querySelector('.pitch');
            if (pitch) {
                pitch.innerHTML = '<div class="error-message">Failed to load team data. Please try refreshing the page.</div>';
            }
        } else {
            console.log("Players loaded successfully for points page");
            console.log("Data received:", data);
            console.log("Data keys:", Object.keys(data));
            console.log("Selected Player IDs from data:", data.selectedPlayerIds);
            console.log("Type of selectedPlayerIds:", typeof data.selectedPlayerIds);
            console.log("Is array:", Array.isArray(data.selectedPlayerIds));
            renderPlayersOnPitch(data.players, data.selectedPlayerIds);
        }
    });
});
