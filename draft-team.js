// ========================================
// DRAFT TEAM PAGE - SPECIFIC FUNCTIONALITY
// Uses shared player-selection.js for common functionality
// ========================================

// Draft Team specific state
let teamBudget = 100.0; // Starting budget in millions
let selectedPlayerCount = 0;
const requiredPlayers = 15;

// Temporary array to track team during drafting
let draftSelectedPlayers = [];

// Store original selectedPlayers for debugging
window.selectedPlayers = [];

// Make draftSelectedPlayers globally accessible for player-selection.js
window.draftSelectedPlayers = draftSelectedPlayers;

// ========================================
// DRAFT-SPECIFIC FUNCTIONS
// ========================================

// Function to display empty team slots for initial selection
function displayEmptyTeamForDraft() {
    console.log("Displaying empty team for initial draft...");

    // Update budget display (starting budget)
    updateDraftDisplay();

    // Create empty slots for initial team selection
    renderEmptyTeamSlots(openTeamSelectionModal);
}

// Function to update the draft display elements
function updateDraftDisplay() {
    // Update budget display
    const budgetElement = document.getElementById('teamBudget');
    if (budgetElement) {
        budgetElement.textContent = teamBudget.toFixed(1);
    }

    // Update budget section styling based on budget status
    const budgetSection = document.querySelector('.budget-section');
    if (budgetSection) {
        if (teamBudget < 0) {
            budgetSection.classList.add('over-budget');
        } else {
            budgetSection.classList.remove('over-budget');
        }
    }

    // Update save button state
    const saveBtn = document.getElementById('saveDraftBtn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Submit Squad';
    }

    console.log(`Updated draft display - Budget: £${teamBudget.toFixed(1)}m, Players: ${selectedPlayerCount}/${requiredPlayers}`);

    // Prevent any accidental modal openings during display updates
    // This ensures that updating the display doesn't trigger unwanted modals
}

// Function to validate the draft form
function validateDraftForm() {
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();

    return teamName.length >= 2 && teamName.length <= 30 &&
           managerName.length >= 2 && managerName.length <= 20;
}

// Function to validate squad rules
function validateSquadRules() {
    const errors = [];

    // Check budget
    if (teamBudget < 0) {
        errors.push(`Your squad budget has been exceeded by £${Math.abs(teamBudget).toFixed(1)}m. Please remove some players or select cheaper alternatives.`);
    }

    // Check formation requirements for 4-4-2
    const players = draftSelectedPlayers.map(id => allPlayersCache.find(p => p.id === id)).filter(p => p);
    const positionCounts = {
        goalkeeper: players.filter(p => p.position === 'goalkeeper').length,
        defender: players.filter(p => p.position === 'defender').length,
        midfielder: players.filter(p => p.position === 'midfielder').length,
        attacker: players.filter(p => p.position === 'attacker').length
    };

    console.log('Position counts for 4-4-2 validation:', positionCounts);

    // Check minimum requirements for 4-4-2 formation (1+1 GK, 4+1 DF, 4+1 MD, 2+1 AT)
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

    // Check maximum requirements
    if (positionCounts.goalkeeper > 2) {
        errors.push('You can only have 2 goalkeepers maximum.');
    }
    if (positionCounts.defender > 5) {
        errors.push('You can only have 5 defenders maximum.');
    }
    if (positionCounts.midfielder > 5) {
        errors.push('You can only have 5 midfielders maximum.');
    }
    if (positionCounts.attacker > 3) {
        errors.push('You can only have 3 attackers maximum.');
    }

    // Check club limits (max 3 players per club)
    const clubCounts = {};
    draftSelectedPlayers.forEach(playerId => {
        const player = allPlayersCache.find(p => p.id === playerId);
        if (player) {
            clubCounts[player.teamName] = (clubCounts[player.teamName] || 0) + 1;
        }
    });

    console.log('Club counts for validation:', clubCounts);

    for (const [clubName, count] of Object.entries(clubCounts)) {
        if (count > 3) {
            errors.push(`You have ${count} players from ${clubName}. The maximum allowed is 3 players per club.`);
            console.log(`Club limit violation: ${clubName} has ${count} players`);
        }
    }

    return errors;
}

