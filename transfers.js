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
            // Store current team player IDs for filtering and snapshot original squad & captain
            currentTeamPlayerIds = data.selectedPlayerIds || [];
            window.originalTeamPlayerIds = [...currentTeamPlayerIds];
            window.originalCaptainId = data.captainId || null;
            
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
        // Override click: run validation then open confirmation modal
        confirmTransfersBtn.addEventListener('click', function(e){
            e.preventDefault();
            // Run validation from shared handleSubmit logic but intercept
            if (typeof pageContext !== 'undefined') {
                // Reuse validation part of handleSubmit by replicating necessary logic minimally
                // We'll manually perform the same validation steps present in handleSubmit
                const errors = [];
                if (tempBudget < 0) {
                    errors.push(`Your squad budget has been exceeded by £${Math.abs(tempBudget).toFixed(1)}m. Please remove some players or select cheaper alternatives.`);
                }
                const players = tempSelectedPlayers.map(id => allPlayersCache.find(p => p.id === id)).filter(p => p);
                const positionCounts = {
                    goalkeeper: players.filter(p => p.position === 'goalkeeper').length,
                    defender: players.filter(p => p.position === 'defender').length,
                    midfielder: players.filter(p => p.position === 'midfielder').length,
                    attacker: players.filter(p => p.position === 'attacker').length
                };
                if (positionCounts.goalkeeper < 2) errors.push('You need at least 2 goalkeepers (1 starting + 1 substitute).');
                if (positionCounts.defender < 5) errors.push('You need at least 5 defenders (4 starting + 1 substitute).');
                if (positionCounts.midfielder < 5) errors.push('You need at least 5 midfielders (4 starting + 1 substitute).');
                if (positionCounts.attacker < 3) errors.push('You need at least 3 attackers (2 starting + 1 substitute).');
                const clubCounts = {};
                tempSelectedPlayers.forEach(playerId => {
                    const player = allPlayersCache.find(p => p.id === playerId);
                    if (player) {
                        clubCounts[player.teamName] = (clubCounts[player.teamName] || 0) + 1;
                    }
                });
                for (const [clubName, count] of Object.entries(clubCounts)) {
                    if (count > 3) errors.push(`You have ${count} players from ${clubName}. The maximum allowed is 3 players per club.`);
                }
                if (errors.length) {
                    showErrorModal(errors);
                    return;
                }
            }
            openTransfersConfirmation();
        });
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

    // Calculate dynamic transfer metrics via set differences
    const originalSet = new Set(window.originalTeamPlayerIds || []);
    const currentSet = new Set(tempSelectedPlayers);

    // Players added (in current but not in original)
    const added = [...currentSet].filter(id => !originalSet.has(id));
    // Players removed (in original but not in current)
    const removed = [...originalSet].filter(id => !currentSet.has(id));
    // Effective transfers is max of added vs removed (handles slot experimentation)
    const effectiveTransfers = Math.max(added.length, removed.length);
    window.effectiveTransfers = effectiveTransfers; // expose for debugging

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

            // Apply success (green) when full squad, error (red) otherwise
            const playersBox = playersCountEl.closest('.players-selected');
            if (playersBox) {
                playersBox.classList.remove('status-success', 'status-error');
                if (tempSelectedPlayers.length === TOTAL_PLAYERS) {
                    playersBox.classList.add('status-success');
                } else {
                    playersBox.classList.add('status-error');
                }
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
            const currentFreePool = (typeof window.initialFreeTransfers === 'number') ? window.initialFreeTransfers : initialFreeTransfers;
            const freeTransfersRemaining = Math.max(0, currentFreePool - effectiveTransfers);
            freeTransfersValueEl.textContent = freeTransfersRemaining;
            freeTransfersBox.classList.remove('status-success', 'status-warning', 'status-neutral');
            freeTransfersBox.classList.add(freeTransfersRemaining > 0 ? 'status-neutral' : 'status-warning');
        }

        // Cost
        const costBox = document.querySelector('.cost-status');
        const costValueEl = document.getElementById('transferCost');
        if (costBox && costValueEl) {
            const paidTransfers = Math.max(0, effectiveTransfers - initialFreeTransfers);
            const cost = paidTransfers * 4;
            costValueEl.textContent = cost;
            costBox.classList.remove('status-success', 'status-warning', 'status-neutral');
            costBox.classList.add(cost === 0 ? 'status-neutral' : 'status-warning');
        }

    const confirmBtn = document.getElementById('confirmTransfersBtn');
    if (confirmBtn) confirmBtn.disabled = effectiveTransfers === 0;
        // Shared auto pick button update
        if (typeof updateAutoPickButtons === 'function') {
            updateAutoPickButtons();
        }
    }

    // Expose if needed
    window.updateTransfersDisplay = updateTransfersDisplay;

    // Sync helper to be called after successful saveTransfers to refresh display using updated global free transfers
    window.syncFreeTransfers = function() {
        // Re-run display update; it will read window.initialFreeTransfers
        updateTransfersDisplay();
    };

    // Add reset transfers function (adapted from resetDraft in create-team.js)
    function resetTransfers() {
        console.log('Resetting transfers to original snapshot');
        if (!window.originalTeamPlayerIds) {
            console.warn('No original snapshot found; aborting reset');
            return;
        }

        // Restore selected players to original snapshot
        tempSelectedPlayers = [...window.originalTeamPlayerIds];
        currentTeamPlayerIds = [...window.originalTeamPlayerIds];

        // Recompute remaining budget based on original squad prices
        if (!allPlayersCache) {
            console.warn('Player cache not ready; attempting to load before reset render');
            loadAllPlayers(function() {
                resetTransfers(); // retry after cache loads
            });
            return;
        }

        const initialBudget = 100.0;
        let squadCost = 0;
        tempSelectedPlayers.forEach(id => {
            const p = allPlayersCache.find(pl => pl.id === id);
            if (p && p.price) squadCost += p.price;
        });
        tempBudget = +(initialBudget - squadCost).toFixed(1);

        // Zero any pending effective transfer cost by restoring snapshot
        tempTransfersMade = 0; // legacy var
        window.effectiveTransfers = 0;

        // Restore free transfers display from initial loaded value
        if (typeof window.initialFreeTransfers === 'number') {
            // nothing to change; just use existing initialFreeTransfers
        }

        // Re-render pitch using cached players in same order as original snapshot
        const orderedPlayers = tempSelectedPlayers
            .map(id => allPlayersCache.find(p => p.id === id))
            .filter(Boolean);
        renderPlayersOnPitch(orderedPlayers, tempSelectedPlayers, 'selection', window.originalCaptainId);

        // Update UI
        updateTransfersDisplay();
        console.log('Reset complete: players', tempSelectedPlayers.length, 'budget', tempBudget);
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

    // Confirmation modal logic
    function openTransfersConfirmation(){
        const modal = document.getElementById('confirmTransfersModal');
        if(!modal) return;

        const originalSet = new Set(window.originalTeamPlayerIds || []);
        const currentSet = new Set(tempSelectedPlayers);
        const addedIds = [...currentSet].filter(id => !originalSet.has(id));
        const removedIds = [...originalSet].filter(id => !currentSet.has(id));
        const effectiveTransfers = Math.max(addedIds.length, removedIds.length);
        const freeAvail = typeof window.initialFreeTransfers === 'number' ? window.initialFreeTransfers : 1;
        const paid = Math.max(0, effectiveTransfers - freeAvail);
        const costPts = paid * 4;

        const outList = document.getElementById('transfersOutList');
        const inList = document.getElementById('transfersInList');
        const summaryWrapper = document.getElementById('transfersSummary');
        const noChangesMessage = document.getElementById('noChangesMessage');
        const pointsCostEl = document.getElementById('pointsCost');

        if(addedIds.length === 0 && removedIds.length === 0){
            summaryWrapper.style.display='none';
            noChangesMessage.style.display='block';
        } else {
            summaryWrapper.style.display='block';
            noChangesMessage.style.display='none';
        }

        function playerLabel(id){
            const p = allPlayersCache ? allPlayersCache.find(pl=>pl.id===id) : null;
            if(!p) return id;
            return `${p.name} (£${(p.price||0).toFixed(1)}m)`;
        }

        if(outList){
            outList.innerHTML = removedIds.map(id => `<li>${playerLabel(id)}</li>`).join('') || '<li><em>None</em></li>';
        }
        if(inList){
            inList.innerHTML = addedIds.map(id => `<li>${playerLabel(id)}</li>`).join('') || '<li><em>None</em></li>';
        }
        if(pointsCostEl) pointsCostEl.textContent = costPts;

        // Disable confirm if no net changes
        const executeBtn = document.getElementById('confirmTransfersExecuteBtn');
        if(executeBtn) executeBtn.disabled = effectiveTransfers === 0;

        modal.showModal();
    }

    // Modal button listeners
    const cancelConfirmTransfersBtn = document.getElementById('cancelConfirmTransfersBtn');
    if(cancelConfirmTransfersBtn){
        cancelConfirmTransfersBtn.addEventListener('click', ()=>{
            const m = document.getElementById('confirmTransfersModal');
            if(m) m.close();
        });
    }
    const executeTransfersBtn = document.getElementById('confirmTransfersExecuteBtn');
    if(executeTransfersBtn){
        executeTransfersBtn.addEventListener('click', function(){
            // Proceed with save
            saveTransfers();
            const m = document.getElementById('confirmTransfersModal');
            if(m) m.close();
        });
    }

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

