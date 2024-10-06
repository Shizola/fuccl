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

// Page load handling
window.onload = function() {
    setupPlayFabAuth();
    
    const sessionTicket = localStorage.getItem("sessionTicket");
    if (sessionTicket) {
        console.log("User is logged in with session ticket:", sessionTicket);
        testUserDataAccess();
    } else {
        console.log("User is not logged in.");
    }
};