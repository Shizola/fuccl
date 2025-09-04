// ========================================
// PLAYER SELECTION SHARED FUNCTIONALITY
// Common functions used by create-team and transfers pages
// ========================================

// Cache for all players data
let allPlayersCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Track current transfer slot being filled
let currentTransferSlot = null;

// ========================================
// CONTEXT-AWARE STATE MANAGEMENT
// ========================================

// Page context and temporary state for draft/transfers
let pageContext = null; // 'draft' or 'transfers'
let tempBudget = 100.0;
let tempSelectedPlayers = [];
let tempTransfersMade = 0;
let currentTeamPlayerIds = []; // For transfers page

// Function to initialize page context
function initializePageContext(context, initialBudget = 100.0, initialPlayers = []) {
    pageContext = context;
    tempBudget = initialBudget;
    tempSelectedPlayers = [...initialPlayers];
    tempTransfersMade = 0;
    if (context === 'transfers') {
        currentTeamPlayerIds = [...initialPlayers];
    }
    console.log(`Initialized ${context} context with budget: £${tempBudget}m, players: ${tempSelectedPlayers.length}`);
}

// ========================================
// CACHE MANAGEMENT
// ========================================

// Function to check if cache is valid
function isCacheValid() {
    return allPlayersCache && cacheTimestamp &&
           (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

// ========================================
// PLAYER DATA LOADING
// ========================================

// Function to load all players from PlayFab (called once on page load)
function loadAllPlayers(callback) {
    // Check cache first
    if (isCacheValid()) {
        console.log("Using cached player data");
        callback(null, allPlayersCache);
        return;
    }

    console.log("Loading all players from PlayFab...");

    PlayFab.ClientApi.GetTitleData({}, function(result, error) {
        if (error) {
            console.error("Error loading title data:", error);
            callback(error, null);
            return;
        }

        if (!result.data || !result.data.Data) {
            console.error("No title data available");
            callback("No title data available", null);
            return;
        }

        // Parse all players
        const allPlayers = [];
        const playerKeys = Object.keys(result.data.Data).filter(key => key.startsWith('player_'));

        console.log(`Found ${playerKeys.length} players in PlayFab`);

        playerKeys.forEach(key => {
            const playerDataString = result.data.Data[key];

            if (playerDataString) {
                const player = parsePlayerData(playerDataString);
                if (player) {
                    player.id = key.replace('player_', '');
                    allPlayers.push(player);
                }
            }
        });

        console.log(`Successfully parsed ${allPlayers.length} players`);

        // Cache the data
        allPlayersCache = allPlayers;
        cacheTimestamp = Date.now();

        callback(null, allPlayers);
    });
}

// ========================================
// CONSOLIDATED SHARED FUNCTIONS
// ========================================

// Consolidated selectPlayerFromTeam with context-aware logic
function selectPlayerFromTeam(player) {
    console.log('Player selected:', player.name, 'Context:', pageContext);

    // Check if player is already selected
    if (tempSelectedPlayers.includes(player.id)) {
        console.log('Player already selected, ignoring');
        closePlayerSelectionModal();
        return;
    }

    // Allow over-budget for both contexts (validation happens on submit)
    // Maintain slot ordering: if we have a currentTransferSlot with a slotIndex, insert there instead of pushing
    let inserted = false;
    if (currentTransferSlot && currentTransferSlot.dataset && currentTransferSlot.dataset.slotIndex !== undefined) {
        const rawIndex = parseInt(currentTransferSlot.dataset.slotIndex, 10);
        if (!Number.isNaN(rawIndex) && rawIndex >= 0) {
            // Prevent duplicates defensively
            const existingIdx = tempSelectedPlayers.indexOf(player.id);
            if (existingIdx !== -1) tempSelectedPlayers.splice(existingIdx, 1);
            if (rawIndex <= tempSelectedPlayers.length) {
                tempSelectedPlayers.splice(rawIndex, 0, player.id);
                inserted = true;
            }
        }
    }
    if (!inserted) {
        tempSelectedPlayers.push(player.id);
    }
    tempBudget -= player.price;

    console.log(`Added ${player.name} to ${pageContext} for £${player.price}m`);

    // Update the slot visually
    if (currentTransferSlot) {
        addPlayerToSlot(currentTransferSlot, player);
    }

    updateDisplay();

    // Close the modal and clear any stale modal data
    closePlayerSelectionModal();
    
    // Clear any stale player modal data to prevent it from reopening
    const playerModal = document.getElementById('playerModal');
    if (playerModal) {
        playerModal.dataset.playerId = '';
        playerModal.removeAttribute('data-player-id');
    }
}

// Consolidated sellPlayer with context-aware logic
function sellPlayer(playerId) {
    console.log('sellPlayer called with playerId:', playerId, 'Context:', pageContext);
    
    // Track when sell operation starts
    window.lastSellOperation = Date.now();

    // Find the player in the cache
    const player = allPlayersCache.find(p => p.id === playerId);
    if (!player) {
        console.error('Player not found in cache:', playerId);
        closePlayerModal();
        return;
    }

    console.log('Found player:', player.name, 'position:', player.position);

    // Remove player from temp state
    const playerIndex = tempSelectedPlayers.indexOf(playerId);
    if (playerIndex > -1) {
        tempSelectedPlayers.splice(playerIndex, 1);
        tempBudget += player.price; // Add money back to budget

        if (pageContext === 'transfers') {
            const teamIndex = currentTeamPlayerIds.indexOf(playerId);
            if (teamIndex > -1) {
                currentTeamPlayerIds.splice(teamIndex, 1);
            }
        }

        console.log(`Sold ${player.name} for £${player.price}m`);

        // Find and update the player card to become an empty slot
        const playerCard = document.querySelector(`[data-player-id="${playerId}"]`);
        if (playerCard) {
            console.log('Found player card, converting to empty slot');

            // Remove old click handler first to prevent any interference
            if (playerCard.clickHandler) {
                playerCard.removeEventListener('click', playerCard.clickHandler);
                playerCard.clickHandler = null;
                console.log('Removed old click handler');
            }

            // Immediately convert the player card to an empty slot
            const emptySlot = createEmptySlot(playerCard, playerId, false);
            
            // Store reference for delayed click handler setup
            window.pendingEmptySlotConversion = {
                playerId: playerId
            };
        } else {
            console.error('Player card not found for playerId:', playerId);
        }

        updateDisplay();
    } else {
        console.error('Player not found in tempSelectedPlayers:', playerId);
    }

    // Close the player modal immediately and clear all modal data
    console.log('About to close player modal');
    closePlayerModal();
    
    // Clear any stale modal data to prevent reopening issues
    const playerModal = document.getElementById('playerModal');
    if (playerModal) {
        playerModal.dataset.playerId = '';
        playerModal.removeAttribute('data-player-id');
        // Clear any other modal attributes
        Object.keys(playerModal.dataset).forEach(key => {
            delete playerModal.dataset[key];
        });
    }
    
    console.log('sellPlayer function completed');

    // Add a small delay to ensure modal is fully closed and cleared
    setTimeout(() => {
        // Double-check that the modal is closed and remove any lingering event handlers
        const modal = document.getElementById('playerModal');
        if (modal && modal.open) {
            console.log('Modal still open, forcing close');
            modal.close();
        }
        
        // Now handle the pending empty slot conversion
        if (window.pendingEmptySlotConversion) {
            const { playerId } = window.pendingEmptySlotConversion;
            
            // Find the empty slot that was created from this player
            const emptySlot = document.querySelector(`[data-converted-from-player="${playerId}"]`);
            
            if (emptySlot) {
                console.log('Setting up click handler for empty slot after modal close');
                
                // Set up click handler for the empty slot
                setupEmptySlotClickHandler(emptySlot);
            } else {
                console.warn('Could not find the empty slot that was created for player:', playerId);
            }
            
            window.pendingEmptySlotConversion = null; // Clear the pending conversion
        }
    }, 100);
}

// Consolidated buyPlayer with context-aware logic
function buyPlayer(player, emptySlot) {
    console.log('Buying player:', player.name, 'for slot:', emptySlot, 'Context:', pageContext);

    // Allow over-budget for both contexts (validation happens on submit)
    // Maintain slot ordering by inserting at the empty slot's original slotIndex when available
    let inserted = false;
    if (emptySlot && emptySlot.dataset && emptySlot.dataset.slotIndex !== undefined) {
        const rawIndex = parseInt(emptySlot.dataset.slotIndex, 10);
        if (!Number.isNaN(rawIndex) && rawIndex >= 0) {
            const existingIdx = tempSelectedPlayers.indexOf(player.id);
            if (existingIdx !== -1) tempSelectedPlayers.splice(existingIdx, 1); // de-dupe just in case
            if (rawIndex <= tempSelectedPlayers.length) {
                tempSelectedPlayers.splice(rawIndex, 0, player.id);
                inserted = true;
            }
        }
    }
    if (!inserted) {
        tempSelectedPlayers.push(player.id);
    }
    tempBudget -= player.price;

    if (pageContext === 'transfers') {
        // Mirror ordering in currentTeamPlayerIds as well
        let teamInserted = false;
        if (emptySlot && emptySlot.dataset && emptySlot.dataset.slotIndex !== undefined) {
            const rawIndex = parseInt(emptySlot.dataset.slotIndex, 10);
            if (!Number.isNaN(rawIndex) && rawIndex >= 0) {
                const existingIdx = currentTeamPlayerIds.indexOf(player.id);
                if (existingIdx !== -1) currentTeamPlayerIds.splice(existingIdx, 1);
                if (rawIndex <= currentTeamPlayerIds.length) {
                    currentTeamPlayerIds.splice(rawIndex, 0, player.id);
                    teamInserted = true;
                }
            }
        }
        if (!teamInserted) {
            currentTeamPlayerIds.push(player.id);
        }
    }

    // Convert empty slot to player card using shared function
    convertEmptySlotToPlayerCard(emptySlot, player);

    // Set up click handler for player card (to show player details/sell option)
    emptySlot.clickHandler = () => {
        openPlayerModal(player);
    };
    emptySlot.addEventListener('click', emptySlot.clickHandler);

    console.log(`Player bought for £${player.price}m. Budget updated.`);
    
    // Clear the current transfer slot
    currentTransferSlot = null;
    
    // Close any open modals
    closeTeamSelectionModal();
    closePlayerSelectionModal();

    updateDisplay();
}

// Shared display update function
function updateDisplay() {
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        budgetElement.textContent = tempBudget.toFixed(1);
    }

    // Update budget section styling based on budget status
    const budgetSection = document.querySelector('.budget-section') || document.querySelector('.budget-info');
    const budgetRemaining = document.querySelector('.budget-remaining');
    
    if (budgetSection) {
        budgetSection.classList.toggle('over-budget', tempBudget < 0);
    }
    
    if (budgetRemaining) {
        budgetRemaining.classList.toggle('over-budget', tempBudget < 0);
    }

    if (pageContext === 'transfers') {
        // Call the page-specific update function for transfers
        if (typeof window.updateTransfersDisplay === 'function') {
            window.updateTransfersDisplay();
        } else {
            // Fallback to basic transfers updates
            const transfersMadeElement = document.getElementById('transfersMade');
            if (transfersMadeElement) {
                transfersMadeElement.textContent = tempTransfersMade;
            }
            
            // Update confirm transfers button state
            const confirmTransfersBtn = document.getElementById('confirmTransfersBtn');
            if (confirmTransfersBtn) {
                const originalSet = new Set(window.originalTeamPlayerIds || []);
                const currentSet = new Set(tempSelectedPlayers);
                const added = [...currentSet].filter(id => !originalSet.has(id));
                const removed = [...originalSet].filter(id => !currentSet.has(id));
                const effectiveTransfers = Math.max(added.length, removed.length);
                confirmTransfersBtn.disabled = effectiveTransfers === 0;
            }
        }
    }

    console.log(`Updated ${pageContext} display - Budget: £${tempBudget.toFixed(1)}m, Players: ${tempSelectedPlayers.length}`);
}

// Consolidated submission with validation
function handleSubmit(event) {
    event.preventDefault();
    console.log('Handling submit for context:', pageContext);

    // Shared validation
    const errors = [];
    if (tempBudget < 0) {
        errors.push(`Your squad budget has been exceeded by £${Math.abs(tempBudget).toFixed(1)}m. Please remove some players or select cheaper alternatives.`);
    }

    // Formation validation (4-4-2)
    const players = tempSelectedPlayers.map(id => allPlayersCache.find(p => p.id === id)).filter(p => p);
    const positionCounts = {
        goalkeeper: players.filter(p => p.position === 'goalkeeper').length,
        defender: players.filter(p => p.position === 'defender').length,
        midfielder: players.filter(p => p.position === 'midfielder').length,
        attacker: players.filter(p => p.position === 'attacker').length
    };

    console.log('Position counts for 4-4-2 validation:', positionCounts);

    if (positionCounts.goalkeeper < 2) {
        errors.push('You need at least 2 goalkeepers (1 starting + 1 substitute).');
    }
    if (positionCounts.defender < 5) {
        errors.push('You need at least 5 defenders (4 starting + 1 substitute).');
    }
    if (positionCounts.midfielder < 5) {
        errors.push('You need at least 5 midfielders (4 starting + 1 substitute).');
    }
    if (positionCounts.attacker < 3) {
        errors.push('You need at least 3 attackers (2 starting + 1 substitute).');
    }

    // Club limits (max 3 players per club)
    const clubCounts = {};
    tempSelectedPlayers.forEach(playerId => {
        const player = allPlayersCache.find(p => p.id === playerId);
        if (player) {
            clubCounts[player.teamName] = (clubCounts[player.teamName] || 0) + 1;
        }
    });

    for (const [clubName, count] of Object.entries(clubCounts)) {
        if (count > 3) {
            errors.push(`You have ${count} players from ${clubName}. The maximum allowed is 3 players per club.`);
        }
    }

    if (errors.length > 0) {
        showErrorModal(errors);
        return;
    }

    // Context-specific submission
    if (pageContext === 'draft') {
        saveDraftTeam();
    } else if (pageContext === 'transfers') {
        saveTransfers();
    }
}

// Context-specific save functions
function saveDraftTeam() {
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();

    console.log('Saving draft team:', { teamName, managerName, selectedPlayers: tempSelectedPlayers });

    // First update the PlayFab display name to the team name
    PlayFab.ClientApi.UpdateUserTitleDisplayName({
        DisplayName: teamName
    }, function(result, error) {
        if (error) {
            console.error("Error updating display name:", error);
            alert("Failed to set team name as display name. Please try again.");
            return;
        }

        console.log("Display name updated to:", teamName);

        // Find the most expensive player to set as captain
        const selectedPlayers = tempSelectedPlayers.map(id => allPlayersCache.find(p => p.id === id)).filter(p => p);
        const mostExpensivePlayer = selectedPlayers.reduce((max, player) => 
            (player.price > max.price) ? player : max, selectedPlayers[0]);
        const captainId = mostExpensivePlayer ? mostExpensivePlayer.id : null;
        
        console.log("Auto-selected captain:", mostExpensivePlayer ? mostExpensivePlayer.name : "None", "Price:", mostExpensivePlayer ? mostExpensivePlayer.price : "N/A");

        // Then save team info to user data
        const teamData = {
            teamName: teamName,
            managerName: managerName,
            captainId: captainId,
            currentPlayerGameWeek: 1,
            leaderboardInfo: JSON.stringify({
                teamName: teamName,
                managerName: managerName
            }),
            freeTransfers: 1
        };

        PlayFab.ClientApi.UpdateUserData({
            Data: teamData
        }, function(result, error) {
            if (error) {
                console.error("Error saving team data:", error);
                alert("Failed to save team information. Please try again.");
                return;
            }

            console.log("Team data saved successfully");

            // Save players in current selected order (formation normalization happens on load)
            console.log('Saving draft order (no client reordering):', tempSelectedPlayers);
            const selectedPlayersData = {
                selectedPlayers: JSON.stringify(tempSelectedPlayers)
            };

            PlayFab.ClientApi.UpdateUserData({
                Data: selectedPlayersData
            }, function(result, error) {
                if (error) {
                    console.error("Error saving selected players:", error);
                    alert("Failed to save selected players. Please try again.");
                    return;
                }

                console.log("Selected players saved successfully");

                // Initialize PlayerTotalPoints statistic for leaderboards
                PlayFab.ClientApi.UpdatePlayerStatistics({
                    Statistics: [{
                        StatisticName: "PlayerTotalPoints",
                        Value: 0
                    }]
                }, function(statResult, statError) {
                    if (statError) {
                        console.error("Error initializing PlayerTotalPoints:", statError);
                    } else {
                        console.log("PlayerTotalPoints initialized to 0");
                    }

                    alert("Team created successfully! Redirecting to team selection.");
                    window.location.href = "pick-team.html";
                });
            });
        });
    });
}

function saveTransfers() {
    // Compute effective transfers via net difference
    const originalSet = new Set(window.originalTeamPlayerIds || []);
    const currentSet = new Set(tempSelectedPlayers);
    const added = [...currentSet].filter(id => !originalSet.has(id));
    const removed = [...originalSet].filter(id => !currentSet.has(id));
    const effectiveTransfers = Math.max(added.length, removed.length);
    console.log('Saving transfers (net):', { selectedPlayers: tempSelectedPlayers, added, removed, effectiveTransfers });

    const initialFree = typeof window.initialFreeTransfers === 'number' ? window.initialFreeTransfers : 1;
    const freeUsed = Math.min(effectiveTransfers, initialFree);
    let remainingFreeTransfers = initialFree - freeUsed;
    if (remainingFreeTransfers > 2) remainingFreeTransfers = 2;
    if (remainingFreeTransfers < 0) remainingFreeTransfers = 0;

    const updateData = {
        selectedPlayers: JSON.stringify(tempSelectedPlayers),
        freeTransfers: remainingFreeTransfers.toString()
    };

    PlayFab.ClientApi.UpdateUserData({ Data: updateData }, function(result, error) {
        if (error) {
            console.error("Error saving transfers:", error);
            alert("Failed to save transfers. Please try again.");
            return;
        }

    console.log("Transfers & freeTransfers updated:", { remainingFreeTransfers, effectiveTransfers });

        // Compute points cost for toast (paid transfers * 4)
        const paidTransfers = Math.max(0, effectiveTransfers - freeUsed);
        const pointsCost = paidTransfers * 4;
        if (typeof showTransientToast === 'function') {
            const msg = effectiveTransfers === 0
                ? 'No changes saved.'
                : `Transfers saved: ${effectiveTransfers} (${freeUsed} free, ${paidTransfers} paid)  Cost: ${pointsCost} pts`;
            showTransientToast(msg, { type: pointsCost > 0 ? 'warning' : 'success' });
        }

        window.initialFreeTransfers = remainingFreeTransfers;
        window.originalTeamPlayerIds = [...tempSelectedPlayers];
        tempTransfersMade = 0; // legacy variable kept
        updateDisplay();
        if (typeof window.syncFreeTransfers === 'function') {
            window.syncFreeTransfers();
        }
    });
}

// Helper function to organize players into 4-4-2 formation
// Removed organizePlayersInto442Formation; server-side load normalization now handles formation legality.

// Error modal functions
function showErrorModal(errors) {
    const errorMessagesDiv = document.getElementById('errorMessages');
    if (errorMessagesDiv) {
        errorMessagesDiv.innerHTML = errors.map(error => `<p>${error}</p>`).join('');
    }

    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.showModal();
    }
}

