// ========================================
// TRANSFERS PAGE INITIALIZATION
// Uses shared player-selection.js for functionality
// ========================================

// Initialize transfers page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Transfers page loaded");

    // Track initial free transfers (updated after data load)
    let initialFreeTransfers = 1;

    // Set temporary loading placeholders for status boxes
    try {
        const playersCountEl = document.getElementById('playersSelectedCount');
        const playersTotalEl = document.getElementById('playersSelectedTotal');
        if (playersCountEl) playersCountEl.textContent = 'Loading';
        if (playersTotalEl) playersTotalEl.textContent = ''; // hide total until loaded
        const budgetEl = document.getElementById('teamBudget');
        if (budgetEl) budgetEl.textContent = 'Loading'; // will become numeric later
        const freeTransfersEl = document.getElementById('freeTransfers');
        if (freeTransfersEl) freeTransfersEl.textContent = 'Loading';
    } catch (e) {
        console.warn('Failed setting loading placeholders', e);
    }

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
            
            // Calculate the actual remaining budget based on current team
            let initialBudget = 100.0;
            let currentTeamCost = 0;
            
            // Calculate cost of current team players
            if (data.players && data.selectedPlayerIds) {
                data.selectedPlayerIds.forEach(playerId => {
                    const player = data.players.find(p => p.id === playerId);
                    if (player && player.price) {
                        currentTeamCost += player.price;
                    }
                });
            }
            
            const actualRemainingBudget = initialBudget - currentTeamCost;
            console.log(`Current team cost: £${currentTeamCost.toFixed(1)}m, Remaining budget: £${actualRemainingBudget.toFixed(1)}m`);
            
            // Initialize shared context for transfers with correct remaining budget
            initializePageContext('transfers', actualRemainingBudget, data.selectedPlayerIds || []);
            
            // Render the current team on the pitch
            renderPlayersOnPitch(data.players, data.selectedPlayerIds, 'selection', data.captainId);

            // Set initial free transfers from user data (default 1)
            if (typeof data.freeTransfers === 'number') {
                initialFreeTransfers = data.freeTransfers;
                window.initialFreeTransfers = initialFreeTransfers; // expose if needed
                console.log('Loaded free transfers after rollover:', initialFreeTransfers, 'currentPlayerTransfersWeek:', data.currentPlayerTransfersWeek, 'gameWeek:', data.gameWeek);
            }

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
        const TOTAL_PLAYERS = 15;

        // Budget: if HTML already wraps the span with £ and m, only inject the number
        const budgetElement = document.getElementById('teamBudget');
        if (budgetElement) {
            const numeric = tempBudget.toFixed(1);
            // Always format with currency now that placeholders removed wrappers
            budgetElement.textContent = `£${numeric}m`;
            const budgetWrapper = budgetElement.closest('.budget-remaining');
            if (budgetWrapper) {
                budgetWrapper.classList.toggle('over-budget', tempBudget < 0);
            }
        }

        // Players selected: prefer separate count + total spans
        const playersCountEl = document.getElementById('playersSelectedCount');
        const playersTotalEl = document.getElementById('playersSelectedTotal');
        if (playersCountEl && playersTotalEl) {
            playersCountEl.textContent = tempSelectedPlayers.length;
            const format = playersTotalEl.getAttribute('data-format');
            if (format === 'slash') {
                playersTotalEl.textContent = `/${TOTAL_PLAYERS}`;
            } else {
                playersTotalEl.textContent = TOTAL_PLAYERS;
            }
        } else {
            // Fallback: single element (ensure NO extra /15 added here)
            const legacyPlayersEl = document.getElementById('playersSelected');
            if (legacyPlayersEl) {
                legacyPlayersEl.textContent = `${tempSelectedPlayers.length}/${TOTAL_PLAYERS}`;
            }
        }

        // Free transfers
        const freeTransfersBox = document.querySelector('.free-transfers');
        const freeTransfersValueEl = document.getElementById('freeTransfers');
        if (freeTransfersBox && freeTransfersValueEl) {
            const freeTransfersRemaining = Math.max(0, initialFreeTransfers - tempTransfersMade);
            freeTransfersValueEl.textContent = freeTransfersRemaining;
            freeTransfersBox.classList.remove('status-success', 'status-warning', 'status-neutral');
            freeTransfersBox.classList.add(freeTransfersRemaining > 0 ? 'status-neutral' : 'status-warning');
        }

        // Cost
        const costBox = document.querySelector('.cost-status');
        const costValueEl = document.getElementById('transferCost');
        if (costBox && costValueEl) {
            const paidTransfers = Math.max(0, tempTransfersMade - initialFreeTransfers);
            const cost = paidTransfers * 4;
            costValueEl.textContent = cost;
            costBox.classList.remove('status-success', 'status-warning', 'status-neutral');
            costBox.classList.add(cost === 0 ? 'status-neutral' : 'status-warning');
        }

        const confirmBtn = document.getElementById('confirmTransfersBtn');
        if (confirmBtn) confirmBtn.disabled = tempTransfersMade === 0;
        // Shared auto pick button update
        if (typeof updateAutoPickButtons === 'function') {
            updateAutoPickButtons();
        }
    }

    // Expose if needed
    window.updateTransfersDisplay = updateTransfersDisplay;

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
        // Ensure correct initial state after listeners set
        setTimeout(() => {
            if (typeof updateAutoPickButtons === 'function') updateAutoPickButtons();
        }, 0);
    }

    // ========================================
    // TRANSFERS-SPECIFIC OVERRIDES
    // ========================================

    // Override selectPlayerFromTeam for transfers context
    function selectPlayerFromTeam(player) {
        console.log('Calling transfers-specific selectPlayerFromTeam');
        // Use the consolidated global implementation from player-selection.js
        if (typeof window.selectPlayerFromTeam === 'function') {
            window.selectPlayerFromTeam(player);
        } else {
            console.warn('selectPlayerFromTeam not found globally');
        }

        // Close all modals
        closePlayerSelectionModal();
        closeTeamSelectionModal();

        // Update the display
        if (window.updateTransfersDisplay) {
            window.updateTransfersDisplay();
        }
    }
});

