from PIL import Image
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile
import sys

def resize_image(image, max_width=70, max_height=70):
    with Image.open(image) as img:
        if img.width > max_width or img.height > max_height:
            # Resize the image using LANCZOS for high-quality downscaling
            img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

            img_io = BytesIO()
            img.save(img_io, format=img.format)

            # Create a new InMemoryUploadedFile without field_name and content_type
            resized_image = InMemoryUploadedFile(
                img_io,  # Image data
                None,  # No field_name
                image.name,  # Keep the original file name
                image.file.content_type,  # Use the content type of the original image
                img_io.tell(),  # Get the size of the image
                None  # No charset
            )
            return resized_image
        else:
            return image