function closeErrorModal() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.close();
    }
}

// Function to create a player card for the pitch
function createPlayerCard(player, context = 'selection') {
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

    // Add context-specific overlay
    const overlayDiv = document.createElement('div');
    
    switch (context) {
        case 'points':
            overlayDiv.className = 'player-points';
            // Display weekly points if available, otherwise fall back to total points
            const pointsToShow = player.weeklyPoints !== undefined ? player.weeklyPoints : player.points;
            overlayDiv.textContent = `${pointsToShow} pts`;
            break;
            
        case 'team':
            overlayDiv.className = 'player-position';
            // Display the position (convert abbreviations to readable format)
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
            
            overlayDiv.textContent = displayPosition;
            
            // Add position-specific class for color coding
            if (positionClass) {
                overlayDiv.classList.add(positionClass);
            }
            break;
            
        case 'selection':
        default:
            overlayDiv.className = 'player-price';
            // Use actual player price from data
            const playerPrice = player.price || '5.0'; // Default if no price available
            overlayDiv.textContent = `£${playerPrice}m`;
            break;
    }
    
    card.appendChild(overlayDiv);

    // Add context-specific click handlers
    if (context === 'team') {
        // Pick team page click handler
        card.addEventListener('click', () => {
            // Check if we're in substitute mode
            if (window.substituteMode && window.substituteMode.active) {
                // Check if this is the selected player (blue highlighted)
                if (card.classList.contains('substitute-mode-selected')) {
                    // Cancel substitute mode when clicking the highlighted player
                    if (typeof cancelSubstituteMode === 'function') {
                        cancelSubstituteMode();
                    }
                    return; // Don't open modal
                }
                
                // If we're in substitute mode and clicked a substitute player, swap them
                if (card.classList.contains('substitute-player')) {
                    if (typeof performSubstitution === 'function') {
                        performSubstitution(window.substituteMode.selectedPlayerId, player.id);
                    }
                    return; // Don't open modal
                }
                
                // If we clicked a main player, perform substitution
                if (typeof performSubstitution === 'function') {
                    performSubstitution(window.substituteMode.selectedPlayerId, player.id);
                }
                return; // Don't open modal
            }
            
            // Normal click behavior - open modal
            if (typeof openPlayerModal === 'function') {
                openPlayerModal(player);
            }
        });
    } else if (context === 'selection') {
        // Selection page click handler
        card.clickHandler = () => {
            if (typeof openPlayerModal === 'function') {
                openPlayerModal(player);
            }
        };
        card.addEventListener('click', card.clickHandler);
    }
    // Points page doesn't need click handlers (view-only)

    // Store player data on the card for later reference
    card.dataset.playerId = player.id;
    card.dataset.playerName = player.name;

    return card;
}

