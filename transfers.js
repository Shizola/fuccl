// Use shared data cache from common.js
const dataCache = sharedDataCache;

// Transfers-specific state
let teamBudget = 100.0; // Starting budget in millions
let freeTransfers = 1;
let transfersMade = 0;
let maxTransfers = 5;

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

    // Load the current team
    loadPlayersFromPlayFab(function(error, data) {
        if (error) {
            console.error("Error loading team data:", error);
            alert("Failed to load your team data. Please try again.");
            return;
        }

        console.log("Team data loaded successfully:", data);
        
        // Update transfers display with current team data
        if (data.players && data.players.length > 0) {
            updateTransfersDisplay(data.gameWeek, data.weeklyPointsTotal, data.cumulativePointsTotal, data.players);
        }
        
        // Render the current team on the pitch
        if (data.players && data.players.length > 0) {
            renderPlayersOnPitch(data.players, data.selectedPlayerIds);
        } else {
            console.log("No team found, redirecting to create team");
            window.location.href = 'create-team.html';
        }
    });

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
    const modalPlayerPrice = document.getElementById('modalPlayerPrice');

    if (modal && modalPlayerName && modalPlayerTeam && modalPlayerPosition && modalPlayerPrice) {
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

// Function to create an empty slot (grey square with + and position)
function createEmptySlot(cardElement, originalPlayerId) {
    // Clear the existing content
    cardElement.innerHTML = '';
    
    // Add empty slot class
    cardElement.classList.add('empty-slot');
    
    // Create + symbol
    const plusSymbol = document.createElement('div');
    plusSymbol.className = 'plus-symbol';
    plusSymbol.textContent = '+';
    cardElement.appendChild(plusSymbol);
    
    // Determine position based on card location
    // Get the player's position from the card's position in the formation
    let position = 'DF'; // Default
    const cardTop = cardElement.style.top;
    
    if (cardTop === '10%') position = 'GK';
    else if (cardTop === '30%') position = 'DF';
    else if (cardTop === '50%') position = 'MD';
    else if (cardTop === '70%') position = 'AT';
    else if (cardTop === '90%') position = 'SUB';
    
    // Add position text
    const positionDiv = document.createElement('div');
    positionDiv.className = 'empty-slot-position';
    positionDiv.textContent = position;
    cardElement.appendChild(positionDiv);
    
    // Update click handler for empty slot
    if (cardElement.clickHandler) {
        cardElement.removeEventListener('click', cardElement.clickHandler); // Remove old listener
    }
    
    cardElement.clickHandler = () => {
        console.log('Empty slot clicked - show available players for position:', position);
        // TODO: Show available players modal for this position
        alert(`Show available ${position} players (to be implemented)`);
    };
    
    cardElement.addEventListener('click', cardElement.clickHandler);
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
});
