from django.core.exceptions import ValidationError
from PIL import Image
import os

# validate_icon_image_size and validate_image_file_extenstion opents
# the image using the Image.open(image) method and checks its dimenstion. 
# it does not modify the image or path to the image. it reads to acces the dimenstions

def validate_icon_image_size(image):
    """
    Validates that the uploaded image does not exceed the maximum allowed dimensions of 70x70 pixels.
    
    Args:
        image (InMemoryUploadedFile): The uploaded image file.
    
    Raises:
        ValidationError: If the image exceeds the maximum allowed dimensions.
    """
    if image:
        try:
            with Image.open(image) as img:
                if img.width > 70 or img.height > 70:
                    raise ValidationError(
                        f"The maximum allowed dimensions for the image are 70x70 - size of image you uploaded {img.size}"
                    )
        except Exception as e:
            raise ValidationError(f"Invalid image file: {e}")
                
def validate_image_file_extension(value):
    """
    Validates the extension of an uploaded file.
    
    This function works as a validator for Django's `FileField` or `ImageField`. When a file is uploaded,
    Django calls this function and passes the uploaded file. The function checks the extension of the
    file and raises a `ValidationError` if the extension is not in the list of valid extensions.

    Args:
        value (UploadedFile or InMemoryUploadedFile): The file that was uploaded. In Django, an uploaded
        file is represented as an instance of either `UploadedFile` or `InMemoryUploadedFile`.

    Raises:
        ValidationError: If the file's extension is not in the list of valid extensions.
    """

    # Get the extension of the uploaded file
    img_file_extension = os.path.splitext(value.name)[1]
    # List of valid extensions
    valid_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    # Convert the list of valid extensions to lower case for case insensitive comparison
    valid_extensions = [ext.lower() for ext in valid_extensions]

    # Check if the file's extension (converted to lower case) is in the list of valid extensions
    if not img_file_extension.lower() in valid_extensions:
        # Raise a ValidationError if the extension is not valid
        # Use ', '.join(valid_extensions) to convert the list of valid extensions into a comma separated string
        raise ValidationError(f"Unsupported file extension. Allowed extensions are {', '.join(valid_extensions)}")



""" The os.path.isfile(image_path) function is a built-in function in
Python's os module. It's used to check if a particular path is an 
existing regular file or not.

In the context of your function, os.path.isfile(image_path)
is being used to check if the image_path provided as an argument
to the scale_down_image function actually leads to a file."""