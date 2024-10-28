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
function createPlayerCard(playerData) {
    // Create the main player card div
    const playerCard = document.createElement('div');
    playerCard.classList.add('player-card');

    // Create player info div
    const playerInfo = document.createElement('div');
    playerInfo.classList.add('player-info');

    // Player shirt image
    const shirtImg = document.createElement('img');
    shirtImg.classList.add('player-shirt');
    shirtImg.src = playerData.shirtImage || 'default-shirt.png';  // Fallback image if none provided
    shirtImg.alt = 'Player shirt';
    playerInfo.appendChild(shirtImg);

    // Optional captain badge
    if (playerData.isCaptain) {
        const captainBadge = document.createElement('div');
        captainBadge.classList.add('captain-badge');
        captainBadge.textContent = 'C';
        playerInfo.appendChild(captainBadge);
    }

    // Info icon
    const infoIcon = document.createElement('div');
    infoIcon.classList.add('info-icon');
    infoIcon.textContent = 'i';
    playerInfo.appendChild(infoIcon);

    // Append playerInfo to playerCard
    playerCard.appendChild(playerInfo);

    // Player name
    const playerName = document.createElement('div');
    playerName.classList.add('player-name');
    playerName.textContent = playerData.name || 'Unknown Player';
    playerCard.appendChild(playerName);

    // Player points
    const playerPoints = document.createElement('div');
    playerPoints.classList.add('player-points');
    playerPoints.textContent = playerData.points || '0';
    playerCard.appendChild(playerPoints);

    // Return the created player card
    return playerCard;
}

// Function to render a list of players on the points page
function renderPlayers(playerList) {
    // Select the container where player cards will be inserted
    const playerContainer = document.querySelector('.player-rows');

    // Clear the container before rendering new players
    playerContainer.innerHTML = '';

    // Loop through the player list and create player cards
    playerList.forEach(playerData => {
        const playerCard = createPlayerCard(playerData);
        playerContainer.appendChild(playerCard);
    });
}



// Page load handling for points page
window.addEventListener('load', function() {
    checkTeamName();
    loadTeamNameOnly();


// Example player data
const players = [
    {
        name: 'John Doe',
        points: 12,
        shirtImage: 'path-to-john-shirt.png',
        isCaptain: true
    },
    {
        name: 'Jane Smith',
        points: 8,
        shirtImage: 'path-to-jane-shirt.png',
        isCaptain: false
    }
];

// Render players on the page
renderPlayers(players);

});
