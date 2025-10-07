from flask import Flask, g, session
from flask_cors import CORS
from app.seeds import seed_db
from config.db import db
from config import config
from app.erros import register_error_handlers
from routes.routes_front import produtos

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
    
    @app.before_request
    def load_user_from_session():
        g.user_id = session.get("user_id")  # None se não logado

    register_error_handlers(app)

    from routes.routes_front import front_bp
    from routes.auth import auth_bp
    from routes.pets import pets_api
    from routes.user import user_api
    from routes.agendamento import sched_api
    from routes.endereco import addr_api
    from routes.formularioAdocao import adocao_api
    from routes.veterinarios import vet_bp
    from routes.carrinho import cart_bp
    from routes.produtos import produtos_bp
    
    app.register_blueprint(user_api)
    app.register_blueprint(auth_bp)
    app.register_blueprint(front_bp)
    app.register_blueprint(pets_api)
    app.register_blueprint(sched_api)
    app.register_blueprint(addr_api)
    app.register_blueprint(adocao_api)
    app.register_blueprint(vet_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(produtos_bp)

    with app.app_context():
        import models
        db.create_all()

        if config.SEED_ON_STARTUP == True:
            seed_db(config)



    return app
