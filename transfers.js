// Use shared data cache from common.js
const dataCache = sharedDataCache;

// Transfers-specific state
let teamBudget = 100.0; // Starting budget in millions
let freeTransfers = 1;
let transfersMade = 0;
let maxTransfers = 5;

// Temporary array to track team during transfers
let pendingSelectedPlayers = [];

// Store original selectedPlayers for debugging
window.selectedPlayers = [];

// Function to check if cached data is still valid
function isCacheValid() {
    return dataCache.playerData && 
           dataCache.gameWeek && 
           (Date.now() - dataCache.lastFetch) < dataCache.CACHE_DURATION;
}

// Function to create a player card for the pitch
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

    // Add player price instead of position for transfers page
    const priceDiv = document.createElement('div');
    priceDiv.className = 'player-price';
    
    // Use actual player price from data
    const playerPrice = player.price || '5.0'; // Default if no price available
    priceDiv.textContent = `£${playerPrice}m`;
    
    card.appendChild(priceDiv);

    // Add click event listener to open modal
    card.clickHandler = () => {
        openPlayerModal(player);
    };
    card.addEventListener('click', card.clickHandler);

    // Store player data on the card for later reference
    card.dataset.playerId = player.id;
    card.dataset.playerName = player.name;

    return card;
}

// Function to load player data and gameweek from PlayFab (using shared function)
function loadPlayersFromPlayFab(callback) {
    // Use shared function from common.js
    loadSharedPlayersFromPlayFab(callback);
}

// Function to load current team for transfers (without points data)
function loadCurrentTeamForTransfers() {
    console.log("Loading current team for transfers...");
    
    // Get user's selected players
    PlayFab.ClientApi.GetUserData({}, function (result, error) {
        if (error) {
            console.error("Error retrieving user data:", error);
            alert("Failed to load your team. Please try again.");
            return;
        }

        // Parse the selectedPlayers
        const selectedPlayersString = result.data.Data.selectedPlayers ? result.data.Data.selectedPlayers.Value : null;
        if (!selectedPlayersString) {
            console.log("No team found, redirecting to create team");
            window.location.href = 'create-team.html';
            return;
        }

        let selectedPlayerIds;
        try {
            selectedPlayerIds = JSON.parse(selectedPlayersString);
            console.log("Current team player IDs:", selectedPlayerIds);
        } catch (e) {
            console.error("Error parsing selected players:", e);
            alert("Error loading your team data. Please try again.");
            return;
        }

        // Store original for debugging
        window.selectedPlayers = [...selectedPlayerIds];

        // Copy to pending array for transfer workflow
        pendingSelectedPlayers = [...selectedPlayerIds];

        // Get basic player data for current team (we use cached data if available)
        if (isCacheValid()) {
            // Use cached data
            const currentTeamPlayers = allPlayersCache.filter(player => 
                selectedPlayerIds.includes(player.id)
            );
            displayCurrentTeam(currentTeamPlayers, selectedPlayerIds);
        } else {
            // Load all players first, then filter for current team
            loadAllPlayers(function(error, allPlayers) {
                if (error) {
                    console.error("Error loading players:", error);
                    alert("Failed to load player data. Please try again.");
                    return;
                }
                
                const currentTeamPlayers = allPlayers.filter(player => 
                    selectedPlayerIds.includes(player.id)
                );
                displayCurrentTeam(currentTeamPlayers, selectedPlayerIds);
            });
        }
    });
}

// Function to display current team on transfers page
function displayCurrentTeam(players, selectedPlayerIds) {
    console.log(`Displaying current team: ${players.length} players`);
    
    // Update budget display (no points needed)
    updateTransfersDisplay(null, 0, 0, players);
    
    // Render players on pitch
    renderPlayersOnPitch(players, selectedPlayerIds);
}

// Cache for all players data
let allPlayersCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Track current transfer in progress
let currentTransferSlot = null; // Will store reference to the card element being filled

