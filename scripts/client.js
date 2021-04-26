const redirectUri = 'https://ktmrose.github.io/CrowdTraQ_Display/';
let access_token = "";
let refresh_token = "";
let userId = "";

const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-modify-public',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'streaming',
    'user-read-email',
    'user-read-private'
];

const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";


/**
 * When page loads, checks session storage for client ID and client Secret. If none, displays html
 * that prompts the user for these. Then checks if access token is in session storage.
 */
function onPageLoad() {

    clientId = sessionStorage.getItem("client_id");
    clientSec = sessionStorage.getItem("client_secret");
    if (clientId === null || clientId == null || clientId.length < 32 || clientSec < 32) {
        document.getElementById("tokenSection").style.display = 'block';
    } else if (window.location.search.length > 0) {
        handleRedirect();
    } else {
        access_token = sessionStorage.getItem("access_token");
        if (access_token === null) {
            requestAuthorization()
        } else {
            refresh_token = sessionStorage.getItem("refresh_token");
            sendTokens(access_token, refresh_token);
            // document.getElementById("songSelection").style.display = 'block';
            // callSpotifyApi("GET", PLAYBACKSTATE + "?market=US", null, handleCurrentlyPlayingResponse);
        }
    }
}

/**
 * Saves the client ID and client secret from the text input boxes into session storage, then redirects to Spotify authorization page.
 */
function requestAuthorization() {
    if (document.getElementById("tokenSection").style.display === 'block') {
        clientId = document.getElementById("clientId").value;
        clientSec = document.getElementById("clientSecret").value;
    }
    sessionStorage.setItem("client_id", clientId);
    sessionStorage.setItem("client_secret", clientSec);

    let url = AUTHORIZE;
    url += "?client_id=" + clientId;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(redirectUri);
    url += "&show_dialog=true";

    let scopeString = "";
    scopes.forEach(scope => scopeString += (scope + " "));
    url += "&scope=" + scopeString;

    window.location.href = url;
}

/**
 * Parses the url returned from Spotify and gets the authorization token.
 * @returns {null} the code, if present. Code would not be present if authorization has not been granted by user.
 */
function getAuthCode() {
    let code = null;
    const queryString = window.location.search;

    if (queryString.length > 0) {
        const urlParams = new URLSearchParams(queryString);
        code = urlParams.get('code');
    }
    return code;
}

/**
 * Callback from requesting access and refresh tokens from Spotify.
 */
function handleAuthorizationResponse() {
    if (this.status === 200) {
        let data = JSON.parse(this.responseText);

        if (data.access_token !== undefined) {
            access_token = data.access_token;
            sessionStorage.setItem("access_token", access_token);
        }
        if (data.refresh_token !== undefined) {
            refresh_token = data.refresh_token;
            sessionStorage.setItem("refresh_token", refresh_token);
        }
        onPageLoad();

    } else if(this.status === 401) {
        refreshAccessToken();

    } else {
        console.log(this.responseText);
        alert(this.responseText);
    }
}

/**
 * Requests access token from Spotify's authorization endpoint.
 * @param body includes necessary params to get access token from Spotify.
 */
function callAuthorizationApi(body) {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(clientId + ":" + clientSec));
    xhr.send(body);
    xhr.onload = handleAuthorizationResponse;
}

/**
 * Refreshes access token
 */
function refreshAccessToken() {
    refresh_token = sessionStorage.getItem("refresh_token");
    let body = "grant_type=refresh_token";
    body += "&refresh_token=" + refresh_token;
    body += "&client_id=" + clientId;
    callAuthorizationApi(body);
}

/**
 * Gets access token from Spotify using authorization code.
 * @param code Authorization code
 */
function fetchAccessToken(code) {
    let body = "grant_type=authorization_code";
    body += "&code=" + code;
    body += "&redirect_uri=" + encodeURI(redirectUri);
    body += "&client_id=" + clientId;
    body += "&client_secret=" + clientSec;
    callAuthorizationApi(body);
}

/**
 * Callback from Spotify authorization page; saves information from url sent back from Spotify and clears it
 */
function handleRedirect() {
    let code = getAuthCode();
    fetchAccessToken(code);
    window.history.pushState("", "", redirectUri);
}

// ### WebSocket connection to server ###
connection = null;
function sendTokens(accessToken, refreshToken) {
    if (accessToken !== "" && refreshToken !== "" && connection !== null) {

        const message = JSON.stringify({
            "UserId" : userId, 
            "Access_Token" : accessToken, 
            "Refresh_Token" : refreshToken})
        connection.send(message)
        console.log(message)
    }
}

function connectToServer() {
    if (connection === null) {
        connection = new WebSocket('ws://localhost:8081')
    }
    this.connection.onopen = function(event) {
        console.log('Server GUI connection to CrowdTraQ Server successful')
    }

    this.connection.onmessage = function(event) {
        
        const message = JSON.parse(event.data)
        console.log(message)
        if (message.UserId !== undefined) {
            userId = message.UserId
            console.log("Your assigned userID: " + userId);
            sendTokens(access_token, refresh_token)
        }
         if (message.Q_length !== undefined) {
             document.getElementById("qLength").innerText = message.Q_length
         }
         if (message.Cost !== undefined) {
             document.getElementById("addSongCost").innerText = message.Cost
         }

         if (message.Album_Cover !== undefined) {
             document.getElementById("albumImage").src = message.Album_Cover
         }

         if (message.Track_Name !== undefined) {
             document.getElementById("trackTitle").innerHTML = message.Track_Name
         }

         if (message.Artist_Name !== undefined) {
            document.getElementById("trackArtist").innerText = message.Artist_Name
         }
    }
}

