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

// Display team name and user points data
function loadUserData() {
    fetchUserData(function(error, userData) {
        if (!error && userData) {
            document.getElementById('teamName').innerText = userData.teamName;
        }
    });
    
    // Load players and gameweek from PlayFab to get user's weekly points
    loadPlayersFromPlayFab(function (error, data) {
        if (error) {
            console.error("Failed to load player data:", error);
        } else {
            const { weeklyPointsTotal } = data;
            
            // Update the weekly points in the HTML
            const weeklyPointsElement = document.getElementById('weeklyPoints');
            if (weeklyPointsElement) {
                weeklyPointsElement.textContent = weeklyPointsTotal;
            }
            
            // Update total points (if you have this data)
            const totalPointsElement = document.getElementById('totalPoints');
            if (totalPointsElement) {
                // You might want to calculate this or get it from elsewhere
                // For now, we'll leave it as "Loading..."
                totalPointsElement.textContent = "Loading...";
            }
        }
    });
}

// Function to load player data and gameweek from PlayFab
function loadPlayersFromPlayFab(callback) {
    // Fetch user data to get the selectedPlayers key
    PlayFab.ClientApi.GetUserData({}, function (result, error) {
        if (error) {
            console.error("Error retrieving user data from PlayFab:", error);
            callback(error, null);
        } else {
            // Parse the selectedPlayers key
            const selectedPlayersString = result.data.Data.selectedPlayers ? result.data.Data.selectedPlayers.Value : null;
            if (!selectedPlayersString) {
                console.error("No selectedPlayers key found for the user.");
                callback("No selectedPlayers key found", null);
                return;
            }

            // Parse the JSON string into an array
            let selectedPlayerIds;
            try {
                selectedPlayerIds = JSON.parse(selectedPlayersString);
            } catch (e) {
                console.error("Error parsing selectedPlayersString:", e);
                callback("Error parsing selectedPlayersString", null);
                return;
            }

            // Map the IDs to the PlayFab title data keys
            const titleDataKeys = selectedPlayerIds.map(id => `player_${id}`);
            titleDataKeys.push("gameWeek"); // Add gameWeek to the keys to fetch it in the same API call

            // Fetch title data for the selected player IDs
            PlayFab.ClientApi.GetTitleData({ Keys: titleDataKeys }, function (titleDataResult, titleDataError) {
                if (titleDataError) {
                    console.error("Error retrieving title data from PlayFab:", titleDataError);
                    callback(titleDataError, null);
                } else {
                    // Check if titleDataResult.data.Data exists
                    if (titleDataResult.data && titleDataResult.data.Data) {
                        // Get the current gameweek
                        const gameWeek = parseInt(titleDataResult.data.Data.gameWeek);
                        
                        // Update the gameweek placeholder in the HTML
                        document.getElementById('gameweek').textContent = gameWeek;

                        // Parse the players and calculate weekly points
                        let weeklyPointsTotal = 0;
                        const players = selectedPlayerIds.map(id => {
                            const key = `player_${id}`;
                            const playerDataString = titleDataResult.data.Data[key];

                            if (playerDataString) {
                                // Calculate weekly points for the current gameweek
                                const weeklyPoints = calculateWeeklyPoints(playerDataString, gameWeek);
                                
                                // Add to the total weekly points
                                weeklyPointsTotal += weeklyPoints;
                                
                                return {
                                    id,
                                    weeklyPoints
                                };
                            } else {
                                console.warn(`No data found for player ID: ${id}`);
                            }
                            return null;
                        }).filter(player => player !== null); // Filter out any null values

                        // Pass the players, weekly points total, and selectedPlayerIds to the callback
                        callback(null, { players, weeklyPointsTotal, selectedPlayerIds });
                    } else {
                        console.error("No title data returned.");
                        callback("No title data returned", null);
                    }
                }
            });
        }
    });
}

