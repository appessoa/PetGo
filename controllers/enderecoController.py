from flask import jsonify, request, session
from models.userModel import User
from service.enderecoService import AddressService
from sqlalchemy.exc import SQLAlchemyError
    
def _validate_payload(data: dict, required: list[str]) -> list[str]:
        missing = [k for k in required if not data.get(k)]
        return missing
def _require_user():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Unauthorized"}), 401)
    return uid, None
class addressController:

    def list_addresses():
        uid, err = _require_user()
        User.query.get_or_404(uid)  # valida existência
        addrs = AddressService.list_by_user(uid)
        return jsonify([a.to_dict() for a in addrs])

    def get_address(addr_id):
        uid, err = _require_user()
        addr = AddressService.get(uid, addr_id)
        return jsonify(addr.to_dict())
    
    def create_address():
        uid, err = _require_user()

        data = request.get_json(silent=True) or {}
        # ajuste os obrigatórios conforme sua regra (aqui, logradouro/cidade/estado ou full_address)
        required = ["cidade", "estado","numero","logradouro","bairro", "estado"]
        missing = _validate_payload(data, required)
        if missing:
            return jsonify({"error":"Campos obrigatórios ausentes", "missing": missing}), 400
        try:
            addr = AddressService.create(uid, data)
            return jsonify(addr.to_dict()), 201
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao criar endereço","detail":str(e)}), 500
        
    def update_address(addr_id):
        uid, err = _require_user()

        data = request.get_json(silent=True) or {}
        try:
            addr = AddressService.update(uid, addr_id, data)
            return jsonify(addr.to_dict())
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao atualizar endereço","detail":str(e)}), 500
        

    def delete_address(addr_id):
        try:
            uid, err = _require_user()
            AddressService.delete(uid, addr_id)
            return jsonify({"ok": True})
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao remover endereço","detail":str(e)}), 500

    def set_primary_address(addr_id):
        try:
            uid, err = _require_user()
            addr = AddressService.set_primary(uid, addr_id)
            return jsonify(addr.to_dict())
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao definir endereço principal","detail":str(e)}), 500