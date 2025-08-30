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

    // Process each empty slot
    emptySlots.forEach(slot => {
        const position = slot.dataset.position;
        if (!position) return;

        // Find available players for this position
        const availablePlayers = allPlayersCache.filter(player => {
            // Check if player matches position
            const positionMatch = player.position === position.toLowerCase();

            // Check if player is not already selected
            const notSelected = !draftSelectedPlayers.includes(player.id);

            // Check if player is affordable
            const affordable = player.price <= teamBudget;

            return positionMatch && notSelected && affordable;
        });

        if (availablePlayers.length > 0) {
            // Sort by price (cheapest first for auto-complete to maximize budget usage)
            availablePlayers.sort((a, b) => (a.price || 0) - (b.price || 0));

            // Select the first available player (cheapest)
            const selectedPlayer = availablePlayers[0];

            // Add to draft
            draftSelectedPlayers.push(selectedPlayer.id);
            selectedPlayerCount++;
            teamBudget -= selectedPlayer.price;
            budgetUsed += selectedPlayer.price;

            // Update the slot visually
            addPlayerToSlot(slot, selectedPlayer);
            slotsFilled++;

            console.log(`Auto-selected ${selectedPlayer.name} (${position}) for £${selectedPlayer.price}m`);
        } else {
            console.log(`No available players found for position ${position}`);
        }
    });

    // Update display
    updateDraftDisplay();

    console.log(`Auto-complete finished: ${slotsFilled} slots filled, £${budgetUsed}m spent`);

    if (slotsFilled > 0) {
        alert(`Auto-completed ${slotsFilled} slots! £${budgetUsed.toFixed(1)}m spent.`);
    } else {
        alert('No suitable players found to fill the remaining slots.');
    }
}

// ========================================
// OVERRIDE SHARED FUNCTIONS
// ========================================

// Override the shared selectPlayerFromTeam function for draft-specific logic
function selectPlayerFromTeam(player) {
    console.log('Selected player:', player.name, 'Price:', player.price, 'Points:', player.points);

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
    const positionLimits = { gk: 2, df: 5, md: 5, at: 3 };
    if (positionCounts[player.position] >= positionLimits[player.position]) {
        alert(`You already have the maximum number of ${player.position.toUpperCase()} players.`);
        return;
    }

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

    closePlayerSelectionModal();
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
        selectBtn.addEventListener('click', function() {
            const modal = document.getElementById('playerModal');
            const playerId = modal.dataset.playerId;
            if (playerId) {
                selectPlayer(playerId);
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
