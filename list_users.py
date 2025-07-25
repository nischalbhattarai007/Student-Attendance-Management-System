from database import Database

def list_all_users():
    try:
        with Database() as db:
            users = db.fetch_all("SELECT * FROM student")
            
            if not users:
                print("No users found in the database.")
                return
            
            print(f"Found {len(users)} users in the database:")
            for user in users:
                print(f"ID: {user.get('stu_id', 'N/A')}, Name: {user.get('Stu_name', 'N/A')}, Roll No: {user.get('Stu_rollno', 'N/A')}")
                print(f"  Password Hash: {user.get('Stu_password', 'N/A')[:10]}...")
                print("---")
    
    except Exception as e:
        print(f"Error listing users: {str(e)}")

if __name__ == "__main__":
    list_all_users() 