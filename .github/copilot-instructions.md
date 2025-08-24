# FUCCL - Fantasy UCCL Copilot Instructions

## Project Overview
FUCCL is a Fantasy Premier League-style web application for a church football league (UCCL). It's a client-side JavaScript application using PlayFab for backend services, with no traditional server-side code.

## Core Architecture

### Backend Service Pattern
- **PlayFab Integration**: All data persistence uses PlayFab cloud services (Title ID: `E210B`)
- **Authentication**: Session-based using PlayFab's `sessionTicket` stored in `localStorage`
- **Data Storage**: Player stats in `GetTitleData()`, user teams in `UpdateUserData()`, leaderboards via `UpdatePlayerStatistics()`
- **No Traditional Backend**: Pure client-side architecture with cloud services

### File Organization Pattern
- **`common.js`**: Consolidated authentication, user management, page routing, and form handling
- **Page-specific JS**: `points.js`, `league.js` handle individual page functionality with performance optimizations
- **Styling**: Pico.css framework + organized CSS files (`common.css`, `points.css`, `league.css`)
- **Assets**: Team shirt SVGs in `images/shirts/` with naming convention `{team}_gk.svg` for goalkeepers
- **Security**: CSP headers in all HTML files to prevent XSS attacks

## Critical Patterns

### Authentication Flow
```javascript
// Consolidated auth setup with proper error handling
function setupPlayFabAuth() {
    const sessionTicket = localStorage.getItem("sessionTicket");
    if (sessionTicket) {
        PlayFab._internalSettings.sessionTicket = sessionTicket;
        return true;
    }
    return false;
}

// Form handling with event prevention
function loginUser(event) {
    event.preventDefault(); // Critical: prevent form submission
    // ... login logic
}
```

### Performance Optimization Patterns
- **Data Caching**: 5-minute TTL cache for API responses to reduce server load
- **API Batching**: Single batch requests instead of multiple individual calls
- **DOM Optimization**: DocumentFragment for batch DOM operations
- **Lazy Loading**: Progressive image loading with IntersectionObserver
- **Memory Management**: Event listener cleanup and cache invalidation

### Data Persistence Pattern
- **Player Selection**: Stored as JSON string in user data key `selectedPlayers`
- **Team Info**: `teamName` and `managerName` in user data
- **Player Stats**: Title data with format `player_{id}` containing pipe-separated values: `name|team|position|weeklyPoints|totalPoints`
- **Leaderboard**: Uses `PlayerTotalPoints` statistic name with cumulative scoring

### Visual Components
- **Player Cards**: Positioned absolutely on pitch SVG background
- **Responsive Design**: Player card sizes scale with viewport (45px → 70px → 90px)
- **Team Shirts**: Dynamic shirt selection with `_gk` suffix for goalkeepers, fallback to `template.svg`

## Key Integration Points

### PlayFab API Patterns
```javascript
// Standard error handling with session validation
PlayFab.ClientApi.GetUserData({}, function(result, error) {
    if (error && error.errorCode === 1000) {
        handleAuthError(); // Session expired
    }
});

// Optimized batch API calls for performance
const titleDataKeys = selectedPlayerIds.map(id => `player_${id}`);
PlayFab.ClientApi.GetTitleData({ Keys: titleDataKeys }, function(result, error) {
    // Handle batch response
});
```

### Security Patterns
```html
<!-- CSP headers in all HTML files -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://download.playfab.com; 
               style-src 'self' 'unsafe-inline' https://unpkg.com; 
               img-src 'self' data:; 
               connect-src 'self' https://*.playfabapi.com https://playfabapi.com;">
```

### Page Navigation
- Route protection in `common.js` `window.onload` handler
- Public pages: `index.html`, `login.html`, `register.html`, `reset-password.html`
- Protected pages redirect to `login.html` if not authenticated

## Performance Best Practices

### Caching Strategy
```javascript
// 5-minute cache with TTL validation
const dataCache = {
    playerData: null,
    gameWeek: null,
    lastFetch: null,
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
};

function isCacheValid() {
    return dataCache.lastFetch && 
           (Date.now() - dataCache.lastFetch) < dataCache.CACHE_DURATION &&
           dataCache.playerData;
}
```

