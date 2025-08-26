/* ========================================
   PICK TEAM PAGE SPECIFIC FUNCTIONALITY
   Uses shared functions from common.js for data loading
   ======================================== */

// Page-specific data cache that extends shared cache
const dataCache = {
    get playerData() { return sharedDataCache.playerData; },
    set playerData(value) { sharedDataCache.playerData = value; },
    get gameWeek() { return sharedDataCache.gameWeek; },
    set gameWeek(value) { sharedDataCache.gameWeek = value; },
    get lastFetch() { return sharedDataCache.lastFetch; },
    set lastFetch(value) { sharedDataCache.lastFetch = value; },
    CACHE_DURATION: sharedDataCache.CACHE_DURATION
};

// Function to check if cached data is still valid
function isCacheValid() {
    return isSharedCacheValid();
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

    // Add player position instead of points for pick team page
    const positionDiv = document.createElement('div');
    positionDiv.className = 'player-position';
    // Display the position (convert abbreviations to readable format)
    // Don't show "SUB" for substitutes, they'll be visually highlighted instead
    const positionMap = {
        'gk': 'GK',
        'df': 'DEF', 
        'md': 'MID',
        'at': 'ATT'
    };
    
    // Map position to CSS class for color coding
    const positionClassMap = {
        'gk': 'gk',
        'df': 'def',
        'md': 'mid',
        'at': 'att'
    };
    
    const displayPosition = positionMap[player.position] || player.position.toUpperCase();
    const positionClass = positionClassMap[player.position] || '';
    
    positionDiv.textContent = displayPosition;
    
    // Add position-specific class for color coding
    if (positionClass) {
        positionDiv.classList.add(positionClass);
    }
    
    card.appendChild(positionDiv);

    // Add click event listener to open modal or handle substitute mode
    card.addEventListener('click', () => {
        // Check if we're in substitute mode
        if (window.substituteMode && window.substituteMode.active) {
            // Check if this is the selected player (blue highlighted)
            if (card.classList.contains('substitute-mode-selected')) {
                // Cancel substitute mode when clicking the highlighted player
                cancelSubstituteMode();
                return; // Don't open modal
            }
            
            // Check if this card is greyed out (not available for substitution)
            if (card.classList.contains('substitute-mode-greyed')) {
                // Do nothing for greyed out players
                return;
            }
            
            // This is an available player for substitution - perform the swap
            performSubstitution(window.substituteMode.selectedPlayerId, player.id);
            return; // Don't open modal
        }
        
        // Normal behavior - open modal
        openPlayerModal(player);
    });

    return card;
}

// Function to render players on the pitch based on their position (optimized)
function renderPlayersOnPitch(players, selectedPlayerIds = []) {
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

    // Identify captain (first player in selectedPlayerIds if available)
    const captainId = selectedPlayerIds.length > 0 ? selectedPlayerIds[0] : null;

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

            // Add substitute styling if this is a substitute
            if (position === 'sb') {
                playerCard.classList.add('substitute-player');
            }

            // Add captain styling if this is the captain
            if (captainId && player.id && String(player.id) === String(captainId)) {
                playerCard.classList.add('captain-player');
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
        // Goalkeeper (Captain)
        { name: 'John Doe', points: 12, shirtImage: 'images/shirts/highfields.svg', position: 'gk', id: '1' },
    
        // Defenders (4)
        { name: 'Jane Smith', points: 8, shirtImage: 'images/shirts/highfields.svg', position: 'df', id: '2' },
        { name: 'Chris Johnson', points: 5, shirtImage: 'images/shirts/highfields.svg', position: 'df', id: '3' },
        { name: 'Michael Brown', points: 7, shirtImage: 'images/shirts/highfields.svg', position: 'df', id: '4' },
        { name: 'Sarah Wilson', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'df', id: '5' },
    
        // Midfielders (4)
        { name: 'Anna Lee', points: 7, shirtImage: 'images/shirts/highfields.svg', position: 'md', id: '6' },
        { name: 'James Taylor', points: 9, shirtImage: 'images/shirts/highfields.svg', position: 'md', id: '7' },
        { name: 'Laura White', points: 8, shirtImage: 'images/shirts/highfields.svg', position: 'md', id: '8' },
        { name: 'Robert King', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'md', id: '9' },
    
        // Attackers (2)
        { name: 'David Brown', points: 10, shirtImage: 'images/shirts/highfields.svg', position: 'at', id: '10' },
        { name: 'Emily Davis', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'at', id: '11' }
    ];
}

// Function to load player data and gameweek from PlayFab (uses shared implementation)
function loadPlayersFromPlayFab(callback) {
    // Use shared loading function from common.js
    loadSharedPlayersFromPlayFab(function(error, data) {
        if (error) {
            callback(error, null);
        } else {
            // Update the pick team specific display elements
            updatePickTeamDisplay();
            callback(null, data);
        }
    });
}

