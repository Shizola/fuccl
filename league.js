// Function to get leaderboard data from PlayFab
function getLeaderboard() {
    PlayFab.ClientApi.GetLeaderboard({
        StatisticName: "PlayerTotalPoints",
        StartPosition: 0,
        MaxResultsCount: 100
    }, function(result, error) {
        if (error) {
            console.error("Error getting leaderboard:", error);
            document.getElementById('leaderboard-wrapper').innerHTML = 
                '<div class="error-message">Failed to load leaderboard data. Please try again later.</div>';
        } else {
            console.log("Leaderboard data:", result.data);
            
            // Get the current player's ID to highlight their row
            // We need to get the actual PlayFab ID, not the title ID
            PlayFab.ClientApi.GetUserData({}, function(userData, userError) {
                const currentPlayerId = userData && userData.data ? userData.data.PlayFabId : null;
                
                // Get all the PlayFab IDs from the leaderboard
                const playerIds = result.data.Leaderboard.map(entry => entry.PlayFabId);
                
                // Fetch additional metadata for all players
                getPlayersAdditionalData(playerIds, function(playerDataMap) {
                    // Process and display the leaderboard data with extra info
                    renderEnhancedLeaderboard(result.data.Leaderboard, currentPlayerId, playerDataMap);
                });
            });
        }
    });
}

// Function to get additional player data
function getPlayersAdditionalData(playerIds, callback) {
    // Get public user data for all players on the leaderboard
    PlayFab.ClientApi.GetSharedGroupData({
        Keys: playerIds,
        SharedGroupId: "LeaderboardMetadata"
    }, function(result, error) {
        const playerDataMap = {};
        
        if (error) {
            console.error("Error getting shared group data:", error);
            callback(playerDataMap); // Continue with empty map
            return;
        }
        
        // Alternative approach: Get each player's public data
        let pendingRequests = playerIds.length;
        
        if (pendingRequests === 0) {
            callback(playerDataMap);
            return;
        }
        
        playerIds.forEach(playerId => {
            PlayFab.ClientApi.GetUserData({
                PlayFabId: playerId,
                Keys: ["leaderboardInfo"]
            }, function(dataResult, dataError) {
                if (!dataError && dataResult.data && dataResult.data.Data && 
                    dataResult.data.Data.leaderboardInfo) {
                    try {
                        playerDataMap[playerId] = JSON.parse(dataResult.data.Data.leaderboardInfo.Value);
                    } catch (e) {
                        console.error("Error parsing player data for", playerId, e);
                    }
                }
                
                pendingRequests--;
                if (pendingRequests <= 0) {
                    callback(playerDataMap);
                }
            });
        });
    });
}

// Modified render function to include additional data
function renderEnhancedLeaderboard(leaderboardData, currentPlayerId, playerDataMap) {
    const leaderboardElement = document.getElementById('leaderboard-wrapper');
    if (!leaderboardElement) {
        console.error("Leaderboard wrapper element not found");
        return;
    }
    
    // Validate input data
    if (!leaderboardData || !Array.isArray(leaderboardData)) {
        leaderboardElement.innerHTML = '<div class="error-message">Invalid leaderboard data received.</div>';
        return;
    }
    
    // Clear any existing content
    leaderboardElement.innerHTML = '';
    
    // Check if we have data to display
    if (leaderboardData.length === 0) {
        leaderboardElement.innerHTML = '<div class="error-message">No leaderboard data available yet.</div>';
        return;
    }
    
    // Create table
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    
    // Add header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    const headers = ['Rank', 'Team', 'Manager', 'Points'];
    
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    
    // Add data rows
    const tbody = table.createTBody();
    leaderboardData.forEach(entry => {
        // Validate each entry
        if (!entry || typeof entry.Position !== 'number') {
            console.warn("Invalid leaderboard entry:", entry);
            return; // Skip invalid entries
        }
        
        const row = tbody.insertRow();
        
        // Highlight current user's row (only if we have a valid currentPlayerId)
        if (currentPlayerId && entry.PlayFabId === currentPlayerId) {
            row.className = 'current-user';
        }
        
        // Add rank styling for top 3
        const rankCell = row.insertCell();
        const rank = entry.Position + 1;
        rankCell.textContent = rank;
        
        if (rank <= 3) {
            rankCell.className = `rank-${rank}`;
        }
        
        // Team name - with validation
        const nameCell = row.insertCell();
        nameCell.textContent = entry.DisplayName || 'Unknown Team';
        
        // Add manager name from our additional data
        const managerCell = row.insertCell();
        const playerData = playerDataMap && playerDataMap[entry.PlayFabId];
        managerCell.textContent = playerData ? (playerData.managerName || 'Unknown') : 'Unknown';
        
        // Points - with validation
        const pointsCell = row.insertCell();
        pointsCell.textContent = entry.StatValue || 0;
    });
    
    leaderboardElement.appendChild(table);
}