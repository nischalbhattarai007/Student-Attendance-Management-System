from flask import Blueprint, jsonify, session, current_app, render_template, url_for, redirect, flash, request
from database import Database
from functools import wraps
from datetime import datetime, timedelta
from utils.image_utils import get_profile_photo_url
# import mysql.connector # No longer needed directly here

student_bp = Blueprint('student_routes', __name__, template_folder='../templates/Student')

def student_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('user_type') != 'student':
            current_app.logger.warning(f"Unauthorized access attempt to student route. Session: {session}")
            return redirect(url_for('signin'))
        return f(*args, **kwargs)
    return decorated_function

@student_bp.route('/dashboard')
@student_bp.route('/dashboard/<path:path_after_dashboard>')
@student_login_required
def user_dashboard(path_after_dashboard=None):
    try:
        student_id = session.get('user_id')
        student_name = session.get('user_name', 'Student')
        student_email = session.get('user_email')
        student_semester = session.get('semester')
        
        return render_template('student_dashboard.html', 
                               student_name=student_name, 
                               student_email=student_email,
                               student_id=student_id,
                               student_semester=student_semester)
    except Exception as e:
        current_app.logger.error(f"Error loading student dashboard for ID {session.get('user_id')}: {str(e)}", exc_info=True)
        return redirect(url_for('signin'))