// Function to organize players into 4-4-2 formation
function organizePlayersInto442Formation(selectedPlayerIds) {
    // Get player objects from cache
    const players = selectedPlayerIds.map(id => allPlayersCache.find(p => p.id === id)).filter(p => p);
    
    // Group players by position
    const goalkeepers = players.filter(p => p.position === 'goalkeeper');
    const defenders = players.filter(p => p.position === 'defender');
    const midfielders = players.filter(p => p.position === 'midfielder');
    const attackers = players.filter(p => p.position === 'attacker');
    
    console.log('Formation organization:', {
        goalkeepers: goalkeepers.length,
        defenders: defenders.length,
        midfielders: midfielders.length,
        attackers: attackers.length
    });
    
    // Validate we have enough players for 4-4-2 formation
    if (goalkeepers.length < 1 || defenders.length < 4 || midfielders.length < 4 || attackers.length < 2) {
        console.error('Invalid formation - not enough players for 4-4-2');
        return selectedPlayerIds; // Return original if validation fails
    }
    
    // Create 4-4-2 formation: 1 GK, 4 DF, 4 MD, 2 AT (starting XI)
    const startingXI = [
        goalkeepers[0].id,           // 1 GK
        ...defenders.slice(0, 4).map(p => p.id),     // 4 DF
        ...midfielders.slice(0, 4).map(p => p.id),   // 4 MD
        ...attackers.slice(0, 2).map(p => p.id)      // 2 AT
    ];
    
    // Create substitutes: remaining players (1 GK, 1 DF, 1 MD, 1 AT)
    const substitutes = [
        ...(goalkeepers.length > 1 ? [goalkeepers[1].id] : []),         // Sub GK
        ...(defenders.length > 4 ? [defenders[4].id] : []),             // Sub DF
        ...(midfielders.length > 4 ? [midfielders[4].id] : []),         // Sub MD
        ...(attackers.length > 2 ? [attackers[2].id] : [])              // Sub AT
    ];
    
    const organizedFormation = [...startingXI, ...substitutes];
    
    console.log('4-4-2 Formation organized:', {
        startingXI: startingXI.length,
        substitutes: substitutes.length,
        total: organizedFormation.length
    });
    
    return organizedFormation;
}

// Function to show error modal with validation messages
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

// Function to close error modal
function closeErrorModal() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.close();
    }
}

// Function to show confirmation modal
function showConfirmationModal() {
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();
    
    // Populate team info
    document.getElementById('confirmTeamName').textContent = teamName || 'Not set';
    document.getElementById('confirmManagerName').textContent = managerName || 'Not set';
    
    // Show modal
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.showModal();
    }
}

// Function to close confirmation modal
function closeConfirmationModal() {
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.close();
    }
}

// Function to handle squad confirmation
function confirmSquad() {
    // Close confirmation modal
    closeConfirmationModal();
    
    // Validate squad rules (budget and club limits) - basic validation already done
    const validationErrors = validateSquadRules();
    if (validationErrors.length > 0) {
        showErrorModal(validationErrors);
        return;
    }

    saveDraftTeam();
}

// Function to handle draft team submission
function handleDraftTeamSubmit(event) {
    event.preventDefault();
    
    // Validate before showing confirmation modal
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();
    
    const errors = [];
    
    if (!teamName || teamName.length < 2) {
        errors.push('Please enter a valid team name (minimum 2 characters).');
    }
    
    if (!managerName || managerName.length < 2) {
        errors.push('Please enter a valid manager name (minimum 2 characters).');
    }
    
    if (selectedPlayerCount < requiredPlayers) {
        errors.push(`Please select ${requiredPlayers - selectedPlayerCount} more players to complete your team.`);
    }
    
    // Validate squad rules (budget and club limits)
    const squadErrors = validateSquadRules();
    errors.push(...squadErrors);
    
    if (errors.length > 0) {
        showErrorModal(errors);
        return;
    }
    
    // If all validation passes, show confirmation modal
    showConfirmationModal();
}// Function to save the draft team
function saveDraftTeam() {
    const teamName = document.getElementById('teamName').value.trim();
    const managerName = document.getElementById('managerName').value.trim();

    console.log('Saving draft team:', { teamName, managerName, selectedPlayers: draftSelectedPlayers });

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

        // Then save team info to user data
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

            // Organize players into proper 4-4-2 formation before saving
            const organizedPlayers = organizePlayersInto442Formation(draftSelectedPlayers);
            console.log('Original draft order:', draftSelectedPlayers);
            console.log('4-4-2 organized order:', organizedPlayers);

            // Finally save selected players in 4-4-2 formation
            const selectedPlayersData = {
                selectedPlayers: JSON.stringify(organizedPlayers)
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
                alert("Team created successfully! Redirecting to team selection.");
                window.location.href = "pick-team.html";
            });
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

