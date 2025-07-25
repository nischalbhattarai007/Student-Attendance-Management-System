from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify, current_app, flash
from functools import wraps
from database import Database
import os
from werkzeug.utils import secure_filename
from flask_mail import Message
from flask_mail import Mail
import secrets
from datetime import datetime, timedelta
import json
import mysql.connector

admin_bp = Blueprint('admin_routes', __name__, template_folder='templates')

# Configure upload folder
UPLOAD_FOLDER = os.path.join('static', 'uploads', 'student_photos')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Login required decorator with role checking
def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('signin'))
            if role and session.get('user_type') != role:
                # For API routes, returning JSON might be better than redirect
                if request.blueprint == 'admin_routes': # Example: Check if it's an admin API route
                    return jsonify({'success': False, 'error': 'Unauthorized'}), 403
                return redirect(url_for('signin'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Decorator to ensure user is an admin
def admin_required(f):
    @wraps(f) # Make sure to import wraps from functools in routes.py if not already
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('user_type') != 'admin':
            flash('Please log in as an admin to access this page.', 'warning')
            return redirect(url_for('signin'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/dashboard')
@admin_bp.route('/dashboard/<path:path_after_dashboard>') # New catch-all route
@admin_required
def admin_dashboard(path_after_dashboard=None): # Added default for the new parameter
    # Admin profile data is now static for display purposes
    admin_display_data = {
        'name': session.get('user_name', 'Admin'), # Should be 'Admin' from session
        'email': session.get('user_email', 'admin@example.com'), # From session
        'photo_placeholder': 'A' # Static placeholder for photo
    }
    # No database calls needed here for admin profile anymore
    return render_template('Admin/admin.html', admin_profile=admin_display_data)

@admin_bp.route('/add_student', methods=['POST'])
@login_required(role='admin')
def add_student_api():
    if 'photo' not in request.files or not request.files['photo'].filename:
        return jsonify({'success': False, 'error': 'No photo provided'}), 400

    file = request.files['photo']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Save the file
        temp_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(temp_path)
        
        # Construct relative path for DB
        photo_path_for_db = os.path.join('uploads', 'student_photos', filename).replace('\\', '/')

        # Process form data
        student_name = request.form.get('name')
        student_email = request.form.get('email')
        student_password = request.form.get('password')
        student_contact = request.form.get('contact')
        student_semester = request.form.get('semester')
        student_address = request.form.get('address') # Get address from form

        try:
            with Database() as db:
                # Insert student data into the correct table with correct columns
                db.execute_query("INSERT INTO student (Stu_name, Stu_email, Stu_password, Stu_contact, semester, Stu_Address, photo_path) VALUES (%s, %s, %s, %s, %s, %s, %s)", 
                                 (student_name, student_email, student_password, student_contact, student_semester, student_address, photo_path_for_db))
            return jsonify({'success': True, 'message': 'Student added successfully!'})
        except Exception as e:
            # Clean up the saved file if DB insertion fails
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        return jsonify({'success': False, 'error': 'Invalid file type'}), 400

@admin_bp.route('/notifications')
@login_required()
def get_notifications_api():
    try:
        with Database() as db:
            # 1. Get count of unread notifications BEFORE marking them as read
            unread_info = db.fetch_one("SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE")
            unread_count = unread_info['count'] if unread_info else 0

            # 2. Fetch recent notifications (e.g., last 10)
            # Added is_read to see the status, though they will be marked read shortly
            notifications = db.fetch_all("""
                SELECT id, message, created_at, is_read 
                FROM notifications 
                ORDER BY created_at DESC 
                LIMIT 10
            """)
            
            # 3. Mark all unread notifications as read
            # This effectively means the unread_count is for "new since last check via this dropdown"
            db.execute_query("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE")
            
            # Format datetime objects for JSON serialization if necessary
            for notification in notifications:
                if isinstance(notification['created_at'], datetime):
                    notification['created_at'] = notification['created_at'].strftime('%Y-%m-%d %H:%M:%S')
                elif isinstance(notification['created_at'], str):
                    # If it's already a string, ensure it's in a consistent format or parse and reformat
                    pass # Assuming it's already fine

            current_app.logger.debug(f"Returning {len(notifications)} notifications, unread count was: {unread_count}")
            return jsonify({'success': True, 'notifications': notifications, 'unread_count': unread_count})
            
    except Exception as e:
        current_app.logger.error(f"Error fetching notifications: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error fetching notifications'}), 500

@admin_bp.route('/student/<int:student_id>/photo', methods=['POST'])
@login_required()
def update_student_photo(student_id):
    try:
        photo = request.files.get('photo')
        if not photo or not allowed_file(photo.filename):
            return jsonify({'success': False, 'message': 'Invalid file type'}), 400
        
        with Database() as db:
            student = db.fetch_one("SELECT photo_path FROM student WHERE stu_id = %s", (student_id,))
            
            if student and student.get('photo_path'):
                # Construct the full path to the old photo for deletion
                # The stored path is relative to 'static', so join it with 'static'
                old_photo_full_path = os.path.join('static', student['photo_path'])
                if os.path.exists(old_photo_full_path):
                    try:
                        os.remove(old_photo_full_path)
                    except OSError as e:
                        current_app.logger.error(f"Error deleting old photo {old_photo_full_path}: {e}")

            filename = secure_filename(f"student_{student_id}_{photo.filename}")
            # Ensure the full path for saving is correct
            full_save_path = os.path.join(UPLOAD_FOLDER, filename)
            photo.save(full_save_path)
            
            # Store the path relative to the 'static' folder, including 'student_photos'
            new_photo_db_path = f"uploads/student_photos/{filename}"
            
            db.execute_query(
                "UPDATE student SET photo_path = %s WHERE stu_id = %s",
                (new_photo_db_path, student_id)
            )
        
        return jsonify({'success': True, 'message': 'Photo updated successfully', 'photo_path': new_photo_db_path})
    
    except Exception as e:
        current_app.logger.error(f"Error updating student photo: {str(e)}")
        return jsonify({'success': False, 'message': 'Error updating photo'}), 500

@admin_bp.route('/student/add', methods=['POST'])
@login_required()
def add_student():
    try:
        # Get form data
        name = request.form.get('name')
        contact = request.form.get('contact')
        email = request.form.get('email')
        password = request.form.get('password')
        semester = request.form.get('semester')
        address = request.form.get('address')
        photo = request.files.get('photo')

        current_app.logger.debug(f"Add student: name={name}, contact={contact}, email={email}, semester={semester}")

        if not all([name, contact, email, password, semester, address]):
            return jsonify({'success': False, 'message': 'All fields are required'}), 400

        with Database() as db:
            # Check if email already exists
            existing_student = db.fetch_one(
                "SELECT stu_id FROM student WHERE Stu_email = %s",
                (email,)
            )
            if existing_student:
                return jsonify({'success': False, 'message': 'Email already registered'}), 400

            # Handle photo upload
            photo_path = None
            if photo and allowed_file(photo.filename):
                filename = secure_filename(f"student_{email}_{photo.filename}")
                # Ensure the full path for saving is correct
                full_save_path = os.path.join(UPLOAD_FOLDER, filename)
                photo.save(full_save_path)
                # Store the path relative to the 'static' folder, including 'student_photos'
                photo_path = f"uploads/student_photos/{filename}"

            # Insert student (no rollno)
            db.execute_query(
                """
                INSERT INTO student (
                    Stu_name, Stu_contact, Stu_email, Stu_password, 
                    semester, Stu_Address, photo_path
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (name, contact, email, password, semester, address, photo_path)
            )

            # Add notification
            notification_message = f"New student registered: {name} ({email})"
            db.execute_query(
                "INSERT INTO notifications (message) VALUES (%s)",
                (notification_message,)
            )

            return jsonify({
                'success': True,
                'message': 'Student added successfully',
                'student': {
                    'email': email,
                    'photo_path': photo_path
                }
            })

    except Exception as e:
        current_app.logger.error(f"Error adding student: {str(e)}")
        return jsonify({'success': False, 'message': f'Error adding student: {str(e)}'}), 500

@admin_bp.route('/student/<int:student_id>/update', methods=['POST'])
@login_required(role='admin')
def update_student(student_id):
    try:
        data = request.form
        name = data.get('name')
        contact = data.get('contact')
        email = data.get('email')
        # Password update is optional
        password = data.get('password')
        semester = data.get('semester')
        address = data.get('address')
        photo = request.files.get('photo')

        current_app.logger.debug(f"Update student {student_id}: name={name}, email={email}, photo_provided={bool(photo)}")

        if not all([name, contact, email, semester, address]):
            return jsonify({'success': False, 'message': 'All fields except password and photo are required'}), 400

        with Database() as db:
            # Check if the new email already exists for another student
            existing_student = db.fetch_one(
                "SELECT stu_id FROM student WHERE Stu_email = %s AND stu_id != %s",
                (email, student_id)
            )
            if existing_student:
                return jsonify({'success': False, 'message': 'Email already registered by another student'}), 400

            update_fields = []
            update_values = []

            update_fields.append("Stu_name = %s")
            update_values.append(name)
            update_fields.append("Stu_contact = %s")
            update_values.append(contact)
            update_fields.append("Stu_email = %s")
            update_values.append(email)
            update_fields.append("semester = %s")
            update_values.append(semester)
            update_fields.append("Stu_Address = %s")
            update_values.append(address)

            if password:
                update_fields.append("Stu_password = %s")
                update_values.append(password) # Consider hashing this password

            photo_db_path = None # Initialize to None
            if photo and allowed_file(photo.filename):
                # Retrieve current photo path to delete old one
                current_student_data = db.fetch_one("SELECT photo_path FROM student WHERE stu_id = %s", (student_id,))
                if current_student_data and current_student_data.get('photo_path'):
                    old_photo_full_path = os.path.join('static', current_student_data['photo_path'])
                    if os.path.exists(old_photo_full_path):
                        try:
                            os.remove(old_photo_full_path)
                        except OSError as e:
                             current_app.logger.error(f"Error deleting old photo during update {old_photo_full_path}: {e}")
                
                filename = secure_filename(f"student_{student_id}_{photo.filename}") # Use student_id for consistency
                full_save_path = os.path.join(UPLOAD_FOLDER, filename)
                photo.save(full_save_path)
                photo_db_path = f"uploads/student_photos/{filename}" # Correct relative path
                update_fields.append("photo_path = %s")
                update_values.append(photo_db_path)
            
            update_fields.append("updated_at = CURRENT_TIMESTAMP")

            query = f"UPDATE student SET {', '.join(update_fields)} WHERE stu_id = %s"
            update_values.append(student_id)
            
            db.execute_query(query, tuple(update_values))

            # Fetch updated student data to return
            updated_student = db.fetch_one("SELECT stu_id, Stu_name, Stu_email, Stu_contact, semester, Stu_Address, photo_path FROM student WHERE stu_id = %s", (student_id,))
            if updated_student and updated_student.get('photo_path'):
                 # Ensure the photo path is prefixed with /static/ for the client if it's not already
                if not updated_student['photo_path'].startswith('/static/'):
                    updated_student['photo_path'] = '/static/' + updated_student['photo_path']


            return jsonify({
                'success': True, 
                'message': 'Student updated successfully',
                'student': updated_student # Return updated student data
            })

    except Exception as e:
        current_app.logger.error(f"Error updating student {student_id}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'Error updating student: {str(e)}'}), 500

@admin_bp.route('/student/<int:student_id>/delete', methods=['POST'])
@login_required()
def delete_student(student_id):
    try:
        with Database() as db:
            student = db.fetch_one("SELECT photo_path FROM student WHERE stu_id = %s", (student_id,))
            if student and student.get('photo_path'):
                photo_path = os.path.join(UPLOAD_FOLDER, student['photo_path'])
                if os.path.exists(photo_path):
                    os.remove(photo_path)
            db.execute_query("DELETE FROM student WHERE stu_id = %s", (student_id,))
        return jsonify({'success': True})
    except Exception as e:
        current_app.logger.error(f"Error deleting student: {str(e)}")
        return jsonify({'success': False, 'message': 'Error deleting student'}), 500

@admin_bp.route('/api/admin/forgot-password', methods=['POST'])
def forgot_admin_password():
    try:
        email = request.form.get('email')
        
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
            
        with Database() as db:
            # Check if email exists
            admin = db.fetch_one(
                "SELECT a.admin_id, ap.email FROM admin a JOIN admin_profile ap ON a.admin_id = ap.admin_id WHERE ap.email = %s",
                (email,)
            )
            
            if not admin:
                return jsonify({'success': False, 'message': 'No account found with this email'}), 404
                
            # Generate reset token
            token = generate_reset_token(admin['admin_id'])
            
            # Store token in database
            db.execute_query(
                "UPDATE admin SET reset_token = %s, reset_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE admin_id = %s",
                (token, admin['admin_id'])
            )
            
            # Send reset email
            reset_url = url_for('admin_routes.reset_password', token=token, _external=True)
            send_reset_email(email, reset_url)
            
            return jsonify({'success': True, 'message': 'Password reset instructions sent to your email'})
            
    except Exception as e:
        current_app.logger.error(f"Error processing password reset: {str(e)}")
        return jsonify({'success': False, 'message': 'Error processing password reset'}), 500

@admin_bp.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if request.method == 'POST':
        try:
            new_password = request.form.get('new_password')
            confirm_password = request.form.get('confirm_password')
            
            if not new_password or not confirm_password:
                return jsonify({'success': False, 'message': 'All password fields are required'}), 400
                
            if new_password != confirm_password:
                return jsonify({'success': False, 'message': 'Passwords do not match'}), 400
                
            with Database() as db:
                # Verify token
                admin = db.fetch_one(
                    "SELECT admin_id, password FROM admin WHERE reset_token = %s AND reset_token_expires > NOW()", # selected 'password' for consistency, though not used for check here
                    (token,)
                )
                
                if not admin:
                    return jsonify({'success': False, 'message': 'Invalid or expired reset token'}), 400
                    
                # Update password (plaintext)
                db.execute_query(
                    "UPDATE admin SET password = %s, reset_token = NULL, reset_token_expires = NULL WHERE admin_id = %s", # Store new_password directly
                    (new_password, admin['admin_id'])
                )
                
                return jsonify({'success': True, 'message': 'Password reset successfully'})
                
        except Exception as e:
            current_app.logger.error(f"Error resetting password: {str(e)}")
            return jsonify({'success': False, 'message': 'Error resetting password'}), 500
            
    # GET request - show reset password form
    return render_template('Admin/reset_password.html', token=token)

@admin_bp.route('/notifications/clear_all', methods=['POST'])
@login_required() # Ensure admin is logged in
def clear_all_notifications_api():
    try:
        with Database() as db:
            # For simplicity, we'll delete all notifications.
            # If you had user-specific notifications, you'd add a WHERE clause.
            cursor = db.execute_query("DELETE FROM notifications")
            # db.connection.commit() is called by execute_query if successful
            
            if cursor:
                current_app.logger.info(f"All notifications cleared. Rows affected: {cursor.rowcount}")
                return jsonify({'success': True, 'message': 'All notifications cleared.'})
            else:
                # This case might indicate an issue with query execution even if no direct SQL error was raised by connector
                current_app.logger.error("Failed to clear notifications, cursor indicates failure.")
                return jsonify({'success': False, 'message': 'Failed to clear notifications due to a database issue.'}), 500

    except Exception as e:
        current_app.logger.error(f"Error clearing all notifications: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'An unexpected error occurred: {str(e)}'}), 500

# Helper functions
def generate_reset_token(admin_id):
    """Generate a secure reset token"""
    return secrets.token_urlsafe(32)

def send_reset_email(email, reset_url):
    """Send password reset email"""
    # This requires Flask-Mail setup in your main app.py
    # For now, it's a placeholder if mail isn't configured.
    try:
        mail = Mail(current_app) # Get mail instance from current_app context
        msg = Message('Password Reset Request',
                    sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'noreply@yourdomain.com'),
                    recipients=[email])
        msg.body = f'''To reset your password, visit the following link:
{reset_url}

If you did not make this request then simply ignore this email.
'''
        mail.send(msg)
        current_app.logger.info(f"Password reset email sent to {email}")
    except Exception as e:
        current_app.logger.error(f"Failed to send password reset email to {email}: {e}")

# Helper to parse day_time string e.g., "Mon, 9:00 AM" or "Tuesday 10:30PM"
def parse_day_time(day_time_str):
    if not day_time_str:
        return None, None
    parts = day_time_str.split(',', 1)
    day_of_week = parts[0].strip()
    time_val = parts[1].strip() if len(parts) > 1 else None
    # Basic validation/cleaning
    if not day_of_week: day_of_week = None
    if not time_val: time_val = None
    return day_of_week, time_val

# --- Upcoming Classes API Endpoints ---

@admin_bp.route('/api/classes', methods=['GET'])
@login_required()
def get_classes_api():
    try:
        with Database() as db:
            classes_raw = db.fetch_all("SELECT id, class_name, day_of_week, time, faculty, semester FROM upcoming_classes ORDER BY id DESC")
        
        classes_data = []
        if classes_raw:
            for cls_item in classes_raw:
                time_str = None
                original_time = cls_item.get('time')
                if isinstance(original_time, timedelta):
                    total_seconds = int(original_time.total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    seconds = total_seconds % 60
                    time_str = f"{hours:02}:{minutes:02}:{seconds:02}"
                elif original_time: # If it's not timedelta but exists (e.g., already a string)
                    time_str = str(original_time)

                day_of_week_str = cls_item.get('day_of_week', '')
                day_time_combined = day_of_week_str
                if time_str:
                    day_time_combined = f"{day_of_week_str}, {time_str}" if day_of_week_str else time_str
                
                classes_data.append({
                    'id': cls_item['id'],
                    'class_name': cls_item['class_name'],
                    'day_time': day_time_combined,
                    'faculty': cls_item.get('faculty'),
                    'semester': cls_item.get('semester')
                    # Explicitly not including original 'day_of_week' or 'time' if they are complex types
                })
        return jsonify(success=True, classes=classes_data)
    except Exception as e:
        current_app.logger.error(f"Error in get_classes_api: {e}", exc_info=True)
        return jsonify(success=False, message="Error fetching classes list."), 500

@admin_bp.route('/api/classes/add', methods=['POST'])
@login_required(role='admin')
def add_class_api():
    data = request.get_json()
    current_app.logger.debug(f"Add Class API - Received data: {data}") # Log received data

    class_name = data.get('class_name')
    day_time_str = data.get('day_time') # Get the combined field
    faculty = data.get('faculty')
    semester = data.get('semester')

    current_app.logger.debug(f"Add Class API - Raw day_time_str: '{day_time_str}'") # Log raw string
    day_of_week, time = parse_day_time(day_time_str) # Parse it
    current_app.logger.debug(f"Add Class API - Parsed day_of_week: '{day_of_week}', time: '{time}'") # Log parsed values

    # Validate all required fields, including parsed day_of_week and time
    if not all([class_name, day_of_week, time, faculty, semester is not None]): 
        current_app.logger.warning(f"Add Class API - Validation failed. Fields: CN={class_name}, DOW={day_of_week}, T={time}, F={faculty}, S={semester}")
        return jsonify({'success': False, 'message': 'Missing or invalid fields. Required: Class Name, valid Day & Time (e.g., Mon, 9:00 AM), Faculty, Semester.'}), 400

    try:
        with Database() as db:
            query = """
                INSERT INTO upcoming_classes (class_name, day_of_week, time, faculty, semester) 
                VALUES (%s, %s, %s, %s, %s)
            """
            db.execute_query(query, (class_name, day_of_week, time, faculty, semester))
        return jsonify({'success': True, 'message': 'Class added successfully'}), 201
    except Exception as e:
        current_app.logger.error(f"Error adding class: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to add class: {str(e)}'}), 500

@admin_bp.route('/api/classes/<int:class_id>', methods=['GET'])
@login_required()
def get_class_details_api(class_id):
    try:
        with Database() as db:
            class_detail_raw = db.fetch_one("SELECT id, class_name, day_of_week, time, faculty, semester FROM upcoming_classes WHERE id = %s", (class_id,))
        
        if class_detail_raw:
            time_str = None
            original_time = class_detail_raw.get('time')
            if isinstance(original_time, timedelta):
                total_seconds = int(original_time.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                time_str = f"{hours:02}:{minutes:02}:{seconds:02}"
            elif original_time:
                time_str = str(original_time)

            day_of_week_str = class_detail_raw.get('day_of_week', '')
            day_time_combined = day_of_week_str
            if time_str:
                day_time_combined = f"{day_of_week_str}, {time_str}" if day_of_week_str else time_str

            safe_class_detail = {
                'id': class_detail_raw['id'],
                'class_name': class_detail_raw['class_name'],
                # 'day_of_week': day_of_week_str, # For form population if needed
                # 'time': time_str,              # For form population if needed
                'day_time': day_time_combined, # For edit form convenience
                'faculty': class_detail_raw.get('faculty'),
                'semester': class_detail_raw.get('semester')
            }
            return jsonify(success=True, class_detail=safe_class_detail)
        else:
            return jsonify(success=False, error="Class not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error in get_class_details_api for class_id {class_id}: {e}", exc_info=True)
        return jsonify(success=False, error="Server error fetching class details."), 500

@admin_bp.route('/api/classes/update/<int:class_id>', methods=['POST'])
@login_required(role='admin')
def update_class_api(class_id):
    data = request.get_json()
    class_name = data.get('class_name')
    day_time_str = data.get('day_time') # Get the combined field
    faculty = data.get('faculty')
    semester = data.get('semester')

    day_of_week, time = parse_day_time(day_time_str) # Parse it

    # Validate all required fields, including parsed day_of_week and time
    if not all([class_name, day_of_week, time, faculty, semester is not None]): 
        return jsonify({'success': False, 'message': 'Missing or invalid fields. Required: Class Name, valid Day & Time, Faculty, Semester.'}), 400

    try:
        with Database() as db:
            query = """
                UPDATE upcoming_classes 
                SET class_name = %s, day_of_week = %s, time = %s, faculty = %s, semester = %s
                WHERE id = %s
            """
            db.execute_query(query, (class_name, day_of_week, time, faculty, semester, class_id))
        return jsonify({'success': True, 'message': 'Class updated successfully'})
    except Exception as e:
        current_app.logger.error(f"Error updating class: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to update class: {str(e)}'}), 500

@admin_bp.route('/api/classes/delete/<int:class_id>', methods=['DELETE'])
@login_required(role='admin')
def delete_class_api(class_id):
    try:
        with Database() as db:
            # Adjusted to match new schema
            db.execute_query("DELETE FROM upcoming_classes WHERE id = %s", (class_id,))
        return jsonify({'success': True, 'message': 'Class deleted successfully'})
    except Exception as e:
        current_app.logger.error(f"Error deleting class: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to delete class'}), 500

# --- Announcements API Endpoints ---

@admin_bp.route('/api/announcements', methods=['GET'])
@login_required()
def get_announcements_api():
    try:
        with Database() as db:
            announcements_raw = db.fetch_all("SELECT id, title, content, date_created FROM announcements ORDER BY date_created DESC")
        
        announcements_data = []
        if announcements_raw:
            for ann_item in announcements_raw:
                date_created_iso = None
                if ann_item.get('date_created'):
                    try:
                        # Assuming date_created is datetime.datetime or datetime.date
                        date_created_iso = ann_item['date_created'].isoformat()
                    except AttributeError:
                        # If it's already a string or other type that doesn't have isoformat
                        date_created_iso = str(ann_item['date_created'])
                        current_app.logger.warning(f"Announcement ID {ann_item.get('id')}: date_created was not a date/datetime object. Type: {type(ann_item['date_created'])}")
                
                announcements_data.append({
                    'id': ann_item['id'],
                    'title': ann_item.get('title'),
                    'content': ann_item.get('content'),
                    'date_created': date_created_iso
                })
        return jsonify(success=True, announcements=announcements_data)
    except Exception as e:
        current_app.logger.error(f"Error in get_announcements_api: {e}", exc_info=True)
        return jsonify(success=False, message="Error fetching announcements list."), 500

@admin_bp.route('/api/announcements/add', methods=['POST'])
@login_required(role='admin')
def add_announcement_api():
    data = request.get_json()
    title = data.get('title')
    content = data.get('content') # Get content

    if not title or not content: # Validate both title and content
        return jsonify({'success': False, 'message': 'Title and Content are required'}), 400

    try:
        with Database() as db:
            query = "INSERT INTO announcements (title, content) VALUES (%s, %s)" # Add content to query
            db.execute_query(query, (title, content)) # Add content to params
        return jsonify({'success': True, 'message': 'Announcement added successfully'}), 201
    except Exception as e:
        current_app.logger.error(f"Error adding announcement: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to add announcement: {str(e)}'}), 500

@admin_bp.route('/api/announcements/<int:announcement_id>', methods=['GET'])
@login_required()
def get_announcement_details_api(announcement_id):
    try:
        with Database() as db:
            announcement_raw = db.fetch_one("SELECT id, title, content, date_created FROM announcements WHERE id = %s", (announcement_id,))
        
        if announcement_raw:
            date_created_iso = None
            if announcement_raw.get('date_created'):
                try:
                    date_created_iso = announcement_raw['date_created'].isoformat()
                except AttributeError:
                    date_created_iso = str(announcement_raw['date_created'])
                    current_app.logger.warning(f"Announcement Detail ID {announcement_raw.get('id')}: date_created was not a date/datetime object. Type: {type(announcement_raw['date_created'])}")

            safe_announcement_detail = {
                'id': announcement_raw['id'],
                'title': announcement_raw.get('title'),
                'content': announcement_raw.get('content'),
                'date_created': date_created_iso
            }
            return jsonify(success=True, announcement=safe_announcement_detail) # Corrected key to 'announcement'
        else:
            return jsonify(success=False, message="Announcement not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error fetching announcement details for ID {announcement_id}: {e}", exc_info=True)
        return jsonify(success=False, message="Server error fetching announcement details"), 500

@admin_bp.route('/api/announcements/update/<int:ann_id>', methods=['POST'])
@login_required(role='admin')
def update_announcement_api(ann_id):
    data = request.get_json()
    title = data.get('title')
    content = data.get('content') # Get content

    if not title or not content: # Validate both title and content
        return jsonify({'success': False, 'message': 'Title and Content are required'}), 400

    try:
        with Database() as db:
            # Update content field as well
            query = "UPDATE announcements SET title = %s, content = %s WHERE id = %s"
            db.execute_query(query, (title, content, ann_id))
        return jsonify({'success': True, 'message': 'Announcement updated successfully'})
    except Exception as e:
        current_app.logger.error(f"Error updating announcement: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to update announcement: {str(e)}'}), 500

@admin_bp.route('/api/announcements/delete/<int:ann_id>', methods=['DELETE'])
@login_required(role='admin')
def delete_announcement_api(ann_id):
    try:
        with Database() as db:
            db.execute_query("DELETE FROM announcements WHERE id = %s", (ann_id,))
        return jsonify({'success': True, 'message': 'Announcement deleted successfully'})
    except Exception as e:
        current_app.logger.error(f"Error deleting announcement: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to delete announcement'}), 500

# --- Class Routine API Endpoints ---

@admin_bp.route('/api/routines/add', methods=['POST'])
@login_required(role='admin')
def add_routine_api():
    data = request.get_json()
    semester = data.get('semester')
    course_id = data.get('course_id')
    subject_name = data.get('subject_name')
    day_of_week = data.get('day_of_week')
    course_time = data.get('course_time') # Expected format HH:MM or HH:MM:SS

    if not all([semester, course_id, subject_name, day_of_week, course_time]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400
    
    try:
        # Validate time format (optional, but good for robustness if direct input)
        datetime.strptime(course_time, '%H:%M') # Will raise ValueError if not matching
    except ValueError:
        try:
            datetime.strptime(course_time, '%H:%M:%S')
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid time format. Use HH:MM or HH:MM:SS'}), 400

    try:
        with Database() as db:
            # Check for duplicate entry (semester, day_of_week, course_time)
            # The UNIQUE KEY in the DB will also prevent this, but a soft check is good.
            existing_routine = db.fetch_one(
                "SELECT id FROM class_routine WHERE semester = %s AND day_of_week = %s AND course_time = %s",
                (semester, day_of_week, course_time)
            )
            if existing_routine:
                return jsonify({'success': False, 'message': 'A routine entry already exists for this semester, day, and time.'}), 409 # 409 Conflict

            query = """
                INSERT INTO class_routine (semester, course_id, subject_name, day_of_week, course_time)
                VALUES (%s, %s, %s, %s, %s)
            """
            db.execute_query(query, (semester, course_id, subject_name, day_of_week, course_time))
        return jsonify({'success': True, 'message': 'Routine entry added successfully'}), 201
    except mysql.connector.Error as err:
        if err.errno == 1062: # Duplicate entry error code
             return jsonify({'success': False, 'message': 'A routine entry already exists for this semester, day, and time (DB constraint).'}), 409
        current_app.logger.error(f"Database error adding routine: {err}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to add routine: {str(err)}'}), 500
    except Exception as e:
        current_app.logger.error(f"Error adding routine: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to add routine: {str(e)}'}), 500

@admin_bp.route('/api/routines/<int:semester>', methods=['GET'])
@login_required(role='admin') # Or allow students too if they need to see full semester routines
def get_routines_by_semester_api(semester):
    try:
        with Database() as db:
            routines = db.fetch_all(
                "SELECT id, course_id, subject_name, day_of_week, course_time FROM class_routine WHERE semester = %s ORDER BY day_of_week, course_time", 
                (semester,)
            )
            for routine in routines:
                if isinstance(routine.get('course_time'), timedelta):
                    total_seconds = int(routine['course_time'].total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    routine['course_time'] = f"{hours:02}:{minutes:02}" # Format as HH:MM for display
            return jsonify({'success': True, 'routines': routines})
    except Exception as e:
        current_app.logger.error(f"Error fetching routines for semester {semester}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to fetch routines'}), 500

@admin_bp.route('/api/routines/update/<int:routine_id>', methods=['POST'])
@login_required(role='admin')
def update_routine_api(routine_id):
    data = request.get_json()
    semester = data.get('semester')
    course_id = data.get('course_id')
    subject_name = data.get('subject_name')
    day_of_week = data.get('day_of_week')
    course_time = data.get('course_time')

    if not all([semester, course_id, subject_name, day_of_week, course_time]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400

    try:
        datetime.strptime(course_time, '%H:%M') 
    except ValueError:
        try:
            datetime.strptime(course_time, '%H:%M:%S')
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid time format. Use HH:MM or HH:MM:SS'}), 400

    try:
        with Database() as db:
            # Check for duplicate entry, excluding the current routine_id
            existing_routine = db.fetch_one(
                "SELECT id FROM class_routine WHERE semester = %s AND day_of_week = %s AND course_time = %s AND id != %s",
                (semester, day_of_week, course_time, routine_id)
            )
            if existing_routine:
                return jsonify({'success': False, 'message': 'Another routine entry already exists for this semester, day, and time.'}), 409

            query = """
                UPDATE class_routine 
                SET semester = %s, course_id = %s, subject_name = %s, day_of_week = %s, course_time = %s
                WHERE id = %s
            """
            db.execute_query(query, (semester, course_id, subject_name, day_of_week, course_time, routine_id))
        return jsonify({'success': True, 'message': 'Routine entry updated successfully'})
    except mysql.connector.Error as err:
        if err.errno == 1062:
            return jsonify({'success': False, 'message': 'Another routine entry already exists for this semester, day, and time (DB constraint).'}), 409
        current_app.logger.error(f"Database error updating routine: {err}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to update routine: {str(err)}'}), 500
    except Exception as e:
        current_app.logger.error(f"Error updating routine: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to update routine: {str(e)}'}), 500

@admin_bp.route('/api/routines/delete/<int:routine_id>', methods=['DELETE'])
@login_required(role='admin')
def delete_routine_api(routine_id):
    try:
        with Database() as db:
            db.execute_query("DELETE FROM class_routine WHERE id = %s", (routine_id,))
        return jsonify({'success': True, 'message': 'Routine entry deleted successfully'})
    except Exception as e:
        current_app.logger.error(f"Error deleting routine: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to delete routine'}), 500

@admin_bp.route('/api/all-attendance-data', methods=['GET'])
@login_required(role='admin')
def get_all_attendance_data():
    try:
        selected_semester = request.args.get('semester')
        query_params = []
        
        base_query = """
            SELECT attendance_id, stu_id, student_name, student_semester, 
                   class_date, subject, class, status, remarks
            FROM attendances
        """
        
        where_clauses = []
        
        if selected_semester and selected_semester.isdigit(): # Ensure semester is a digit
            where_clauses.append("student_semester = %s")
            query_params.append(selected_semester)
        
        if where_clauses:
            base_query += " WHERE " + " AND ".join(where_clauses)
            
        base_query += " ORDER BY class_date DESC"

        with Database() as db:
            all_attendance = db.fetch_all(base_query, tuple(query_params))
            
            # Convert datetime objects to ISO format string for JSON serialization
            for record in all_attendance:
                if isinstance(record.get('class_date'), datetime):
                    record['class_date'] = record['class_date'].isoformat()
            
            # Using current_app.logger for consistency if available
            try:
                current_app.logger.debug(f"Fetched {len(all_attendance)} attendance records. Semester filter: '{selected_semester}'")
            except AttributeError:
                 print(f"Fetched {len(all_attendance)} attendance records. Semester filter: '{selected_semester}'")

            return jsonify({'success': True, 'history': all_attendance})
            
    except Exception as e:
        try:
            current_app.logger.error(f"Error fetching all attendance data for admin: {str(e)}", exc_info=True)
        except AttributeError:
            print(f"Error fetching all attendance data for admin: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to fetch attendance data.'}), 500

# Make sure to add `admin_bp` to your main app if it's not already.
# e.g., from Admin.routes import admin_bp
# app.register_blueprint(admin_bp, url_prefix='/Admin')
# Ensure necessary imports like `mysql` and `login_required` are correctly set up in this file's context.
