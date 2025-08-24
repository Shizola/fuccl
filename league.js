// PAGINATION AND TEST DATA CONFIGURATION
const LEADERBOARD_CONFIG = {
    itemsPerPage: 15,
    enableTestData: true, // Set to false when you have real data
    testDataCount: 149   // Number of fake entries to generate (149 + 1 real user = 150 total)
};

let currentPage = 1;
let totalPages = 1;
let allLeaderboardData = [];
let currentPlayerId = null;

// Function to generate test leaderboard data for development
function generateTestLeaderboardData() {
    const teamNames = [
        "Holy Strikers", "Faith FC", "Gospel Goals", "Divine Defenders", "Sacred Shots",
        "Blessed Ballers", "Worship Warriors", "Praise Players", "Spirit Squad", "Grace United",
        "Miracle Makers", "Heaven's Heroes", "Glory Getters", "Trinity Titans", "Cross Crusaders",
        "Salvation Strikers", "Prayer Power", "Hope United", "Love Lions", "Peace Players",
        "Joy Joggers", "Light Leaders", "Truth Tacklers", "Victory Vibes", "Faith Fighters",
        "Crown Catchers", "Angel Athletes", "Blessing Ballers", "Gospel Giants", "Holy Hustlers",
        "Divine Dribblers", "Sacred Scorers", "Mighty Miracles", "Righteous Runners", "Pure Power",
        "Eternal Eagles", "Chosen Champions", "Kingdom Kickers", "Heavenly Hawks", "Spirit Spartans",
        "Grace Gladiators", "Faith Flames", "Hope Hawks", "Love Lakers", "Peace Panthers",
        "Joy Jaguars", "Victory Vipers", "Crown Cobras", "Angel Arrows", "Blessing Bears"
    ];

    const managerNames = [
        "John Smith", "Sarah Johnson", "Mike Wilson", "Emma Davis", "James Brown",
        "Lisa Garcia", "David Miller", "Anna Rodriguez", "Chris Martinez", "Maria Lopez",
        "Robert Taylor", "Jennifer Anderson", "Paul Thomas", "Linda Jackson", "Mark White",
        "Susan Harris", "Kevin Martin", "Nancy Thompson", "Daniel Garcia", "Karen Wilson",
        "Matthew Martinez", "Betty Davis", "Anthony Rodriguez", "Helen Lopez", "Steven Anderson",
        "Dorothy Thomas", "Kenneth Jackson", "Lisa Martin", "Joshua Harris", "Sharon Thompson",
        "Andrew Garcia", "Donna Wilson", "Ryan Martinez", "Carol Rodriguez", "Brandon Lopez",
        "Michelle Anderson", "Jason Thomas", "Sandra Jackson", "Justin Martin", "Kimberly Harris",
        "Jonathan Thompson", "Amy Garcia", "Nicholas Wilson", "Angela Martinez", "Aaron Rodriguez",
        "Brenda Lopez", "Jacob Anderson", "Emma Thomas", "Alexander Jackson", "Olivia Martin"
    ];

    const testData = [];
    
    for (let i = 0; i < LEADERBOARD_CONFIG.testDataCount; i++) {
        // Generate realistic point distribution
        let points;
        if (i < 5) {
            points = Math.floor(Math.random() * 50) + 200; // Top 5: 200-250 points
        } else if (i < 20) {
            points = Math.floor(Math.random() * 60) + 140; // Top 20: 140-200 points
        } else if (i < 50) {
            points = Math.floor(Math.random() * 70) + 70;  // Top 50: 70-140 points
        } else {
            points = Math.floor(Math.random() * 70) + 20;  // Rest: 20-90 points
        }

        testData.push({
            Position: i,
            PlayFabId: `test_player_${i}`,
            DisplayName: teamNames[i % teamNames.length] + (i >= teamNames.length ? ` ${Math.floor(i / teamNames.length) + 1}` : ''),
            StatValue: points,
            managerName: managerNames[i % managerNames.length] + (i >= managerNames.length ? ` ${Math.floor(i / managerNames.length) + 1}` : '')
        });
    }

    // Sort by points (highest first)
    testData.sort((a, b) => b.StatValue - a.StatValue);
    
    // Update positions after sorting
    testData.forEach((entry, index) => {
        entry.Position = index;
    });

    return testData;
}
// Function to get leaderboard data from PlayFab or generate test data
function getLeaderboard() {
    if (LEADERBOARD_CONFIG.enableTestData) {
        console.log("Using test data for leaderboard with real user data");
        
        // Use the optimized helper to get PlayFab ID (cached or from API)
        getPlayFabId(function(idError, playFabId) {
            if (idError) {
                console.error("Error getting PlayFab ID:", idError);
                // Fallback to pure test data
                generateAndRenderTestData(null);
                return;
            }
            
            console.log("Got PlayFab ID:", playFabId);
            
            // Now get the user's team data from GetUserData
            PlayFab.ClientApi.GetUserData({}, function(userData, userError) {
                if (userError) {
                    console.error("Error getting user data:", userError);
                    // Still proceed with just the PlayFab ID
                    const realUserData = {
                        playFabId: playFabId,
                        teamName: null,
                        managerName: null
                    };
                    getUserPointsAndRender(realUserData);
                    return;
                }
                
                console.log("User data from PlayFab:", userData);
                
                // Combine PlayFab ID with user data
                const realUserData = {
                    playFabId: playFabId,
                    teamName: userData.data.Data && userData.data.Data.teamName ? userData.data.Data.teamName.Value : null,
                    managerName: userData.data.Data && userData.data.Data.managerName ? userData.data.Data.managerName.Value : null
                };
                
                console.log("Combined real user data:", realUserData);
                getUserPointsAndRender(realUserData);
            });
        });
        
        return;
    }

    // Real PlayFab data (original implementation)
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
            
            allLeaderboardData = result.data.Leaderboard;
            totalPages = Math.ceil(allLeaderboardData.length / LEADERBOARD_CONFIG.itemsPerPage);
            
            // Get the current player's ID to highlight their row using optimized helper
            getPlayFabId(function(idError, playFabId) {
                if (idError) {
                    console.error("Error getting PlayFab ID:", idError);
                    currentPlayerId = null;
                } else {
                    currentPlayerId = playFabId;
                    console.log("Current player ID:", currentPlayerId);
                }
                
                // Render the leaderboard
                renderPaginatedLeaderboard();
            });
        }
    });
}