// Function to auto-complete the team
function autoCompleteTeam() {
    console.log('Starting auto-complete process...');

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
        draftSelectedPlayers.forEach(playerId => {
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
        const maxSpendForThisSlot = teamBudget - minBudgetForOtherSlots;

        console.log(`Position ${position}: Budget=${teamBudget.toFixed(1)}m, MinForOthers=${minBudgetForOtherSlots.toFixed(1)}m, MaxSpend=${maxSpendForThisSlot.toFixed(1)}m`);

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
            const notSelected = !draftSelectedPlayers.includes(player.id);

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

            // Add to draft
            draftSelectedPlayers.push(selectedPlayer.id);
            selectedPlayerCount++;
            teamBudget -= selectedPlayer.price;
            budgetUsed += selectedPlayer.price;

            // Update remaining slots count
            remainingSlots[position]--;
            if (remainingSlots[position] === 0) {
                delete remainingSlots[position];
            }

            // Update the slot visually
            addPlayerToSlot(slot, selectedPlayer);
            slotsFilled++;

            console.log(`Auto-selected ${selectedPlayer.name} (${position}) for £${selectedPlayer.price}m. Remaining budget: £${teamBudget.toFixed(1)}m`);
        } else {
            console.log(`No suitable players found for position ${position} within budget constraints (max spend: £${maxSpendForThisSlot.toFixed(1)}m)`);
        }
    });

    // Update display
    updateDraftDisplay();

    console.log(`Auto-complete finished: ${slotsFilled} slots filled, £${budgetUsed.toFixed(1)}m spent, £${teamBudget.toFixed(1)}m remaining`);

    if (slotsFilled > 0) {
        updateDraftDisplay();
    } else {
        alert('No suitable players found to fill the remaining slots within budget constraints.');
    }
}

// ========================================
// OVERRIDE SHARED FUNCTIONS
// ========================================

// Override the shared selectPlayerFromTeam function for draft-specific logic
function selectPlayerFromTeam(player) {
    console.log('Selected player:', player.name, 'Price:', player.price, 'Points:', player.points);

    // Add player to draft (no validation on selection - validation happens on submit)
    if (!draftSelectedPlayers.includes(player.id)) {
        draftSelectedPlayers.push(player.id);
        selectedPlayerCount++;
        teamBudget -= player.price;

        console.log(`Added ${player.name} to draft for £${player.price}m`);

        // Update the slot visually
        if (currentTransferSlot) {
            addPlayerToSlot(currentTransferSlot, player);
        }

        updateDraftDisplay();
    }

    closePlayerSelectionModal();
}

// Function to handle selling a player from the draft team
function sellPlayer(playerId) {
    console.log('sellPlayer called with playerId:', playerId);

    // Find the player in the cache
    const player = allPlayersCache.find(p => p.id === playerId);
    if (!player) {
        console.error('Player not found in cache:', playerId);
        closePlayerModal();
        return;
    }

    console.log('Found player:', player.name, 'position:', player.position);

    // Remove player from draft
    const playerIndex = window.draftSelectedPlayers.indexOf(playerId);
    if (playerIndex > -1) {
        window.draftSelectedPlayers.splice(playerIndex, 1);
        selectedPlayerCount--;
        teamBudget += player.price; // Add money back to budget

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

            // Convert back to empty slot
            playerCard.className = 'player-card empty-slot';
            playerCard.innerHTML = '';

            // Create + symbol
            const plusSymbol = document.createElement('div');
            plusSymbol.className = 'plus-symbol';
            plusSymbol.textContent = '+';
            playerCard.appendChild(plusSymbol);

            // Add position text
            const positionDiv = document.createElement('div');
            positionDiv.className = 'empty-slot-position';
            // Convert full position name back to abbreviation for display
            const positionAbbrev = {
                'goalkeeper': 'GK',
                'defender': 'DF',
                'midfielder': 'MD',
                'attacker': 'AT'
            };
            positionDiv.textContent = positionAbbrev[player.position] || player.position.toUpperCase();
            playerCard.appendChild(positionDiv);

            // Store position for later use
            playerCard.dataset.position = positionAbbrev[player.position] || player.position.toUpperCase();

            // Set up empty slot click handler ONLY after conversion is complete
            // Use setTimeout to ensure this happens after modal is fully closed
            setTimeout(() => {
                playerCard.clickHandler = () => {
                    console.log('Empty slot clicked - opening team selection modal');
                    currentTransferSlot = playerCard;
                    // Only open team selection modal if this is actually an empty slot
                    if (playerCard.classList.contains('empty-slot')) {
                        // Convert position back to abbreviation for team selection modal
                        const positionAbbrev = {
                            'goalkeeper': 'GK',
                            'defender': 'DF',
                            'midfielder': 'MD',
                            'attacker': 'AT'
                        };
                        const position = positionAbbrev[player.position] || player.position.toUpperCase();
                        openTeamSelectionModal(position);
                    }
                };
                playerCard.addEventListener('click', playerCard.clickHandler);
                console.log('Empty slot click handler set up for player:', player.name);
            }, 150);
        } else {
            console.error('Player card not found for playerId:', playerId);
        }

        updateDraftDisplay();
    } else {
        console.error('Player not found in draftSelectedPlayers:', playerId);
    }

    // Close the player modal immediately
    console.log('About to close player modal');
    closePlayerModal();
    console.log('sellPlayer function completed');

    // Add a small delay to ensure modal is fully closed before setting up new handlers
    setTimeout(() => {
        // Double-check that the modal is closed and remove any lingering event handlers
        const modal = document.getElementById('playerModal');
        if (modal && modal.open) {
            console.log('Modal still open, forcing close');
            modal.close();
        }
    }, 100);
}

