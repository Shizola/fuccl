// ========================================
// TRANSFERS PAGE INITIALIZATION
// Uses shared player-selection.js for functionality
// ========================================

// Transfer state
let transferBudget = 100.0;
let transfersMade = 0;
let currentTeamPlayerIds = []; // Track players already in the team
// currentTransferSlot is declared in player-selection.js

// Override the selectPlayerFromTeam function for transfers logic
function selectPlayerFromTeam(player) {
    console.log('Player selected for transfer:', player.name);
    closePlayerSelectionModal();
    
    // Check if we have enough budget
    if (transferBudget < player.price) {
        alert(`Not enough budget! You need £${player.price}m but only have £${transferBudget.toFixed(1)}m`);
        return;
    }
    
    // Check if we have a current transfer slot
    if (!currentTransferSlot) {
        console.error('No transfer slot selected');
        alert('Please select an empty slot first');
        return;
    }
    
    // Buy the player - convert empty slot to player card
    buyPlayer(player, currentTransferSlot);
}

// Function to sell a player (converts player card to empty slot)
function sellPlayer(playerId) {
    console.log('Selling player with ID:', playerId);

    // Find the player card in the DOM
    const playerCard = document.querySelector(`[data-player-id="${playerId}"]`);
    if (!playerCard) {
        console.error('Could not find player card for ID:', playerId);
        return;
    }

    // Get player price for budget calculation
    const priceDiv = playerCard.querySelector('.player-price');
    let soldPlayerPrice = 0;
    if (priceDiv) {
        const priceText = priceDiv.textContent.replace('£', '').replace('m', '');
        soldPlayerPrice = parseFloat(priceText) || 0;
    }

    // Convert player card to empty slot
    createEmptySlot(playerCard, playerId);

    // Update budget
    transferBudget += soldPlayerPrice;
    transfersMade++;
    
    // Remove player from current team tracking
    const playerIndex = currentTeamPlayerIds.indexOf(playerId);
    if (playerIndex > -1) {
        currentTeamPlayerIds.splice(playerIndex, 1);
        console.log('Player removed from team. Current team player IDs:', currentTeamPlayerIds);
    }
    
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        budgetElement.textContent = (100.0 - (100.0 - transferBudget)).toFixed(1);
    }
    
    const transfersMadeElement = document.getElementById('transfersMade');
    if (transfersMadeElement) {
        transfersMadeElement.textContent = transfersMade;
    }

    console.log(`Player sold for £${soldPlayerPrice}m. Budget updated.`);
    closePlayerModal();
}

// Note: createEmptySlot function now shared in player-selection.js

// Function to buy a player (converts empty slot to player card)
function buyPlayer(player, emptySlot) {
    console.log('Buying player:', player.name, 'for slot:', emptySlot);
    console.log('Player object:', player); // Debug: log the entire player object

    // Check budget
    if (transferBudget < player.price) {
        alert(`Not enough budget! You need £${player.price}m but only have £${transferBudget.toFixed(1)}m`);
        return;
    }

    // Convert empty slot to player card using shared function
    convertEmptySlotToPlayerCard(emptySlot, player);

    // Set up click handler for player card (to show player details/sell option)
    emptySlot.clickHandler = () => {
        showPlayerModal(player);
    };
    emptySlot.addEventListener('click', emptySlot.clickHandler);

    // Update budget
    transferBudget -= player.price;
    transfersMade++;
    
    // Add player to current team tracking
    currentTeamPlayerIds.push(player.id);
    console.log('Player added to team. Current team player IDs:', currentTeamPlayerIds);
    
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        budgetElement.textContent = (100.0 - (100.0 - transferBudget)).toFixed(1);
    }
    
    const transfersMadeElement = document.getElementById('transfersMade');
    if (transfersMadeElement) {
        transfersMadeElement.textContent = transfersMade;
    }

    console.log(`Player bought for £${player.price}m. Budget updated.`);
    
    // Clear the current transfer slot
    currentTransferSlot = null;
    
    // Close any open modals
    closeTeamSelectionModal();
    closePlayerSelectionModal();
}

// Initialize transfers page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Transfers page loaded");

    // Set up PlayFab authentication
    if (!setupPlayFabAuth()) {
        console.log("No session found, redirecting to login");
        window.location.href = 'login.html';
        return;
    }

    // Load team name
    loadTeamNameOnly();

    // Preload all players for the modals
    loadAllPlayers(function(error, allPlayers) {
        if (error) {
            console.error("Error preloading players:", error);
        } else {
            console.log(`Successfully preloaded ${allPlayers.length} players`);
        }
    });

    // Load and display current team
    loadSharedPlayersFromPlayFab(function(error, data) {
        if (error) {
            console.error("Failed to load team data:", error);
            
            if (error === "No selectedPlayers key found") {
                console.log("User has no team data - redirecting to create team page");
                alert("No team found. You'll be redirected to create your team.");
                window.location.href = "create-team.html";
                return;
            }
            
            const pitch = document.querySelector('.pitch');
            if (pitch) {
                pitch.innerHTML = '<div class="error-message">Failed to load team data. Please try refreshing the page.</div>';
            }
        } else {
            console.log("Team loaded successfully for transfers page");
            // Store current team player IDs for filtering
            currentTeamPlayerIds = data.selectedPlayerIds || [];
            console.log("Current team player IDs:", currentTeamPlayerIds);
            // Render the current team on the pitch
            renderPlayersOnPitch(data.players, data.selectedPlayerIds);
        }
    });

    // Setup shared modal listeners
    setupSharedModalListeners();

    // Set up sell player button
    const sellPlayerBtn = document.getElementById('sellPlayerBtn');
    if (sellPlayerBtn) {
        sellPlayerBtn.addEventListener('click', function() {
            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            if (playerId) {
                sellPlayer(playerId);
            }
        });
    }
});