// Function to check if cache is valid
function isCacheValid() {
    return allPlayersCache && cacheTimestamp && 
           (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

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

// Function to update the transfers display elements
function updateTransfersDisplay(gameWeek, weeklyPointsTotal, cumulativePointsTotal, players = []) {
    // Calculate total cost of current team
    const totalTeamCost = players.reduce((total, player) => {
        return total + (player.price || 0);
    }, 0);
    
    // Calculate remaining budget (100m - team cost)
    const remainingBudget = 100.0 - totalTeamCost;
    
    // Update budget display to show remaining budget
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        budgetElement.textContent = remainingBudget.toFixed(1);
    }

    // Update transfers made
    const transfersMadeElement = document.getElementById('transfersMade');
    if (transfersMadeElement) {
        transfersMadeElement.textContent = transfersMade;
    }

    // Update free transfers
    const freeTransfersElement = document.getElementById('freeTransfers');
    if (freeTransfersElement) {
        freeTransfersElement.textContent = freeTransfers;
    }

    console.log(`Updated transfers display - Team Cost: £${totalTeamCost.toFixed(1)}m, Remaining Budget: £${remainingBudget.toFixed(1)}m, Transfers: ${transfersMade}/${maxTransfers}, Free: ${freeTransfers}`);
}

// Function to render players on the pitch
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

    // Define vertical positions for each row (no separate substitute row on transfers page)
    const positionStyles = {
        gk: { top: '10%' },
        df: { top: '30%' },
        md: { top: '50%' },
        at: { top: '70%' }
    };

    // Group players by position (no substitute separation on transfers page)
    const positions = {
        gk: [],
        df: [],
        md: [],
        at: []
    };

    // Assign ALL players to their actual positions (no main vs substitute distinction)
    players.forEach(player => {
        if (positions[player.position]) {
            positions[player.position].push(player);
        } else {
            console.warn('Unknown position for player:', player.name, player.position);
            // Default to defender if position is unknown
            positions.df.push(player);
        }
    });

    // Render players for each position
    let slotCounter = 0;
    Object.keys(positions).forEach(position => {
        const rowPlayers = positions[position];

        rowPlayers.forEach((player, index) => {
            const playerCard = createPlayerCard(player);
            // Assign slot index for tracking
            playerCard.dataset.slotIndex = slotCounter;
            slotCounter++;

            // Calculate dynamic left position to avoid overlap
            const left = `${(index + 1) * (100 / (rowPlayers.length + 1))}%`;

            // Apply inline styles for positioning
            playerCard.style.position = 'absolute';
            playerCard.style.top = positionStyles[position].top;
            playerCard.style.left = left;

            // Note: Substitute styling not shown on transfers page  
            // This is for transfer management, not team status display
            // Substitute positions will be maintained in team data structure

            // Note: Captain styling is not shown on transfers page
            // Captain will be reassigned to first player in selectedPlayerIds when transfers are confirmed

            // Add to fragment instead of DOM
            fragment.appendChild(playerCard);
        });
    });

    // Append all player cards at once to minimize layout thrashing
    pitch.appendChild(fragment);
}

// Function to confirm all transfers
function confirmAllTransfers() {
    console.log('Confirming transfers - functionality to be implemented');
    alert('Transfer confirmation functionality will be implemented here');
}

// Function to reset all pending transfers
function resetAllTransfers() {
    console.log('Resetting transfers - functionality to be implemented');
    alert('Reset transfers functionality will be implemented here');
}

// Event listeners setup
document.addEventListener('DOMContentLoaded', function() {
    console.log("Transfers page loaded");

    // Set up PlayFab authentication
    if (!setupPlayFabAuth()) {
        console.log("No session found, redirecting to login");
        window.location.href = 'login.html';
        return;
    }

    // Load team name using shared function
    loadTeamNameOnly();

    // Preload all players for transfers (cache for performance)
    console.log("Preloading all players for transfers...");
    loadAllPlayers(function(error, allPlayers) {
        if (error) {
            console.error("Error preloading players:", error);
        } else {
            console.log(`Successfully preloaded ${allPlayers.length} players`);
        }
    });

    // Load the current team composition (just for transfers, no points needed)
    loadCurrentTeamForTransfers();

    // Set up action buttons
    const confirmBtn = document.getElementById('confirmTransfersBtn');
    const resetBtn = document.getElementById('resetTransfersBtn');

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmAllTransfers);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllTransfers);
    }
});

// Clean up when leaving the page
window.addEventListener('beforeunload', function() {
    // Clean up any event listeners or timers
    console.log("Cleaning up transfers page");
});

/* ========================================
   PLAYER MODAL FUNCTIONALITY
   Functions to handle the player modal popup
   ======================================== */

