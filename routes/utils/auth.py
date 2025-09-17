from functools import wraps
from flask import g, session
from werkzeug.exceptions import Unauthorized


def current_user_id() -> int:
    uid = session.get("user_id") or getattr(g, "user_id", None)
    if not uid:
        raise Unauthorized("Faça login.")
    return uid

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        _ = current_user_id()  # levanta Unauthorized se não estiver logado
        return f(*args, **kwargs)
    return wrapper
