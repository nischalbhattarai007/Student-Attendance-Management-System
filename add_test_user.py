from database import Database
import hashlib
import traceback

def add_test_user():
    # Test user credentials
    username = "testuser"
    password = "password123"
    email = "test@example.com"
    roll_no = "TEST001"
    
    # Hash the password
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    print(f"Attempting to add/update user: {username}")
    print(f"Hashed password: {hashed_password}")
    
    try:
        with Database() as db:
            # Check if user exists
            print("Checking if user exists...")
            existing_user = db.fetch_one(
                "SELECT * FROM student WHERE Stu_name = %s", 
                (username,)
            )
            
            if existing_user:
                print(f"User '{username}' already exists with ID: {existing_user.get('stu_id', 'unknown')}")
                # Update the password for testing
                print("Updating password...")
                db.execute_query(
                    "UPDATE student SET Stu_password = %s WHERE Stu_name = %s",
                    (hashed_password, username)
                )
                print(f"Password updated for user '{username}'")
                print(f"Password: {password}")
                print(f"Hashed Password: {hashed_password}")
                return
            
            # Insert new student - make sure all required fields are included
            print("Creating new user...")
            
            # First, check the table structure
            columns = db.fetch_all("SHOW COLUMNS FROM student")
            print("Table structure:")
            for col in columns:
                print(f"  {col.get('Field', 'unknown')}: {col.get('Type', 'unknown')} (Null: {col.get('Null', 'unknown')})")
            
            result = db.execute_query(
                "INSERT INTO student (Stu_name, Stu_contact, Stu_password, Stu_rollno) VALUES (%s, %s, %s, %s)",
                (username, email, hashed_password, roll_no)
            )
            
            if result:
                # Verify the user was created
                new_user = db.fetch_one(
                    "SELECT * FROM student WHERE Stu_name = %s",
                    (username,)
                )
                if new_user:
                    print(f"Test user '{username}' created successfully with ID: {new_user.get('stu_id', 'unknown')}")
                    print(f"Roll No: {new_user.get('Stu_rollno', 'unknown')}")
                    print(f"Password: {password}")
                    print(f"Hashed Password: {hashed_password}")
                else:
                    print("User was supposed to be created but could not be found!")
            else:
                print("Failed to create test user.")
    
    except Exception as e:
        print(f"Error creating test user: {str(e)}")
        print(traceback.format_exc())

if __name__ == "__main__":
    add_test_user() 