// Function to calculate weekly points for a player
function calculateWeeklyPoints(playerDataString, gameWeek) {
    try {
        const parts = playerDataString.split('|');
        const pointsArray = parts[4].split(','); // Weekly points are stored as a comma-separated string
        
        // Return the points for the current gameweek (1-based index)
        return parseInt(pointsArray[gameWeek - 1] || 0);
    } catch (error) {
        console.error("Error calculating weekly points:", error, "Player Data:", playerDataString);
        return 0; // Return 0 points if there's an error
    }
}

// Function to get leaderboard data from PlayFab
function getLeaderboard() {
    PlayFab.ClientApi.GetLeaderboard({
        StatisticName: "PlayerTotalPoints",
        StartPosition: 0,
        MaxResultsCount: 100 // Adjust as needed
    }, function(result, error) {
        if (error) {
            console.error("Error getting leaderboard:", error);
            document.getElementById('leaderboard-wrapper').innerHTML = 
                '<div class="error-message">Failed to load leaderboard data. Please try again later.</div>';
        } else {
            console.log("Leaderboard data:", result.data);
            
            // Get the current player's ID to highlight their row
            const currentPlayerId = PlayFab.settings.titleId;
            
            // Process and display the leaderboard data
            renderLeaderboard(result.data.Leaderboard, currentPlayerId);
        }
    });
}

// Function to render the leaderboard
function renderLeaderboard(leaderboardData, currentPlayerId) {
    const leaderboardElement = document.getElementById('leaderboard-wrapper');
    
    // Clear any existing content
    leaderboardElement.innerHTML = '';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    
    // Add header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    const headers = ['Rank', 'Team', 'Points'];
    
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    
    // Add data rows
    const tbody = table.createTBody();
    
    // Track entries to render so we can wait for all team names to load
    const entriesToRender = [];
    let entriesProcessed = 0;
    
    // If no data found
    if (leaderboardData.length === 0) {
        leaderboardElement.innerHTML = '<div class="error-message">No leaderboard data available yet.</div>';
        return;
    }
    
    // For each leaderboard entry, get the team name from PlayFab
    leaderboardData.forEach(entry => {
        // Get user data for each player to fetch their team name
        PlayFab.ClientApi.GetUserReadOnlyData({
            PlayFabId: entry.PlayFabId,
            Keys: ["teamName"]
        }, function(result, error) {
            let teamName = 'Unknown Team';
            
            if (!error && result.data && result.data.Data && result.data.Data.teamName) {
                teamName = result.data.Data.teamName.Value;
            }
            
            // Store entry with team name for rendering
            entriesToRender.push({
                position: entry.Position,
                playFabId: entry.PlayFabId,
                teamName: teamName,
                points: entry.StatValue
            });
            
            entriesProcessed++;
            
            // When all entries are processed, render the table
            if (entriesProcessed === leaderboardData.length) {
                // Sort by position to maintain correct order
                entriesToRender.sort((a, b) => a.position - b.position);
                
                // Render the sorted entries
                entriesToRender.forEach(item => {
                    const row = tbody.insertRow();
                    
                    // Highlight current user's row
                    if (item.playFabId === currentPlayerId) {
                        row.className = 'current-user';
                    }
                    
                    // Add rank styling for top 3
                    const rankCell = row.insertCell();
                    const rank = item.position + 1; // Position is 0-based
                    rankCell.textContent = rank;
                    
                    if (rank <= 3) {
                        rankCell.className = `rank-${rank}`;
                    }
                    
                    const nameCell = row.insertCell();
                    nameCell.textContent = item.teamName;
                    
                    const pointsCell = row.insertCell();
                    pointsCell.textContent = item.points;
                });
                
                leaderboardElement.appendChild(table);
            }
        });
    });
    
    // Show loading message while processing
    leaderboardElement.innerHTML = '<div class="loading-message">Loading leaderboard data...</div>';
}

// Page load handling for leaderboard page
window.addEventListener('load', function () {
    // Use the setupPlayFabAuth from common.js
    checkTeamName();
    loadUserData();
    getLeaderboard();
});