from flask import Flask
from flask_cors import CORS
from app.seeds import seed_db
from config.db import db
from config import config

def create_app():
    app = Flask(
        __name__,
        template_folder=config.TEMPLATE_FOLDER,  # agora ABSOLUTO p/ ...\PetGo\views
        static_folder=config.STATIC_FOLDER       # ABSOLUTO p/ ...\PetGo\public (ou app\public se preferir)
    )
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = config.SQLALCHEMY_TRACK_MODIFICATIONS
    db.init_app(app)
    
    app.config["SECRET_KEY"] = config.SECRET_KEY

    from routes.routes_front import front_bp
    from routes.auth import auth_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(front_bp)


    from models.userModel import User
    from models.produtoModel import produto

    with app.app_context():
        db.create_all()

        if config.SEED_ON_STARTUP:
            seed_db(config)

    return app