// Make the shared createPlayerCard function globally accessible with a unique name
window.sharedCreatePlayerCard = createPlayerCard;

// Make the shared renderPlayersOnPitch function globally accessible
window.sharedRenderPlayersOnPitch = renderPlayersOnPitch;

// ========================================
// PITCH RENDERING
// ========================================

// Function to render players on the pitch
function renderPlayersOnPitch(players, selectedPlayerIds = [], context = 'selection', captainId = null) {
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

    // Context-aware configuration
    const config = getContextConfig(context);
    
    // Position mapping from full names to abbreviations
    const positionMapping = {
        'goalkeeper': 'gk',
        'defender': 'df',
        'midfielder': 'md',
        'attacker': 'at'
    };

    // Group players by position
    const positions = initializePositions(config.hasSubstitutes);
    
    // Handle substitutes if context supports them
    let mainPlayers = players;
    let substitutes = [];
    
    if (config.hasSubstitutes && players.length > 11) {
        substitutes = players.slice(-4);
        mainPlayers = players.slice(0, players.length - 4);
    }

    // Debug logging for points page
    if (context === 'points') {
        console.log("renderPlayersOnPitch called with:");
        console.log("- players:", players);
        console.log("- selectedPlayerIds:", selectedPlayerIds);
        console.log("- Captain ID identified:", captainId);
    }

    // Assign main players to their positions
    mainPlayers.forEach(player => {
        const mappedPosition = positionMapping[player.position] || player.position;
        const targetPosition = config.useAbbreviations ? mappedPosition : player.position;
        
        if (positions[targetPosition]) {
            positions[targetPosition].push(player);
        } else {
            console.warn(`Unknown position: ${player.position} for player ${player.name}`);
            // Default fallback
            const fallbackPos = config.useAbbreviations ? 'df' : 'defender';
            if (positions[fallbackPos]) {
                positions[fallbackPos].push(player);
            }
        }
    });

    // Assign substitutes if applicable
    if (config.hasSubstitutes) {
        substitutes.forEach(player => {
            positions.sb.push(player);
        });
    }

    // Render players for each position
    let slotCounter = 0;
    Object.keys(positions).forEach(position => {
        const rowPlayers = positions[position];

        rowPlayers.forEach((player, index) => {
            const playerCard = createPlayerCard(player, context);
            
            // Add slot index for selection context
            if (context === 'selection') {
                playerCard.dataset.slotIndex = slotCounter;
                slotCounter++;
            }

            // Calculate dynamic left position to avoid overlap
            const left = `${(index + 1) * (100 / (rowPlayers.length + 1))}%`;

            // Apply inline styles for positioning
            playerCard.style.position = 'absolute';
            playerCard.style.top = config.positionStyles[position].top;
            playerCard.style.left = left;

            // Add context-specific styling
            if (config.hasSubstitutes && position === 'sb') {
                playerCard.classList.add('substitute-player');
            }

            // Add captain styling if this is the captain (exclude selection context: draft/transfers pages)
            if (captainId && context !== 'selection' && player.id && String(player.id) === String(captainId)) {
                playerCard.classList.add('captain-player');
                if (context === 'points') {
                    console.log(`Captain badge added to player: ${player.name} (ID: ${player.id})`);
                }
            }

            // Add to fragment instead of DOM
            fragment.appendChild(playerCard);
        });
    });

    // Append all player cards at once to minimize layout thrashing
    pitch.appendChild(fragment);
}