// Function to open the player modal
function openPlayerModal(player) {
    const modal = document.getElementById('playerModal');
    const modalPlayerName = document.getElementById('modalPlayerName');
    const modalPlayerTeam = document.getElementById('modalPlayerTeam');
    const modalPlayerPosition = document.getElementById('modalPlayerPosition');
    const modalPlayerPoints = document.getElementById('modalPlayerPoints');
    const modalPlayerPrice = document.getElementById('modalPlayerPrice');

    if (modal && modalPlayerName && modalPlayerTeam && modalPlayerPosition && modalPlayerPoints && modalPlayerPrice) {
        // Set player information in modal
        modalPlayerName.textContent = player.name;
        modalPlayerTeam.textContent = player.teamName;
        
        // Convert position back to readable format
        const positionMap = {
            'gk': 'Goalkeeper',
            'df': 'Defender', 
            'md': 'Midfielder',
            'at': 'Attacker'
        };
        modalPlayerPosition.textContent = positionMap[player.position] || player.position;
        modalPlayerPoints.textContent = player.points || 0;
        modalPlayerPrice.textContent = (player.price || 0).toFixed(1);

        // Store current player for sell action
        modal.dataset.playerId = player.id;
        
        // Show the modal
        modal.showModal();
    }
}

// Function to close the player modal
function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    if (modal) {
        modal.close();
    }
}

// Function to sell a player
function sellPlayer(playerId) {
    console.log('Selling player with ID:', playerId);
    
    // Find the player card in the DOM using stored player ID
    const playerCards = document.querySelectorAll('.player-card');
    let targetCard = null;
    let soldPlayerPrice = 0;
    
    playerCards.forEach(card => {
        if (card.dataset.playerId === playerId) {
            targetCard = card;
            // Get the player's price from the price div
            const priceDiv = card.querySelector('.player-price');
            if (priceDiv) {
                // Extract price from text like "£4.9m"
                const priceText = priceDiv.textContent.replace('£', '').replace('m', '');
                soldPlayerPrice = parseFloat(priceText) || 0;
            }
        }
    });
    
    if (targetCard) {
        // Replace the player card with an empty slot
        createEmptySlot(targetCard, playerId);
        
        // Update the remaining budget by adding the sold player's price
        updateBudgetAfterSale(soldPlayerPrice);
    } else {
        console.error('Could not find player card for ID:', playerId);
    }
    
    closePlayerModal();
}

/* ========================================
   TEAM SELECTION MODAL FUNCTIONALITY
   ======================================== */

// Function to open team selection modal
function openTeamSelectionModal(position) {
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
        { name: 'Waterfront Community Church FC', shirt: 'images/shirts/waterfront.svg' }
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

/* ========================================
   PLAYER SELECTION MODAL FUNCTIONALITY
   ======================================== */

// Function to open player selection modal
function openPlayerSelectionModal(teamName, position) {
    const modal = document.getElementById('playerSelectionModal');
    const modalTitle = document.getElementById('playerModalTitle');
    const modalPosition = document.getElementById('playerModalPosition');
    const modalTeam = document.getElementById('playerModalTeam');
    const playerList = document.getElementById('playerSelectionList');

    if (modal && modalTitle && modalPosition && modalTeam && playerList) {
        // Set modal content
        const positionNames = {
            'GK': 'Goalkeeper',
            'DF': 'Defender',
            'MD': 'Midfielder', 
            'AT': 'Attacker'
        };
        
        modalTitle.textContent = `Select ${positionNames[position] || position}`;
        modalPosition.textContent = positionNames[position] || position;
        modalTeam.textContent = teamName;
        
        // Store selection info for later use
        modal.dataset.selectedTeam = teamName;
        modal.dataset.selectedPosition = position;
        
        // Load and display players
        loadPlayersFromTeam(teamName, position, playerList);
        
        // Show the modal
        modal.showModal();
    }
}

// Function to get current team's player IDs
function getCurrentTeamPlayerIds() {
    const playerIds = [];
    
    // Get all player cards currently on the pitch
    const playerCards = document.querySelectorAll('.player-card[data-player-id]');
    
    playerCards.forEach(card => {
        const playerId = card.dataset.playerId;
        if (playerId) {
            playerIds.push(playerId);
        }
    });
    
    console.log('Current team player IDs:', playerIds);
    return playerIds;
}

// Function to load players from a specific team and position
function loadPlayersFromTeam(teamName, position, playerListContainer) {
    // Show loading state
    playerListContainer.innerHTML = '<p>Loading players...</p>';
    
    // Use cached data if available, otherwise load all players
    if (isCacheValid()) {
        filterAndDisplayPlayers(allPlayersCache, teamName, position, playerListContainer);
    } else {
        loadAllPlayers(function(error, allPlayers) {
            if (error) {
                console.error("Error loading player data:", error);
                playerListContainer.innerHTML = '<p>Error loading players. Please try again.</p>';
                return;
            }
            
            filterAndDisplayPlayers(allPlayers, teamName, position, playerListContainer);
        });
    }
}

// Helper function to filter and display players
function filterAndDisplayPlayers(allPlayers, teamName, position, playerListContainer) {
    // Get current team's player IDs to exclude them from purchase options
    const currentTeamPlayerIds = getCurrentTeamPlayerIds();
    
    // Filter players by team and position
    const positionMap = {
        'GK': 'gk',
        'DF': 'df',
        'MD': 'md',
        'AT': 'at'
    };
    
    const targetPosition = positionMap[position];
    console.log(`Filtering for team: ${teamName}, position: ${targetPosition}`);
    
    const filteredPlayers = allPlayers.filter(player => {
        // Filter by team and position
        const matchesTeamAndPosition = player.teamName === teamName && player.position === targetPosition;
        
        // Exclude players already in the current team
        const notInCurrentTeam = !currentTeamPlayerIds.includes(player.id);
        
        return matchesTeamAndPosition && notInCurrentTeam;
    });

    console.log(`Found ${filteredPlayers.length} available players for ${teamName} ${position} (excluding current team)`);

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

        // Add click handler
        playerOption.addEventListener('click', () => {
            selectPlayerFromTeam(player);
        });

        container.appendChild(playerOption);
    });
}