// Override openPlayerSelectionModal to exclude already selected players
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

        // Load players, excluding those already in the draft
        loadPlayersFromTeam(teamName, position, playerList, draftSelectedPlayers);

        // Show the modal
        modal.showModal();
        console.log(`Opened player selection modal for ${teamName} ${position}, excluding ${draftSelectedPlayers.length} players`);
    } else {
        console.error('Player selection modal elements not found');
    }
}

// ========================================
// PAGE INITIALIZATION
// ========================================

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
    const autoCompleteBtn = document.getElementById('autoCompleteBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', handleDraftTeamSubmit);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetDraft);
    }

    if (autoCompleteBtn) {
        autoCompleteBtn.addEventListener('click', autoCompleteTeam);
    }

    // Setup shared modal listeners
    setupSharedModalListeners();

    // Setup draft-specific modal listeners
    const selectBtn = document.getElementById('selectPlayerBtn');
    if (selectBtn) {
        selectBtn.addEventListener('click', function(event) {
            // Prevent event propagation to avoid any interference
            event.preventDefault();
            event.stopPropagation();

            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            if (playerId) {
                console.log('Button clicked, playerId:', playerId, 'button text:', selectBtn.textContent);
                // Check button text to determine action
                if (selectBtn.textContent === 'Sell Player') {
                    console.log('Sell Player button clicked for playerId:', playerId);
                    sellPlayer(playerId);
                    // Prevent any further event handling
                    return false;
                } else if (selectBtn.textContent === 'Select Player') {
                    console.log('Select Player button clicked for playerId:', playerId);
                    // For selecting a player from the player info modal
                    const player = allPlayersCache.find(p => p.id === playerId);
                    if (player) {
                        // Add player to draft
                        if (!draftSelectedPlayers.includes(player.id)) {
                            draftSelectedPlayers.push(player.id);
                            selectedPlayerCount++;
                            teamBudget -= player.price;

                            console.log(`Added ${player.name} to draft for £${player.price}m`);

                            // Update the slot visually
                            if (currentTransferSlot) {
                                addPlayerToSlot(currentTransferSlot, player);
                            }

                            updateDraftDisplay();
                        }

                        // Close the player modal
                        closePlayerModal();
                    }
                }
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

    // Setup confirmation modal listeners
    const closeConfirmationModalBtn = document.getElementById('closeConfirmationModal');
    const cancelConfirmationBtn = document.getElementById('cancelConfirmationBtn');
    const confirmSquadBtn = document.getElementById('confirmSquadBtn');
    
    if (closeConfirmationModalBtn) {
        closeConfirmationModalBtn.addEventListener('click', closeConfirmationModal);
    }
    
    if (cancelConfirmationBtn) {
        cancelConfirmationBtn.addEventListener('click', closeConfirmationModal);
    }
    
    if (confirmSquadBtn) {
        confirmSquadBtn.addEventListener('click', confirmSquad);
    }

    // Close confirmation modal when clicking outside
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.addEventListener('click', function(event) {
            if (event.target === confirmationModal) {
                closeConfirmationModal();
            }
        });
    }
});

// ========================================
// FORM VALIDATION
// ========================================

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
