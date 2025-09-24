from flask import Blueprint, session
from controllers.authController import authController
from config.decorators import login_required
auth_bp = Blueprint("auth", __name__)


auth_bp.get("/login")(authController.login_form)

auth_bp.post("/login")(authController.login)

auth_bp.get("/me")(login_required(authController.me))

auth_bp.get("/logout")(authController.logout)