// Helper function to get context-specific configuration
function getContextConfig(context) {
    switch (context) {
        case 'selection':
            return {
                hasSubstitutes: false,
                useAbbreviations: false,
                positionStyles: {
                    goalkeeper: { top: '10%' },
                    defender: { top: '30%' },
                    midfielder: { top: '50%' },
                    attacker: { top: '70%' }
                }
            };
        case 'team':
        case 'points':
        default:
            return {
                hasSubstitutes: true,
                useAbbreviations: true,
                positionStyles: {
                    gk: { top: '10%' },
                    df: { top: '30%' },
                    md: { top: '50%' },
                    at: { top: '70%' },
                    sb: { top: '90%' } // Substitutes row
                }
            };
    }
}

// Helper function to initialize position groups
function initializePositions(hasSubstitutes) {
    if (hasSubstitutes) {
        return {
            gk: [],
            df: [],
            md: [],
            at: [],
            sb: [] // Substitutes
        };
    } else {
        return {
            goalkeeper: [],
            defender: [],
            midfielder: [],
            attacker: []
        };
    }
}

// ========================================
// EMPTY SLOT RENDERING
// ========================================

// Function to render empty team slots for initial selection
function renderEmptyTeamSlots(onSlotClick) {
    // Get the pitch container
    const pitch = document.querySelector('.pitch');
    if (!pitch) {
        console.error("Pitch container not found - cannot render empty slots");
        return;
    }

    // Clear existing content
    pitch.innerHTML = '<img src="images/pitch.svg" alt="Football Pitch" class="pitch-image">';

    // Define positions and their layout (15 players: 11 starting + 4 substitutes)
    const positions = [
        { pos: 'gk', top: '10%', count: 2 },  // 1 starting + 1 substitute GK
        { pos: 'df', top: '30%', count: 5 },  // 4 starting + 1 substitute DF
        { pos: 'md', top: '50%', count: 5 },  // 4 starting + 1 substitute MD
        { pos: 'at', top: '70%', count: 3 }   // 2 starting + 1 substitute AT
    ];

    let slotIndex = 0;

    positions.forEach(position => {
        for (let i = 0; i < position.count; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'player-card empty-slot';
            emptySlot.dataset.slotIndex = slotIndex;
            emptySlot.dataset.position = position.pos.toUpperCase();

            // Create + symbol
            const plusSymbol = document.createElement('div');
            plusSymbol.className = 'plus-symbol';
            plusSymbol.textContent = '+';
            emptySlot.appendChild(plusSymbol);

            // Add position text
            const positionDiv = document.createElement('div');
            positionDiv.className = 'empty-slot-position';
            positionDiv.textContent = position.pos.toUpperCase();
            emptySlot.appendChild(positionDiv);

            // Calculate left position
            const left = `${((i + 1) * (100 / (position.count + 1)))}%`;

            // Apply positioning
            emptySlot.style.position = 'absolute';
            emptySlot.style.top = position.top;
            emptySlot.style.left = left;

            // Add click handler
            emptySlot.clickHandler = () => {
                currentTransferSlot = emptySlot;
                if (onSlotClick) {
                    onSlotClick(position.pos.toUpperCase());
                } else {
                    openTeamSelectionModal(position.pos.toUpperCase());
                }
            };
            emptySlot.addEventListener('click', emptySlot.clickHandler);

            pitch.appendChild(emptySlot);
            slotIndex++;
        }
    });

    console.log("Rendered empty team slots");
}

