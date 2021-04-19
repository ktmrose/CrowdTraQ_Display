var redirectUri = 'http://localhost:8081/';
var clientId = "";
var clientSec = "";
var access_token = null;
var refresh_token = null;

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
const PLAY = "https://api.spotify.com/v1/me/player/play";
const QUEUE = "https://api.spotify.com/v1/me/player/queue";
const SKIP = "https://api.spotify.com/v1/me/player/next";
const PLAYBACKSTATE = "https://api.spotify.com/v1/me/player";
const PAUSE = "https://api.spotify.com/v1/me/player/pause";

let isPlaying;
let songDuration;
let songProgression;
let songTimer = null;

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
 * Generic method to handle Spotify API requests
 * @param method "POST", "PUT", "GET"
 * @param url Spotify end point. Don't forget to include any (required) query params here.
 * @param body Nullable stringified JSON object
 * @param callback after Spotify request is completed
 */
function callSpotifyApi(method, url, body, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.send(body);
    xhr.onload = callback;
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

/**
 * Callback verifying song addition.
 */
function handleSongAddition() {
    if (this.status === 204) {
        console.log("Check your queue to see if your song was added.");

    } else if (this.status === 404) {
        console.log("Device not found");

    } else if (this.status === 401) {
        refreshAccessToken();

    } else {
        console.log(this.responseText);
    }
}

/**
 * Driver method to add a song to a queue.
 */
function addSongToQueue(){

    let songId;
    songId = document.getElementById("track").value;
    if (songId !== undefined) {
        pushSongToQ(songId);
    }
    document.getElementById("track").value = "";
}

/**
 * Adds a song with a valid Spotify track ID to the queue.
 * @param trackID unique Spotify track ID
 */
function pushSongToQ(trackID) {

    callSpotifyApi("POST", QUEUE + "?uri=spotify%3Atrack%3A" + trackID, null, handleSongAddition);
}

/**
 * Developer message to check if Spotify successfully received a request when otherwise not expecting a response.
 */
function verifyRequestHandled() {
    if (this.status === 204) {
        console.log("ReQuEsT fUlLfIlLeD");
    } else if (this.status === 401) {
        refreshAccessToken();
    } else {
        console.log(this.responseText);
    }
}

/**
 * Parses JSON response from Spotify and verifies current player state
 */
function handleCurrentlyPlayingResponse() {
    if (this.status === 200) {
        let data = JSON.parse(this.responseText);
        console.log(data);
        if (data.item !== null) {
            document.getElementById("albumImage").src = data.item.album.images[0].url
            document.getElementById("trackTitle").innerHTML = data.item.name
            document.getElementById("trackArtist").innerText = data.item.artists[0].name

            songDuration = data.item.duration_ms
            songProgression = data.progress_ms
            checkSongDuration();
        }

    } else if (this.status === 401) {
        refreshAccessToken();

    } else {
        console.log(this.responseText);
    }
}

/**
 * Plays if playback state is paused, otherwise pauses playback state
 */
function playPause() {

    callSpotifyApi("GET", PLAYBACKSTATE + "?market=US", null, handleCurrentlyPlayingResponse);
    if (isPlaying) {
        callSpotifyApi("PUT", PAUSE, null, verifyRequestHandled());
        isPlaying = false;
    } else {
        callSpotifyApi("PUT", PLAY, null, verifyRequestHandled());
        isPlaying = true;
    }
}

/**
 * Skips a song if playback state is playing
 */
function skipSong() {

    clearInterval(songTimer);
    callSpotifyApi("POST", SKIP, null, verifyRequestHandled)
    callSpotifyApi("GET", PLAYBACKSTATE + "?market=US", null, handleCurrentlyPlayingResponse)
}

/**
 * Sets the song duration and resets timer
 */
function checkSongDuration() {

    let songEnd = new Date().getTime() + (songDuration - songProgression)
    songTimer = setInterval(function () {
        let now = new Date().getTime();
        let remainingTime = songEnd - now;

        // Time calculations for days, hours, minutes and seconds
        var days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
        var hours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

        // Display the result
        // console.log(days + "d " + hours + "h " + minutes + "m " + seconds + "s ");

        if (remainingTime < 0) {
            clearInterval(songTimer);
            console.log("Song ended")
            callSpotifyApi("GET", PLAYBACKSTATE + "?market=US", null, handleCurrentlyPlayingResponse);
        }
    }, 1000);
}

/**
 * When page loads, checks session storage for client ID and client Secret. If none, displays html
 * that prompts the user for these. Then checks if access token is in session storage.
 */
function onPageLoad() {
    clientId = sessionStorage.getItem("client_id");
    clientSec = sessionStorage.getItem("client_secret");
    if (window.location.search.length > 0) {
        handleRedirect();
    } else {
        access_token = sessionStorage.getItem("access_token");
        if (access_token == null) {
            document.getElementById("tokenSection").style.display = 'block';
        } else {
            document.getElementById("songSelection").style.display = 'block';
            callSpotifyApi("GET", PLAYBACKSTATE + "?market=US", null, handleCurrentlyPlayingResponse);
            // document.getElementById("qLength").innerText = window.queueLength;
        }
    }
}

/**
 * Saves the client ID and client secret from the text input boxes into session storage, then redirects to Spotify authorization page.
 */
function requestAuthorization() {
    clientId = document.getElementById("clientId").value;
    clientSec = document.getElementById("clientSecret").value;
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