// Helper function to get user's points and render the leaderboard
function getUserPointsAndRender(realUserData) {
    // Get user's current points from the leaderboard (get their specific entry)
    PlayFab.ClientApi.GetPlayerStatistics({
        StatisticNames: ["PlayerTotalPoints"]
    }, function(pointsResult, pointsError) {
        if (!pointsError && pointsResult.data.Statistics && pointsResult.data.Statistics.length > 0) {
            // This gets the user's actual statistic value
            const userStat = pointsResult.data.Statistics.find(stat => stat.StatisticName === "PlayerTotalPoints");
            if (userStat) {
                realUserData.points = userStat.Value;
                console.log("Found user's real points:", realUserData.points);
            } else {
                console.log("PlayerTotalPoints statistic not found, using default points");
                realUserData.points = Math.floor(Math.random() * 100) + 50; // 50-150 points
            }
        } else {
            console.log("No statistics found for user, using default points");
            console.log("Points result:", pointsResult);
            console.log("Points error:", pointsError);
            // If no leaderboard data, use a default/calculated value
            realUserData.points = Math.floor(Math.random() * 100) + 50; // 50-150 points
        }
        
        console.log("Final real user data before generating test data:", realUserData);
        generateAndRenderTestData(realUserData);
    });
}

// Generate test data including real user data
function generateAndRenderTestData(realUserData) {
    // Generate test data (14 fake teams)
    allLeaderboardData = generateTestLeaderboardData();
    
    console.log("Generated", allLeaderboardData.length, "fake teams");
    console.log("Checking real user data:", realUserData);
    
    // If we have real user data, ADD it to the fake data (don't replace)
    if (realUserData && realUserData.playFabId) {
        console.log("Using real user data - playFabId:", realUserData.playFabId);
        currentPlayerId = realUserData.playFabId;
        
        // Create real user entry with actual points
        const realUserEntry = {
            Position: 0, // Will be set after sorting
            PlayFabId: realUserData.playFabId,
            DisplayName: realUserData.teamName || "My Team",
            StatValue: realUserData.points || 75,
            managerName: realUserData.managerName || "My Manager"
        };
        
        // ADD the real user to the array (don't replace, just add as 15th team)
        allLeaderboardData.push(realUserEntry);
        
        console.log(`Added real user data:`, realUserEntry);
        console.log("Total teams after adding real user:", allLeaderboardData.length);
    } else {
        console.log("NO real user data found, using fallback");
        console.log("realUserData exists:", !!realUserData);
        console.log("realUserData.playFabId exists:", realUserData ? !!realUserData.playFabId : "N/A");
        
        // Fallback: add a simulated current user if no real data available
        const fallbackUser = {
            Position: 0,
            PlayFabId: `test_real_user`,
            DisplayName: "My Test Team",
            StatValue: Math.floor(Math.random() * 100) + 50,
            managerName: "Test Manager"
        };
        
        allLeaderboardData.push(fallbackUser);
        currentPlayerId = `test_real_user`;
        console.log("Added fallback test user:", fallbackUser);
    }
    
    // Re-sort by points (highest first) to ensure proper ranking
    allLeaderboardData.sort((a, b) => b.StatValue - a.StatValue);
    
    // Update positions after sorting
    allLeaderboardData.forEach((entry, index) => {
        entry.Position = index;
    });
    
    console.log("Final leaderboard data:", allLeaderboardData);
    
    // Calculate pagination
    totalPages = Math.ceil(allLeaderboardData.length / LEADERBOARD_CONFIG.itemsPerPage);
    
    // Find what page the real user is on and start there
    if (currentPlayerId) {
        const userEntry = allLeaderboardData.find(entry => entry.PlayFabId === currentPlayerId);
        if (userEntry) {
            const userRank = userEntry.Position + 1;
            currentPage = Math.ceil(userRank / LEADERBOARD_CONFIG.itemsPerPage);
            console.log(`Real user "${userEntry.DisplayName}" is rank ${userRank} with ${userEntry.StatValue} points, starting on page ${currentPage}`);
        } else {
            console.error("Could not find user entry after insertion!", currentPlayerId);
            console.log("Available PlayFab IDs:", allLeaderboardData.map(entry => entry.PlayFabId));
            currentPage = 1;
        }
    }
    
    // Render the leaderboard
    renderPaginatedLeaderboard();
}

