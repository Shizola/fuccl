// Initialize PlayFab
PlayFab.settings.titleId = "E210B";
console.log("PlayFab Title ID set to:", PlayFab.settings.titleId);

// ========================================
// DEBUG MODE CONFIGURATION
// Set to true to disable redirect logic for testing
// ========================================
const DEBUG_MODE = true; // Set to true to test both create-team and transfers pages

/* ========================================
   SHARED DATA CACHE AND UTILITIES
   Common data loading and caching functionality
   ======================================== */

// Function to extract surname from full name with first initial
function extractSurname(fullName) {
    if (!fullName) return '';
    const nameParts = fullName.trim().split(' ');
    
    if (nameParts.length === 1) {
        // If only one name part, return as is
        return nameParts[0];
    }
    
    // Get first initial and surname
    const firstInitial = nameParts[0].charAt(0).toUpperCase();
    const surname = nameParts[nameParts.length - 1];
    
    return `${firstInitial}. ${surname}`;
}

// Simple data cache to avoid refetching the same data
const sharedDataCache = {
    playerData: null,
    gameWeek: null,
    lastFetch: 0,
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutes in milliseconds
};

// Function to check if cached data is still valid
function isSharedCacheValid() {
    return sharedDataCache.playerData && 
           sharedDataCache.gameWeek && 
           (Date.now() - sharedDataCache.lastFetch) < sharedDataCache.CACHE_DURATION;
}

// Function to calculate weekly points for a player
function calculateWeeklyPoints(playerDataString, gameWeek) {
    try {
        const parts = playerDataString.split('|');
        const pointsArray = parts[4].split(','); // Weekly points are stored as a comma-separated string

        // Log the points array for debugging
        //console.log(`Points Array for Gameweek ${gameWeek}:`, pointsArray);

        // Return the points for the current gameweek (1-based index)
        return parseInt(pointsArray[gameWeek - 1] || 0);
    } catch (error) {
        console.error("Error calculating weekly points:", error, "Player Data:", playerDataString);
        return 0; // Return 0 points if there's an error
    }
}

// Function to calculate total points for a player across all gameweeks up to the current one
function calculateTotalPointsUpToCurrentWeek(playerDataString, currentGameWeek) {
    try {
        const parts = playerDataString.split('|');
        const pointsArray = parts[4].split(','); // Weekly points are stored as a comma-separated string
        
        // Log the points array for debugging
        //console.log(`Points Array up to Gameweek ${currentGameWeek}:`, pointsArray);
        
        // Sum up points for all weeks up to the current gameweek
        let totalPoints = 0;
        for (let week = 0; week < currentGameWeek; week++) {
            // Add points for each week (using 0 if the week doesn't exist in the array)
            const weeklyPoints = parseInt(pointsArray[week] || 0);
            totalPoints += weeklyPoints;
            
            //console.log(`Week ${week + 1}: ${weeklyPoints} points`);
        }
        
        //console.log(`Total accumulated points up to week ${currentGameWeek}: ${totalPoints}`);
        return totalPoints;
    } catch (error) {
        console.error("Error calculating total points:", error, "Player Data:", playerDataString);
        return 0; // Return 0 points if there's an error
    }
}

// Function to parse player data from PlayFab
function parsePlayerData(playerDataString) {
    // Validate input
    if (!playerDataString || typeof playerDataString !== 'string') {
        console.error("Invalid player data string:", playerDataString);
        return null;
    }
    
    const parts = playerDataString.split('|');
    
    // Validate data format - should have exactly 6 parts: name|team|position|price|weeklyPoints|totalPoints
    if (parts.length !== 6) {
        console.error(`Invalid player data format - expected 6 parts, got ${parts.length}:`, playerDataString);
        return null;
    }
    
    const name = parts[0] || 'Unknown Player'; // Provide fallback
    const teamName = parts[1] || 'Unknown Team'; // Provide fallback
    const position = parts[2] || 'Unknown'; // Provide fallback
    const price = parseFloat(parts[3]) || 4.0; // Player price in millions
    const weeklyPointsArray = parts[4] || ''; // Weekly points array as string
    const totalPoints = parseInt(parts[5]) || 0; // Fallback to 0 if parsing fails

    // Convert position to match the full position names used in filtering
    const positionMap = {
        Goalkeeper: 'goalkeeper',
        Defender: 'defender',
        Midfielder: 'midfielder',
        Attacker: 'attacker'
    };

    // Map team names to shirt images
    const shirtImageMap = {
        'Highfields FC': 'images/shirts/highfields.svg',
        'Vineyard FC': 'images/shirts/vineyard.svg',
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
        'Mumbles Baptist FC': 'images/shirts/mumbles.svg',
        'Oasis FC': 'images/shirts/oasis.svg'
    };

    // Determine the shirt image
    let shirtImage = shirtImageMap[teamName] || 'images/shirts/template.svg';
    if (positionMap[position] === 'goalkeeper') {
        // For goalkeepers, try to use _gk version first, fallback to regular
        const gkShirt = shirtImage.replace('.svg', '_gk.svg');
        // Check if the GK shirt exists by trying to load it (this will fallback in onerror)
        shirtImage = gkShirt;
    }

    return {
        name,
        teamName, // Add the team name to the returned object
        position: positionMap[position] || 'unknown', // Map position or default to 'unknown'
        price, // Player price in millions
        points: totalPoints,
        weeklyPointsArray, // Add weekly points array for future use
        shirtImage // Use the determined shirt image
    };
}

