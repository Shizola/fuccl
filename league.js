// Function to check if the user's team name is set
function checkTeamName() {
    PlayFab.ClientApi.GetUserData({}, function(result, error) {
        if (error) {
            console.error("Error retrieving user data:", error);
        } else {
            const teamName = result.data.Data.teamName ? result.data.Data.teamName.Value : null;
            if (!teamName) {
                console.log("Team name not set. Redirecting to create team page.");
                alert("You must create a team first.");
                window.location.href = "create-team.html";
            } else {
                console.log("Team name found:", teamName);
            }
        }
    });
}

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
            const currentPlayerId = PlayFab.settings.titleId;
            
            // Get all the PlayFab IDs from the leaderboard
            const playerIds = result.data.Leaderboard.map(entry => entry.PlayFabId);
            
            // Fetch additional metadata for all players
            getPlayersAdditionalData(playerIds, function(playerDataMap) {
                // Process and display the leaderboard data with extra info
                renderEnhancedLeaderboard(result.data.Leaderboard, currentPlayerId, playerDataMap);
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
    
    // Clear any existing content
    leaderboardElement.innerHTML = '';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    
    // Add header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    const headers = ['Rank', 'Team', 'Manager', 'Points']; // Added 'Manager'
    
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    
    // Add data rows
    const tbody = table.createTBody();
    leaderboardData.forEach(entry => {
        const row = tbody.insertRow();
        
        // Highlight current user's row
        if (entry.PlayFabId === currentPlayerId) {
            row.className = 'current-user';
        }
        
        // Add rank styling for top 3
        const rankCell = row.insertCell();
        const rank = entry.Position + 1;
        rankCell.textContent = rank;
        
        if (rank <= 3) {
            rankCell.className = `rank-${rank}`;
        }
        
        // Team name - already from DisplayName
        const nameCell = row.insertCell();
        nameCell.textContent = entry.DisplayName || 'Unknown Team';
        
        // Add manager name from our additional data
        const managerCell = row.insertCell();
        const playerData = playerDataMap[entry.PlayFabId];
        managerCell.textContent = playerData ? playerData.managerName : 'Unknown';
        
        // Points
        const pointsCell = row.insertCell();
        pointsCell.textContent = entry.StatValue;
    });
    
    leaderboardElement.appendChild(table);
    
    // If no data found
    if (leaderboardData.length === 0) {
        leaderboardElement.innerHTML = '<div class="error-message">No leaderboard data available yet.</div>';
    }
}

// Page load handling for leaderboard page
window.addEventListener('load', function () {
    checkTeamName();
    getLeaderboard();
});