// ========================================
// PLAYER MODAL FUNCTIONALITY
// ========================================

// Function to open the player modal
function openPlayerModal(player) {
    const modal = document.getElementById('playerModal');
    const modalPlayerName = document.getElementById('modalPlayerName');
    const modalPlayerTeam = document.getElementById('modalPlayerTeam');
    const modalPlayerPosition = document.getElementById('modalPlayerPosition');
    const modalPlayerPoints = document.getElementById('modalPlayerPoints');
    const modalPlayerPrice = document.getElementById('modalPlayerPrice');
    const selectPlayerBtn = document.getElementById('selectPlayerBtn');

    if (modal && modalPlayerName && modalPlayerTeam && modalPlayerPosition && modalPlayerPoints && modalPlayerPrice) {
        // Set player information in modal
        modalPlayerName.textContent = player.name;
        modalPlayerTeam.textContent = player.teamName;

        // Convert position back to readable format
        const positionMap = {
            'goalkeeper': 'Goalkeeper',
            'defender': 'Defender',
            'midfielder': 'Midfielder',
            'attacker': 'Attacker'
        };
        modalPlayerPosition.textContent = positionMap[player.position] || player.position;
        modalPlayerPoints.textContent = player.points || 0;
        modalPlayerPrice.textContent = (player.price || 0).toFixed(1);

        // Store current player for action
        modal.dataset.playerId = player.id;

        // Determine context and update button text
        if (selectPlayerBtn) {
            // Check if this player is already selected in the draft team
            const isPlayerSelected = window.draftSelectedPlayers && window.draftSelectedPlayers.includes(player.id);

            if (isPlayerSelected) {
                // Player is already in the team - show sell option
                selectPlayerBtn.textContent = 'Sell Player';
                selectPlayerBtn.className = 'sell-player-btn'; // Add class for styling if needed
            } else {
                // Player is not in the team - show select option
                selectPlayerBtn.textContent = 'Select Player';
                selectPlayerBtn.className = 'select-player-btn'; // Add class for styling if needed
            }
        }

        // Show the modal
        modal.showModal();
    }
}

// Function to close the player modal
function closePlayerModal() {
    console.log('closePlayerModal called');
    const modal = document.getElementById('playerModal');
    if (modal) {
        console.log('Closing player modal...');
        modal.close();
        console.log('Player modal closed successfully');
    } else {
        console.error('Player modal not found');
    }
}

// ========================================
// TEAM SELECTION MODAL FUNCTIONALITY
// ========================================

