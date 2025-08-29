// Draft Team specific state
let teamBudget = 100.0; // Starting budget in millions
let selectedPlayerCount = 0;
const requiredPlayers = 11;

// Temporary array to track team during drafting
let draftSelectedPlayers = [];

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

    // Add player price
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

// Function to display empty team slots for initial selection
function displayEmptyTeamForDraft() {
    console.log("Displaying empty team for initial draft...");

    // Update budget display (starting budget)
    updateDraftDisplay();

    // Create empty slots for initial team selection
    renderEmptyTeamSlots();
}

// Function to render empty team slots for initial selection
function renderEmptyTeamSlots() {
    // Get the pitch container
    const pitch = document.querySelector('.pitch');
    if (!pitch) {
        console.error("Pitch container not found - cannot render empty slots");
        return;
    }

    // Clear existing content
    pitch.innerHTML = '<img src="images/pitch.svg" alt="Football Pitch" class="pitch-image">';

    // Define positions and their layout
    const positions = [
        { pos: 'gk', top: '10%', count: 1 },
        { pos: 'df', top: '30%', count: 4 },
        { pos: 'md', top: '50%', count: 4 },
        { pos: 'at', top: '70%', count: 2 }
    ];

    let slotIndex = 0;

    positions.forEach(position => {
        for (let i = 0; i < position.count; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'player-card empty-slot';
            emptySlot.dataset.slotIndex = slotIndex;
            emptySlot.dataset.position = position.pos;

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
            emptySlot.addEventListener('click', () => {
                currentTransferSlot = emptySlot;
                openTeamSelectionModal(position.pos.toUpperCase());
            });

            pitch.appendChild(emptySlot);
            slotIndex++;
        }
    });

    console.log("Rendered empty team slots for draft");
}

// Function to update the draft display elements
function updateDraftDisplay() {
    // Update budget display
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        budgetElement.textContent = teamBudget.toFixed(1);
    }

    // Update save button state
    const saveBtn = document.getElementById('saveDraftBtn');
    if (saveBtn) {
        const isFormValid = validateDraftForm();
        const hasEnoughPlayers = selectedPlayerCount >= requiredPlayers;
        saveBtn.disabled = !(isFormValid && hasEnoughPlayers);

        if (hasEnoughPlayers && isFormValid) {
            saveBtn.textContent = 'Save Team';
        } else if (!hasEnoughPlayers) {
            saveBtn.textContent = `Select ${requiredPlayers - selectedPlayerCount} More Players`;
        } else {
            saveBtn.textContent = 'Complete Team Info';
        }
    }

    console.log(`Updated draft display - Budget: £${teamBudget.toFixed(1)}m, Players: ${selectedPlayerCount}/${requiredPlayers}`);
}

// Function to validate the draft form
function validateDraftForm() {
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();

    return teamName.length >= 2 && teamName.length <= 30 &&
           managerName.length >= 2 && managerName.length <= 20;
}

// Function to handle draft team submission
function handleDraftTeamSubmit(event) {
    event.preventDefault();

    if (!validateDraftForm()) {
        alert('Please fill in your team name and manager name correctly.');
        return;
    }

    if (selectedPlayerCount < requiredPlayers) {
        alert(`Please select ${requiredPlayers - selectedPlayerCount} more players to complete your team.`);
        return;
    }

    saveDraftTeam();
}

// Function to save the draft team
function saveDraftTeam() {
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();

    console.log('Saving draft team:', { teamName, managerName, selectedPlayers: draftSelectedPlayers });

    // First save team info
    const teamData = {
        teamName: teamName,
        managerName: managerName
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

        // Then save selected players
        const selectedPlayersData = {
            selectedPlayers: JSON.stringify(draftSelectedPlayers)
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
            alert("Team created successfully! Redirecting to your dashboard.");
            window.location.href = "points.html";
        });
    });
}

// Function to reset the draft
function resetDraft() {
    if (confirm('Are you sure you want to reset your draft? This will clear all selected players.')) {
        // Reset form
        document.getElementById('teamName').value = '';
        document.getElementById('managerName').value = '';

        // Reset budget and player count
        teamBudget = 100.0;
        selectedPlayerCount = 0;
        draftSelectedPlayers = [];

        // Re-render empty slots
        displayEmptyTeamForDraft();

        console.log('Draft reset successfully');
    }
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

    // Define vertical positions for each row
    const positionStyles = {
        gk: { top: '10%' },
        df: { top: '30%' },
        md: { top: '50%' },
        at: { top: '70%' }
    };

    // Group players by position
    const positions = {
        gk: [],
        df: [],
        md: [],
        at: []
    };

    // Assign players to their positions
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
    console.log("Draft Team page loaded");

    // Set up PlayFab authentication
    if (!setupPlayFabAuth()) {
        console.log("No session found, redirecting to login");
        window.location.href = 'login.html';
        return;
    }

    // Set up form validation and character counters
    setupFormValidation();

    // Preload all players for draft (cache for performance)
    console.log("Preloading all players for draft...");
    loadAllPlayers(function(error, allPlayers) {
        if (error) {
            console.error("Error preloading players:", error);
        } else {
            console.log(`Successfully preloaded ${allPlayers.length} players`);
        }
    });

    // Display empty team for drafting
    displayEmptyTeamForDraft();

    // Set up action buttons
    const saveBtn = document.getElementById('saveDraftBtn');
    const resetBtn = document.getElementById('resetDraftBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', handleDraftTeamSubmit);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetDraft);
    }
});

