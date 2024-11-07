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
    card.className = 'player-card'; // Add appropriate class for styling
    card.textContent = player.name; // Display player name (or any other info)
    return card;
}


// Function to render players on the pitch based on their position
function renderPlayersOnPitch(players) {
    // Get containers for each row
    const gkRow = document.getElementById('gk-row');
    const dfRow = document.getElementById('df-row');
    const mdRow = document.getElementById('md-row');
    const atRow = document.getElementById('at-row');

    // Clear rows before rendering
    gkRow.innerHTML = '';
    dfRow.innerHTML = '';
    mdRow.innerHTML = '';
    atRow.innerHTML = '';

    // Loop through players and append them to the correct row based on their position
    players.forEach(player => {
        console.log(`Rendering player: ${player.name}, Position: ${player.position}`);

        const playerCard = createPlayerCard(player);
        
        switch(player.position) {
            case 'gk':
                gkRow.appendChild(playerCard);
                break;
            case 'df':
                dfRow.appendChild(playerCard);
                break;
            case 'md':
                mdRow.appendChild(playerCard);
                break;
            case 'at':
                atRow.appendChild(playerCard);
                break;
            default:
                console.warn('Unknown position:', player.position);
        }
    });
}

// Page load handling for points page
window.addEventListener('load', function() {
    checkTeamName();
    loadTeamNameOnly();

    const players = [
        {
            name: 'John Doe',
            points: 12,
            shirtImage: 'path-to-john-shirt.png',
            isCaptain: true,
            position: 'gk' // Goalkeeper
        },
        {
            name: 'Jane Smith',
            points: 8,
            shirtImage: 'path-to-jane-shirt.png',
            isCaptain: false,
            position: 'df' // Defender
        },
        {
            name: 'Chris Johnson',
            points: 5,
            shirtImage: 'path-to-chris-shirt.png',
            isCaptain: false,
            position: 'df' // Defender
        },
        {
            name: 'Chris Johnson',
            points: 5,
            shirtImage: 'path-to-chris-shirt.png',
            isCaptain: false,
            position: 'df' // Defender
        },
        {
            name: 'Anna Lee',
            points: 7,
            shirtImage: 'path-to-anna-shirt.png',
            isCaptain: false,
            position: 'md' // Midfielder
        },
        {
            name: 'David Brown',
            points: 10,
            shirtImage: 'path-to-david-shirt.png',
            isCaptain: false,
            position: 'at' // Attacker
        },
        // Add additional players as needed with varied positions
    ];
    


// Render players on the page
renderPlayersOnPitch(players);

});