// Function to open team selection modal
function openTeamSelectionModal(position) {
    console.log('openTeamSelectionModal called with position:', position);
    console.trace('Stack trace for openTeamSelectionModal call');
    const modal = document.getElementById('teamSelectionModal');
    const modalTitle = document.getElementById('teamModalTitle');
    const modalPosition = document.getElementById('teamModalPosition');
    const teamList = document.getElementById('teamList');

    if (modal && modalTitle && modalPosition && teamList) {
        // Set modal title and position
        const positionNames = {
            'GK': 'Goalkeepers',
            'DF': 'Defenders',
            'MD': 'Midfielders',
            'AT': 'Attackers'
        };

        modalTitle.textContent = `Select Team - ${positionNames[position] || position}`;
        modalPosition.textContent = positionNames[position] || position;

        // Store position for later use
        modal.dataset.selectedPosition = position;

        // Populate teams
        populateTeamList(teamList);

        // Show the modal
        modal.showModal();
        console.log('Team selection modal opened successfully');
    } else {
        console.error('Team selection modal elements not found');
    }
}

// Function to populate the team list
function populateTeamList(teamListContainer) {
    // Clear existing content
    teamListContainer.innerHTML = '';

    // List of teams (matching the shirt images we have)
    const teams = [
        { name: 'Highfields FC', shirt: 'images/shirts/highfields.svg' },
        { name: 'Vineyard FC', shirt: 'images/shirts/vineyard.svg' },
        { name: 'Bethel Town FC', shirt: 'images/shirts/bethel.svg' },
        { name: 'Lifepoint Church AFC', shirt: 'images/shirts/lifepoint.svg' },
        { name: 'DC United FC', shirt: 'images/shirts/dc.svg' },
        { name: 'Emmanuel Baptist Church FC', shirt: 'images/shirts/emmanuel.svg' },
        { name: 'Parklands AFC', shirt: 'images/shirts/parklands.svg' },
        { name: 'Bridgend Deanery FC', shirt: 'images/shirts/bridgend.svg' },
        { name: 'Rhondda Royals FC', shirt: 'images/shirts/rhondda.svg' },
        { name: 'Libanus Evangelical Church', shirt: 'images/shirts/libanus.svg' },
        { name: 'Waterfront Community Church FC', shirt: 'images/shirts/waterfront.svg' },
        { name: 'Oasis FC', shirt: 'images/shirts/oasis.svg' },
        { name: 'Mumbles Baptist FC', shirt: 'images/shirts/mumbles.svg' }
    ];

    // Create team options
    teams.forEach(team => {
        const teamOption = document.createElement('div');
        teamOption.className = 'team-option';
        teamOption.dataset.teamName = team.name;

        // Add team shirt image
        const shirtImg = document.createElement('img');
        shirtImg.src = team.shirt;
        shirtImg.alt = `${team.name} Shirt`;
        shirtImg.onerror = function() {
            this.src = 'images/shirts/template.svg';
        };

        // Add team name
        const teamName = document.createElement('h4');
        teamName.textContent = team.name;

        // Add click handler
        teamOption.addEventListener('click', () => {
            selectTeam(team.name);
        });

        teamOption.appendChild(shirtImg);
        teamOption.appendChild(teamName);
        teamListContainer.appendChild(teamOption);
    });
}

// Function to handle team selection
function selectTeam(teamName) {
    console.log('Selected team:', teamName);
    const modal = document.getElementById('teamSelectionModal');
    const position = modal.dataset.selectedPosition;

    // Close team selection modal
    closeTeamSelectionModal();

    // Open player selection modal for this team and position
    openPlayerSelectionModal(teamName, position);
}

// Function to close team selection modal
function closeTeamSelectionModal() {
    const modal = document.getElementById('teamSelectionModal');
    if (modal) {
        modal.close();
    }
}

// ========================================
// PLAYER SELECTION MODAL FUNCTIONALITY
// ========================================

// Function to open player selection modal
function openPlayerSelectionModal(teamName, position) {
    const modal = document.getElementById('playerSelectionModal');
    const modalTitle = document.getElementById('playerModalTitle');
    const modalPosition = document.getElementById('playerModalPosition');
    const modalTeam = document.getElementById('playerModalTeam');
    const playerList = document.getElementById('playerSelectionList');

    if (modal && modalTitle && modalPosition && modalTeam && playerList) {
        // Set position names (copied from shared function for consistency)
        const positionNames = {
            'GK': 'Goalkeeper',
            'DF': 'Defender',
            'MD': 'Midfielder',
            'AT': 'Attacker'
        };

        // Update modal content
        modalTitle.textContent = `Select ${positionNames[position] || position}`;
        modalPosition.textContent = positionNames[position] || position;
        modalTeam.textContent = teamName;

        // Store selection data
        modal.dataset.selectedTeam = teamName;
        modal.dataset.selectedPosition = position;

        // Load players, excluding those already in the temp selected players
        loadPlayersFromTeam(teamName, position, playerList, tempSelectedPlayers);

        // Show the modal
        modal.showModal();
        console.log(`Opened player selection modal for ${teamName} ${position}, excluding ${tempSelectedPlayers.length} players`);
    } else {
        console.error('Player selection modal elements not found');
    }
}

// Function to load players from a specific team and position
function loadPlayersFromTeam(teamName, position, playerListContainer, excludePlayerIds = []) {
    // Show loading state
    playerListContainer.innerHTML = '<p>Loading players...</p>';

    // Use cached data if available, otherwise load all players
    if (isCacheValid()) {
        filterAndDisplayPlayers(allPlayersCache, teamName, position, playerListContainer, excludePlayerIds);
    } else {
        loadAllPlayers(function(error, allPlayers) {
            if (error) {
                console.error("Error loading player data:", error);
                playerListContainer.innerHTML = '<p>Error loading players. Please try again.</p>';
                return;
            }

            filterAndDisplayPlayers(allPlayers, teamName, position, playerListContainer, excludePlayerIds);
        });
    }
}

