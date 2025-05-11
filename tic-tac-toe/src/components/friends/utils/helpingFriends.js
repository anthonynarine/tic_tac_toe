
export function getOnlineFriendsExcludingCurrentUser(friends, currentUserId) {
    return friends
    .filter((friend) => {
        const isCurrentUserFrom = friend.from_user === currentUserId;
        const otherUserId = isCurrentUserFrom ? friend.to_user : friend.from_user;




        const
    })
}