// New paginated rendering function
function renderPaginatedLeaderboard() {
    const leaderboardElement = document.getElementById('leaderboard-wrapper');
    if (!leaderboardElement) {
        console.error("Leaderboard wrapper element not found");
        return;
    }
    
    // Validate input data
    if (!allLeaderboardData || !Array.isArray(allLeaderboardData)) {
        leaderboardElement.innerHTML = '<div class="error-message">Invalid leaderboard data received.</div>';
        return;
    }
    
    // Check if we have data to display
    if (allLeaderboardData.length === 0) {
        leaderboardElement.innerHTML = '<div class="error-message">No leaderboard data available yet.</div>';
        return;
    }
    
    // Clear any existing content
    leaderboardElement.innerHTML = '';
    
    // Create leaderboard header with stats
    const headerDiv = document.createElement('div');
    headerDiv.className = 'leaderboard-header';
    headerDiv.innerHTML = `
        <h2>🏆 League Standings</h2>
        <div class="leaderboard-stats">
            <span class="total-players">Total Players: ${allLeaderboardData.length}</span>
            <span class="current-page-info">Page ${currentPage} of ${totalPages}</span>
        </div>
    `;
    leaderboardElement.appendChild(headerDiv);
    
    // Calculate which entries to show on current page
    const startIndex = (currentPage - 1) * LEADERBOARD_CONFIG.itemsPerPage;
    const endIndex = Math.min(startIndex + LEADERBOARD_CONFIG.itemsPerPage, allLeaderboardData.length);
    const pageData = allLeaderboardData.slice(startIndex, endIndex);
    
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
    pageData.forEach(entry => {
        const row = tbody.insertRow();
        
        // Highlight current user's row
        if (currentPlayerId && entry.PlayFabId === currentPlayerId) {
            row.className = 'current-user';
        }
        
        // Add rank styling for top 3 (globally, not just on this page)
        const rankCell = row.insertCell();
        const rank = entry.Position + 1;
        rankCell.textContent = rank;
        
        if (rank <= 3) {
            rankCell.className = `rank-${rank}`;
        }
        
        // Team name
        const nameCell = row.insertCell();
        nameCell.textContent = entry.DisplayName || 'Unknown Team';
        
        // Manager name
        const managerCell = row.insertCell();
        managerCell.textContent = entry.managerName || 'Unknown Manager';
        
        // Points
        const pointsCell = row.insertCell();
        pointsCell.textContent = entry.StatValue || 0;
    });
    
    leaderboardElement.appendChild(table);
    
    // Add pagination controls
    createPaginationControls(leaderboardElement);
    
    // Add quick jump to current user if they're not on this page
    addUserLocationHelper(leaderboardElement);
}