// Helper function to filter and display players
function filterAndDisplayPlayers(allPlayers, teamName, position, playerListContainer, excludePlayerIds = []) {
    // Filter players by team and position
    const positionMap = {
        'GK': 'goalkeeper',
        'DF': 'defender',
        'MD': 'midfielder',
        'AT': 'attacker'
    };

    const targetPosition = positionMap[position];
    console.log(`Filtering for team: ${teamName}, position: ${targetPosition}`);

    // Debug: Log all unique team names and positions in the data
    const uniqueTeams = [...new Set(allPlayers.map(p => p.teamName))];
    const uniquePositions = [...new Set(allPlayers.map(p => p.position))];
    console.log('Available teams in data:', uniqueTeams);
    console.log('Available positions in data:', uniquePositions);

    const filteredPlayers = allPlayers.filter(player => {
        // Filter by team and position (case-insensitive team matching)
        const matchesTeam = player.teamName.toLowerCase().includes(teamName.toLowerCase().replace(' fc', '').replace(' afc', '').replace(' church', '').replace(' baptist', '').replace(' town', '').replace(' united', '').replace(' community', '').replace(' evangelical', '').replace(' deanery', '').replace(' royals', ''));
        const matchesPosition = player.position === targetPosition;

        // Exclude specified players
        const notExcluded = !excludePlayerIds.includes(player.id);

        if (matchesTeam && matchesPosition) {
            console.log(`Matched player: ${player.name}, team: ${player.teamName}, position: ${player.position}`);
        }

        return matchesTeam && matchesPosition && notExcluded;
    });

    console.log(`Found ${filteredPlayers.length} available players for ${teamName} ${position}`);

    // Sort by price (highest first) - most expensive/popular players at top
    filteredPlayers.sort((a, b) => (b.price || 0) - (a.price || 0));

    // Display players
    displayPlayerSelection(filteredPlayers, playerListContainer);
}

// Function to display player selection list
function displayPlayerSelection(players, container) {
    // Clear loading message
    container.innerHTML = '';

    if (players.length === 0) {
        container.innerHTML = '<p>No players found for this position and team.</p>';
        return;
    }

    players.forEach(player => {
        const playerOption = document.createElement('div');
        playerOption.className = 'player-selection-option';
        playerOption.dataset.playerId = player.id;

        // Player shirt image
        const shirtImg = document.createElement('img');
        shirtImg.src = player.shirtImage;
        shirtImg.alt = `${player.name}'s Shirt`;
        shirtImg.onerror = function() {
            this.src = 'images/shirts/template.svg';
        };

        // Player info container
        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-selection-info';

        // Player details
        const playerDetails = document.createElement('div');
        playerDetails.className = 'player-selection-details';

        const playerName = document.createElement('h4');
        playerName.className = 'player-selection-name';
        playerName.textContent = player.name;

        const playerStats = document.createElement('p');
        playerStats.className = 'player-selection-stats';
        playerStats.innerHTML = `<span>Points: ${player.points || 0}</span>`;

        // Player price
        const playerPrice = document.createElement('div');
        playerPrice.className = 'player-selection-price';
        playerPrice.textContent = `£${(player.price || 0).toFixed(1)}m`;

        // Assemble the option
        playerDetails.appendChild(playerName);
        playerDetails.appendChild(playerStats);

        playerInfo.appendChild(playerDetails);
        playerInfo.appendChild(playerPrice);

        playerOption.appendChild(shirtImg);
        playerOption.appendChild(playerInfo);

        // Add click handler - this will be overridden by page-specific logic
        playerOption.addEventListener('click', () => {
            selectPlayerFromTeam(player);
        });

        container.appendChild(playerOption);
    });
}

// NOTE: Removed placeholder selectPlayerFromTeam definition that previously
// overwrote the fully featured version declared earlier in this file.
// Page-specific overrides (e.g. in transfers.js) can still redefine the
// function after this script loads. The base implementation now remains
// active for draft/create-team, ensuring the modal closes and state updates.

// Function to close player selection modal
function closePlayerSelectionModal() {
    const modal = document.getElementById('playerSelectionModal');
    if (modal) {
        modal.close();
    }
}

// ========================================
// SLOT MANAGEMENT
// ========================================

// Function to add a player to a specific slot
function addPlayerToSlot(cardElement, player) {
    console.log('addPlayerToSlot called for player:', player.name);
    
    // Use shared function to convert empty slot to player card
    convertEmptySlotToPlayerCard(cardElement, player);
    
    // Add additional functionality specific to player selection
    // Add intersection observer for progressive loading if supported
    const shirtImg = cardElement.querySelector('.player-shirt');
    if (shirtImg && 'IntersectionObserver' in window) {
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

    // Add click event listener to open modal (same as original cards)
    cardElement.clickHandler = () => {
        console.log('Player card clicked - opening player modal for:', player.name);
        openPlayerModal(player);
    };
    cardElement.addEventListener('click', cardElement.clickHandler);
    console.log('Player modal click handler set up for:', player.name);

    // Preserve the slot index from the existing card element
    // (it should already be set from when the card was created)
}

// Function to set up click handler for empty slots
function setupEmptySlotClickHandler(emptySlot) {
    // Determine position based on card location
    let position = 'DF'; // Default
    const cardTop = emptySlot.style.top;
    if (cardTop === '10%') position = 'GK';
    else if (cardTop === '30%') position = 'DF';
    else if (cardTop === '50%') position = 'MD';
    else if (cardTop === '70%') position = 'AT';
    else if (cardTop === '90%') position = 'SUB';

    console.log('Setting up click handler for empty slot position:', position);
    
    // Remove any existing click handler
    if (emptySlot.clickHandler) {
        emptySlot.removeEventListener('click', emptySlot.clickHandler);
    }
    
    // Add a flag to prevent immediate clicks
    let justSetUp = true;
    setTimeout(() => { justSetUp = false; }, 50);
    
    emptySlot.clickHandler = (event) => {
        // Check if this is a real user-initiated event
        if (!event.isTrusted) {
            console.log('Blocking programmatic click event');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        
        if (justSetUp) {
            console.log('Blocking click - handler was just set up');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        
        // Check if there was a sell operation recently
        const now = Date.now();
        const timeSinceSell = now - (window.lastSellOperation || 0);
        
        if (timeSinceSell < 100) {
            console.log('Blocking click - too soon after sell operation');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        
        console.log('Empty slot clicked by user for position:', position);
        currentTransferSlot = emptySlot;
        openTeamSelectionModal(position);
    };
    emptySlot.addEventListener('click', emptySlot.clickHandler);
    console.log('Click handler set up successfully for empty slot');
}

// Function to setup shared modal event listeners
function setupSharedModalListeners() {
    // Modal close button
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closePlayerModal);
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePlayerModal);
    }

    // Close modal when clicking outside
    const modal = document.getElementById('playerModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closePlayerModal();
            }
        });
    }

    // Team selection modal event listeners
    const closeTeamModalBtn = document.getElementById('closeTeamModal');
    if (closeTeamModalBtn) {
        closeTeamModalBtn.addEventListener('click', closeTeamSelectionModal);
    }

    const cancelTeamBtn = document.getElementById('cancelTeamSelection');
    if (cancelTeamBtn) {
        cancelTeamBtn.addEventListener('click', closeTeamSelectionModal);
    }

    // Close team modal when clicking outside
    const teamModal = document.getElementById('teamSelectionModal');
    if (teamModal) {
        teamModal.addEventListener('click', function(event) {
            if (event.target === teamModal) {
                closeTeamSelectionModal();
            }
        });
    }

    // Player selection modal event listeners
    const closePlayerSelectionBtn = document.getElementById('closePlayerSelectionModal');
    if (closePlayerSelectionBtn) {
        closePlayerSelectionBtn.addEventListener('click', closePlayerSelectionModal);
    }

    const cancelPlayerSelectionBtn = document.getElementById('cancelPlayerSelection');
    if (cancelPlayerSelectionBtn) {
        cancelPlayerSelectionBtn.addEventListener('click', closePlayerSelectionModal);
    }

    // Close player selection modal when clicking outside
    const playerSelectionModal = document.getElementById('playerSelectionModal');
    if (playerSelectionModal) {
        playerSelectionModal.addEventListener('click', function(event) {
            if (event.target === playerSelectionModal) {
                closePlayerSelectionModal();
            }
        });
    }
}

