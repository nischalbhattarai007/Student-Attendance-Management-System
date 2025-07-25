from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import re
from werkzeug.security import generate_password_hash, check_password_hash
from database import Database
import hashlib
from functools import wraps
import os
import logging
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
import face_recognition
import cv2
import numpy as np
import gc
import datetime
import base64
import io
import random
import threading

# Global cache for face encodings
known_faces_cache = {}
face_cache_lock = threading.Lock()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB limit
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# Define CAPTURES_FOLDER globally for the new internal function
CAPTURES_FOLDER = os.path.join(app.static_folder, 'captures')
if not os.path.exists(CAPTURES_FOLDER):
    os.makedirs(CAPTURES_FOLDER)
    app.logger.info(f"Created captures folder: {CAPTURES_FOLDER}")
app.logger.setLevel(logging.DEBUG)

# Database configuration
DB_CONFIG = {
    'database': 'student_attendance_system',
    'table_prefix': 'stu_'
}

# Static admin credentials (store in environment variables in production)
ADMIN_CREDENTIALS = {
    'username': os.environ.get('ADMIN_USERNAME', 'admin'),
    'password': os.environ.get('ADMIN_PASSWORD', 'admin123')
}

# Template folder configuration
app.template_folder = 'templates'

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create upload folders if they don't exist
CAPTURES_FOLDER = os.path.join(app.static_folder, 'captures')
STUDENT_PHOTOS_FOLDER = os.path.join(app.static_folder, 'uploads', 'student_photos')
os.makedirs(CAPTURES_FOLDER, exist_ok=True)
os.makedirs(STUDENT_PHOTOS_FOLDER, exist_ok=True) # Ensure student photos folder also exists

# --- Temporary Simulation for Demo ---
SIMULATE_SUCCESS = False # Set to False to use actual face recognition

def add_or_update_face_in_cache(student_id, student_name, photo_path):
    """Adds or updates a single student's face encoding in the cache."""
    global known_faces_cache
    try:
        # Construct the full path to the photo
        full_photo_path = os.path.join(app.static_folder, photo_path.replace('/', os.sep))
        
        if not os.path.exists(full_photo_path):
            app.logger.warning(f"Photo not found for student {student_id} at {full_photo_path}. Cannot update cache.")
            return

        # Load image and create encoding
        image = face_recognition.load_image_file(full_photo_path)
        encodings = face_recognition.face_encodings(image)

        if encodings:
            with face_cache_lock:
                known_faces_cache[student_id] = {
                    'encoding': encodings[0],
                    'name': student_name
                }
            app.logger.info(f"Successfully added/updated face for student {student_id} in cache.")
        else:
            app.logger.warning(f"No face found in photo for student {student_id}. Cache not updated.")

    except Exception as e:
        app.logger.error(f"Error updating cache for student {student_id}: {e}")

def remove_face_from_cache(student_id):
    """Removes a student's face encoding from the cache."""
    global known_faces_cache
    with face_cache_lock:
        if student_id in known_faces_cache:
            del known_faces_cache[student_id]
            app.logger.info(f"Removed face for student {student_id} from cache.")

def load_known_faces_from_db():
    global known_faces_cache
    with face_cache_lock:
        app.logger.info("Loading or refreshing known faces cache...")
        temp_cache = {}
        try:
            with Database() as db:
                all_students = db.fetch_all("SELECT stu_id, Stu_name, photo_path FROM student WHERE photo_path IS NOT NULL AND photo_path != ''")
            
            for student in all_students:
                try:
                    student_photo_path = os.path.join(app.static_folder, student['photo_path'].replace('/', os.sep))
                    if os.path.exists(student_photo_path):
                        image = face_recognition.load_image_file(student_photo_path)
                        encodings = face_recognition.face_encodings(image)
                        if encodings:
                            temp_cache[student['stu_id']] = {
                                'encoding': encodings[0],
                                'name': student['Stu_name']
                            }
                except Exception as e:
                    app.logger.error(f"Error loading face for student {student['stu_id']}: {e}")
            known_faces_cache = temp_cache
            app.logger.info(f"Cache refreshed. Total faces loaded: {len(known_faces_cache)}")
        except Exception as e:
            app.logger.error(f"Failed to load faces from database: {e}")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Login required decorator with role checking