// Function to handle player selection
function selectPlayerFromTeam(player) {
    console.log('Selected player:', player.name, 'Price:', player.price, 'Points:', player.points);
    if (!currentTransferSlot) {
        console.error('No transfer slot selected');
        alert('Error: No slot selected for transfer');
        return;
    }
    const budgetElement = document.getElementById('teamBudget');
    const remainingBudget = budgetElement ? parseFloat(budgetElement.textContent) || 0 : 0;
    if (player.price > remainingBudget) {
        alert(`Cannot afford ${player.name} (£${player.price}m). You only have £${remainingBudget}m remaining.`);
        return;
    }
    // Always recalculate slot index
    const slotIndex = getSlotIndex(currentTransferSlot);
    if (typeof slotIndex !== 'number' || slotIndex === -1) {
        alert('Error: Could not determine slot index');
        return;
    }
    // Replace the player in pendingSelectedPlayers
    pendingSelectedPlayers[slotIndex] = player.id;
    // Update the card element visually (do not replace the element)
    addPlayerToSlot(currentTransferSlot, player);
    updateBudgetAfterPurchase(player.price);
    closePlayerSelectionModal();
    currentTransferSlot = null;
    console.log(`Successfully added ${player.name} to team for £${player.price}m (pending)`);
    // Debug log arrays
    console.log('selectedPlayers (original):', window.selectedPlayers);
    console.log('pendingSelectedPlayers (current):', pendingSelectedPlayers);
}

// Function to add a player to a specific slot
function addPlayerToSlot(cardElement, player) {
    // Clear empty slot styling
    cardElement.classList.remove('empty-slot');
    cardElement.innerHTML = '';
    
    // Remove old click handler
    if (cardElement.clickHandler) {
        cardElement.removeEventListener('click', cardElement.clickHandler);
        cardElement.clickHandler = null;
    }
    
    // Use the same structure as createPlayerCard but add it to existing element
    cardElement.className = 'player-card';

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

    cardElement.appendChild(shirtImg);

    // Add player name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = player.name;
    cardElement.appendChild(nameDiv);

    // Add player price
    const priceDiv = document.createElement('div');
    priceDiv.className = 'player-price';
    const playerPrice = player.price || '5.0'; // Default if no price available
    priceDiv.textContent = `£${playerPrice}m`;
    cardElement.appendChild(priceDiv);

    // Add click event listener to open modal (same as original cards)
    cardElement.clickHandler = () => {
        openPlayerModal(player);
    };
    cardElement.addEventListener('click', cardElement.clickHandler);

    // Store player data on the card for later reference
    cardElement.dataset.playerId = player.id;
    cardElement.dataset.playerName = player.name;
    
    // Preserve the slot index from the existing card element
    // (it should already be set from when the card was created)
    
    // Increment transfers made
    transfersMade++;
    updateTransfersCounter();
}

