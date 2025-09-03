// ========================================
// TRANSFERS PAGE INITIALIZATION
// Uses shared player-selection.js for functionality
// ========================================

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
            
            // Initialize shared context for transfers with current team data
            initializePageContext('transfers', 100.0, data.selectedPlayerIds || []);
            
            // Render the current team on the pitch
            renderPlayersOnPitch(data.players, data.selectedPlayerIds, 'selection', data.captainId);

            // Update display after loading
            updateTransfersDisplay();
        }
    });

    // Setup shared modal listeners
    setupSharedModalListeners();

    // Set up confirm transfers button
    const confirmTransfersBtn = document.getElementById('confirmTransfersBtn');
    if (confirmTransfersBtn) {
        confirmTransfersBtn.addEventListener('click', handleSubmit);
        // Enable button if transfers have been made
        confirmTransfersBtn.disabled = tempTransfersMade === 0;
    }

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

    // Setup error modal listeners
    const closeErrorBtn = document.getElementById('closeErrorBtn');
    const closeErrorModalBtn = document.getElementById('closeErrorModal');
    
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', closeErrorModal);
    }
    
    if (closeErrorModalBtn) {
        closeErrorModalBtn.addEventListener('click', closeErrorModal);
    }

    // Close error modal when clicking outside
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.addEventListener('click', function(event) {
            if (event.target === errorModal) {
                closeErrorModal();
            }
        });
    }

    // Add function to update transfers display (mimicking updateDraftDisplay from create-team.js)
    function updateTransfersDisplay() {
        // Update budget display
        const budgetElement = document.getElementById('teamBudget');
        if (budgetElement) {
            budgetElement.textContent = tempBudget.toFixed(1);
        }

        // Update budget section styling based on budget status
        const budgetSection = document.querySelector('.budget-section');
        if (budgetSection) {
            budgetSection.classList.toggle('over-budget', tempBudget < 0);
        }

        // Update confirm transfers button state
        const confirmTransfersBtn = document.getElementById('confirmTransfersBtn');
        if (confirmTransfersBtn) {
            confirmTransfersBtn.disabled = tempTransfersMade === 0;
        }

    // Update Auto Fill button state - enable when there are empty slots
    const autoCompleteBtn = document.getElementById('autoCompleteTransfersBtn');
    if (autoCompleteBtn) {
        const emptySlots = document.querySelectorAll('.empty-slot');
        const hasEmptySlots = emptySlots.length > 0;
        autoCompleteBtn.disabled = !hasEmptySlots; // Disabled when NO empty slots (all filled)
        autoCompleteBtn.textContent = 'Auto Fill';
    }        // Update Reset button state - grey out if slots are the same as original selectedPlayers
        const resetBtn = document.getElementById('resetTransfersBtn'); // Assuming ID matches create-team
        if (resetBtn) {
            // Check if tempSelectedPlayers matches the original currentTeamPlayerIds
            const isUnchanged = JSON.stringify(tempSelectedPlayers.sort()) === JSON.stringify(currentTeamPlayerIds.sort());
            resetBtn.disabled = isUnchanged;
        }

        console.log(`Updated transfers display - Budget: £${tempBudget.toFixed(1)}m, Players: ${tempSelectedPlayers.length}/${11}, Transfers: ${tempTransfersMade}`);
    }

    // Add reset transfers function (adapted from resetDraft in create-team.js)
    function resetTransfers() {
        // Reset temp state to original
        tempSelectedPlayers = [...currentTeamPlayerIds];
        tempBudget = 100.0; // Reset to initial budget
        tempTransfersMade = 0;

        // Re-render the pitch with original team
        loadSharedPlayersFromPlayFab(function(error, data) {
            if (!error) {
                renderPlayersOnPitch(data.players, data.selectedPlayerIds, 'selection', data.captainId);
            }
        });

        updateTransfersDisplay();
    }

    // Add auto fill transfers function (adapted from autoPickTeam in create-team.js)
    function autoFillTransfers() {
        console.log('Starting auto-fill process...');

        // Get all empty slots
        const emptySlots = document.querySelectorAll('.empty-slot');
        if (emptySlots.length === 0) {
            alert('No empty slots to fill!');
            return;
        }

        // Load all players if not already loaded
        if (!allPlayersCache) {
            alert('Player data not loaded yet. Please wait a moment and try again.');
            return;
        }

        let slotsFilled = 0;
        let budgetUsed = 0;

        // Helper function to get current club counts
        function getClubCounts() {
            const clubCounts = {};
            tempSelectedPlayers.forEach(playerId => {
                const player = allPlayersCache.find(p => p.id === playerId);
                if (player) {
                    clubCounts[player.teamName] = (clubCounts[player.teamName] || 0) + 1;
                }
            });
            return clubCounts;
        }

        // Helper function to get minimum price for each position
        function getMinimumPrices() {
            const positionMap = {
                'GK': 'goalkeeper',
                'DF': 'defender', 
                'MD': 'midfielder',
                'AT': 'attacker'
            };

            const minPrices = {};
            
            Object.entries(positionMap).forEach(([abbrev, fullPosition]) => {
                const playersInPosition = allPlayersCache.filter(p => p.position === fullPosition);
                minPrices[abbrev] = playersInPosition.length > 0 ? 
                    Math.min(...playersInPosition.map(p => p.price || 0)) : 4.0; // Default minimum
            });

            console.log('Minimum prices by position:', minPrices);
            return minPrices;
        }

        // Get remaining slots by position
        const remainingSlots = {};
        emptySlots.forEach(slot => {
            const position = slot.dataset.position;
            if (position) {
                remainingSlots[position] = (remainingSlots[position] || 0) + 1;
            }
        });

        console.log('Remaining slots by position:', remainingSlots);

        const minimumPrices = getMinimumPrices();

        // Calculate minimum budget needed for remaining slots (excluding current slot)
        function calculateMinimumBudgetNeeded(excludePosition) {
            let minBudget = 0;
            Object.entries(remainingSlots).forEach(([pos, count]) => {
                if (pos !== excludePosition) {
                    minBudget += (minimumPrices[pos] || 4.0) * count;
                } else if (count > 1) {
                    // If there are multiple slots of the same position, account for the others
                    minBudget += (minimumPrices[pos] || 4.0) * (count - 1);
                }
            });
            return minBudget;
        }

        // Process each empty slot with budget-aware selection
        emptySlots.forEach(slot => {
            const position = slot.dataset.position;
            if (!position) return;

            // Calculate how much budget we can safely spend on this slot
            const minBudgetForOtherSlots = calculateMinimumBudgetNeeded(position);
            const spareBudget = 0.5; // Leave 0.5m spare for safety
            const maxSpendForThisSlot = tempBudget - minBudgetForOtherSlots - spareBudget;

            console.log(`Position ${position}: Budget=${tempBudget.toFixed(1)}m, MinForOthers=${minBudgetForOtherSlots.toFixed(1)}m, Spare=${spareBudget}m, MaxSpend=${maxSpendForThisSlot.toFixed(1)}m`);

            // Get current club counts
            const currentClubCounts = getClubCounts();

            // Find available players for this position
            const availablePlayers = allPlayersCache.filter(player => {
                // Check if player matches position
                const positionMap = {
                    'GK': 'goalkeeper',
                    'DF': 'defender',
                    'MD': 'midfielder',
                    'AT': 'attacker'
                };
                const targetPosition = positionMap[position] || position.toLowerCase();
                const positionMatch = player.position === targetPosition;

                // Check if player is not already selected
                const notSelected = !tempSelectedPlayers.includes(player.id);

                // Check if player is affordable AND leaves enough budget for other slots
                const affordable = player.price <= maxSpendForThisSlot;

                // Check club limit (max 3 players per club)
                const currentClubCount = currentClubCounts[player.teamName] || 0;
                const underClubLimit = currentClubCount < 3;

                return positionMatch && notSelected && affordable && underClubLimit;
            });

            if (availablePlayers.length > 0) {
                // Sort by price (most expensive first for better team quality)
                availablePlayers.sort((a, b) => (b.price || 0) - (a.price || 0));

                // Select the first available player (most expensive that fits budget constraints)
                const selectedPlayer = availablePlayers[0];

                // Add to transfers
                tempSelectedPlayers.push(selectedPlayer.id);
                tempBudget -= selectedPlayer.price;
                tempTransfersMade++;
                budgetUsed += selectedPlayer.price;

                // Update remaining slots count
                remainingSlots[position]--;
                if (remainingSlots[position] === 0) {
                    delete remainingSlots[position];
                }

                // Update the slot visually
                addPlayerToSlot(slot, selectedPlayer);
                slotsFilled++;

                console.log(`Auto-selected ${selectedPlayer.name} (${position}) for £${selectedPlayer.price}m. Remaining budget: £${tempBudget.toFixed(1)}m`);
            } else {
                console.log(`No suitable players found for position ${position} within budget constraints (max spend: £${maxSpendForThisSlot.toFixed(1)}m)`);
            }
        });

        // Update display
        updateTransfersDisplay();

        console.log(`Auto-fill finished: ${slotsFilled} slots filled, £${budgetUsed.toFixed(1)}m spent, £${tempBudget.toFixed(1)}m remaining`);

        if (slotsFilled > 0) {
            updateTransfersDisplay();
        } else {
            alert('No suitable players found to fill the remaining slots within budget constraints.');
        }
    }

    // Add reset button listener
    const resetBtn = document.getElementById('resetTransfersBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetTransfers);
    }

    // Add auto fill button listener
    const autoFillBtn = document.getElementById('autoCompleteTransfersBtn');
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', autoFillTransfers);
    }
});

