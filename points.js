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

// Display team name only (for points page)
function loadTeamNameOnly() {
    fetchUserData(function(error, userData) {
        if (!error && userData) {
            document.getElementById('teamName').innerText = userData.teamName;
        }
    });
}

// Function to create a player card
function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card';

    // Add player shirt image
    const shirtImg = document.createElement('img');
    shirtImg.src = player.shirtImage;
    shirtImg.alt = `${player.name}'s Shirt`;
    shirtImg.className = 'player-shirt';

    // Fallback to template.svg if the shirt image fails to load
    shirtImg.onerror = function () {
        this.src = 'images/shirts/template.svg';
    };

    card.appendChild(shirtImg);

    // Add player name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = player.name;
    card.appendChild(nameDiv);

    // Add player points - use weeklyPoints instead of total points
    const pointsDiv = document.createElement('div');
    pointsDiv.className = 'player-points';
    // Display weekly points if available, otherwise fall back to total points
    const pointsToShow = player.weeklyPoints !== undefined ? player.weeklyPoints : player.points;
    pointsDiv.textContent = `${pointsToShow} pts`;
    card.appendChild(pointsDiv);

    return card;
}

// Function to render players on the pitch based on their position
function renderPlayersOnPitch(players) {
    // Get the pitch container
    const pitch = document.querySelector('.pitch');

    // Clear existing players
    pitch.innerHTML = '<img src="images/pitch.svg" alt="Football Pitch" class="pitch-image">';

    // Define vertical positions for each row, including substitutes
    const positionStyles = {
        gk: { top: '10%' },
        df: { top: '30%' },
        md: { top: '50%' },
        at: { top: '70%' },
        sb: { top: '90%' } // Substitutes row
    };

    // Group players by position
    const positions = {
        gk: [],
        df: [],
        md: [],
        at: [],
        sb: [] // Substitutes
    };

    // Separate substitutes (last 4 players)
    const substitutes = players.slice(-4);
    const mainPlayers = players.slice(0, players.length - 4);

    // Assign main players to their positions
    mainPlayers.forEach(player => {
        positions[player.position].push(player);
    });

    // Assign substitutes to the 'sb' position
    substitutes.forEach(player => {
        positions.sb.push(player);
    });

    // Render players for each position
    Object.keys(positions).forEach(position => {
        const rowPlayers = positions[position];

        rowPlayers.forEach((player, index) => {
            const playerCard = createPlayerCard(player);

            // Calculate dynamic left position to avoid overlap
            const left = `${(index + 1) * (100 / (rowPlayers.length + 1))}%`;

            // Apply inline styles for positioning
            playerCard.style.position = 'absolute';
            playerCard.style.top = positionStyles[position].top;
            playerCard.style.left = left;

            // Append the player card to the pitch
            pitch.appendChild(playerCard);
        });
    });
}

