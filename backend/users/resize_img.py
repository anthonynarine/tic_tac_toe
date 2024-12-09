from PIL import Image
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile

def resize_image(image, max_width=70, max_height=70):
    if not image:
        return image  # Return as is if no image is provided

    try:
        with Image.open(image) as img:
            if img.width > max_width or img.height > max_height:
                # Resize the image using LANCZOS for high-quality downscaling
                img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

                img_io = BytesIO()
                img_format = img.format if img.format else 'JPEG'
                img.save(img_io, format=img_format)
                img_io.seek(0)

                # Determine content_type based on img_format
                format_to_content_type = {
                    'JPEG': 'image/jpeg',
                    'JPG': 'image/jpeg',
                    'PNG': 'image/png',
                    'GIF': 'image/gif',
                    'BMP': 'image/bmp',
                    'TIFF': 'image/tiff',
                }

                content_type = format_to_content_type.get(img_format.upper(), 'image/jpeg')

                # Create a new InMemoryUploadedFile without relying on image.file.content_type
                resized_image = InMemoryUploadedFile(
                    img_io,              # File object
                    None,                # Field name (not needed here)
                    image.name,          # Original file name
                    content_type,        # Determined content type
                    img_io.tell(),       # Size
                    None                 # Charset (not needed)
                )
                return resized_image
            else:
                return image
    except Exception as e:
        print(f"Error resizing image: {e}")  # Log the error
        return image  # Return original image if any issue arises during resizing


