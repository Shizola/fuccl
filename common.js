// Initialize PlayFab
PlayFab.settings.titleId = "E210B";
console.log("PlayFab Title ID set to:", PlayFab.settings.titleId);

// Authentication functions
function setupPlayFabAuth() {
    const sessionTicket = localStorage.getItem("sessionTicket");
    if (sessionTicket) {
        console.log("Found session ticket, setting up authentication");
        PlayFab._internalSettings.sessionTicket = sessionTicket;
        return true;
    }
    console.log("No session ticket found");
    return false;
}

function handleAuthError() {
    localStorage.removeItem("sessionTicket");
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
        alert("Registration successful! Redirecting to create team.");
        localStorage.setItem("sessionTicket", result.data.SessionTicket);
        window.location.href = "create-team.html";
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
        alert("Login successful! Redirecting to points.");
        localStorage.setItem("sessionTicket", result.data.SessionTicket);
        window.location.href = "points.html";
    }
}

// Logout function
function logOut() {
    localStorage.removeItem("sessionTicket");
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

    // Input validation
    if (!teamName || !teamName.trim()) {
        alert('Please enter a team name');
        return;
    }
    if (!managerName || !managerName.trim()) {
        alert('Please enter a manager name');
        return;
    }

    // Sanitize input (remove potentially harmful characters)
    const sanitizedTeamName = teamName.trim().substring(0, 50); // Limit length
    const sanitizedManagerName = managerName.trim().substring(0, 50);

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
        window.location.href = "points.html";
    }
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

// Display team name only (for points page)
function loadTeamNameOnly() {
    fetchUserData(function(error, userData) {
        if (!error && userData) {
            document.getElementById('teamName').innerText = userData.teamName;
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
                        const { players } = data;
                        console.log("Selected players:", players);
                        // Render the players on the pitch
                        if (typeof renderPlayersOnPitch === 'function') {
                            renderPlayersOnPitch(players);
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
            
        case 'create-team.html':
            // Verify team status before allowing access
            PlayFab.ClientApi.GetUserData({}, function(result, error) {
                if (!error && result.data.Data.teamName) {
                    console.log("Team already exists, redirecting to points...");
                    window.location.href = "points.html";
                }
            });
            break;
    }
}

// Page load handling
window.addEventListener('load', function() {
    const publicPages = ['index.html', 'login.html', 'register.html', 'reset-password.html'];
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
                console.log("Already logged in, redirecting to points...");
                window.location.href = "points.html";
                return;
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
