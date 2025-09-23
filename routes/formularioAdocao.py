# routes/adocao_api.py
from flask import Blueprint, request, session, jsonify
from service.adocaoformularioService import AdoptionService
from service.Helpers import api_error

adocao_api = Blueprint("adocao_api", __name__, url_prefix="/api")

def _current_user_id():
    uid = session.get("user_id")
    if not uid:
        raise PermissionError("Não autenticado")
    return int(uid)

@adocao_api.route("/adocoes", methods=["POST"])
def create_or_update_application():
    try:
        user_id = _current_user_id()
    except PermissionError:
        return api_error(401, "Faça login para enviar sua aplicação.")
    data = request.get_json(silent=True) or {}
    app = AdoptionService.create_or_update_for_user(user_id, data)
    # se create_or_update retornar api_error (dict flask), apenas repassa
    if isinstance(app, tuple) or isinstance(app, dict):
        return app
    return jsonify(app.to_dict()), 201

@adocao_api.route("/adocoes", methods=["GET"])
def list_my_applications():
    try:
        user_id = _current_user_id()
    except PermissionError:
        return api_error(401, "Não autenticado.")
    apps = AdoptionService.list_my(user_id)
    return jsonify([a.to_dict() for a in apps])

@adocao_api.route("/adocoes/<int:app_id>", methods=["GET"])
def get_application(app_id):
    try:
        user_id = _current_user_id()
    except PermissionError:
        return api_error(401, "Não autenticado.")
    app = AdoptionService.get_my(user_id, app_id)
    if isinstance(app, dict):
        return app
    return jsonify(app.to_dict())

@adocao_api.route("/adocoes/<int:app_id>/status", methods=["PATCH"])
def patch_application_status(app_id):
    try:
        user_id = _current_user_id()
    except PermissionError:
        return api_error(401, "Não autenticado.")
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip().lower()
    app = AdoptionService.set_status(user_id, app_id, status)
    if isinstance(app, dict):
        return app
    return jsonify(app.to_dict())
