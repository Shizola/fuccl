// Use shared data cache from common.js
const dataCache = sharedDataCache;

// Function to check if cached data is still valid
function isCacheValid() {
    return dataCache.playerData && 
           dataCache.gameWeek && 
           (Date.now() - dataCache.lastFetch) < dataCache.CACHE_DURATION;
}

// Function to create a player card (using shared implementation)
function createPlayerCard(player) {
    // Use shared function from player-selection.js with 'points' context
    if (typeof window.sharedCreatePlayerCard === 'function') {
        return window.sharedCreatePlayerCard(player, 'points');
    } else {
        return createPlayerCardFallback(player);
    }
}

// Fallback implementation in case shared function isn't loaded
function createPlayerCardFallback(player) {
    console.warn("Using fallback createPlayerCard - shared function not available");
    const card = document.createElement('div');
    card.className = 'player-card';

    // Basic implementation for emergency fallback
    const shirtImg = document.createElement('img');
    shirtImg.src = player.shirtImage || 'images/shirts/template.svg';
    shirtImg.alt = `${player.name}'s Shirt`;
    shirtImg.className = 'player-shirt';
    card.appendChild(shirtImg);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = extractSurname(player.name);
    card.appendChild(nameDiv);

    const pointsDiv = document.createElement('div');
    pointsDiv.className = 'player-points';
    const pointsToShow = player.weeklyPoints !== undefined ? player.weeklyPoints : player.points;
    pointsDiv.textContent = `${pointsToShow} pts`;
    card.appendChild(pointsDiv);

    card.dataset.playerId = player.id;
    card.dataset.playerName = player.name;

    return card;
}

// Function to render players on the pitch based on their position (using shared implementation)
function renderPlayersOnPitch(players, selectedPlayerIds = [], captainId = null) {
    // Use shared function from player-selection.js with 'points' context
    if (typeof window.sharedRenderPlayersOnPitch === 'function') {
        return window.sharedRenderPlayersOnPitch(players, selectedPlayerIds, 'points', captainId);
    } else {
        return renderPlayersOnPitchFallback(players, selectedPlayerIds);
    }
}

// Fallback implementation in case shared function isn't loaded
function renderPlayersOnPitchFallback(players, selectedPlayerIds = []) {
    console.warn("Using fallback renderPlayersOnPitch - shared function not available");
    
    const pitch = document.querySelector('.pitch');
    if (!pitch) {
        console.error("Pitch container not found - cannot render players");
        return;
    }

    pitch.innerHTML = '<img src="images/pitch.svg" alt="Football Pitch" class="pitch-image">';
    const fragment = document.createDocumentFragment();

    // Basic fallback rendering
    players.forEach((player, index) => {
        const playerCard = createPlayerCard(player);
        playerCard.style.position = 'absolute';
        playerCard.style.top = '50%';
        playerCard.style.left = `${(index + 1) * (100 / (players.length + 1))}%`;
        fragment.appendChild(playerCard);
    });

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
            } else {
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
                    }
                });
                
                // 3. Update DisplayName to show team name
                PlayFab.ClientApi.UpdateUserTitleDisplayName({
                    DisplayName: userData.teamName
                }, function(displayResult, displayError) {
                    if (displayError) {
                        console.error("Error updating display name:", displayError);
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
    // Clear cache to force fresh data load
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
            renderPlayersOnPitch(data.players, data.selectedPlayerIds, data.captainId);
        }
    });
});