@student_bp.route('/profile-data')
@student_login_required
def student_profile_data():
    student_id = session.get('user_id')
    if not student_id:
        current_app.logger.error(f"User ID not found in session for /profile-data despite login decorator. Session: {session}")
        return jsonify({'success': False, 'error': 'Authentication error: User ID missing'}), 500

    try:
        with Database() as db:
            student_data = db.fetch_one(
                "SELECT Stu_name, Stu_email, Stu_contact, Stu_Address, semester, photo_path FROM student WHERE stu_id = %s",
                (student_id,)
            )

        if student_data:
            photo_url = None
            if student_data.get('photo_path'):
                # Ensure consistent path separators
                clean_photo_path = student_data['photo_path'].replace('\\', '/')
                photo_url = url_for('static', filename=clean_photo_path, _external=False) # Use url_for for static files
            student_data['photo_url'] = photo_url
            
            student_data['stu_id'] = student_id # Ensure stu_id is part of the response
            
            current_app.logger.info(f"Fetched profile data for student ID {student_id}")
            return jsonify({'success': True, 'data': student_data})
        else:
            current_app.logger.warning(f"No profile data found for student ID {student_id}")
            return jsonify({'success': False, 'error': 'Student data not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error fetching student profile data for ID {student_id}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f'An error occurred: {str(e)}'}), 500

@student_bp.route('/api/upcoming-classes', methods=['GET'])
@student_login_required
def get_student_upcoming_classes():
    try:
        student_semester = session.get('semester')
        if not student_semester:
            current_app.logger.warning("Upcoming classes: Student semester not found in session.")
            return jsonify(success=False, message="Student semester not found in session. Cannot fetch upcoming classes."), 400

        with Database() as db:
            # Fetching from upcoming_classes table, filtered by student's semester
            # Added created_at for ordering, and id for potential future use.
            raw_classes = db.fetch_all(
                "SELECT id, class_name, day_of_week, time, faculty, semester, created_at FROM upcoming_classes WHERE semester = %s ORDER BY created_at DESC LIMIT 10",
                (student_semester,)
            )
        
        classes_list = []
        if raw_classes:
            for cls in raw_classes:
                day_time_str = cls.get('day_of_week', '')
                if cls.get('time'):
                    day_time_str += f", {cls['time']}" if day_time_str else cls['time']
                
                classes_list.append({
                    'id': cls['id'], # Added id
                    'class_name': cls.get('class_name', 'N/A'), # Mapped from course_name previously
                    'day_time': day_time_str,
                    'faculty': cls.get('faculty', 'N/A'), 
                    'semester': cls.get('semester', 'N/A'),
                    'created_at': cls.get('created_at').isoformat() if cls.get('created_at') else None # Added created_at
                })
        current_app.logger.info(f"Fetched {len(classes_list)} upcoming classes for student view.")
        return jsonify(success=True, classes=classes_list)
    except Exception as e:
        current_app.logger.error(f"Error fetching student upcoming classes: {e}", exc_info=True)
        return jsonify(success=False, message=f"Error fetching upcoming classes: {str(e)}"), 500

@student_bp.route('/api/recent-announcements', methods=['GET'])
@student_login_required
def get_student_recent_announcements():
    try:
        with Database() as db:
            # Fetch content along with other fields
            raw_announcements = db.fetch_all(
                "SELECT id, title, content, date_created FROM announcements ORDER BY date_created DESC LIMIT 5"
            )

        announcements_list = []
        if raw_announcements:
            for ann in raw_announcements:
                announcements_list.append({
                    'id': ann['id'],
                    'title': ann.get('title', 'Announcement'), 
                    'content': ann.get('content', ''), # Add content, default to empty string
                    'date_created': ann.get('date_created').isoformat() if ann.get('date_created') else None
                })
        current_app.logger.info(f"Fetched {len(announcements_list)} recent announcements for student view.")
        return jsonify(success=True, announcements=announcements_list)
    except Exception as e:
        current_app.logger.error(f"Error fetching student recent announcements: {e}", exc_info=True)
        return jsonify(success=False, message=f"Error fetching recent announcements: {str(e)}"), 500

@student_bp.route('/api/class-routine', methods=['GET'])
@student_login_required
def get_student_class_routine_api():
    student_id = session.get('user_id')
    student_semester_from_db = None # For logging and response
    try:
        with Database() as db:
            student_data = db.fetch_one("SELECT semester FROM student WHERE stu_id = %s", (student_id,))
            if not student_data or not student_data.get('semester'):
                current_app.logger.warning(f"Student semester not found for student_id: {student_id}")
                # Return success:false but include semester as null or specific message
                return jsonify({'success': False, 'message': 'Your semester is not set. Please contact administration.', 'semester': None, 'routines': []}), 404

            student_semester_from_db = student_data['semester']
            current_app.logger.info(f"Fetching class routine for student_id: {student_id}, semester: {student_semester_from_db}")
            
            routines_raw = db.fetch_all(
                "SELECT id, course_id, subject_name, day_of_week, course_time FROM class_routine WHERE semester = %s ORDER BY FIELD(day_of_week, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'), course_time", 
                (student_semester_from_db,)
            )
            current_app.logger.info(f"Fetched {len(routines_raw)} raw routine entries for student {student_id}, semester {student_semester_from_db}.")

            processed_routines_for_json = []
            for routine_item in routines_raw:
                item_for_json = {
                    'id': routine_item.get('id'),
                    'course_id': routine_item.get('course_id'),
                    'subject_name': routine_item.get('subject_name'),
                    'day_of_week': routine_item.get('day_of_week'),
                    'course_time_formatted': 'N/A' # Default
                }
                try:
                    course_time_original = routine_item.get('course_time')
                    if isinstance(course_time_original, timedelta):
                        # Create a datetime object at midnight, then add the timedelta
                        time_obj = datetime.min + course_time_original
                        item_for_json['course_time_formatted'] = time_obj.strftime("%I:%M %p").lstrip('0') # lstrip('0') for times like "09:30 AM" -> "9:30 AM"
                    elif course_time_original is None:
                        current_app.logger.debug(f"Routine ID {routine_item.get('id')}: course_time is None. Displaying N/A.")
                    else: # Should not happen if DB schema for time is TIME type
                        current_app.logger.warning(f"Routine ID {routine_item.get('id')}: course_time ('{course_time_original}') is not timedelta or None (Type: {type(course_time_original)}). Using raw string or N/A.")
                        # item_for_json['course_time_formatted'] = str(course_time_original) # Or keep N/A
                except Exception as fmt_err:
                    current_app.logger.error(f"Error formatting time for routine_id {routine_item.get('id', 'UNKNOWN')} (Time: {course_time_original}): {fmt_err}", exc_info=True)
                    item_for_json['course_time_formatted'] = "Time Error"
                
                processed_routines_for_json.append(item_for_json)
            
            current_app.logger.info(f"Successfully processed routines for student {student_id}. Count: {len(processed_routines_for_json)}")
            return jsonify({'success': True, 'routines': processed_routines_for_json, 'semester': student_semester_from_db})
    
    except Exception as e:
        current_app.logger.error(f"Error fetching student class routine for student_id: {student_id}, semester: {student_semester_from_db if student_semester_from_db else 'Not Determined'}. Error: {str(e)}", exc_info=True)
        # Ensure semester is part of the error response if known
        return jsonify({'success': False, 'message': 'An unexpected error occurred while fetching your routine. Please try again later.', 'semester': student_semester_from_db, 'routines': []}), 500

@student_bp.route('/update-profile', methods=['POST'])
@student_login_required
def update_student_profile_api():
    # Implementation of the update_student_profile_api route
    pass

@student_bp.route('/api/class-routine/current', methods=['GET'])
@student_login_required
def get_current_class():
    try:
        student_semester = session.get('semester')
        if not student_semester:
            return jsonify({'success': False, 'error': 'Student semester not found in session'}), 400

        current_time = datetime.now()
        current_day = current_time.strftime('%A')  # Get current day as string (e.g., 'Monday')
        current_hour = current_time.hour
        current_minute = current_time.minute

        with Database() as db:
            # Fetch current class for the student's semester and current day/time
            current_class = db.fetch_one(
                """
                SELECT id, class_name, day_of_week, time AS course_time, faculty, semester 
                FROM upcoming_classes 
                WHERE semester = %s 
                AND day_of_week = %s 
                AND TIME(time) <= TIME(%s) 
                ORDER BY time DESC 
                LIMIT 1
                """,
                (student_semester, current_day, current_time.strftime('%H:%M:%S'))
            )

        if current_class:
            return jsonify({'success': True, 'data': current_class})
        else:
            return jsonify({'success': True, 'data': None})

    except Exception as e:
        current_app.logger.error(f"Error fetching current class: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

# Ensure this blueprint is registered in your main app.py
# Example in app.py: 
@student_bp.route('/change-password', methods=['POST'])
@student_login_required
def change_password():
    student_id = session.get('user_id')
    data = request.get_json()
    new_password = data.get('new_password')

    if not new_password or len(new_password) < 8:
        return jsonify({'success': False, 'message': 'Password must be at least 8 characters long.'}), 400

    try:
        with Database() as db:
            # The database function will handle hashing
            success = db.update_student_password(student_id, new_password)
        
        if success:
            current_app.logger.info(f"Password updated successfully for student ID: {student_id}")
            return jsonify({'success': True, 'message': 'Password updated successfully!'})
        else:
            # This case might occur if the student_id is invalid, though unlikely if they are logged in.
            current_app.logger.error(f"Password update failed for student ID: {student_id}. Student not found or DB error.")
            return jsonify({'success': False, 'message': 'Failed to update password. Please try again.'}), 500

    except Exception as e:
        current_app.logger.error(f"Exception during password update for student ID {student_id}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'An internal server error occurred.'}), 500

# Ensure this blueprint is registered in your main app.py
# Example in app.py: 
# from Student.routes import student_bp
# app.register_blueprint(student_bp, url_prefix='/Student')