// Function to get test player data
function getTestPlayerData() {
    return [
        // Goalkeeper
        { name: 'John Doe', points: 12, shirtImage: 'images/shirts/highfields.svg', position: 'gk' },
    
        // Defenders (4)
        { name: 'Jane Smith', points: 8, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
        { name: 'Chris Johnson', points: 5, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
        { name: 'Michael Brown', points: 7, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
        { name: 'Sarah Wilson', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'df' },
    
        // Midfielders (4)
        { name: 'Anna Lee', points: 7, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
        { name: 'James Taylor', points: 9, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
        { name: 'Laura White', points: 8, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
        { name: 'Robert King', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'md' },
    
        // Attackers (2)
        { name: 'David Brown', points: 10, shirtImage: 'images/shirts/highfields.svg', position: 'at' },
        { name: 'Emily Davis', points: 6, shirtImage: 'images/shirts/highfields.svg', position: 'at' }
    ];
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

            //console.log("selectedPlayersString:", selectedPlayersString);

            let selectedPlayerIds;
            try {
                // Parse the JSON string into an array
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
                    // Log the entire titleDataResult object to verify what data is returned
                    console.log("Full title data result:", titleDataResult);

                    // Check if titleDataResult.data.Data exists
                    if (titleDataResult.data && titleDataResult.data.Data) {
                       // console.log("Title data keys:", Object.keys(titleDataResult.data.Data));

                        // Get the current gameweek
                        const gameWeek = parseInt(titleDataResult.data.Data.gameWeek);
                        console.log("Gameweek Value:", gameWeek);
                        console.log("Current Gameweek:", gameWeek);

                        // Update the gameweek placeholder in the HTML
                        document.getElementById('gameweek').textContent = gameWeek;

                        // Parse the players and calculate weekly points
                        let weeklyPointsTotal = 0;
                        const players = selectedPlayerIds.map(id => {
                            const key = `player_${id}`;
                            const playerDataString = titleDataResult.data.Data[key];

                            if (playerDataString) {
                                const player = parsePlayerData(playerDataString);

                                // Calculate weekly points for the current gameweek
                                const weeklyPoints = calculateWeeklyPoints(playerDataString, gameWeek);
                                //console.log(`Player ID: ${id}, Weekly Points: ${weeklyPoints}, Gameweek: ${gameWeek}`);

                                player.weeklyPoints = weeklyPoints;

                                // Add to the total weekly points
                                weeklyPointsTotal += weeklyPoints;

                                return player;
                            } else {
                                console.warn(`No data found for player ID: ${id}`);
                            }
                            return null;
                        }).filter(player => player !== null); // Filter out any null values

                        // Update the weekly points in the HTML
                        const weeklyPointsElement = document.getElementById('weeklyPoints');
                        if (!weeklyPointsElement) {
                            console.error("Element with ID 'weeklyPoints' not found in the HTML.");
                        } else {
                            weeklyPointsElement.textContent = weeklyPointsTotal;
                        }

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

        // Log the points array for debugging
        console.log(`Points Array for Gameweek ${gameWeek}:`, pointsArray);

        // Return the points for the current gameweek (1-based index)
        return parseInt(pointsArray[gameWeek - 1] || 0);
    } catch (error) {
        console.error("Error calculating weekly points:", error, "Player Data:", playerDataString);
        return 0; // Return 0 points if there's an error
    }
}

// Function to parse player data from PlayFab
function parsePlayerData(playerDataString) {
    const parts = playerDataString.split('|');
    const name = parts[0]; // Extract the name
    const teamName = parts[1]; // Extract the team name
    const position = parts[2]; // Extract the position
    const totalPoints = parseInt(parts[5]); // Extract total points directly

    // Convert position to match the test player format
    const positionMap = {
        Goalkeeper: 'gk',
        Defender: 'df',
        Midfielder: 'md',
        Attacker: 'at'
    };

    // Map team names to shirt images
    const shirtImageMap = {
        'Highfields FC': 'images/shirts/highfields.svg',
        'Vinyard FC': 'images/shirts/vinyard.svg',
        'Bethel Town FC': 'images/shirts/bethel.svg',
        'Lifepoint Church AFC': 'images/shirts/lifepoint.svg',
        'DC United FC': 'images/shirts/dc.svg',
        'FC United': 'images/shirts/fc_united.svg',
        'Emmanuel Baptist Church FC': 'images/shirts/emmanuel.svg',
        'Parklands AFC': 'images/shirts/parklands.svg',
        'Bridgend Deanery FC': 'images/shirts/bridgend.svg',
        'Rhondda Royals FC': 'images/shirts/rhondda.svg',
        'Libanus Evangelical Church': 'images/shirts/libanus.svg',
        'Waterfront Community Church FC': 'images/shirts/waterfront.svg',
    };

    // Determine the shirt image
    let shirtImage = shirtImageMap[teamName] || 'images/shirts/default.svg';
    if (positionMap[position] === 'gk') {
        // Append "_gk" for goalkeepers
        const teamKey = Object.keys(shirtImageMap).find(key => shirtImageMap[key] === shirtImage);
        if (teamKey) {
            shirtImage = shirtImage.replace('.svg', '_gk.svg');
        }
    }

    return {
        name,
        position: positionMap[position] || 'unknown', // Map position or default to 'unknown'
        points: totalPoints,
        shirtImage // Use the determined shirt image
    };
}

// Function to load the current gameweek from PlayFab Title Data
function loadGameWeek() {
    PlayFab.ClientApi.GetTitleData({}, function (titleDataResult, titleDataError) {
        if (titleDataError) {
            console.error("Error retrieving title data from PlayFab:", titleDataError);
        } else {
            // Check if gameWeek exists in the title data
            if (titleDataResult.data && titleDataResult.data.Data.gameWeek) {
                const gameWeek = parseInt(titleDataResult.data.Data.gameWeek); // Parse the gameWeek value as an integer
                console.log("Current Gameweek:", gameWeek);

                // Update the gameweek placeholder in the HTML
                document.getElementById('gameweek').textContent = gameWeek;
            } else {
                console.error("gameWeek not found in title data.");
            }
        }
    });
}

// Function to submit weekly points to PlayFab leaderboard
function submitWeeklyPointsToLeaderboard(weeklyPointsTotal) {
    // Make sure weeklyPointsTotal is a valid integer
    const points = parseInt(weeklyPointsTotal) || 0;
    
    // First get the user's data to get team name
    fetchUserData(function(error, userData) {
        if (error) {
            console.error("Error fetching user data:", error);
            return;
        }
        
        // 1. Update the player statistics (leaderboard entry)
        PlayFab.ClientApi.UpdatePlayerStatistics({
            Statistics: [{
                StatisticName: "PlayerTotalPoints",
                Value: points
            }]
        }, function (result, error) {
            if (error) {
                console.error("Error submitting weekly points to leaderboard:", error);
                console.error("Error details:", JSON.stringify(error));
            } else {
                console.log("Successfully submitted weekly points to leaderboard:", result);
                
                // 2. Store the team and manager info in a shared data location for leaderboard use
                PlayFab.ClientApi.UpdateUserData({
                    Data: {
                        "leaderboardInfo": JSON.stringify({
                            teamName: userData.teamName,
                            managerName: userData.managerName || "Unknown"
                        })
                    },
                    // Make this data readable by other players
                    Permission: "Public"
                }, function(updateResult, updateError) {
                    if (updateError) {
                        console.error("Error storing leaderboard metadata:", updateError);
                    } else {
                        console.log("Successfully stored leaderboard metadata");
                    }
                });
                
                // 3. Update DisplayName to show team name
                PlayFab.ClientApi.UpdateUserTitleDisplayName({
                    DisplayName: userData.teamName
                }, function(displayResult, displayError) {
                    if (displayError) {
                        console.error("Error updating display name:", displayError);
                    } else {
                        console.log("Successfully updated display name to team name");
                    }
                });
            }
        });
    });
}

// Test function to call the submission method
function testLeaderboardSubmission() {
    // Load players and gameweek from PlayFab to get the weekly points
    loadPlayersFromPlayFab(function (error, data) {
        if (error) {
            console.error("Failed to load player data:", error);
        } else {
            const { weeklyPointsTotal } = data;
            
            console.log("Submitting weekly points to leaderboard:", weeklyPointsTotal);
            
            // Submit the weekly points to the leaderboard
            submitWeeklyPointsToLeaderboard(weeklyPointsTotal);
        }
    });
}

// Page load handling for points page
window.addEventListener('load', function () {
    checkTeamName();
    loadTeamNameOnly();

    // Load players and gameweek from PlayFab
    loadPlayersFromPlayFab(function (error, data) {
        if (error) {
            console.error("Failed to load player data:", error);
        } else {
            const { players } = data;
            
            console.log("Selected players:", players);
            
            // Players is already an array from loadPlayersFromPlayFab
            // Render the players on the pitch
            renderPlayersOnPitch(players);
        }
    });
});

// Add event listener to the test button
const testButton = document.getElementById('testLeaderboardBtn');
if (testButton) {
    testButton.addEventListener('click', testLeaderboardSubmission);
}