// Helper function to update the pick team display elements
function updatePickTeamDisplay() {
    // For pick team page, we don't need to update points displays
    // This function can be used later for team selection status updates
    console.log("Pick team display updated");
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

// Function to save team changes to PlayFab
function saveTeamToPlayFab() {
    console.log("Saving team to PlayFab...");
    
    // Get the current selected player IDs from the cached data
    if (!dataCache.playerData || !dataCache.playerData.selectedPlayerIds) {
        console.error("No player data available to save");
        alert("Error: No team data to save");
        return;
    }
    
    const selectedPlayerIds = dataCache.playerData.selectedPlayerIds;
    
    // Show saving state to user
    const saveBtn = document.getElementById('saveTeamBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    // Save the selectedPlayers array to PlayFab user data
    PlayFab.ClientApi.UpdateUserData({
        Data: {
            "selectedPlayers": JSON.stringify(selectedPlayerIds)
        }
    }, function(result, error) {
        // Reset button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
        if (error) {
            console.error("Error saving team to PlayFab:", error);
            alert("Error saving team. Please try again.");
        } else {
            console.log("Team saved successfully to PlayFab:", result);
            alert("Team saved successfully!");
            
            // Optionally update the leaderboard with current points
            if (dataCache.playerData.weeklyPointsTotal !== undefined && 
                dataCache.playerData.cumulativePointsTotal !== undefined) {
                submitWeeklyPointsToLeaderboard(
                    dataCache.playerData.weeklyPointsTotal, 
                    dataCache.playerData.cumulativePointsTotal
                );
            }
        }
    });
}

// Add event listener to the save team button
const saveTeamBtn = document.getElementById('saveTeamBtn');
if (saveTeamBtn) {
    saveTeamBtn.addEventListener('click', saveTeamToPlayFab);
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

/* ========================================
   PLAYER MODAL FUNCTIONALITY
   Functions to handle the player modal popup
   ======================================== */

// Function to open the player modal
function openPlayerModal(player) {
    const modal = document.getElementById('playerModal');
    const playerNameElement = document.getElementById('modalPlayerName');
    const playerTeamElement = document.getElementById('modalPlayerTeam');
    const makeCaptainBtn = document.getElementById('makeCaptainBtn');
    
    // Populate modal with player data
    playerNameElement.textContent = player.name || 'Unknown Player';
    playerTeamElement.textContent = player.teamName || 'Unknown Team';
    
    // Store the current player data in the modal for later use
    modal.dataset.playerId = player.id;
    
    // Check if this player is a substitute (last 4 players in the team)
    let isSubstitute = false;
    if (dataCache.playerData && dataCache.playerData.players) {
        const players = dataCache.playerData.players;
        const substitutes = players.slice(-4);
        isSubstitute = substitutes.some(sub => String(sub.id) === String(player.id));
    }
    
    // Grey out and disable the "Make Captain" button if this is a substitute
    if (makeCaptainBtn) {
        if (isSubstitute) {
            makeCaptainBtn.disabled = true;
            makeCaptainBtn.classList.add('secondary'); // Pico.css secondary style for disabled look
            makeCaptainBtn.textContent = 'Cannot Captain Sub';
            console.log(`Player ${player.name} is a substitute - captain button disabled`);
        } else {
            makeCaptainBtn.disabled = false;
            makeCaptainBtn.classList.remove('secondary');
            makeCaptainBtn.textContent = 'Make Captain';
            console.log(`Player ${player.name} is not a substitute - captain button enabled`);
        }
    }
    
    // Show the modal (Pico.css way)
    modal.showModal();
}

// Function to close the player modal
function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    modal.close();
}

// Function to make a player captain
function makePlayerCaptain(playerId) {
    // Get the current selected player IDs from the cached data
    if (!dataCache.playerData || !dataCache.playerData.selectedPlayerIds) {
        console.error("No player data available to update captain");
        return;
    }
    
    const selectedPlayerIds = dataCache.playerData.selectedPlayerIds;
    
    // Check if the player is in the selected team
    const playerIndex = selectedPlayerIds.findIndex(id => String(id) === String(playerId));
    if (playerIndex === -1) {
        console.error("Player not found in selected team");
        return;
    }
    
    // If player is already captain (first position), do nothing
    if (playerIndex === 0) {
        console.log("Player is already captain");
        return;
    }
    
    // Remove the player from their current position
    const playerIdToMove = selectedPlayerIds.splice(playerIndex, 1)[0];
    
    // Add them to the first position (captain position)
    selectedPlayerIds.unshift(playerIdToMove);
    
    console.log(`Player ${playerId} is now captain. Updated selectedPlayerIds:`, selectedPlayerIds);
    
    // Reorder the players array to match the new selectedPlayerIds order
    const reorderedPlayers = selectedPlayerIds.map(id => {
        return dataCache.playerData.players.find(player => String(player.id) === String(id));
    }).filter(player => player !== undefined);
    
    // Update the cached data with both new order and new players array
    dataCache.playerData.selectedPlayerIds = selectedPlayerIds;
    dataCache.playerData.players = reorderedPlayers;
    
    // Re-render the pitch to update the captain badge
    renderPlayersOnPitch(reorderedPlayers, selectedPlayerIds);
    
    console.log("Captain updated and pitch re-rendered");
}

// Function to start substitute mode for a player
function startSubstituteMode(playerId) {
    console.log(`Starting substitute mode for player ${playerId}`);
    
    // Store the player ID in substitute mode
    if (!window.substituteMode) {
        window.substituteMode = {};
    }
    window.substituteMode.selectedPlayerId = playerId;
    window.substituteMode.active = true;
    
    // Find the selected player to determine if they're a substitute or outfield player
    let selectedPlayer = null;
    let isSelectedPlayerSub = false;
    let selectedPlayerPosition = null;
    
    if (dataCache.playerData && dataCache.playerData.players) {
        selectedPlayer = dataCache.playerData.players.find(p => 
            String(p.id) === String(playerId)
        );
        
        if (selectedPlayer) {
            selectedPlayerPosition = selectedPlayer.position;
            // Check if this player is in the substitutes (last 4 players)
            const players = dataCache.playerData.players;
            const substitutes = players.slice(-4);
            isSelectedPlayerSub = substitutes.some(sub => String(sub.id) === String(playerId));
        }
    }
    
    console.log(`Selected player is ${isSelectedPlayerSub ? 'substitute' : 'outfield player'} with position: ${selectedPlayerPosition}`);
    
    // Find and highlight/grey out players appropriately
    const playerCards = document.querySelectorAll('.player-card');
    playerCards.forEach(card => {
        // Remove any existing substitute highlighting and greying
        card.classList.remove('substitute-mode-selected', 'substitute-mode-greyed');
        
        // Get the player name to find the corresponding player data
        const playerName = card.querySelector('.player-name')?.textContent;
        
        if (dataCache.playerData && dataCache.playerData.players) {
            const player = dataCache.playerData.players.find(p => p.name === playerName);
            
            if (player) {
                // Check if this card's player is a substitute
                const players = dataCache.playerData.players;
                const substitutes = players.slice(-4);
                const isCardPlayerSub = substitutes.some(sub => String(sub.id) === String(player.id));
                
                if (String(player.id) === String(playerId)) {
                    // This is the selected player - highlight with blue outline
                    card.classList.add('substitute-mode-selected');
                    console.log(`Highlighted player ${player.name} for substitution`);
                } else {
                    // This is not the selected player - check if we should grey it out
                    let shouldGreyOut = false;
                    
                    // Rule 1: Players in the same category (outfield vs outfield, sub vs sub) are greyed out
                    if (isSelectedPlayerSub && isCardPlayerSub) {
                        shouldGreyOut = true; // Both are subs
                    } else if (!isSelectedPlayerSub && !isCardPlayerSub) {
                        shouldGreyOut = true; // Both are outfield
                    }
                    
                    // Rule 2: Position compatibility - GK can only be subbed with GK
                    if (!shouldGreyOut) {
                        const isSelectedGK = selectedPlayerPosition === 'gk';
                        const isCardGK = player.position === 'gk';
                        
                        // If selected is GK but card is not GK, or vice versa, grey out
                        if (isSelectedGK !== isCardGK) {
                            shouldGreyOut = true;
                            console.log(`Position incompatible: ${selectedPlayerPosition} cannot be subbed with ${player.position}`);
                        }
                    }
                    
                    if (shouldGreyOut) {
                        card.classList.add('substitute-mode-greyed');
                        console.log(`Greyed out ${player.name} (${player.position})`);
                    }
                }
            }
        }
    });
}

// Function to cancel substitute mode
function cancelSubstituteMode() {
    console.log("Cancelling substitute mode");
    
    // Clear substitute mode state
    if (window.substituteMode) {
        window.substituteMode.active = false;
        window.substituteMode.selectedPlayerId = null;
    }
    
    // Remove all substitute mode styling from all player cards
    const playerCards = document.querySelectorAll('.player-card');
    playerCards.forEach(card => {
        card.classList.remove('substitute-mode-selected', 'substitute-mode-greyed');
    });
    
    console.log("Substitute mode cancelled - all players returned to normal");
}

// Function to perform player substitution
function performSubstitution(selectedPlayerId, targetPlayerId) {
    console.log(`Performing substitution: ${selectedPlayerId} ↔ ${targetPlayerId}`);
    
    // Get the current selected player IDs from the cached data
    if (!dataCache.playerData || !dataCache.playerData.selectedPlayerIds) {
        console.error("No player data available to perform substitution");
        return;
    }
    
    const selectedPlayerIds = dataCache.playerData.selectedPlayerIds;
    const originalCaptainId = selectedPlayerIds[0]; // Store the original captain
    
    // Find the indices of both players
    const selectedPlayerIndex = selectedPlayerIds.findIndex(id => String(id) === String(selectedPlayerId));
    const targetPlayerIndex = selectedPlayerIds.findIndex(id => String(id) === String(targetPlayerId));
    
    if (selectedPlayerIndex === -1 || targetPlayerIndex === -1) {
        console.error("One or both players not found in selected team");
        return;
    }
    
    // Perform the swap
    const temp = selectedPlayerIds[selectedPlayerIndex];
    selectedPlayerIds[selectedPlayerIndex] = selectedPlayerIds[targetPlayerIndex];
    selectedPlayerIds[targetPlayerIndex] = temp;
    
    // After the swap, ensure the captain is whoever is now in the starting XI (positions 0-10)
    // Find where the original captain ended up
    const captainNewIndex = selectedPlayerIds.findIndex(id => String(id) === String(originalCaptainId));
    
    // If the captain is now in the substitutes (positions 11-14), we need a new captain
    if (captainNewIndex >= 11) {
        // The captain was substituted out, so whoever took their place becomes the new captain
        console.log(`Captain ${originalCaptainId} was substituted out. Player ${selectedPlayerIds[0]} is now captain.`);
    } else if (captainNewIndex !== 0) {
        // The captain is still in the starting XI but not in position 0
        // Move them to position 0 to maintain captaincy
        const captainIdToMove = selectedPlayerIds.splice(captainNewIndex, 1)[0];
        selectedPlayerIds.unshift(captainIdToMove);
        console.log(`Captain ${originalCaptainId} maintained captaincy and moved to position 0`);
    }
    
    console.log(`Substitution completed. Updated selectedPlayerIds:`, selectedPlayerIds);
    
    // Reorder the players array to match the new selectedPlayerIds order
    const reorderedPlayers = selectedPlayerIds.map(id => {
        return dataCache.playerData.players.find(player => String(player.id) === String(id));
    }).filter(player => player !== undefined); // Filter out any undefined players
    
    // Update the cached data with both new order and new players array
    dataCache.playerData.selectedPlayerIds = selectedPlayerIds;
    dataCache.playerData.players = reorderedPlayers;
    
    console.log(`Players reordered to match new selectedPlayerIds order`);
    
    // Cancel substitute mode first
    cancelSubstituteMode();
    
    // Re-render the pitch to show the new positions
    renderPlayersOnPitch(reorderedPlayers, selectedPlayerIds);
    
    console.log("Pitch re-rendered with new player positions");
}

// Setup modal event listeners when the page loads
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const makeSubstituteBtn = document.getElementById('makeSubstituteBtn');
    const makeCaptainBtn = document.getElementById('makeCaptainBtn');
    
    // Close button functionality
    if (closeBtn) {
        closeBtn.addEventListener('click', closePlayerModal);
    }
    
    // Cancel button functionality
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePlayerModal);
    }
    
    // Close modal when clicking outside (Pico.css handles this by default, but we can add custom logic)
    if (modal) {
        modal.addEventListener('click', function(event) {
            // Close if clicking on the modal backdrop (outside the article element)
            if (event.target === modal) {
                closePlayerModal();
            }
        });
    }
    
    // Placeholder functionality for the action buttons
    if (makeSubstituteBtn) {
        makeSubstituteBtn.addEventListener('click', function() {
            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            
            if (playerId) {
                closePlayerModal(); // Close modal first
                startSubstituteMode(playerId); // Then start substitute mode
            } else {
                console.error("No player ID found for substitute assignment");
            }
        });
    }
    
    if (makeCaptainBtn) {
        makeCaptainBtn.addEventListener('click', function() {
            // Check if the button is disabled
            if (makeCaptainBtn.disabled) {
                console.log("Make captain button is disabled - cannot make substitute captain");
                return;
            }
            
            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            
            if (playerId) {
                makePlayerCaptain(playerId);
                closePlayerModal();
            } else {
                console.error("No player ID found for captain assignment");
            }
        });
    }
    
    // Load team name from PlayFab using shared function
    loadTeamNameOnly();
    
    // Load and render players
    loadPlayersFromPlayFab(function(error, data) {
        if (error) {
            console.error("Failed to load player data:", error);
            // You could show a user-friendly error message here
        } else {
            console.log("Players loaded successfully");
            renderPlayersOnPitch(data.players, data.selectedPlayerIds);
        }
    });
});


