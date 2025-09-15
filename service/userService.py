from models.userModel import User
from config.db import db
from flask_bcrypt import Bcrypt
bcrypt = Bcrypt()


def get_user_by_id(user_id):
    return User.query.get(user_id)

def get_all_users():
    return User.query.all()

def create_user(username, email, password):

    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    new_user = User(username=username, email=email, password=hashed)
    db.session.add(new_user)
    db.session.commit()
    return new_user

def check_password(user, password):
    return bcrypt.check_password_hash(user.password, password)

def get_user_by_email(email):
    return User.query.filter_by(email=email).first()

def get_user_by_username(username):
    return User.query.filter_by(username=username).first()

def authenticate_user(username, password):
    user = User.query.filter_by(username=username).first()
    if user and user.password == password:
        return user
    return None

def change_password(user_id, new_password):
    user = User.query.get(user_id)
    if not user:
        return None
    user.password = new_password
    db.session.commit()
    return user

def get_active_users():
    return User.query.filter_by(is_active=True).all()