def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('signin'))
            if role and session.get('user_type') != role:
                return redirect(url_for('signin'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/')
def root():
    return render_template('index2.html')

@app.route('/home')
def home():
    return redirect(url_for('signin'))

@app.route('/signin', methods=['GET', 'POST'])
def signin():
    if request.method == 'POST':
        try:
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '').strip()
            
            app.logger.debug(f"Login attempt - Username: {username}")
            
            if not username or not password:
                return jsonify({'success': False, 'message': 'Username and password are required'}), 400
            
            with Database() as db:
                admin_user = db.fetch_one(
                    "SELECT admin_id, username, password, email FROM admin WHERE username = %s",
                    (username,)
                )

                if admin_user and admin_user['password'] == password:
                    session['user_id'] = admin_user['admin_id']
                    session['user_type'] = 'admin'
                    session['user_name'] = 'Admin'  
                    session['user_email'] = admin_user['email'] 
                    app.logger.info(f"Admin '{username}' (ID: {admin_user['admin_id']}) logged in successfully.")
                    return jsonify({
                        'success': True, 
                        'redirect': url_for('admin_routes.admin_dashboard')
                    })
            
                student_user = db.fetch_one(
                    """
                    SELECT stu_id, Stu_name, Stu_email, Stu_password, semester, Stu_Address, Stu_contact
                    FROM student 
                    WHERE LOWER(Stu_name) = LOWER(%s) OR LOWER(Stu_contact) = LOWER(%s) OR LOWER(Stu_email) = LOWER(%s)
                    """,
                    (username, username, username) 
                )
                
                if student_user and student_user['Stu_password'] == password:
                    if not student_user.get('Stu_Address') or \
                       not student_user.get('Stu_contact') or \
                       not student_user.get('semester'):
                        app.logger.warning(f"Login attempt for student '{username}' (ID: {student_user['stu_id']}) - Profile incomplete.")
                        return jsonify({
                            'success': False, 
                            'action': 'redirect',
                            'redirect_url': url_for('account_pending') # New: instruct client to redirect
                        }), 200 # Send 200 OK because it's a valid JSON response with instructions

                    session['user_id'] = student_user['stu_id']
                    session['user_type'] = 'student'
                    session['user_name'] = student_user['Stu_name']
                    session['user_email'] = student_user['Stu_email']
                    session['semester'] = student_user['semester']
                    app.logger.info(f"Student '{username}' (ID: {student_user['stu_id']}) logged in successfully with complete profile.")
                    return jsonify({
                        'success': True, 
                        'redirect': url_for('student_routes.user_dashboard')
                    })
                
                app.logger.warning(f"Login failed for username: {username}. Invalid credentials or incomplete profile if password matched but fields were missing.")
                return jsonify({
                    'success': False, 
                    'message': 'Invalid username or password'
                }), 401

        except Exception as e:
            app.logger.error(f"Database error during signin: {str(e)}", exc_info=True)
            return jsonify({
                'success': False, 
                'message': 'Database connection error or processing issue during login.'
            }), 500

    return render_template('signIn.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        try:
            username = request.form.get('username', '').strip()
            form_email = request.form.get('email', '').strip()
            password = request.form.get('password', '').strip()
            confirm_password = request.form.get('confirm-password', '').strip()
            
            # Stu_contact is not explicitly collected in the current simplified form.
            # We'll store it as NULL or an empty string. Let's use None for the query parameter.
            student_contact_info = None 

            # Default values for columns not in the simplified signup form
            default_semester = None # Assuming semester can be NULL or has a DB default
            
            if not all([username, form_email, password, confirm_password]):
                return jsonify({
                    'success': False, 
                    'message': 'All fields are required'
                }), 400
            if len(password) < 8: # Assuming a minimum password length requirement
                return jsonify({
                    'success': False, 
                    'message': 'Password must be at least 8 characters'
                }), 400
            if password != confirm_password:
                return jsonify({
                    'success': False, 
                    'message': 'Passwords do not match'
                }), 400
            
            with Database() as db:
                existing_user_by_name = db.fetch_one(
                    "SELECT stu_id FROM student WHERE Stu_name = %s", 
                    (username,)
                )
                if existing_user_by_name:
                    return jsonify({
                        'success': False, 
                        'message': 'Username already taken'
                    }, 400)
                
                existing_user_by_email = db.fetch_one(
                    "SELECT stu_id FROM student WHERE Stu_email = %s",
                    (form_email,)
                )
                if existing_user_by_email:
                    return jsonify({
                        'success': False,
                        'message': 'Email already registered'
                    }, 400)

                # Correctly insert student with email in Stu_email and contact as None (or empty)
                db.execute_query(
                    "INSERT INTO student (Stu_name, Stu_email, Stu_password, Stu_contact, semester) VALUES (%s, %s, %s, %s, %s)",
                    (username, form_email, password, student_contact_info, default_semester)
                )
                
                notification_message = f"New student registration: {username}"
                db.execute_query(
                    "INSERT INTO notifications (message) VALUES (%s)",
                    (notification_message,)
                )
                return jsonify({
                    'success': True, 
                    'redirect': url_for('account_pending')
                })
        
        except Exception as e:
            app.logger.error(f"Error during signup: {str(e)}", exc_info=True)
            return jsonify({
                'success': False, 
                'message': 'An error occurred during registration'
            }), 500
    
    return render_template('signUp.html')

@app.route('/account_pending')
def account_pending():
    return render_template('incomplete_profile.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('signin'))

@app.route('/admin-login')
def admin_login():
    return render_template('Admin/admin_signIn.html')

@app.route('/Admin/get-students')
@login_required()
def get_students():
    try:
        semester = request.args.get('semester', '')
        query = "SELECT * FROM student"
        if semester:
            query += f" WHERE semester = {semester}"
        with Database() as db:
            cursor = db.cursor()
            cursor.execute(query)
            students = cursor.fetchall()
        return jsonify({'success': True, 'students': students})
    except Exception as e:
        app.logger.error(f"Error getting students: {str(e)}")
        return jsonify({'success': False, 'message': 'Error fetching students'}), 500

@app.route('/Admin/student-details/<int:student_id>', methods=['GET'])
@login_required(role='admin')
def get_student_details(student_id):
    try:
        with Database() as db:
            # Get student basic info
            student = db.fetch_one("""
                SELECT 
                    s.*,
                    COUNT(DISTINCT a.attendance_id) as total_attendance
                FROM student s
                LEFT JOIN attendances a ON s.stu_id = a.stu_id
                WHERE s.stu_id = %s
                GROUP BY s.stu_id
            """, (student_id,))
            
            if not student:
                return jsonify({
                    'success': False,
                    'message': 'Student not found'
                }), 404
            
            # Get recent attendance records (use Stu_email instead of Stu_rollno)
            attendance = db.fetch_all("""
                SELECT 
                    attendance_id,
                    class_date,
                    subject,
                    class
                FROM attendances
                WHERE stu_email = %s
                ORDER BY class_date DESC
                LIMIT 10
            """, (student.get('Stu_email'),))
            
            # Format dates
            if 'created_at' in student and student['created_at']:
                student['created_at'] = student['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if student.get('photo_path'):
                student['photo_path'] = student['photo_path'].replace("\\", "/")
            
            return jsonify({
                'success': True,
                'student': student,
                'recent_attendance': attendance or []
            })
            
    except Exception as e:
        app.logger.error(f"Error fetching student details: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to fetch student details: {str(e)}'
        }), 500

@app.route('/Admin/dashboard-stats', methods=['GET'])
@login_required(role='admin')
def get_dashboard_stats():
    try:
        with Database() as db:
            # Get total students
            total_students = db.fetch_one("SELECT COUNT(*) as count FROM student")
            if total_students is None:
                total_students = {'count': 0}
            # Get today's attendance
            today_attendance = db.fetch_one("""
                SELECT COUNT(DISTINCT stu_email) as count 
                FROM attendances 
                WHERE DATE(class_date) = CURDATE()
            """)
            if today_attendance is None:
                today_attendance = {'count': 0}
            # Set attendance percentage to 0 (no present column)
            attendance_stats = {'attendance_percentage': 0}
            return jsonify({
                'success': True,
                'stats': {
                    'total_students': total_students['count'],
                    'today_attendance': today_attendance['count'],
                    'attendance_percentage': attendance_stats['attendance_percentage']
                }
            })
    except Exception as e:
        app.logger.error(f"Error fetching dashboard stats: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to fetch dashboard stats'}), 500

def initialize_database():
    try:
        with app.app_context():
            Database.initialize_tables()
            app.logger.info("Database tables initialized successfully")
    except Exception as e:
        app.logger.error(f"Failed to initialize database: {str(e)}")

# Blueprint registrations
from Admin.routes import admin_bp
from Student.routes import student_bp

app.register_blueprint(admin_bp, url_prefix='/Admin')
app.register_blueprint(student_bp, url_prefix='/Student')

@app.route('/Admin/delete-student/<int:student_id>', methods=['POST'])
@login_required()
def delete_student(student_id):
    try:
        with Database() as db:
            cursor = db.cursor()
            cursor.execute("DELETE FROM student WHERE stu_id = %s", (student_id,))
            db.commit()
            cursor.close()
            return jsonify({'success': True, 'message': 'Student deleted successfully'})
    except Exception as e:
        app.logger.error(f"Error deleting student: {str(e)}")
        return jsonify({'success': False, 'message': 'Error deleting student'}), 500

@app.route('/Admin/notifications', methods=['GET'])
@login_required(role='admin')
def get_notifications():
    try:
        with Database() as db:
            notifications = db.fetch_all(
                "SELECT id, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 10"
            )
        return jsonify({'success': True, 'notifications': notifications})
    except Exception as e:
        app.logger.error(f"Error fetching notifications: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to fetch notifications'}), 500

@app.route('/Admin/students', methods=['GET'])
def get_students_api():
    try:
        with Database() as db:
            # Removed ORDER BY created_at DESC as the column might not exist or causes errors
            students = db.fetch_all("SELECT * FROM student") 
            return jsonify({'success': True, 'students': students})
    except Exception as e:
        # Log the specific error for backend debugging
        app.logger.error(f"Error in get_students_api: {str(e)}") 
        return jsonify({'success': False, 'error': str(e)}), 500

def validate_student_data(email, contact, password=None):
    """Validates student data based on specified rules."""
    errors = []

    # Email validation
    if not email.endswith('.com'):
        errors.append('Email must end with .com')

    # Contact validation
    if not (contact.startswith('98') or contact.startswith('97')) or len(contact) != 10 or not contact.isdigit():
        errors.append('Contact number must be 10 digits and start with 98 or 97.')

    # Password validation (only if provided)
    if password and len(password) < 8:
        errors.append('Password must be at least 8 characters long.')

    return errors
@app.route('/Admin/student/<int:student_id>/update', methods=['POST'])
@login_required(role='admin')
def update_student_api(student_id):
    try:
        name = request.form.get('name')
        email = request.form.get('email')
        contact = request.form.get('contact')
        semester = request.form.get('semester')
        address = request.form.get('address', '')
        password = request.form.get('password') # New password (optional)

        # Validate student data
        validation_errors = validate_student_data(email, contact)
        if validation_errors:
            return jsonify({'success': False, 'error': ', '.join(validation_errors)}), 400

        with Database() as db:
            existing_student = db.fetch_one("SELECT photo_path FROM student WHERE stu_id = %s", (student_id,))
            if not existing_student:
                return jsonify({'success': False, 'error': 'Student not found'}), 404

            old_photo_path = existing_student.get('photo_path')
            photo_path_for_db = old_photo_path
            photo_updated = False

            if 'photo' in request.files:
                photo_file = request.files['photo']
                if photo_file.filename != '' and allowed_file(photo_file.filename):
                    # A new photo is being uploaded
                    unique_filename = f"{student_id}_{secure_filename(photo_file.filename)}"
                    absolute_new_photo_path = os.path.join(STUDENT_PHOTOS_FOLDER, unique_filename)
                    photo_file.save(absolute_new_photo_path)
                    photo_path_for_db = os.path.join('uploads', 'student_photos', unique_filename).replace('\\', '/')
                    photo_updated = True

                    # Delete old photo if it exists
                    if old_photo_path:
                        absolute_old_photo_path = os.path.join(app.static_folder, old_photo_path.replace('/', os.sep))
                        if os.path.exists(absolute_old_photo_path):
                            os.remove(absolute_old_photo_path)
            
            # Update student details in DB
            if password:
                 if len(password) < 8:
                    return jsonify({'success': False, 'error': 'Password must be at least 8 characters long.'}), 400
                 hashed_password = generate_password_hash(str(password))
                 update_query = "UPDATE student SET Stu_name=%s, Stu_email=%s, Stu_contact=%s, semester=%s, Stu_Address=%s, photo_path=%s, Stu_password=%s WHERE stu_id=%s"
                 db.execute_query(update_query, (name, email, contact, semester, address, photo_path_for_db, hashed_password, student_id))
            else:
                update_query = "UPDATE student SET Stu_name=%s, Stu_email=%s, Stu_contact=%s, semester=%s, Stu_Address=%s, photo_path=%s WHERE stu_id=%s"
                db.execute_query(update_query, (name, email, contact, semester, address, photo_path_for_db, student_id))


        # Immediately update the face recognition cache
        if photo_path:
            add_or_update_face_in_cache(student_id, name, photo_path)
        elif name != existing_student_data['Stu_name']:
            # If only the name changed, update it in the cache
            with face_cache_lock:
                if student_id in known_faces_cache:
                    known_faces_cache[student_id]['name'] = name
                    app.logger.info(f"Updated name for student {student_id} in cache.")

        return jsonify({'success': True, 'message': 'Student updated successfully'})

    except Exception as e:
        app.logger.error(f"Error updating student {student_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/Admin/reports/today_attendance_summary', methods=['GET'])
@login_required(role='admin')
def today_attendance_summary():
    try:
        today_date = datetime.date.today()
        summary_by_semester = {}
        with Database() as db:
            # 1. Get total students per semester
            # 1. Get total students per semester, ignoring students with no assigned semester
            total_students_sql = "SELECT semester, COUNT(stu_id) as total FROM student WHERE semester IS NOT NULL AND semester != '' GROUP BY semester"
            total_students_result = db.fetch_all(total_students_sql)
            total_map = {row['semester']: row['total'] for row in total_students_result}

            # 2. Get present students per semester for today
            present_students_sql = """
                SELECT s.semester, COUNT(DISTINCT a.stu_id) as present
                FROM attendances a
                JOIN student s ON a.stu_id = s.stu_id
                WHERE DATE(a.class_date) = %s AND s.semester IS NOT NULL AND s.semester != ''
                GROUP BY s.semester
            """
            present_students_result = db.fetch_all(present_students_sql, (today_date,))
            present_map = {row['semester']: row['present'] for row in present_students_result}

            # 3. Combine the results
            all_semesters = sorted(total_map.keys())
            
            total_students_overall = 0
            present_students_overall = 0

            for semester in all_semesters:
                total = total_map.get(semester, 0)
                present = present_map.get(semester, 0)
                absent = total - present

                summary_by_semester[semester] = {
                    'total': total,
                    'present': present,
                    'absent': absent
                }
                total_students_overall += total
                present_students_overall += present
            
            # 4. Calculate overall summary from the aggregated data
            absent_students_overall = total_students_overall - present_students_overall
            summary_by_semester['all'] = {
                'total': total_students_overall,
                'present': present_students_overall,
                'absent': absent_students_overall
            }
            
            return jsonify({'success': True, 'summary': summary_by_semester})

    except Exception as e:
        app.logger.error(f"Error generating today's attendance summary: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred.'}), 500


@app.route('/Admin/reports/attendance_by_semester', methods=['GET'])
@login_required(role='admin')
def attendance_by_semester_report():
    semester = request.args.get('semester')
    report_date_str = request.args.get('date')

    if not semester or not report_date_str:
        return jsonify({'success': False, 'error': 'Semester and date are required.'}), 400

    try:
        report_date = datetime.datetime.strptime(report_date_str, '%Y-%m-%d').date()
        
        with Database() as db:
            # Get all students for the given semester
            students = db.fetch_all("SELECT stu_id, Stu_name FROM student WHERE semester = %s ORDER BY Stu_name", (semester,))
            
            # Get all attendance records for the given date
            attendances = db.fetch_all("SELECT stu_id FROM attendances WHERE DATE(class_date) = %s", (report_date,))
            
            present_student_ids = {att['stu_id'] for att in attendances}
            
            report_data = []
            for student in students:
                status = 'Present' if student['stu_id'] in present_student_ids else 'Absent'
                report_data.append({
                    'id': student['stu_id'],
                    'name': student['Stu_name'],
                    'status': status
                })

        return jsonify({'success': True, 'report': report_data})

    except Exception as e:
        app.logger.error(f"Error generating attendance report: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred.'}), 500


@app.route('/Student/attendance-history')
@login_required(role='student')
def student_attendance_history():
    if 'user_id' not in session or session.get('user_type') != 'student':
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    student_id = session['user_id']
    try:
        with Database() as db:
            query = """SELECT 
                            s.Stu_name as student_name, 
                            s.semester as student_semester,
                            a.class_date, 
                            a.status, 
                            'Java Programming' as subject, 
                            'BCA' as class
                         FROM attendances a 
                         JOIN student s ON a.stu_id = s.stu_id 
                         WHERE a.stu_id = %s 
                         ORDER BY a.class_date DESC"""
            history = db.fetch_all(query, (student_id,))

            # Format date for JSON response
            for record in history:
                if isinstance(record['class_date'], datetime.datetime):
                    record['class_date'] = record['class_date'].strftime('%Y-%m-%d %H:%M:%S')
            return jsonify({'success': True, 'history': history})
    except Exception as e:
        app.logger.error(f"Error fetching attendance history for student ID {student_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Database error'}), 500


@app.route('/api/semesters', methods=['GET'])
@login_required(role='admin')
def get_semesters():
    try:
        with Database() as db:
            semesters = db.fetch_all("SELECT DISTINCT semester FROM student ORDER BY semester")
            return jsonify({'success': True, 'semesters': [s['semester'] for s in semesters]})
    except Exception as e:
        app.logger.error(f"Error fetching semesters: {e}")
        return jsonify({'success': False, 'error': 'Database error'}), 500


@app.route('/Admin/student/<int:student_id>/delete', methods=['DELETE'])
def delete_student_api(student_id):
    try:
        with Database() as db:
            student = db.fetch_one("SELECT photo_path FROM student WHERE stu_id = %s", (student_id,))
            if student and student.get('photo_path'):
                absolute_photo_path = os.path.join(app.static_folder, student['photo_path'].replace('/', os.sep))
                if os.path.exists(absolute_photo_path):
                    os.remove(absolute_photo_path)

            db.execute_query("DELETE FROM attendances WHERE stu_id = %s", (student_id,))
            db.execute_query("DELETE FROM student WHERE stu_id = %s", (student_id,))

        # Remove the student's face from the cache
        remove_face_from_cache(student_id)

        return jsonify({'success': True, 'message': 'Student deleted successfully'})
    except Exception as e:
        app.logger.error(f"Error deleting student {student_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

def _mark_student_attendance_internal(student_id, student_name, image_bytes):
    app.logger.info(f"_mark_student_attendance_internal: Attempting for student {student_id} - {student_name}")
    try:
        # Save the captured image
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"attendance_capture_s{student_id}_{timestamp}.jpg"
            image_path = os.path.join(CAPTURES_FOLDER, filename)
            with open(image_path, 'wb') as f:
                f.write(image_bytes)
            app.logger.info(f"Saved captured image for attendance to {image_path}")
        except Exception as e:
            app.logger.error(f"Error saving captured image for student {student_id}: {e}", exc_info=True)

        with Database() as db:
            student_details = db.fetch_one("SELECT semester FROM student WHERE stu_id = %s", (student_id,))
            student_semester = student_details['semester'] if student_details else 'N/A'

            today_date = datetime.date.today()
            existing_attendance = db.fetch_one(
                                "SELECT attendance_id FROM attendances WHERE stu_id = %s AND DATE(class_date) = %s LIMIT 1",

                (student_id, today_date)
            )

            if existing_attendance:
                app.logger.info(f"Attendance already marked for student {student_id} today.")
                return True, f'Attendance already marked for {student_name} today.'

            current_datetime = datetime.datetime.now()
            db.execute_query(
                """INSERT INTO attendances 
                   (stu_id, student_name, student_semester, subject, class_date, status, class) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (student_id, student_name, student_semester, 'Online Check-in', current_datetime, 'Present', 'Live Face Recognition')
            )
            app.logger.info(f"Attendance successfully marked for student {student_name} (ID: {student_id})")
            return True, f'Attendance successfully marked for {student_name}.'

    except Exception as e:
        app.logger.error(f"Error in _mark_student_attendance_internal for student {student_id}: {e}", exc_info=True)
        return False, f'An server error occurred while marking attendance: {str(e)}'


@app.route('/identify_and_mark_attendance', methods=['POST'])
def identify_and_mark_attendance():
    if 'image' not in request.files:
        return jsonify({'success': False, 'message': 'No image file provided'}), 400

    unknown_image_file = request.files['image']
    unknown_image_bytes = unknown_image_file.read()

    try:
        unknown_image_np = np.frombuffer(unknown_image_bytes, np.uint8)
        unknown_image = cv2.imdecode(unknown_image_np, cv2.IMREAD_COLOR)
        if unknown_image is None:
            return jsonify({'success': False, 'message': 'Could not decode image.'}), 400

        rgb_unknown_image = cv2.cvtColor(unknown_image, cv2.COLOR_BGR2RGB)
        unknown_encodings = face_recognition.face_encodings(rgb_unknown_image)

        if not unknown_encodings:
            return jsonify({'success': False, 'message': 'Face not recognized. Please try again.'})

        unknown_encoding = unknown_encodings[0]

        with face_cache_lock:
            if not known_faces_cache:
                return jsonify({'success': False, 'message': 'No registered student faces found to compare against.'})

            for student_id, face_data in known_faces_cache.items():
                is_match = face_recognition.compare_faces([face_data['encoding']], unknown_encoding, tolerance=0.50)
                if is_match[0]:
                    success, message = _mark_student_attendance_internal(student_id, face_data['name'], unknown_image_bytes)
                    return jsonify({'success': success, 'message': message})

        return jsonify({'success': False, 'message': 'Face not recognized. Please try again.'})

    except Exception as e:
        app.logger.error(f"Error in identify_and_mark_attendance: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'An error occurred during face recognition.'}), 500

if __name__ == '__main__':
    initialize_database()
    with app.app_context():
        load_known_faces_from_db()
    app.run(debug=True)