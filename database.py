import mysql.connector
from config import Config
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.connection = mysql.connector.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DB
        )
        self.cursor = self.connection.cursor(dictionary=True)
        logger.debug(f"Connected to database {Config.MYSQL_DB} on {Config.MYSQL_HOST}")

    def execute_query(self, query, params=None):
        try:
            self.cursor.execute(query, params or ())
            self.connection.commit()
            return self.cursor
        except mysql.connector.Error as err:
            logger.error(f"Database error: {err}")
            self.connection.rollback()
            return None

    def fetch_one(self, query, params=None):
        try:
            logger.debug(f"Executing query: {query}")
            logger.debug(f"With parameters: {params}")
            self.cursor.execute(query, params or ())
            result = self.cursor.fetchone()
            logger.debug(f"Query result: {result}")
            return result
        except mysql.connector.Error as err:
            logger.error(f"Database error in fetch_one: {err}")
            return None

    def fetch_all(self, query, params=None):
        try:
            logger.debug(f"Executing query: {query}")
            logger.debug(f"With parameters: {params}")
            self.cursor.execute(query, params or ())
            result = self.cursor.fetchall()
            logger.debug(f"Query returned {len(result)} rows")
            return result
        except mysql.connector.Error as err:
            logger.error(f"Database error in fetch_all: {err}")
            return []

    def close(self):
        self.cursor.close()
        self.connection.close()
        logger.debug("Database connection closed")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def update_student_password(self, student_id, new_password):
        """Updates the password for a given student (stores in plaintext)."""
        try:
            query = "UPDATE student SET Stu_password = %s WHERE stu_id = %s"
            self.execute_query(query, (new_password, student_id))
            # Check if the update was successful
            if self.cursor.rowcount > 0:
                logger.info(f"Password updated for student_id: {student_id}")
                return True
            else:
                logger.warning(f"No student found with id: {student_id} to update password.")
                return False
        except mysql.connector.Error as err:
            logger.error(f"Database error while updating password for student {student_id}: {err}")
            return False

    @staticmethod
    def initialize_tables():
        """Initialize database tables if they don't exist"""
        with Database() as db:
            # Create admin table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS admin (
                    admin_id INT PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    reset_token VARCHAR(255) NULL,
                    reset_token_expires DATETIME NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)

            # Create student table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS student (
                    stu_id INT PRIMARY KEY AUTO_INCREMENT,
                    Stu_name VARCHAR(255) NOT NULL,
                    Stu_contact VARCHAR(20),
                    Stu_email VARCHAR(255) UNIQUE NOT NULL,
                    Stu_password VARCHAR(255) NOT NULL,
                    Stu_rollno VARCHAR(20) UNIQUE,
                    semester INT,
                    Stu_Address TEXT,
                    photo_path VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)

            # Create attendances table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS attendances (
                    attendance_id INT PRIMARY KEY AUTO_INCREMENT,
                    stu_id INT NOT NULL,
                    student_name VARCHAR(255), 
                    student_semester INT, 
                    class_date DATETIME NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'Present',
                    subject VARCHAR(100),
                    class VARCHAR(100),
                    remarks TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (stu_id) REFERENCES student(stu_id) ON DELETE CASCADE
                )
            """)

            # Create captures table if it doesn't exist - COMMENTED OUT AS PER REQUEST
            # db.execute_query("""
            #     CREATE TABLE IF NOT EXISTS captures (
            #         capture_id INT PRIMARY KEY AUTO_INCREMENT,
            #         attendance_id INT NOT NULL,
            #         image_path VARCHAR(255) NOT NULL,
            #         captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            #         FOREIGN KEY (attendance_id) REFERENCES attendances(attendance_id) ON DELETE CASCADE
            #     )
            # """)

            # Create notifications table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    message TEXT NOT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create upcoming_classes table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS upcoming_classes (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    class_name VARCHAR(255) NOT NULL,
                    day_of_week VARCHAR(50),
                    time VARCHAR(50),
                    faculty VARCHAR(255),
                    semester INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create announcements table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS announcements (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(255) NOT NULL,
                    content TEXT,
                    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create class_routine table if it doesn't exist
            db.execute_query("""
                CREATE TABLE IF NOT EXISTS class_routine (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    semester INT NOT NULL,
                    course_id VARCHAR(50) NOT NULL,
                    subject_name VARCHAR(255) NOT NULL,
                    day_of_week VARCHAR(20) NOT NULL,
                    course_time TIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_routine_entry (semester, day_of_week, course_time)
                )
            """)

            # Insert default admin if not exists
            default_admin_username = 'admin'
            default_admin_email = 'admin@example.com'
            default_admin_password = 'admin123'
            # Default admin name is no longer stored in DB, will be static in UI.

            # Check if default admin exists
            existing_admin = db.fetch_one("SELECT admin_id FROM admin WHERE username = %s", (default_admin_username,))
            
            admin_id_to_use = None
            if not existing_admin:
                # Store plaintext password
                insert_admin_query = """
                    INSERT INTO admin (username, password, email)
                    VALUES (%s, %s, %s)
                """
                cursor = db.execute_query(insert_admin_query, (default_admin_username, default_admin_password, default_admin_email))
                if cursor:
                    admin_id_to_use = cursor.lastrowid
                    logger.info(f"Default admin '{default_admin_username}' created with ID: {admin_id_to_use} (password stored as plaintext)")
                else:
                    logger.error(f"Failed to create default admin '{default_admin_username}'.")
                    return
            else:
                admin_id_to_use = existing_admin['admin_id']
                logger.info(f"Default admin '{default_admin_username}' already exists with ID: {admin_id_to_use}")

            # Admin profile related logic is removed here.
            # The admin_id_to_use is available if needed for other initial setup, but not for profile.
            if not admin_id_to_use:
                 logger.error("Could not obtain admin_id for any further default setup if needed.")