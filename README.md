# Face Recognition Based Attendance System

This is a web-based attendance system that uses face recognition to mark student attendance.

## Setup Instructions

### 1. Prerequisites

- Python 3.x
- MySQL Server

### 2. Create a Virtual Environment

It is highly recommended to use a virtual environment to manage project dependencies.

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows
venv\Scripts\activate

# On macOS/Linux
# source venv/bin/activate
```

### 3. Install Dependencies

Install the required Python packages using pip:

```bash
pip install -r requirements.txt
```

### 4. Database Setup

1.  Make sure your MySQL server is running.
2.  Create a new database named `student_attendance_system`.
3.  Import the provided SQL file `student_attendance_system.sql` to set up the necessary tables.

    ```bash
    mysql -u your_username -p student_attendance_system < student_attendance_system.sql
    ```

    Replace `your_username` with your MySQL username.

4.  Update the database credentials in `database.py` if they are different from the default values (root user with no password).

### 5. Running the Application

Once the setup is complete, you can run the application:

```bash
python app.py
```

The application will be accessible at `http://127.0.0.1:5000` in your web browser.

### 6. Adding a Test User

A script is provided to add a test user to the system.

```bash
python add_test_user.py
```

## Project Structure

-   `app.py`: The main Flask application file.
-   `database.py`: Contains database connection and query functions.
-   `requirements.txt`: A list of Python packages required for the project.
-   `student_attendance_system.sql`: The SQL dump file for database setup.
-   `templates/`: Contains the HTML templates for the web interface.
-   `static/`: Contains static files like CSS, JavaScript, and images.
-   `Admin/`: Contains Admin routes.
-   `Student/`: Contains Student routes.
-   `utils/`: Contains utility scripts.


## 7. login as Admin
- username: admin
- password: admin123
