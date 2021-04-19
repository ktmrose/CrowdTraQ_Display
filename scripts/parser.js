/**
 * Returns an instance of the user if the user exists. Otherwise throws error
 * @param usersArr the array of users as defined in gatekeeper.js
 * @param userId the hexadecimal userId that was assigned by the server upon establishment of WebSocket
 */
function getUser(usersArr, userId) {
    //a user has a websocket, userid, and tokens
    if (typeof(usersArr) !== Array) {
        console.log("First parameter in getUser must be an array.")
        return;
    }
    for (let i = 0; i < usersArr.length; i++) {
        if (user.userId === userId) {
            return user
        } else {
            console.log("Unidentified user: user not found in array")
        }
    }
}

module.exports = getUser