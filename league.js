// PAGINATION AND TEST DATA CONFIGURATION
const LEADERBOARD_CONFIG = {
    itemsPerPage: 15,
    enableTestData: false, // Set to false when you have real data
    testDataCount: 149,  // Number of fake entries to generate (149 + 1 real user = 150 total)
    progressivePaging: true, // Enable progressive paging for large leaderboards
    apiBatchSize: 100, // PlayFab typical max per call (adjust if title allows larger)
    maxTotalEntriesHint: 1000 // Soft cap hint; actual end discovered when batch < apiBatchSize
};

let currentPage = 1;
let totalPages = 1; // Will finalize once end encountered
let allLeaderboardData = []; // For test mode (full data) OR accumulated real entries (flattened)
let currentPlayerId = null;
// Progressive paging caches
const segmentCache = {}; // key: segmentStart -> array of entries
const segmentInFlight = {}; // key: segmentStart -> promise
let discoveredEnd = false; // true once a segment returns < batch size
let highestFetchedRankExclusive = 0; // track highest position+1 fetched
// Cache for per-player extra data (managerName, teamName)
const playerExtraCache = {}; // key: PlayFabId -> { managerName, teamName, fetched: true }

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

    if (!LEADERBOARD_CONFIG.progressivePaging) {
        // Legacy single-call mode
        PlayFab.ClientApi.GetLeaderboard({
            StatisticName: "PlayerTotalPoints",
            StartPosition: 0,
            MaxResultsCount: LEADERBOARD_CONFIG.apiBatchSize
        }, function(result, error) {
            if (error) {
                console.error("Error getting leaderboard:", error);
                document.getElementById('leaderboard-wrapper').innerHTML = 
                    '<div class="error-message">Failed to load leaderboard data. Please try again later.</div>';
            } else {
                allLeaderboardData = result.data.Leaderboard;
                totalPages = Math.ceil(allLeaderboardData.length / LEADERBOARD_CONFIG.itemsPerPage);
                getPlayFabId(function(idError, playFabId) {
                    currentPlayerId = idError ? null : playFabId;
                    renderPaginatedLeaderboard();
                });
            }
        });
        return;
    }

    // Progressive mode: fetch first segment only
    fetchSegment(0).then(() => {
        // After first segment loaded, set initial totalPages estimate (may grow)
        recomputeTotalPages();
        getPlayFabId(function(idError, playFabId) {
            currentPlayerId = idError ? null : playFabId;
            renderPaginatedLeaderboard();
        });
    }).catch(err => {
        console.error('Failed initial leaderboard segment:', err);
        const wrapper = document.getElementById('leaderboard-wrapper');
        if (wrapper) wrapper.innerHTML = '<div class="error-message">Failed to load leaderboard data. Please try again later.</div>';
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
    
    // In progressive mode, data may be in segmentCache before merged; treat presence of any segment entries as data
    if (!allLeaderboardData || !Array.isArray(allLeaderboardData)) {
        leaderboardElement.innerHTML = '<div class="error-message">Invalid leaderboard data received.</div>';
        return;
    }
    const hasAnyData = LEADERBOARD_CONFIG.progressivePaging
        ? Object.keys(segmentCache).some(k => (segmentCache[k] && segmentCache[k].length > 0)) || allLeaderboardData.length > 0
        : allLeaderboardData.length > 0;
    if (!hasAnyData) {
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
    
    // Ensure needed data present (progressive)
    const startIndex = (currentPage - 1) * LEADERBOARD_CONFIG.itemsPerPage;
    const endIndex = startIndex + LEADERBOARD_CONFIG.itemsPerPage;

    if (LEADERBOARD_CONFIG.progressivePaging) {
        // Determine which segments are required
        const batchSize = LEADERBOARD_CONFIG.apiBatchSize;
        const neededSegmentStarts = new Set();
        for (let idx = startIndex; idx < endIndex; idx += batchSize) {
            const segStart = Math.floor(idx / batchSize) * batchSize;
            if (!segmentCache[segStart] && !discoveredEnd) neededSegmentStarts.add(segStart);
        }
        if (neededSegmentStarts.size > 0) {
            // Show placeholder while loading
            renderLoadingPlaceholder();
            // Fetch all needed segments sequentially (could parallelize)
            const fetches = Array.from(neededSegmentStarts).sort((a,b)=>a-b).reduce((p, seg) => p.then(()=>fetchSegment(seg)), Promise.resolve());
            fetches.then(() => {
                recomputeTotalPages();
                renderPaginatedLeaderboard(); // re-render with data
            });
            return; // exit until data loaded
        }
    }

    const pageData = getPageDataSlice(startIndex, endIndex);
    
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
    const pagePlayerIdsNeedingFetch = [];
    pageData.forEach(entry => {
        if (!entry) return; // skip empty placeholder (shouldn't occur now)
        const row = tbody.insertRow();
        row.setAttribute('data-playfab-id', entry.PlayFabId);
        
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
        
        // Team name (DisplayName from leaderboard or cached extra)
        const nameCell = row.insertCell();
        const cachedExtra = playerExtraCache[entry.PlayFabId];
        const teamName = (cachedExtra && cachedExtra.teamName) || entry.DisplayName || 'Unknown Team';
        nameCell.textContent = teamName;
        
        // Manager name (prefer cache -> entry.managerName -> fallback)
        const managerCell = row.insertCell();
        const managerName = (cachedExtra && cachedExtra.managerName) || entry.managerName;
        if (managerName) {
            managerCell.textContent = managerName;
        } else {
            managerCell.textContent = 'Loading…';
            pagePlayerIdsNeedingFetch.push(entry.PlayFabId);
            managerCell.setAttribute('data-pending-manager', 'true');
        }
        
        // Points
        const pointsCell = row.insertCell();
        pointsCell.textContent = entry.StatValue || 0;
    });
    
    leaderboardElement.appendChild(table);
    
    // Add pagination controls
    createPaginationControls(leaderboardElement);
    
    // Add quick jump to current user if they're not on this page
    addUserLocationHelper(leaderboardElement);
    
    // Lazy fetch manager names & extra data for entries missing cache (real data mode only)
    if (!LEADERBOARD_CONFIG.enableTestData && pagePlayerIdsNeedingFetch.length > 0) {
        fetchManagerDataForPage(pagePlayerIdsNeedingFetch);
    }
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

// Fetch manager/team names for visible page players (batched sequentially to avoid rate issues)
function fetchManagerDataForPage(playerIds) {
    // Filter out ids already cached (defensive)
    const ids = playerIds.filter(id => !playerExtraCache[id]);
    if (ids.length === 0) return;
    console.log('Fetching manager data for page players:', ids);

    // We'll process sequentially to be gentle on API; could batch with Promise.all if needed
    let index = 0;
    function next() {
        if (index >= ids.length) {
            // Re-render rows to update placeholders
            updatePendingManagerCells();
            return;
        }
        const id = ids[index++];
        PlayFab.ClientApi.GetUserData({
            PlayFabId: id,
            Keys: ["managerName", "teamName", "leaderboardInfo"]
        }, function(res, err) {
            if (err) {
                console.warn('GetUserData failed for', id, err);
            } else if (res && res.data && res.data.Data) {
                const dataObj = res.data.Data;
                let managerName = dataObj.managerName ? dataObj.managerName.Value : null;
                let teamName = dataObj.teamName ? dataObj.teamName.Value : null;
                // Try leaderboardInfo JSON for fallback detail
                if ((!managerName || !teamName) && dataObj.leaderboardInfo) {
                    try {
                        const info = JSON.parse(dataObj.leaderboardInfo.Value);
                        managerName = managerName || info.managerName;
                        teamName = teamName || info.teamName;
                    } catch(parseErr) {
                        console.warn('Failed parsing leaderboardInfo for', id, parseErr);
                    }
                }
                playerExtraCache[id] = {
                    managerName: managerName || 'Unknown Manager',
                    teamName: teamName || null,
                    fetched: true
                };
            }
            // Update cells incrementally for responsiveness
            updatePendingManagerCells();
            setTimeout(next, 60); // slight delay to avoid hammering
        });
    }
    next();
}

// Update any cells still marked pending with fetched cache values
function updatePendingManagerCells() {
    const table = document.querySelector('.leaderboard-table');
    if (!table) return;
    const rows = table.tBodies[0] ? table.tBodies[0].rows : [];
    Array.from(rows).forEach(row => {
        const cells = row.cells;
        if (cells.length < 4) return; // Rank, Team, Manager, Points
        const managerCell = cells[2];
        if (managerCell && managerCell.dataset.pendingManager === 'true') {
            // Identify player via team cell + points? Instead store mapping: we can't easily map back without id.
            // Enhancement: store PlayFabId on row.
        }
    });
    // Improved approach: add data-playfab-id to each row on render, revisit that.
    const pending = table.querySelectorAll('tr[data-playfab-id] td[data-pending-manager="true"]');
    pending.forEach(cell => {
        const row = cell.closest('tr');
        const pid = row ? row.getAttribute('data-playfab-id') : null;
        if (pid && playerExtraCache[pid]) {
            cell.textContent = playerExtraCache[pid].managerName || 'Unknown Manager';
            cell.removeAttribute('data-pending-manager');
            // Update team cell if we have a better teamName
            const teamCell = row.cells[1];
            if (teamCell && playerExtraCache[pid].teamName) {
                teamCell.textContent = playerExtraCache[pid].teamName;
            }
        }
    });
}

// Render a lightweight loading placeholder while segments fetch
function renderLoadingPlaceholder() {
    const wrapper = document.getElementById('leaderboard-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="leaderboard-header">
        <h2>🏆 League Standings</h2>
        <div class="leaderboard-stats"><span>Loading page...</span></div>
      </div>
      <div class="loading-message">Fetching leaderboard data...</div>`;
}

// Fetch a leaderboard segment starting at startPosition
function fetchSegment(startPosition) {
    if (segmentCache[startPosition]) {
        return Promise.resolve(segmentCache[startPosition]);
    }
    if (segmentInFlight[startPosition]) {
        return segmentInFlight[startPosition];
    }
    const batchSize = LEADERBOARD_CONFIG.apiBatchSize;
    const promise = new Promise((resolve, reject) => {
        PlayFab.ClientApi.GetLeaderboard({
            StatisticName: "PlayerTotalPoints",
            StartPosition: startPosition,
            MaxResultsCount: batchSize
        }, function(result, error) {
            if (error) {
                delete segmentInFlight[startPosition];
                reject(error);
                return;
            }
            const entries = result.data.Leaderboard || [];
            segmentCache[startPosition] = entries;
            // Integrate into flattened array (sparse fill) for functions relying on it
            integrateSegmentIntoAll(entries, startPosition);
            highestFetchedRankExclusive = Math.max(highestFetchedRankExclusive, startPosition + entries.length);
            if (entries.length < batchSize) {
                discoveredEnd = true;
            }
            delete segmentInFlight[startPosition];
            resolve(entries);
        });
    });
    segmentInFlight[startPosition] = promise;
    return promise;
}

// Place segment entries into allLeaderboardData at correct positions
function integrateSegmentIntoAll(entries, startPosition) {
    if (!entries || entries.length === 0) return;
    // Ensure array large enough
    const neededLength = startPosition + entries.length;
    if (allLeaderboardData.length < neededLength) {
        allLeaderboardData.length = neededLength; // expands with undefineds
    }
    for (let i = 0; i < entries.length; i++) {
        allLeaderboardData[startPosition + i] = entries[i];
    }
}

// Recompute total pages when new data fetched
function recomputeTotalPages() {
    if (!LEADERBOARD_CONFIG.progressivePaging) return;
    if (discoveredEnd) {
        totalPages = Math.ceil(highestFetchedRankExclusive / LEADERBOARD_CONFIG.itemsPerPage) || 1;
    } else {
        // Estimate upper bound using hint
        totalPages = Math.ceil(Math.min(LEADERBOARD_CONFIG.maxTotalEntriesHint, highestFetchedRankExclusive + LEADERBOARD_CONFIG.apiBatchSize) / LEADERBOARD_CONFIG.itemsPerPage);
    }
}

// Build page slice from cached segments
function getPageDataSlice(startIndex, endIndex) {
    if (!LEADERBOARD_CONFIG.progressivePaging) {
        return allLeaderboardData.slice(startIndex, Math.min(endIndex, allLeaderboardData.length));
    }
    const batchSize = LEADERBOARD_CONFIG.apiBatchSize;
    const result = [];
    for (let i = startIndex; i < endIndex; i++) {
        // If already integrated, use flattened array directly
        if (allLeaderboardData[i]) {
            result.push(allLeaderboardData[i]);
            continue;
        }
        const segStart = Math.floor(i / batchSize) * batchSize;
        const seg = segmentCache[segStart];
        if (!seg) continue;
        const localIndex = i - segStart;
        const entry = seg[localIndex];
        if (entry) {
            result.push(entry);
        }
    }
    return result;
}