// ========================================
// SHARED EMPTY SLOT AND PLAYER CARD FUNCTIONS
// Used by both create-team and transfers pages
// ========================================

// Shared function to create an empty slot (used by both create-team and transfers)
function createEmptySlot(cardElement, originalPlayerId, setupClickHandler = true) {
    console.log('createEmptySlot called with setupClickHandler:', setupClickHandler);
    
    // Store position and style before clearing
    const cardTop = cardElement.style.top;
    const cardLeft = cardElement.style.left;
    const cardPosition = cardElement.style.position;
    
    // Completely remove all event listeners by cloning the element
    const newCard = cardElement.cloneNode(false); // Clone without children
    
    // Restore positioning
    newCard.style.position = cardPosition;
    newCard.style.top = cardTop;
    newCard.style.left = cardLeft;
    
    // Replace the old element with the clean one
    cardElement.parentNode.replaceChild(newCard, cardElement);
    
    // Clear all classes and add empty slot class
    newCard.className = 'player-card empty-slot';

    // Add marker to identify this slot was created from a specific player
    if (originalPlayerId) {
        newCard.dataset.convertedFromPlayer = originalPlayerId;
    }

    // Create + symbol
    const plusSymbol = document.createElement('div');
    plusSymbol.className = 'plus-symbol';
    plusSymbol.textContent = '+';
    newCard.appendChild(plusSymbol);

    // Determine position based on card location
    let position = 'DF'; // Default
    if (cardTop === '10%') position = 'GK';
    else if (cardTop === '30%') position = 'DF';
    else if (cardTop === '50%') position = 'MD';
    else if (cardTop === '70%') position = 'AT';
    else if (cardTop === '90%') position = 'SUB';

    const positionDiv = document.createElement('div');
    positionDiv.className = 'empty-slot-position';
    positionDiv.textContent = position;
    newCard.appendChild(positionDiv);

    // Only set up click handler if requested
    if (setupClickHandler) {
        console.log('Setting up click handler for empty slot position:', position);
        
        // Add a flag to prevent immediate triggering
        let justCreated = true;
        setTimeout(() => { justCreated = false; }, 50);
        
        // Set up click handler for empty slot
        newCard.clickHandler = (event) => {
            if (justCreated) {
                console.log('Blocking click event because slot was just created');
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            currentTransferSlot = newCard;
            openTeamSelectionModal(position);
        };
        newCard.addEventListener('click', newCard.clickHandler);
        console.log('Click handler set up successfully');
    } else {
        console.log('Skipping click handler setup as requested');
    }
    
    // Return the new element so calling code can reference it
    return newCard;
}

// Shared function to convert empty slot to player card (used by both create-team and transfers)
function convertEmptySlotToPlayerCard(emptySlot, player) {
    // Remove empty slot styling and content
    emptySlot.classList.remove('empty-slot');
    emptySlot.innerHTML = '';

    // Remove old click handler
    if (emptySlot.clickHandler) {
        emptySlot.removeEventListener('click', emptySlot.clickHandler);
    }

    // Determine the correct context for the player card
    let context = 'selection'; // Default to selection (shows price)
    
    // Both create-team and transfers pages should show price for decision making
    // Use the shared createPlayerCard function for consistency
    const newPlayerCard = createPlayerCard(player, context);
    
    // Copy all the content and properties from the new card to the existing slot
    emptySlot.className = newPlayerCard.className;
    emptySlot.innerHTML = newPlayerCard.innerHTML;
    
    // Copy all attributes
    Array.from(newPlayerCard.attributes).forEach(attr => {
        emptySlot.setAttribute(attr.name, attr.value);
    });
    
    // Copy event listeners by recreating them based on context
    if (context === 'selection') {
        // Selection page click handler
        emptySlot.clickHandler = () => {
            if (typeof openPlayerModal === 'function') {
                openPlayerModal(player);
            }
        };
        emptySlot.addEventListener('click', emptySlot.clickHandler);
    }

    return emptySlot;
}

// ========================================
// SHARED AUTO PICK BUTTON MANAGEMENT
// ========================================
function updateAutoPickButtons() {
    const buttons = [];
    const draftBtn = document.getElementById('autoCompleteBtn');
    if (draftBtn) buttons.push(draftBtn);
    const transfersBtn = document.getElementById('autoCompleteTransfersBtn');
    if (transfersBtn) buttons.push(transfersBtn);

    if (buttons.length === 0) return;

    const emptySlotCount = document.querySelectorAll('.empty-slot').length;
    const hasEmpty = emptySlotCount > 0;

    buttons.forEach(btn => {
        btn.disabled = !hasEmpty;
        btn.textContent = 'Auto Pick';
        btn.classList.toggle('disabled', !hasEmpty);
    });
}

window.updateAutoPickButtons = updateAutoPickButtons;

// ========================================
// TOAST NOTIFICATIONS (shared)
// ========================================
function showTransientToast(message, { type = 'success', duration = 4000 } = {}) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.setProperty('--toast-duration', `${duration}ms`);
    toast.textContent = message;

    container.appendChild(toast);

    // Remove after animation completes (duration + out animation buffer)
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        if (container && container.children.length === 0) {
            container.parentNode.removeChild(container);
        }
    }, duration + 1000);
}
window.showTransientToast = showTransientToast;