// ========================================
// FORMATION VALIDATION & AUTO-HEALING (Multiple legal formations)
// Supported formations (starting XI, GK always 1):
// 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-2-3, 5-3-2, 5-4-1
// Bench (squad size 15): remaining 4 players; preference: 2nd GK (if any) + highest price remaining.
// We NEVER drop players; only reorder when starting XI invalid.
// Returned: { healedIds, healedPlayers, healed, formation }
function enforceLegalFormation(players) {
    if (!Array.isArray(players) || players.length === 0) {
        return { healedIds: [], healedPlayers: [], healed: false, formation: null };
    }

    const legalPatterns = [
        { df:3, md:4, at:3, key:'3-4-3' },
        { df:3, md:5, at:2, key:'3-5-2' },
        { df:4, md:3, at:3, key:'4-3-3' },
        { df:4, md:4, at:2, key:'4-4-2' },
        { df:4, md:5, at:1, key:'4-5-1' },
        { df:5, md:2, at:3, key:'5-2-3' },
        { df:5, md:3, at:2, key:'5-3-2' },
        { df:5, md:4, at:1, key:'5-4-1' }
    ];

    // Helpers
    const posGroups = {
        gk: players.filter(p => p.position === 'goalkeeper'),
        df: players.filter(p => p.position === 'defender'),
        md: players.filter(p => p.position === 'midfielder'),
        at: players.filter(p => p.position === 'attacker')
    };

    // Fast path: if we have at least 11, check existing first XI for validity.
    if (players.length >= 11) {
        const xi = players.slice(0,11);
        const counts = { gk:0, df:0, md:0, at:0 };
        xi.forEach(p => {
            switch(p.position){
                case 'goalkeeper': counts.gk++; break;
                case 'defender': counts.df++; break;
                case 'midfielder': counts.md++; break;
                case 'attacker': counts.at++; break;
            }
        });
        if (counts.gk === 1) {
            const pattern = legalPatterns.find(f => f.df === counts.df && f.md === counts.md && f.at === counts.at);
            if (pattern) {
                return {
                    healedIds: players.map(p => p.id),
                    healedPlayers: players,
                    healed: false,
                    formation: pattern.key
                };
            }
        }
    }

    // Need to build a valid starting XI. Choose a legal formation we can satisfy with available pool.
    // Preference: pattern closest to available distribution (min sum of deficits) then higher attackers (more exciting) then fewer changes.
    const availableCounts = { gk: posGroups.gk.length, df: posGroups.df.length, md: posGroups.md.length, at: posGroups.at.length };
    if (availableCounts.gk < 1) {
        // Can't build anything
        return { healedIds: players.map(p=>p.id), healedPlayers: players, healed:false, formation:null };
    }

    const feasible = legalPatterns.filter(p => availableCounts.df >= p.df && availableCounts.md >= p.md && availableCounts.at >= p.at);
    if (feasible.length === 0) {
        return { healedIds: players.map(p=>p.id), healedPlayers: players, healed:false, formation:null };
    }

    // Scoring function: more attackers prioritized, then midfielders, then defenders (entertainment bias)
    feasible.sort((a,b) => (b.at - a.at) || (b.md - a.md) || (a.df - b.df));
    const chosen = feasible[0];

    // Sort each positional group by price desc to field strongest XI
    const sortByPriceDesc = arr => arr.slice().sort((a,b)=>(b.price||0)-(a.price||0));
    const gkSorted = sortByPriceDesc(posGroups.gk);
    const dfSorted = sortByPriceDesc(posGroups.df);
    const mdSorted = sortByPriceDesc(posGroups.md);
    const atSorted = sortByPriceDesc(posGroups.at);

    const startingXI = [
        gkSorted[0],
        ...dfSorted.slice(0, chosen.df),
        ...mdSorted.slice(0, chosen.md),
        ...atSorted.slice(0, chosen.at)
    ];

    // Bench: add second GK if exists, then highest priced remaining irrespective of position until 4 bench spots filled.
    const usedIds = new Set(startingXI.map(p=>p.id));
    const bench = [];
    if (gkSorted.length > 1) bench.push(gkSorted[1]);
    // Pool of remaining candidates sorted by price
    const remaining = players.filter(p => !usedIds.has(p.id)).sort((a,b)=>(b.price||0)-(a.price||0));
    for (const p of remaining) {
        if (bench.length >= 4) break;
        if (!bench.includes(p)) bench.push(p);
    }

    const ordered = [...startingXI, ...bench, ...remaining.filter(p => !bench.includes(p))];
    const healedIds = ordered.map(p=>p.id);
    const originalIds = players.map(p=>p.id);
    const healed = healedIds.length === originalIds.length && healedIds.every((id,i)=> id===originalIds[i]) ? false : true;
    return { healedIds, healedPlayers: ordered, healed, formation: chosen.key };
}