// Function to close player selection modal
function closePlayerSelectionModal() {
    const modal = document.getElementById('playerSelectionModal');
    if (modal) {
        modal.close();
    }
}

// Function to update budget after selling a player
function updateBudgetAfterSale(soldPlayerPrice) {
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        const currentBudget = parseFloat(budgetElement.textContent) || 0;
        const newBudget = currentBudget + soldPlayerPrice;
        budgetElement.textContent = newBudget.toFixed(1);
        
        console.log(`Player sold for £${soldPlayerPrice}m. Budget updated from £${currentBudget}m to £${newBudget}m`);
    }
}

// Function to update budget after buying a player
function updateBudgetAfterPurchase(playerPrice) {
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        const currentBudget = parseFloat(budgetElement.textContent) || 0;
        const newBudget = currentBudget - playerPrice;
        budgetElement.textContent = newBudget.toFixed(1);
        
        console.log(`Player bought for £${playerPrice}m. Budget updated from £${currentBudget}m to £${newBudget}m`);
    }
}

// Function to update transfers made counter
function updateTransfersCounter() {
    const transfersMadeElement = document.getElementById('transfersMade');
    if (transfersMadeElement) {
        transfersMadeElement.textContent = transfersMade;
    }
}

// Function to create an empty slot (grey square with + and position)
function createEmptySlot(cardElement, originalPlayerId) {
    // Clear the existing content
    cardElement.innerHTML = '';
    cardElement.classList.add('empty-slot');
    // Create + symbol
    const plusSymbol = document.createElement('div');
    plusSymbol.className = 'plus-symbol';
    plusSymbol.textContent = '+';
    cardElement.appendChild(plusSymbol);
    // Determine position based on card location
    let position = 'DF';
    const cardTop = cardElement.style.top;
    if (cardTop === '10%') position = 'GK';
    else if (cardTop === '30%') position = 'DF';
    else if (cardTop === '50%') position = 'MD';
    else if (cardTop === '70%') position = 'AT';
    // Add position text
    const positionDiv = document.createElement('div');
    positionDiv.className = 'empty-slot-position';
    positionDiv.textContent = position;
    cardElement.appendChild(positionDiv);
    // Update click handler for empty slot
    if (cardElement.clickHandler) {
        cardElement.removeEventListener('click', cardElement.clickHandler);
    }
    // Assign slot index for tracking
    cardElement.dataset.slotIndex = cardElement.dataset.slotIndex || getSlotIndex(cardElement);
    cardElement.clickHandler = () => {
        console.log('Empty slot clicked - show team selection for position:', position);
        currentTransferSlot = cardElement;
        openTeamSelectionModal(position);
    };
    cardElement.addEventListener('click', cardElement.clickHandler);
    // Remove from pendingSelectedPlayers
    const slotIndex = parseInt(cardElement.dataset.slotIndex);
    if (!isNaN(slotIndex) && slotIndex !== -1) {
        pendingSelectedPlayers[slotIndex] = null;
    }
    // Debug log arrays
    console.log('selectedPlayers (original):', window.selectedPlayers);
    console.log('pendingSelectedPlayers (current):', pendingSelectedPlayers);
}

// Utility: get slot index from card element
function getSlotIndex(cardElement) {
    // Use the stored slot index from the dataset instead of calculating from DOM position
    const storedIndex = parseInt(cardElement.dataset.slotIndex);
    if (!isNaN(storedIndex) && storedIndex >= 0) {
        return storedIndex;
    }

    // Fallback: Find all pitch slots (excluding the pitch image)
    const pitch = document.querySelector('.pitch');
    if (!pitch) return -1;
    const slots = Array.from(pitch.children).filter(child => child.classList.contains('player-card') || child.classList.contains('empty-slot'));
    return slots.indexOf(cardElement);
}

// Setup modal event listeners when the page loads
document.addEventListener('DOMContentLoaded', function() {
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

    // Sell player button
    const sellBtn = document.getElementById('sellPlayerBtn');
    if (sellBtn) {
        sellBtn.addEventListener('click', function() {
            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            if (playerId) {
                sellPlayer(playerId);
            }
        });
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
});