// Create pagination controls
function createPaginationControls(container) {
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination-controls';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.className = 'pagination-btn' + (currentPage === 1 ? ' disabled' : '');
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderPaginatedLeaderboard();
        }
    };
    
    // Page numbers (show current page and a few around it)
    const pageNumbersDiv = document.createElement('div');
    pageNumbersDiv.className = 'page-numbers';
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    // Add first page if not in range
    if (startPage > 1) {
        addPageButton(pageNumbersDiv, 1);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            pageNumbersDiv.appendChild(ellipsis);
        }
    }
    
    // Add page range
    for (let i = startPage; i <= endPage; i++) {
        addPageButton(pageNumbersDiv, i);
    }
    
    // Add last page if not in range
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            pageNumbersDiv.appendChild(ellipsis);
        }
        addPageButton(pageNumbersDiv, totalPages);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.className = 'pagination-btn' + (currentPage === totalPages ? ' disabled' : '');
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPaginatedLeaderboard();
        }
    };
    
    paginationDiv.appendChild(prevButton);
    paginationDiv.appendChild(pageNumbersDiv);
    paginationDiv.appendChild(nextButton);
    
    container.appendChild(paginationDiv);
}

// Helper function to add page buttons
function addPageButton(container, pageNumber) {
    const pageButton = document.createElement('button');
    pageButton.textContent = pageNumber;
    pageButton.className = 'page-btn' + (pageNumber === currentPage ? ' active' : '');
    pageButton.onclick = () => {
        currentPage = pageNumber;
        renderPaginatedLeaderboard();
    };
    container.appendChild(pageButton);
}

// Add helper to show where current user is
function addUserLocationHelper(container) {
    if (!currentPlayerId) return;
    
    const userEntry = allLeaderboardData.find(entry => entry.PlayFabId === currentPlayerId);
    if (!userEntry) return;
    
    const userRank = userEntry.Position + 1;
    const userPage = Math.ceil(userRank / LEADERBOARD_CONFIG.itemsPerPage);
    
    if (userPage !== currentPage) {
        const helperDiv = document.createElement('div');
        helperDiv.className = 'user-location-helper';
        helperDiv.innerHTML = `
            <div class="user-location-info">
                <span>🎯 Your team "${userEntry.DisplayName}" is ranked #${userRank}</span>
                <button class="goto-user-btn" onclick="goToUserPage()">Go to My Position</button>
            </div>
        `;
        container.appendChild(helperDiv);
    }
}

// Function to jump to user's page
function goToUserPage() {
    if (!currentPlayerId) return;
    
    const userEntry = allLeaderboardData.find(entry => entry.PlayFabId === currentPlayerId);
    if (!userEntry) return;
    
    const userRank = userEntry.Position + 1;
    const userPage = Math.ceil(userRank / LEADERBOARD_CONFIG.itemsPerPage);
    
    currentPage = userPage;
    renderPaginatedLeaderboard();
}
// Keep these functions for when switching back to real PlayFab data
function getPlayersAdditionalData(playerIds, callback) {
    // This function will be used when LEADERBOARD_CONFIG.enableTestData = false
    const playerDataMap = {};
    
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
}

// Legacy function - kept for backward compatibility but not used with pagination
function renderEnhancedLeaderboard(leaderboardData, currentPlayerId, playerDataMap) {
    // This function is kept for reference but renderPaginatedLeaderboard() is now used instead
    console.log("Legacy renderEnhancedLeaderboard called - consider using renderPaginatedLeaderboard instead");
}