// Shared function to load player data and gameweek from PlayFab (optimized with caching)
function loadSharedPlayersFromPlayFab(callback) {
    // Check cache first
    if (isSharedCacheValid()) {
        // Return cached data
        const cachedData = sharedDataCache.playerData;
        callback(null, cachedData);
        return;
    }

    // Cache miss - fetch fresh data
    
    // Fetch user data to get the selectedPlayers key and captain
    PlayFab.ClientApi.GetUserData({
        Keys: ["selectedPlayers", "captainId", "teamName", "managerName", "freeTransfers", "currentPlayerTransfersWeek"]
    }, function (result, error) {
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

            // Get captain ID if it exists
            const captainId = result.data.Data.captainId ? result.data.Data.captainId.Value : null;
            // Get free transfers (default 1 if missing or invalid)
            const freeTransfersRaw = result.data.Data.freeTransfers ? result.data.Data.freeTransfers.Value : null;
            let freeTransfers = parseInt(freeTransfersRaw, 10);
            if (isNaN(freeTransfers) || freeTransfers < 0) {
                freeTransfers = 1;
            }
            // Get currentPlayerTransfersWeek (default to gameWeek later if missing)
            const currentTransfersWeekRaw = result.data.Data.currentPlayerTransfersWeek ? result.data.Data.currentPlayerTransfersWeek.Value : null;
            let currentPlayerTransfersWeek = parseInt(currentTransfersWeekRaw, 10);
            if (isNaN(currentPlayerTransfersWeek) || currentPlayerTransfersWeek < 1) {
                currentPlayerTransfersWeek = null; // will initialize after fetching title data
            }

            let selectedPlayerIds;
            try {
                // Parse the JSON string into an array
                selectedPlayerIds = JSON.parse(selectedPlayersString);
            } catch (e) {
                console.error("Error parsing selectedPlayersString:", e);
                callback("Error parsing selectedPlayersString", null);
                return;
            }

            // OPTIMIZATION: Batch all title data requests into a single API call
            const titleDataKeys = selectedPlayerIds.map(id => `player_${id}`);
            titleDataKeys.push("gameWeek"); // Add gameWeek to the keys to fetch it in the same API call

            // Single API call to fetch all player data + gameweek
            PlayFab.ClientApi.GetTitleData({ Keys: titleDataKeys }, function (titleDataResult, titleDataError) {
                if (titleDataError) {
                    console.error("Error retrieving title data from PlayFab:", titleDataError);
                    callback(titleDataError, null);
                } else {
                    // Check if titleDataResult.data.Data exists
                    if (titleDataResult.data && titleDataResult.data.Data) {
                        // Get the current gameweek
                        const gameWeek = parseInt(titleDataResult.data.Data.gameWeek);
                        console.log("Current Gameweek:", gameWeek);

                        // Rollover logic for free transfers based on week difference
                        let rolloverApplied = false;
                        if (!isNaN(gameWeek)) {
                            if (currentPlayerTransfersWeek === null) {
                                // First-time initialization: set to current gameWeek and ensure at least 1 free transfer
                                const before = freeTransfers;
                                if (freeTransfers < 1) {
                                    freeTransfers = 1; // baseline free transfer on first initialization
                                }
                                currentPlayerTransfersWeek = gameWeek;
                                rolloverApplied = true; // we will persist initialization (week and maybe free transfer adjustment)
                                console.log(`Initial transfers week setup: week=${gameWeek}, freeTransfers ${before}->${freeTransfers}`);
                            } else if (gameWeek > currentPlayerTransfersWeek) {
                                const weeksBehind = gameWeek - currentPlayerTransfersWeek;
                                if (weeksBehind > 0) {
                                    const before = freeTransfers;
                                    freeTransfers = Math.min(2, freeTransfers + weeksBehind); // cap at 2
                                    currentPlayerTransfersWeek = gameWeek; // advance tracked week
                                    rolloverApplied = true;
                                    console.log(`Rollover applied: weeksBehind=${weeksBehind}, freeTransfers ${before}->${freeTransfers}`);
                                }
                            }
                        }

                        // Parse the players and calculate points
                        let weeklyPointsTotal = 0;         // For displaying current week's points
                        let cumulativePointsTotal = 0;     // For the leaderboard (all weeks combined)
                        
                        const players = selectedPlayerIds.map(id => {
                            const key = `player_${id}`;
                            const playerDataString = titleDataResult.data.Data[key];

                            if (playerDataString) {
                                const player = parsePlayerData(playerDataString);
                                
                                // Skip invalid players that couldn't be parsed
                                if (!player) {
                                    console.warn(`Failed to parse player data for ID: ${id}`);
                                    return null;
                                }
                                
                                // Add the player ID to the player object for captain identification
                                player.id = id;
                                
                                // Calculate points for current week only (for display)
                                const weeklyPoints = calculateWeeklyPoints(playerDataString, gameWeek);
                                player.weeklyPoints = weeklyPoints;
                                
                                // Calculate cumulative points for all weeks up to current
                                const cumulativePoints = calculateTotalPointsUpToCurrentWeek(playerDataString, gameWeek);
                                player.cumulativePoints = cumulativePoints;
                                
                                // Check if this player is the captain and triple their points
                                const isCaptain = captainId && String(captainId) === String(id);
                                if (isCaptain) {
                                    // Triple captain's points for both weekly and cumulative totals
                                    const tripledWeeklyPoints = weeklyPoints * 3;
                                    const tripledCumulativePoints = cumulativePoints * 3;
                                    
                                    // Store tripled points on player object for display
                                    player.weeklyPoints = tripledWeeklyPoints;
                                    player.cumulativePoints = tripledCumulativePoints;
                                    
                                    // Add tripled points to totals
                                    weeklyPointsTotal += tripledWeeklyPoints;
                                    cumulativePointsTotal += tripledCumulativePoints;
                                    
                                    console.log(`Captain ${player.name}: Weekly ${weeklyPoints} -> ${tripledWeeklyPoints}, Cumulative ${cumulativePoints} -> ${tripledCumulativePoints}`);
                                } else {
                                    // Add regular points to totals for non-captain players
                                    weeklyPointsTotal += weeklyPoints;
                                    cumulativePointsTotal += cumulativePoints;
                                }
                                
                                return player;
                            } else {
                                console.warn(`No data found for player ID: ${id}`);
                                return null;
                            }
                        }).filter(player => player !== null); // Filter out any null values

                        // Auto-heal formation if needed before caching / returning
                        let formationHealed = false;
                        let healedIds = selectedPlayerIds;
                        let healedPlayers = players;
                        let detectedFormation = null;
                        try {
                            const { healedIds: hIds, healedPlayers: hPlayers, healed, formation } = enforceLegalFormation(players);
                            formationHealed = healed;
                            detectedFormation = formation;
                            if (formationHealed) {
                                console.log('Formation auto-healed to legal pattern:', formation);
                                healedIds = hIds;
                                healedPlayers = hPlayers;
                            } else if (formation) {
                                console.log('Existing formation is legal:', formation);
                            }
                        } catch (e) {
                            console.warn('Formation normalization failed:', e);
                        }

                        // Prepare data for response
                        const responseData = {
                            players: healedPlayers,
                            weeklyPointsTotal,         // Current week points
                            cumulativePointsTotal,     // Total points across all weeks
                            gameWeek,                  // Current gameweek
                            selectedPlayerIds: healedIds,
                            captainId,                 // Store captain separately
                            freeTransfers,             // Current free transfers available (after rollover)
                            currentPlayerTransfersWeek, // Week marker for transfers logic
                            formation: detectedFormation
                        };

                        // Cache the successful response
                        sharedDataCache.playerData = responseData;
                        sharedDataCache.gameWeek = gameWeek;
                        sharedDataCache.lastFetch = Date.now();
                        console.log("Shared data cached successfully");

                        // If rollover changed data, persist updated freeTransfers & currentPlayerTransfersWeek immediately to prevent refresh abuse
                        if (rolloverApplied || formationHealed) {
                            const dataUpdate = {};
                            if (rolloverApplied) {
                                dataUpdate.freeTransfers = freeTransfers.toString();
                                dataUpdate.currentPlayerTransfersWeek = currentPlayerTransfersWeek.toString();
                            }
                            if (formationHealed) {
                                dataUpdate.selectedPlayers = JSON.stringify(healedIds);
                            }
                            PlayFab.ClientApi.UpdateUserData({ Data: dataUpdate }, function(uResult, uError) {
                                if (uError) {
                                    console.warn('Failed to persist auto-heal / rollover update:', uError);
                                } else {
                                    console.log('Persisted auto-heal / rollover update');
                                }
                                callback(null, responseData);
                            });
                        } else {
                            callback(null, responseData);
                        }
                    } else {
                        console.error("No title data returned.");
                        callback("No title data returned", null);
                    }
                }
            });
        }
    });
}

