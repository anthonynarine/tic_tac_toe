import os
from uuid import uuid4

def avatar_upload_path(instance, filename):
    """
    Determines the upload path for the user avatars.

    This function is a unique path for each user's avatar, based on the user ID.

    Args:
        instance (CustomUser): The instance of the "Customuser" model that the file is being uploaded to.
        filename (str): The original name of the uploaded file.

    Returns:
        str: The uploaded path for the avatar. For example, it might return "user/1/avatar/unique_id.png."

    Example:
        If the user's ID is 1 and the uploaded file is named "profile.png", the function will return 
        a path like "user/1/avatar/unique_id.png", where "unique_id" is generated using a UUID to avoid 
        filename collisions.
    """
    # Extract the file extension.
    extension = os.path.splitext(filename)[1].lower()

    # Chcek if the filename has no extension ()
    if not extension:
        extension = ".png" # default to .png if none if provided

    # Generate a new filename using a UUID to avoid filename colisions.
    new_filename = f"{uuid4()}{extension}"
    
    # Return the path "user/<user_id>/avatar/<newfile_name>"
    return f"user/{instance.id}/avatar/{new_filename}"


def default_avatar():
    return "user/defaults/avatar/default_avatar.png"