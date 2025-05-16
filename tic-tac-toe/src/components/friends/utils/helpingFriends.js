export function groupFriendsByStatus(friends) {
    const online = [];
    const offline = [];

    friends.forEach((friend) => {
        if (friend.friend_status === "online") {
        online.push(friend);
        } else {
        offline.push(friend);
        }
    });

    return { online, offline };
}