// Shared memory management functions
let sharedEventListeners = [];

// Optimized event listener management
function addManagedEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    sharedEventListeners.push({ element, event, handler });
}

// Cleanup function for memory management
function cleanupSharedResources() {
    // Remove all managed event listeners
    sharedEventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    sharedEventListeners = [];
    
    // Clear cached data to free memory
    sharedDataCache.playerData = null;
    sharedDataCache.gameWeek = null;
    sharedDataCache.lastFetch = null;
}

// Add page visibility API to cleanup when tab is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Clear expired cache when tab is hidden to save memory
        if (!isSharedCacheValid()) {
            sharedDataCache.playerData = null;
            sharedDataCache.gameWeek = null;
            sharedDataCache.lastFetch = null;
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupSharedResources);

// Authentication functions
function setupPlayFabAuth() {
    const sessionTicket = localStorage.getItem("sessionTicket");
    if (sessionTicket) {
        PlayFab._internalSettings.sessionTicket = sessionTicket;
        return true;
    }
    return false;
}

function handleAuthError() {
    localStorage.removeItem("sessionTicket");
    localStorage.removeItem("playFabId"); // Also remove stored PlayFab ID
    alert("Your session has expired. Please log in again.");
    window.location.href = "login.html";
}

// User registration and login functions
function registerUser(event) {
    event.preventDefault(); // Prevent form submission
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Input validation
    if (!email || !email.trim()) {
        alert('Please enter an email address');
        return;
    }
    if (!password || password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        alert('Please enter a valid email address');
        return;
    }
    const request = {
        TitleId: PlayFab.settings.titleId,
        Email: email,
        Password: password,
        RequireBothUsernameAndEmail: false
    };
    PlayFab.ClientApi.RegisterPlayFabUser(request, handleRegistrationResponse);
}

function handleRegistrationResponse(result, error) {
    if (error) {
        console.error("Error registering user:", error);
        alert("Registration failed: " + error.errorMessage);
    } else {
        console.log("User registered successfully:", result);
        
        // Store session ticket
        localStorage.setItem("sessionTicket", result.data.SessionTicket);
        
        // Immediately get and store PlayFab ID for future use
        PlayFab.ClientApi.GetAccountInfo({}, function(accountResult, accountError) {
            if (!accountError && accountResult.data.AccountInfo.PlayFabId) {
                localStorage.setItem("playFabId", accountResult.data.AccountInfo.PlayFabId);
                console.log("Stored PlayFab ID:", accountResult.data.AccountInfo.PlayFabId);
            } else {
                console.warn("Could not retrieve PlayFab ID during registration:", accountError);
            }
            
            // Continue with redirect regardless
            alert("Registration successful! Redirecting to create team.");
            window.location.href = "create-team.html";
        });
    }
}

