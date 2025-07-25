from flask import url_for

def get_profile_photo_url(photo_path):
    """
    Generates a URL for a student's profile photo.
    Assumes photo_path is relative to the 'static' folder (e.g., 'uploads/student_photos/image.jpg').
    Returns a default placeholder URL if photo_path is None or empty.
    """
    if photo_path:
        # Clean the path to ensure it uses forward slashes, which url_for expects
        cleaned_path = photo_path.replace('\\', '/')
        return url_for('static', filename=cleaned_path)
    else:
        # Return a placeholder image URL if no photo_path is provided
        # You can customize this placeholder
        return url_for('static', filename='images/default_avatar.png') # Assuming you have a default avatar 