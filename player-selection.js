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
// PLAYER CARD CREATION
// ========================================

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
    nameDiv.textContent = extractSurname(player.name);
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

// ========================================
// PITCH RENDERING
// ========================================

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
        goalkeeper: { top: '10%' },
        defender: { top: '30%' },
        midfielder: { top: '50%' },
        attacker: { top: '70%' }
    };

    // Group players by position
    const positions = {
        goalkeeper: [],
        defender: [],
        midfielder: [],
        attacker: []
    };

    // Assign players to their positions
    players.forEach(player => {
        if (positions[player.position]) {
            positions[player.position].push(player);
        } else {
            console.warn('Unknown position for player:', player.name, player.position);
            // Default to defender if position is unknown
            positions.defender.push(player);
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

// Placeholder function - should be overridden by page-specific logic
function selectPlayerFromTeam(player) {
    console.log('Player selected:', player.name);
    // This should be overridden by page-specific implementations
}

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
    nameDiv.textContent = extractSurname(player.name);
    cardElement.appendChild(nameDiv);

    // Add player price
    const priceDiv = document.createElement('div');
    priceDiv.className = 'player-price';
    const playerPrice = player.price || '5.0'; // Default if no price available
    priceDiv.textContent = `£${playerPrice}m`;
    cardElement.appendChild(priceDiv);

    // Add click event listener to open modal (same as original cards)
    cardElement.clickHandler = () => {
        console.log('Player card clicked - opening player modal for:', player.name);
        openPlayerModal(player);
    };
    cardElement.addEventListener('click', cardElement.clickHandler);
    console.log('Player modal click handler set up for:', player.name);

    // Store player data on the card for later reference
    cardElement.dataset.playerId = player.id;
    cardElement.dataset.playerName = player.name;

    // Preserve the slot index from the existing card element
    // (it should already be set from when the card was created)
}

// ========================================
// MODAL EVENT LISTENERS
// ========================================

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