function loginUser(event) {
    event.preventDefault(); // Prevent form submission
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Input validation
    if (!email || !email.trim()) {
        alert('Please enter an email address');
        return;
    }
    if (!password || password.length < 1) {
        alert('Please enter a password');
        return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        alert('Please enter a valid email address');
        return;
    }
    const request = {
        TitleId: PlayFab.settings.titleId,
        Email: email,
        Password: password
    };
    PlayFab.ClientApi.LoginWithEmailAddress(request, handleLoginResponse);
}

function handleLoginResponse(result, error) {
    if (error) {
        console.error("Error logging in:", error);
        alert("Login failed: " + error.errorMessage);
    } else {
        console.log("User logged in successfully:", result);

        // Store session ticket
        localStorage.setItem("sessionTicket", result.data.SessionTicket);

        // Immediately get and store PlayFab ID for future use
        PlayFab.ClientApi.GetAccountInfo({}, function(accountResult, accountError) {
            if (!accountError && accountResult.data.AccountInfo.PlayFabId) {
                localStorage.setItem("playFabId", accountResult.data.AccountInfo.PlayFabId);
                console.log("Stored PlayFab ID:", accountResult.data.AccountInfo.PlayFabId);
            } else {
                console.warn("Could not retrieve PlayFab ID during login:", accountError);
            }

            // Check user status and redirect accordingly
            checkUserStatusAndRedirect();
        });
    }
}

// Logout function
function logOut() {
    localStorage.removeItem("sessionTicket");
    localStorage.removeItem("playFabId"); // Also remove stored PlayFab ID
    console.log("User logged out successfully");
    window.location.href = "index.html";
}

function resetPassword(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;

    // Input validation
    if (!email || !email.trim()) {
        alert('Please enter an email address');
        return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        alert('Please enter a valid email address');
        return;
    }

    const request = {
        TitleId: PlayFab.settings.titleId,
        Email: email
    };
    PlayFab.ClientApi.SendAccountRecoveryEmail(request, function(result, error) {
        if (error) {
            console.error("Error sending recovery email:", error);
            alert("Password reset failed: " + error.errorMessage);
        } else {
            console.log("Password reset email sent successfully:", result);
            alert("Password reset email sent! Please check your inbox.");
        }
    });
}

// Team management functions
function registerTeam(event) {
    event.preventDefault();
    if (!setupPlayFabAuth()) {
        alert("You must be logged in to create a team");
        window.location.href = "login.html";
        return;
    }
    const teamName = document.getElementById('teamName').value;
    const managerName = document.getElementById('managerName').value;

    // Enhanced input validation
    const teamValidation = validateTeamName(teamName);
    if (!teamValidation.isValid) {
        alert(teamValidation.message);
        return;
    }

    const managerValidation = validateManagerName(managerName);
    if (!managerValidation.isValid) {
        alert(managerValidation.message);
        return;
    }

    // Sanitize input (remove potentially harmful characters)
    const sanitizedTeamName = teamName.trim().substring(0, 30); // Limit team name to 30 chars
    const sanitizedManagerName = managerName.trim().substring(0, 20); // Limit manager name to 20 chars

    const teamData = {
        teamName: sanitizedTeamName,
        managerName: sanitizedManagerName
    };
    const request = {
        Data: teamData
    };
    PlayFab.ClientApi.UpdateUserData(request, handleTeamUpdateResponse);
}

function handleTeamUpdateResponse(result, error) {
    if (error) {
        console.error("Error updating user data:", error);
        if (error.errorCode === 1000) {
            handleAuthError();
        } else {
            alert("Failed to create team: " + error.errorMessage);
        }
    } else {
        console.log("Team created successfully:", result);
        alert("Team created successfully!");
        
        // Check if user has selectedPlayers data to determine next page
        checkSelectedPlayersAndRedirect();
    }
}

function checkUserStatusAndRedirect() {
    console.log("Checking user status for redirection...");

    PlayFab.ClientApi.GetUserData({}, function(result, error) {
        if (error) {
            console.error("Error checking user data:", error);
            // On error, default to create team page to be safe
            window.location.href = "create-team.html";
            return;
        }

        const teamName = result.data.Data.teamName ? result.data.Data.teamName.Value : null;
        const selectedPlayersString = result.data.Data.selectedPlayers ? result.data.Data.selectedPlayers.Value : null;
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        if (!teamName) {
            // New user - no team created yet
            if (currentPage !== 'create-team.html') {
                console.log("New user - redirecting to create team page");
                window.location.href = "create-team.html";
            } else {
                console.log("New user already on create team page - staying here");
            }
        } else if (!selectedPlayersString) {
            // User has team but no selected players - redirect to create team
            if (currentPage !== 'create-team.html') {
                console.log("User has team but no players - redirecting to create team page");
                window.location.href = "create-team.html";
            } else {
                console.log("User has team but no players - already on create team page");
            }
        } else {
            // User has both team and selected players - redirect to points
            if (DEBUG_MODE && currentPage === 'create-team.html') {
                console.log("DEBUG MODE: User has complete team but staying on create-team page for testing");
            } else {
                console.log("User has complete team - redirecting to points page");
                window.location.href = "points.html";
            }
        }
    });
}

