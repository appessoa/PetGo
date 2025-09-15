# app.py
from flask import Flask
from config.db import db
from flask_cors import CORS
from config import config
def create_app():
    app = Flask(__name__, template_folder= config.TEMPLATE_FOLDER, static_folder=config.STATIC_FOLDER)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///petgo.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    from models.userModel import User 

    with app.app_context():
        db.create_all()

    return app
