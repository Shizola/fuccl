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
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

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
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

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
    // Clear the session ticket from local storage
    localStorage.removeItem("sessionTicket");

    console.log("User logged out successfully");

    // Redirect to the login page
    window.location.href = "index.html";
}

function resetPassword(event) {
    event.preventDefault(); // Prevent form submission from reloading the page

    const email = document.getElementById('email').value;

    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    const request = {
        TitleId: PlayFab.settings.titleId, // Replace this with your PlayFab Title ID if necessary
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

    const teamData = {
        teamName: document.getElementById('teamName').value,
        managerName: document.getElementById('managerName').value
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

// Profile data functions
function loadProfileData() {
    console.log("Loading profile data...");

    PlayFab.ClientApi.GetUserData({}, handleProfileDataResponse);
}

function handleProfileDataResponse(result, error) {
    if (error) {
        console.error("Error getting profile data:", error);
    } else {
        // Assuming your data keys are 'teamName' and 'managerName'
        const teamName = result.data.Data.teamName ? result.data.Data.teamName.Value : "Not set";
        const managerName = result.data.Data.managerName ? result.data.Data.managerName.Value : "Not set";

        // Update the HTML elements with the correct string values
        document.getElementById('teamName').innerText = teamName;
        document.getElementById('managerName').innerText = managerName;
    }
}

// Page load handling
window.onload = function () {
    const publicPages = ['index.html', 'login.html', 'register.html', 'reset-password.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Setup PlayFab authentication and get session status
    const isAuthenticated = setupPlayFabAuth();
    const sessionTicket = localStorage.getItem("sessionTicket");

    // Authentication routing logic
    if (sessionTicket) {
        console.log("User is logged in with session ticket:", sessionTicket);
        
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
};

// Helper function to initialize page-specific content
function initializePage(currentPage) {
    switch (currentPage) {
        case 'profile.html':
            loadProfileData();
            break;
            
        case 'points.html':
            checkTeamName();
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