// Validation functions for team and manager names
function validateTeamName(teamName) {
    // Check if empty
    if (!teamName || !teamName.trim()) {
        return { isValid: false, message: 'Please enter a team name' };
    }

    const trimmedName = teamName.trim();

    // Check character limit (30 characters)
    if (trimmedName.length > 30) {
        return { isValid: false, message: 'Team name must be 30 characters or less' };
    }

    // Check minimum length
    if (trimmedName.length < 2) {
        return { isValid: false, message: 'Team name must be at least 2 characters long' };
    }

    // Check for inappropriate content
    const inappropriateContent = checkForInappropriateContent(trimmedName);
    if (inappropriateContent) {
        return { isValid: false, message: 'Team name contains inappropriate content. Please choose a different name.' };
    }

    // Check for valid characters (letters, numbers, spaces, hyphens, apostrophes)
    const validPattern = /^[a-zA-Z0-9\s\-']+$/;
    if (!validPattern.test(trimmedName)) {
        return { isValid: false, message: 'Team name can only contain letters, numbers, spaces, hyphens, and apostrophes' };
    }

    // Check for excessive repeated characters
    if (/(.)\1{3,}/.test(trimmedName)) {
        return { isValid: false, message: 'Team name cannot contain excessive repeated characters' };
    }

    return { isValid: true };
}

function validateManagerName(managerName) {
    // Check if empty
    if (!managerName || !managerName.trim()) {
        return { isValid: false, message: 'Please enter a manager name' };
    }

    const trimmedName = managerName.trim();

    // Check character limit (20 characters)
    if (trimmedName.length > 20) {
        return { isValid: false, message: 'Manager name must be 20 characters or less' };
    }

    // Check minimum length
    if (trimmedName.length < 2) {
        return { isValid: false, message: 'Manager name must be at least 2 characters long' };
    }

    // Check for inappropriate content
    const inappropriateContent = checkForInappropriateContent(trimmedName);
    if (inappropriateContent) {
        return { isValid: false, message: 'Manager name contains inappropriate content. Please choose a different name.' };
    }

    // Check for valid characters (letters, spaces, hyphens, apostrophes)
    const validPattern = /^[a-zA-Z\s\-']+$/;
    if (!validPattern.test(trimmedName)) {
        return { isValid: false, message: 'Manager name can only contain letters, spaces, hyphens, and apostrophes' };
    }

    // Check for excessive repeated characters
    if (/(.)\1{3,}/.test(trimmedName)) {
        return { isValid: false, message: 'Manager name cannot contain excessive repeated characters' };
    }

    return { isValid: true };
}

function checkForInappropriateContent(text) {
    // List of inappropriate words and patterns to block
    const blockedWords = [
    // Profanity and offensive terms
    'fuck', 'shit', 'damn', 'bitch', 'bastard', 'asshole', 'cunt', 'pussy', 'dick', 'cock',
    'fag', 'faggot', 'nigger', 'nigga', 'chink', 'gook', 'spic', 'wetback', 'kike', 'heeb',
    'slut', 'whore', 'cocksucker', 'motherfucker', 'bullshit', 'piss', 'tits', 'boobs',

    // Ableist / derogatory terms
    'retard', 'retarded', 'spaz', 'spastic', 'mong', 'moron', 'idiot', 'imbecile', 'simpleton',

    // British / Irish / Aussie slang insults
    'twat', 'knob', 'nob', 'wanker', 'tosser', 'bellend', 'prick', 'git', 'pillock', 
    'slag', 'sket', 'minge', 'nonce', 'muppet', 'bugger', 'arse', 'arsehole', 'bollocks',
    'numpty', 'gormless', 'div', 'plonker', 'scrubber',

    // Hate speech / discriminatory terms
    'racist', 'sexist', 'homophobe', 'transphobe', 'bigot', 'supremacist', 'nazi', 'kkk',
    'hitler', 'stalin', 'mao', 'genocide', 'holocaust', 'slave', 'terrorism', 'terrorist',

    // Sexual content
    'sex', 'porn', 'xxx', 'nsfw', 'adult', 'erotic', 'nude', 'naked', 'orgy', 'gangbang',
    'milf', 'hentai', 'fetish', 'bdsm', 'kinky', 'anal', 'blowjob', 'handjob', 'rimjob',

    // Drug references
    'cocaine', 'heroin', 'meth', 'weed', 'marijuana', 'crack', 'ecstasy', 'lsd', 'shrooms',
    'ketamine', 'opioid', 'opium', 'adderall', 'xanax', 'valium',

    // Violence and harm
    'kill', 'murder', 'rape', 'abuse', 'torture', 'suicide', 'bomb', 'gun', 'knife', 'death',
    'hang', 'lynch', 'stab', 'shoot', 'execute', 'massacre',

    // Religious offense (mild)
    'satan', 'devil', 'hell', 'damnation', 'antichrist',

    // Spam patterns
    'spam', 'scam', 'fake', 'test', 'admin', 'moderator', 'bot', 'system'
];


    const lowerText = text.toLowerCase();

    // Check for exact blocked words using word boundaries to prevent false positives
    for (const word of blockedWords) {
        // Use regex with word boundaries to match complete words only
        const regex = new RegExp(`\\b${word}\\b`, 'i'); // 'i' flag for case-insensitive matching
        if (regex.test(lowerText)) {
            return true;
        }
    }

    // Check for common leetspeak variations
    const leetspeakPatterns = [
        /f+u+c+k+/i, /sh+i+t+/i, /b+i+t+c+h+/i, /c+u+n+t+/i, /d+i+c+k+/i,
        /n+i+g+g+e+r+/i, /f+a+g+/i, /s+l+u+t+/i, /wh+o+r+e+/i, /s+e+x+/i
    ];

    for (const pattern of leetspeakPatterns) {
        if (pattern.test(lowerText)) {
            return true;
        }
    }

    // Check for excessive symbols or numbers
    const symbolCount = (text.match(/[^a-zA-Z\s\-']/g) || []).length;
    if (symbolCount > text.length * 0.3) { // More than 30% symbols
        return true;
    }

    return false;
}

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

// User data functions
function testUserDataAccess() {
    console.log("Testing user data access");
    PlayFab.ClientApi.GetUserData({}, handleUserDataResponse);
}

function handleUserDataResponse(result, error) {
    if (error) {
        console.error("Error getting user data:", error);
    } else {
        console.log("Successfully retrieved user data:", result);
    }
}

// Fetch user profile data and return it through a callback
function fetchUserData(callback) {
    console.log("Fetching user data...");
    PlayFab.ClientApi.GetUserData({}, function(result, error) {
        if (error) {
            console.error("Error getting profile data:", error);
            callback(error, null);
        } else {
            const userData = {
                teamName: result.data.Data.teamName ? result.data.Data.teamName.Value : "Not set",
                managerName: result.data.Data.managerName ? result.data.Data.managerName.Value : "Not set"
            };
            callback(null, userData);
        }
    });
}

// Display profile data (for profile page)
function loadProfileData() {
    fetchUserData(function(error, userData) {
        if (!error && userData) {
            document.getElementById('teamName').innerText = userData.teamName;
            document.getElementById('managerName').innerText = userData.managerName;
        }
    });
}

// Display team name with proper error handling
function loadTeamNameOnly() {
    fetchUserData(function(error, userData) {
        const teamNameElement = document.getElementById('teamName');
        if (!teamNameElement) {
            console.error("Team name element not found");
            return;
        }
        
        if (error) {
            console.error("Error loading team name:", error);
            teamNameElement.textContent = 'Unknown Team';
        } else if (userData && userData.teamName) {
            teamNameElement.textContent = userData.teamName;
            console.log("Team name loaded:", userData.teamName);
        } else {
            teamNameElement.textContent = 'Unknown Team';
            console.log("No team name found, using default");
        }
    });
}

// Helper function to get PlayFab ID (cached or from API)
function getPlayFabId(callback) {
    // First try to get cached PlayFab ID
    const cachedPlayFabId = localStorage.getItem("playFabId");
    if (cachedPlayFabId) {
        console.log("Using cached PlayFab ID:", cachedPlayFabId);
        callback(null, cachedPlayFabId);
        return;
    }
    
    // Fallback to API call if not cached
    console.log("PlayFab ID not cached, fetching from API...");
    PlayFab.ClientApi.GetAccountInfo({}, function(accountResult, accountError) {
        if (accountError) {
            console.error("Error getting PlayFab ID:", accountError);
            callback(accountError, null);
        } else {
            const playFabId = accountResult.data.AccountInfo.PlayFabId;
            // Cache it for future use
            localStorage.setItem("playFabId", playFabId);
            console.log("Retrieved and cached PlayFab ID:", playFabId);
            callback(null, playFabId);
        }
    });
}

// Helper function to initialize page-specific content
function initializePage(currentPage) {
    switch (currentPage) {
        case 'profile.html':
            loadProfileData();
            break;
            
        case 'points.html':
            checkTeamName();
            loadTeamNameOnly();
            
            // PERFORMANCE OPTIMIZATION: Show loading states and handle errors gracefully
            const pointsElements = {
                gameweek: document.getElementById('gameweek'),
                weeklyPoints: document.getElementById('weeklyPoints'),
                totalPoints: document.getElementById('totalPoints'),
                teamName: document.getElementById('teamName')
            };
            
            // Set loading states
            if (pointsElements.gameweek) pointsElements.gameweek.textContent = 'Loading...';
            if (pointsElements.weeklyPoints) pointsElements.weeklyPoints.textContent = 'Loading...';
            if (pointsElements.totalPoints) pointsElements.totalPoints.textContent = 'Loading...';
            
            // Load players and render the pitch for points page
            if (typeof loadPlayersFromPlayFab === 'function') {
                loadPlayersFromPlayFab(function (error, data) {
                    if (error) {
                        console.error("Failed to load player data:", error);
                        // Show error states
                        if (pointsElements.gameweek) pointsElements.gameweek.textContent = 'Error';
                        if (pointsElements.weeklyPoints) pointsElements.weeklyPoints.textContent = 'Error';
                        if (pointsElements.totalPoints) pointsElements.totalPoints.textContent = 'Error';
                        
                        // Show error message to user
                        const pitch = document.querySelector('.pitch');
                        if (pitch) {
                            pitch.innerHTML = '<div class="error-message">Failed to load player data. Please refresh the page.</div>';
                        }
                    } else {
                        const { players, selectedPlayerIds, captainId } = data;
                        console.log("Selected players:", players);
                        // Render the players on the pitch
                        if (typeof renderPlayersOnPitch === 'function') {
                            renderPlayersOnPitch(players, selectedPlayerIds, captainId);
                        }
                    }
                });
            }
            break;
            
        case 'league.html':
            checkTeamName();
            // Load leaderboard for league page
            if (typeof getLeaderboard === 'function') {
                getLeaderboard();
            }
            break;
            
        case 'pick-team.html':
            checkTeamName();
            loadTeamNameOnly();
            
            // Initialize mobile dropdown for pick-team page
            initializeMobileDropdown();
            
            // Load players for pick team page
            if (typeof loadPlayersFromPlayFab === 'function') {
                loadPlayersFromPlayFab(function (error, data) {
                    if (error) {
                        console.error("Failed to load player data:", error);
                        
                        // Check if the error is due to missing selectedPlayers key
                        if (error === "No selectedPlayers key found") {
                            console.log("User has no team data - redirecting to create team page");
                            alert("No team found. You'll be redirected to create your team.");
                            window.location.href = "create-team.html";
                            return;
                        }
                        
                        // Show error message to user for other errors
                        const pitch = document.querySelector('.pitch');
                        if (pitch) {
                            pitch.innerHTML = '<div class="error-message">Failed to load player data. Please refresh the page.</div>';
                        }
                    } else {
                        const { players, selectedPlayerIds, captainId } = data;
                        console.log("Available players for selection:", players);
                        // Render the players on the pitch
                        if (typeof renderPlayersOnPitch === 'function') {
                            renderPlayersOnPitch(players, selectedPlayerIds, captainId);
                        }
                    }
                });
            }
            break;
            
        case 'create-team.html':
            // Check if user already has a complete team
            PlayFab.ClientApi.GetUserData({}, function(result, error) {
                if (!error && result.data.Data.teamName && result.data.Data.selectedPlayers) {
                    console.log("User already has complete team, redirecting to points...");
                    window.location.href = "points.html";
                } else {
                    console.log("User needs to create team - staying on create page");
                }
            });
            break;
    }
    
    // Initialize mobile dropdown for all pages (with a delay to ensure DOM is ready)
    setTimeout(() => {
        initializeMobileDropdown();
    }, 200);
}

// Page load handling
window.addEventListener('load', function() {
    const publicPages = ['index.html', 'login.html', 'register.html', 'reset-password.html', 'create-team.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Setup PlayFab authentication and get session status
    const isAuthenticated = setupPlayFabAuth();
    const sessionTicket = localStorage.getItem("sessionTicket");

    // Authentication routing logic
    if (sessionTicket) {
        console.log("User is logged in");
        
        // Test user data access to verify session is still valid
        PlayFab.ClientApi.GetUserData({}, function(result, error) {
            if (error) {
                console.error("Session invalid:", error);
                handleAuthError();
                return;
            }
            
            // Redirect from public pages if already logged in
            if (publicPages.includes(currentPage)) {
                console.log("Already logged in, checking user status for redirect...");
                checkUserStatusAndRedirect();
                return; // Don't continue with initializePage since we're redirecting
            }

            // Handle page-specific initialization
            initializePage(currentPage);
        });
    } else {
        console.log("User is not logged in.");
        
        // Redirect to index if trying to access protected pages
        if (!publicPages.includes(currentPage)) {
            console.log("Unauthorized access attempt. Redirecting to login...");
            window.location.href = "login.html";
            return;
        }
    }
});

// ========================================
// BUDGET DISPLAY MANAGEMENT
// Shared functionality for budget display and styling
// ========================================

// Function to update budget display with color coding
function updateBudgetDisplay(budgetValue, budgetElementId, targetSelector) {
    // Update budget text
    const budgetElement = document.getElementById(budgetElementId);
    if (budgetElement) {
        budgetElement.textContent = budgetValue.toFixed(1);
    }

    // Update target element styling based on budget status
    const targetElement = document.querySelector(targetSelector);
    if (targetElement) {
        if (budgetValue < 0) {
            targetElement.classList.add('over-budget');
        } else {
            targetElement.classList.remove('over-budget');
        }
    }
}

/* ========================================
   MOBILE NAVIGATION DROPDOWN
   Custom dropdown functionality for mobile menu
   ======================================== */

// Initialize mobile dropdown functionality
function initializeMobileDropdown() {
    console.log('Attempting to initialize mobile dropdown...');
    
    // Wait a bit to ensure DOM is fully loaded
    setTimeout(() => {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileDropdown = document.getElementById('mobile-menu-dropdown');
        
        console.log('Mobile menu button found:', !!mobileMenuBtn);
        console.log('Mobile dropdown found:', !!mobileDropdown);
        
        if (mobileMenuBtn && mobileDropdown) {
            console.log('Both elements found, setting up event listeners...');
            
            // Remove any existing event listeners
            const newButton = mobileMenuBtn.cloneNode(true);
            mobileMenuBtn.parentNode.replaceChild(newButton, mobileMenuBtn);
            
            newButton.addEventListener('click', function(e) {
                console.log('Mobile menu button clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                const isOpen = mobileDropdown.classList.contains('show');
                console.log('Current dropdown state:', isOpen ? 'open' : 'closed');
                
                if (isOpen) {
                    // Close dropdown
                    mobileDropdown.classList.remove('show');
                    mobileDropdown.removeAttribute('data-open');
                    newButton.classList.remove('open');
                    console.log('Dropdown closed');
                } else {
                    // Open dropdown
                    mobileDropdown.classList.add('show');
                    mobileDropdown.setAttribute('data-open', 'true');
                    newButton.classList.add('open');
                    console.log('Dropdown opened');
                }
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function(event) {
                // Don't close dropdown if clicking inside any modal
                const clickedInsideModal = event.target.closest('dialog');
                
                if (!clickedInsideModal && !newButton.contains(event.target) && !mobileDropdown.contains(event.target)) {
                    mobileDropdown.classList.remove('show');
                    newButton.classList.remove('open');
                    console.log('Dropdown closed by outside click');
                }
            });
            
            console.log('Mobile dropdown initialized successfully!');
        } else {
            console.error('Mobile dropdown elements not found:', {
                button: !!mobileMenuBtn,
                dropdown: !!mobileDropdown
            });
        }
    }, 100);
}

// Initialize dropdown when DOM is ready and also when window loads
document.addEventListener('DOMContentLoaded', initializeMobileDropdown);
window.addEventListener('load', initializeMobileDropdown);