// Function to set up form validation and character counters
function setupFormValidation() {
    const teamNameInput = document.getElementById('teamName');
    const managerNameInput = document.getElementById('managerName');
    const teamCounter = document.getElementById('teamNameCounter');
    const managerCounter = document.getElementById('managerNameCounter');

    function updateCounters() {
        const teamLength = teamNameInput.value.length;
        const managerLength = managerNameInput.value.length;

        if (teamCounter) teamCounter.textContent = `${teamLength}/30`;
        if (managerCounter) managerCounter.textContent = `${managerLength}/20`;

        // Change color based on length
        if (teamCounter) {
            teamCounter.style.color = teamLength > 30 ? '#d73a49' : teamLength > 25 ? '#f9c513' : '#666';
        }
        if (managerCounter) {
            managerCounter.style.color = managerLength > 20 ? '#d73a49' : managerLength > 15 ? '#f9c513' : '#666';
        }

        // Update save button state
        updateDraftDisplay();
    }

    // Update counters on input
    if (teamNameInput) teamNameInput.addEventListener('input', updateCounters);
    if (managerNameInput) managerNameInput.addEventListener('input', updateCounters);

    // Initial update
    updateCounters();
}

// Clean up when leaving the page
window.addEventListener('beforeunload', function() {
    // Clean up any event listeners or timers
    console.log("Cleaning up draft team page");
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

        // Store current player for selection action
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

// Function to select a player
function selectPlayer(playerId) {
    console.log('Selecting player with ID:', playerId);

    // Find the player in cache
    if (!allPlayersCache) {
        console.error('Player cache not available');
        return;
    }

    const player = allPlayersCache.find(p => p.id === playerId);
    if (!player) {
        console.error('Player not found:', playerId);
        return;
    }

    // Check if player can be afforded
    if (player.price > teamBudget) {
        alert(`Cannot afford ${player.name} (£${player.price}m). You only have £${teamBudget}m remaining.`);
        return;
    }

    // Check if position is already filled (simplified - just count by position)
    const positionCounts = {
        gk: 0, df: 0, md: 0, at: 0
    };

    draftSelectedPlayers.forEach(id => {
        const p = allPlayersCache.find(player => player.id === id);
        if (p && positionCounts[p.position] !== undefined) {
            positionCounts[p.position]++;
        }
    });

    // Check position limits
    const positionLimits = { gk: 1, df: 4, md: 4, at: 2 };
    if (positionCounts[player.position] >= positionLimits[player.position]) {
        alert(`You already have the maximum number of ${player.position.toUpperCase()} players.`);
        return;
    }

    // Add player to draft
    if (!draftSelectedPlayers.includes(playerId)) {
        draftSelectedPlayers.push(playerId);
        selectedPlayerCount++;
        teamBudget -= player.price;

        console.log(`Added ${player.name} to draft for £${player.price}m`);

        // Update the slot visually
        if (currentTransferSlot) {
            addPlayerToSlot(currentTransferSlot, player);
        }

        updateDraftDisplay();
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

        // Exclude players already in the draft
        const notInDraft = !draftSelectedPlayers.includes(player.id);

        return matchesTeamAndPosition && notInDraft;
    });

    console.log(`Found ${filteredPlayers.length} available players for ${teamName} ${position} (excluding drafted players)`);

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

    // Check if player can be afforded
    if (player.price > teamBudget) {
        alert(`Cannot afford ${player.name} (£${player.price}m). You only have £${teamBudget}m remaining.`);
        return;
    }

    // Select the player
    selectPlayer(player.id);

    // Close player selection modal
    closePlayerSelectionModal();
}

// Function to close player selection modal
function closePlayerSelectionModal() {
    const modal = document.getElementById('playerSelectionModal');
    if (modal) {
        modal.close();
    }
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

    // Select player button
    const selectBtn = document.getElementById('selectPlayerBtn');
    if (selectBtn) {
        selectBtn.addEventListener('click', function() {
            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            if (playerId) {
                selectPlayer(playerId);
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
