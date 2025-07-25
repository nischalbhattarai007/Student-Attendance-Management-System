from flask import session, redirect, url_for
from functools import wraps

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
