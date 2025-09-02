// ========================================
// TRANSFERS PAGE INITIALIZATION
// Uses shared player-selection.js for functionality
// ========================================

// Transfer state
let transferBudget = 100.0;
let transfersMade = 0;

// Override the selectPlayerFromTeam function for transfers logic
function selectPlayerFromTeam(player) {
    console.log('Player selected for transfer:', player.name);
    closePlayerSelectionModal();
    // TODO: Implement buying functionality
    alert('Transfer functionality will be implemented later');
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
    playerCard.classList.add('empty-slot');
    playerCard.innerHTML = '';

    // Remove old click handler
    if (playerCard.clickHandler) {
        playerCard.removeEventListener('click', playerCard.clickHandler);
    }

    // Create empty slot content
    const plusSymbol = document.createElement('div');
    plusSymbol.className = 'plus-symbol';
    plusSymbol.textContent = '+';
    playerCard.appendChild(plusSymbol);

    // Determine position based on card location
    let position = 'DF'; // Default
    const cardTop = playerCard.style.top;
    if (cardTop === '10%') position = 'GK';
    else if (cardTop === '30%') position = 'DF';
    else if (cardTop === '50%') position = 'MD';
    else if (cardTop === '70%') position = 'AT';
    else if (cardTop === '90%') position = 'SUB';

    const positionDiv = document.createElement('div');
    positionDiv.className = 'empty-slot-position';
    positionDiv.textContent = position;
    playerCard.appendChild(positionDiv);

    // Set up click handler for empty slot
    playerCard.clickHandler = () => {
        currentTransferSlot = playerCard;
        openTeamSelectionModal(position);
    };
    playerCard.addEventListener('click', playerCard.clickHandler);

    // Update budget
    transferBudget += soldPlayerPrice;
    transfersMade++;
    
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
                console.log("User has no team data - redirecting to draft team page");
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