### DOM Optimization
```javascript
// Use DocumentFragment for batch operations
const fragment = document.createDocumentFragment();
players.forEach(player => {
    const card = createPlayerCard(player);
    fragment.appendChild(card);
});
pitch.appendChild(fragment); // Single DOM operation
```

## Development Commands

### Local Development
```bash
# Serve locally (any static server)
python -m http.server 8000
# or
npx serve .
```

### File Structure Rules
- All HTML files in root directory
- JavaScript files in root (no subdirectories)
- Images organized in `images/shirts/` with consistent naming
- CSS files follow page naming convention

## Code Quality Standards

### Error Handling Requirements
- PlayFab errors code 1000 = session expired → redirect to login
- Missing team data → redirect to `create-team.html`
- Failed API calls → show user-friendly alerts, log to console
- All form submissions must use `event.preventDefault()`

### Security Requirements
- CSP headers required in all HTML files
- No inline JavaScript execution without CSP allowances
- Session validation on all protected routes
- Input sanitization for user data

## Project-Specific Conventions

### Data Format Standards
- **Player Data**: Pipe-separated format `name|team|position|weeklyPointsArray|totalPoints`
- **Weekly Points**: Comma-separated array matching gameweek indices
- **Team Names**: Must match exactly with shirt image mappings in `parsePlayerData()`

### Data Format Standards
- **Player Data**: Pipe-separated format `name|team|position|weeklyPointsArray|totalPoints`
- **Weekly Points**: Comma-separated array matching gameweek indices
- **Team Names**: Must match exactly with shirt image mappings in `parsePlayerData()`

### Responsive Behavior
- Player pitch scales based on screen width with three breakpoints
- Navigation uses CSS Grid with auto-fit columns
- All interactive elements must work on mobile (touch-friendly)

## Critical Dependencies
- **Pico.css**: Primary UI framework loaded from CDN
- **PlayFab SDK**: `PlayFabClientApi.js` must be loaded before custom scripts
- **SVG Assets**: Team shirts are essential for visual functionality

## Leaderboard Scalability Considerations

### Current Limitations
- **API Constraint**: `MaxResultsCount: 100` in GetLeaderboard API limits real players to 100
- **Test Data**: Current implementation generates 149 fake teams + 1 real user for pagination demo
- **Memory Usage**: All 150 entries loaded into memory for client-side pagination

### Performance Considerations for 150+ Real Players
- **Multiple API Calls**: Would need batching for more than 100 real players
- **Memory Management**: Larger datasets require more careful memory handling
- **User Experience**: Longer loading times for initial data fetch

### Implementation Options for Scaling

#### Option 1: Simple API Limit Increase (Quick Fix)
```javascript
// Limited to PlayFab's maximum per call
MaxResultsCount: 1000  // PlayFab's maximum
```

#### Option 2: Batched Loading (Medium Scale)
```javascript
// Fetch leaderboard in chunks for 100-1000 players
async function getFullLeaderboard() {
    let allEntries = [];
    let startPosition = 0;
    const batchSize = 100;
    
    do {
        const batch = await getLeaderboardBatch(startPosition, batchSize);
        allEntries = allEntries.concat(batch);
        startPosition += batchSize;
    } while (batch.length === batchSize);
    
    return allEntries;
}
```

#### Option 3: Server-Side Pagination (Best for Scale)
```javascript
// Only fetch current page's data - recommended for 1000+ players
function getLeaderboardPage(pageNumber, itemsPerPage) {
    const startPosition = (pageNumber - 1) * itemsPerPage;
    return PlayFab.ClientApi.GetLeaderboard({
        StartPosition: startPosition,
        MaxResultsCount: itemsPerPage
    });
}
```

### Decision Framework
- **Up to 100 players**: Current system works without changes
- **100-1000 players**: Implement batched loading (Option 2)
- **1000+ players**: Implement server-side pagination (Option 3)

When making changes, always test authentication flows and ensure PlayFab session management works correctly across page transitions.
