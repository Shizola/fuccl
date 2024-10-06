// Initialize PlayFab settings immediately
PlayFab.settings.titleId = "E210B";
console.log("PlayFab Title ID set to:", PlayFab.settings.titleId);

// Additional initialization when window loads
window.onload = function() {
    checkLoginStatus();
};

// Function to register a new user
function registerUser(event) {
    event.preventDefault(); // Prevent the default form submission

    // Double-check that titleId is set before making the API call
    if (!PlayFab.settings.titleId) {
        PlayFab.settings.titleId = "E210B";
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const request = {
        TitleId: PlayFab.settings.titleId, // Include titleId in the request
        Email: email,
        Password: password,
        RequireBothUsernameAndEmail: false
    };

    // Call PlayFab API to register the user
    PlayFab.ClientApi.RegisterPlayFabUser(request, function (result, error) {
        if (error) {
            console.error("Error registering user:", error);
            alert("Registration failed: " + error.errorMessage);
        } else {
            console.log("User registered successfully:", result);
            alert("Registration successful! Redirecting to team selection.");
            localStorage.setItem("sessionTicket", result.data.SessionTicket);
            window.location.href = "team-selection.html";
        }
    });
}

// Function to log in an existing user
function loginUser(event) {
    event.preventDefault(); // Prevent the default form submission

    const email = document.getElementById('email').value; // Assuming you changed this to 'username' for email input
    const password = document.getElementById('password').value;

    const request = {
        TitleId: PlayFab.settings.titleId,
        Email: email,
        Password: password
    };

    // Call PlayFab API to log in the user
    PlayFab.ClientApi.LoginWithEmailAddress(request, function (result, error) {
        if (error) {
            console.error("Error logging in:", error);
            alert("Login failed: " + error.errorMessage);
        } else {
            console.log("User logged in successfully:", result);
            alert("Login successful! Redirecting to team selection.");
            localStorage.setItem("sessionTicket", result.data.SessionTicket); // Store session ticket
            window.location.href = "team-selection.html"; // Redirect to team selection page
        }
    });
}

// Function to check if the user is logged in
function checkLoginStatus() {
    const sessionTicket = localStorage.getItem("sessionTicket");
    if (sessionTicket) {
        console.log("User is logged in with session ticket:", sessionTicket);
        // You can add logic to display user info or restrict access here
    } else {
        console.log("User is not logged in.");
        // Optionally, redirect to login page or show a message
        // window.location.href = "login.html"; // Uncomment if you want to redirect unauthenticated users
    }
}

// Call checkLoginStatus on page load
window.onload = checkLoginStatus;
