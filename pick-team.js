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

// Function to create a player card (using shared implementation)
function createPlayerCard(player) {
    // Use shared function from player-selection.js with 'team' context
    if (typeof window.sharedCreatePlayerCard === 'function') {
        return window.sharedCreatePlayerCard(player, 'team');
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

    const positionDiv = document.createElement('div');
    positionDiv.className = 'player-position';
    positionDiv.textContent = player.position?.toUpperCase() || 'POS';
    card.appendChild(positionDiv);

    card.addEventListener('click', () => openPlayerModal(player));
    card.dataset.playerId = player.id;
    card.dataset.playerName = player.name;

    return card;
}

// Function to render players on the pitch based on their position (using shared implementation)
function renderPlayersOnPitch(players, selectedPlayerIds = [], captainId = null) {
    // Use shared function from player-selection.js with 'team' context
    if (typeof window.sharedRenderPlayersOnPitch === 'function') {
        return window.sharedRenderPlayersOnPitch(players, selectedPlayerIds, 'team', captainId);
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

    const positionStyles = {
        gk: { top: '10%' },
        df: { top: '30%' },
        md: { top: '50%' },
        at: { top: '70%' },
        sb: { top: '90%' }
    };

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
            callback(null, data);
        }
    });
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
    const captainId = dataCache.playerData.captainId || null;
    
    // Show saving state to user
    const saveBtn = document.getElementById('saveTeamBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    // Prepare data to save - include both player order and captain separately
    const dataToSave = {
        "selectedPlayers": JSON.stringify(selectedPlayerIds)
    };
    
    // Save captain separately if one is selected
    if (captainId) {
        dataToSave["captainId"] = captainId;
    }
    
    // Save the selectedPlayers array and captain to PlayFab user data
    PlayFab.ClientApi.UpdateUserData({
        Data: dataToSave
    }, function(result, error) {
        // Reset button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
        if (error) {
            console.error("Error saving team to PlayFab:", error);
            if (typeof showTransientToast === 'function') {
                showTransientToast('Team save failed. Try again.', { type: 'error' });
            } else {
                alert("Error saving team. Please try again.");
            }
        } else {
            console.log("Team saved successfully to PlayFab:", result);
            if (typeof showTransientToast === 'function') {
                showTransientToast('Team saved successfully!', { type: 'success' });
            } else {
                alert("Team saved successfully!");
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
    
    // If player is already captain, do nothing
    if (dataCache.playerData.captainId && String(dataCache.playerData.captainId) === String(playerId)) {
        console.log("Player is already captain");
        return;
    }
    
    // Store captain separately - do NOT reorder the selectedPlayerIds array
    dataCache.playerData.captainId = playerId;
    
    console.log(`Player ${playerId} is now captain. Captain stored separately, selectedPlayerIds order preserved:`, selectedPlayerIds);
    
    // Re-render the pitch to update the captain badge (player positions remain the same)
    renderPlayersOnPitch(dataCache.playerData.players, selectedPlayerIds, dataCache.playerData.captainId);
    
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
    
    // Get the full team data to understand player positions
    if (!dataCache.playerData || !dataCache.playerData.players) {
        console.error("No player data available for substitution logic");
        return;
    }
    
    const allPlayers = dataCache.playerData.players;
    
    // Split into starting 11 and bench (last 4 players)
    const starting11 = allPlayers.slice(0, 11);
    const bench = allPlayers.slice(11); // Last 4 players
    
    // Find the selected player and determine if they're in starting 11 or bench
    const selectedPlayer = allPlayers.find(p => String(p.id) === String(playerId));
    if (!selectedPlayer) {
        console.error(`Could not find selected player with ID: ${playerId}`);
        return;
    }
    
    const isSelectedInStarting11 = starting11.some(p => String(p.id) === String(playerId));
    const isSelectedOnBench = bench.some(p => String(p.id) === String(playerId));
    
    // Get all player cards on the pitch
    const playerCards = document.querySelectorAll('.player-card');
    
    playerCards.forEach((card, index) => {
        // Remove any existing substitute highlighting and greying
        card.classList.remove('substitute-mode-selected', 'substitute-mode-greyed');
        
        // Get the player ID from the data attribute instead of trying to match by name
        const cardPlayerId = card.getAttribute('data-player-id');
        if (!cardPlayerId) {
            return;
        }
        
        const cardPlayer = allPlayers.find(p => String(p.id) === String(cardPlayerId));
        if (!cardPlayer) {
            return;
        }
        
        if (String(cardPlayer.id) === String(playerId)) {
            // This is the selected player - highlight with blue outline
            card.classList.add('substitute-mode-selected');
        } else {
            // This is not the selected player - apply substitution rules
            const isCardInStarting11 = starting11.some(p => String(p.id) === String(cardPlayer.id));
            const isCardOnBench = bench.some(p => String(p.id) === String(cardPlayer.id));
            
            let shouldGreyOut = false;
            
            if (isSelectedInStarting11 && isCardInStarting11) {
                // Selected starting player, card is also starting player - GREY OUT
                shouldGreyOut = true;
            } else if (isSelectedOnBench && isCardOnBench) {
                // Selected bench player, card is also bench player - GREY OUT
                shouldGreyOut = true;
            } else {
                // One is starting, one is bench - check substitution validity
                const selectedIsGK = selectedPlayer.position === 'gk' || selectedPlayer.position === 'goalkeeper';
                const cardIsGK = cardPlayer.position === 'gk' || cardPlayer.position === 'goalkeeper';
                
                if (selectedIsGK && !cardIsGK) {
                    shouldGreyOut = true;
                } else if (!selectedIsGK && cardIsGK) {
                    shouldGreyOut = true;
                } else {
                    // Check formation rules for outfield player substitutions
                    if (!selectedIsGK && !cardIsGK) {
                        // Count current positions in starting 11
                        const currentFormation = {
                            gk: 0,
                            defender: 0,
                            midfielder: 0,
                            attacker: 0
                        };
                        
                        starting11.forEach(p => {
                            const pos = p.position.toLowerCase();
                            if (pos === 'gk' || pos === 'goalkeeper') {
                                currentFormation.gk++;
                            } else if (pos === 'df' || pos === 'defender') {
                                currentFormation.defender++;
                            } else if (pos === 'md' || pos === 'midfielder') {
                                currentFormation.midfielder++;
                            } else if (pos === 'at' || pos === 'attacker') {
                                currentFormation.attacker++;
                            }
                        });
                        
                        // Simulate the substitution to check if it would violate formation rules
                        const selectedPos = selectedPlayer.position.toLowerCase();
                        const cardPos = cardPlayer.position.toLowerCase();
                        
                        // Create a copy of the formation after the substitution
                        const newFormation = { ...currentFormation };
                        
                        // Remove the selected player's position
                        if (selectedPos === 'df' || selectedPos === 'defender') {
                            newFormation.defender--;
                        } else if (selectedPos === 'md' || selectedPos === 'midfielder') {
                            newFormation.midfielder--;
                        } else if (selectedPos === 'at' || selectedPos === 'attacker') {
                            newFormation.attacker--;
                        }
                        
                        // Add the card player's position
                        if (cardPos === 'df' || cardPos === 'defender') {
                            newFormation.defender++;
                        } else if (cardPos === 'md' || cardPos === 'midfielder') {
                            newFormation.midfielder++;
                        } else if (cardPos === 'at' || cardPos === 'attacker') {
                            newFormation.attacker++;
                        }
                        
                        // Check if the new formation violates rules
                        // Rules: 1 GK, at least 3 defenders, at least 1 attacker
                        if (newFormation.gk !== 1) {
                            shouldGreyOut = true;
                        } else if (newFormation.defender < 3) {
                            shouldGreyOut = true;
                        } else if (newFormation.attacker < 1) {
                            shouldGreyOut = true;
                        }
                    }
                }
            }
            
            if (shouldGreyOut) {
                card.classList.add('substitute-mode-greyed');
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
    const originalCaptainId = dataCache.playerData.captainId; // Get the current captain
    
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
    
    // Check if the captain was affected by the substitution
    if (originalCaptainId && String(originalCaptainId) === String(selectedPlayerId)) {
        // The captain was substituted out, need to assign new captain to the player who took their place
        dataCache.playerData.captainId = targetPlayerId;
        console.log(`Captain ${originalCaptainId} was substituted out. Player ${targetPlayerId} is now captain.`);
    } else if (originalCaptainId && String(originalCaptainId) === String(targetPlayerId)) {
        // The target player was the captain and was substituted in/moved
        dataCache.playerData.captainId = selectedPlayerId;
        console.log(`Captain ${originalCaptainId} was moved. Player ${selectedPlayerId} is now captain.`);
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
    renderPlayersOnPitch(reorderedPlayers, selectedPlayerIds, dataCache.playerData.captainId);
    
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
            // Store the loaded data in the cache for later use
            dataCache.playerData = data;
            renderPlayersOnPitch(data.players, data.selectedPlayerIds, data.captainId);
        }
    });
});


