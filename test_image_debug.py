import numpy as np
import face_recognition
import os

# Path to the problematic image array
# Adjust this path if your script is not in d:/Attendance/
npy_file_path = os.path.join('static', 'temp', 'problematic_unknown_image_rgb.npy') 
# For a script in d:/Attendance, this resolves to d:/Attendance/static/temp/problematic_unknown_image_rgb.npy

print(f"Attempting to load image array from: {os.path.abspath(npy_file_path)}")

if not os.path.exists(npy_file_path):
    print(f"ERROR: File not found at {npy_file_path}")
    print("Please ensure the Flask app has run and created this file.")
else:
    try:
        print("Loading image array...")
        image_rgb = np.load(npy_file_path)
        print(f"Image array loaded successfully. Shape: {image_rgb.shape}, dtype: {image_rgb.dtype}")

        print("\nAttempting to find face locations with model='hog'...")
        # This is the call that crashes in the Flask app
        face_locations = face_recognition.face_locations(image_rgb, model="hog")
        
        print(f"\nSuccessfully found {len(face_locations)} face location(s).")
        if face_locations:
            print("Locations found:")
            for loc in face_locations:
                print(loc)
        
    except Exception as e:
        print(f"\n--- PYTHON EXCEPTION CAUGHT ---")
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

print("\n--- Script finished ---")
