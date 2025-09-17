from flask import Blueprint
from controllers.authController import authController

auth_bp = Blueprint("auth", __name__)

auth_bp.get("/login")(authController.login_form)

auth_bp.post("/login")(authController.login)

auth_bp.get("/me")(authController.me)

auth_bp.get("/logout")(authController.logout)