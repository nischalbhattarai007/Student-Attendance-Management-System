from database import Database
import hashlib
import cv2

def test_login(username, password):
    print(f"\nTesting login with username: {username}, password: {password}")
    
    # Hash the password
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    print(f"Hashed password: {hashed_password}")
    
    try:
        with Database() as db:
            # First, check if the user exists at all
            user_check = db.fetch_one(
                "SELECT stu_id, Stu_name FROM student WHERE LOWER(Stu_name) = LOWER(%s)",
                (username,)
            )
            
            if not user_check:
                print(f"User '{username}' does not exist in the database.")
                return False
            
            print(f"User found: {user_check}")
            
            # Now check with password
            student = db.fetch_one(
                "SELECT stu_id, Stu_name, Stu_rollno, Stu_password FROM student WHERE LOWER(Stu_name) = LOWER(%s) AND Stu_password = %s",
                (username, hashed_password)
            )
            
            if student:
                print(f"Login successful for user: {student['Stu_name']}")
                print(f"User details: {student}")
                return True
            else:
                # Check what password is stored
                stored_pwd = db.fetch_one(
                    "SELECT Stu_password FROM student WHERE LOWER(Stu_name) = LOWER(%s)",
                    (username,)
                )
                if stored_pwd:
                    stored = stored_pwd['Stu_password']
                    print(f"Stored password: {stored}")
                    print(f"Hashed password: {hashed_password}")
                    print(f"Match: {stored == hashed_password}")
                    
                    # Try plaintext comparison
                    print(f"Plaintext match: {stored == password}")
                
                print("Login failed: Invalid password")
                return False
    
    except Exception as e:
        print(f"Error during login test: {str(e)}")
        return False

if __name__ == "__main__":
    # Test with our known test user
    test_login("testuser", "password123")
    
    # Test with the existing user from the database
    test_login("test", "hello@123")
    
    # You can add more tests here
    # test_login("your_username", "your_password") 