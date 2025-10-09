from flask import jsonify, request
from models.userModel import User
from service.enderecoService import AddressService
from sqlalchemy.exc import SQLAlchemyError
    
def _validate_payload(data: dict, required: list[str]) -> list[str]:
        missing = [k for k in required if not data.get(k)]
        return missing

class addressController:

    def list_addresses(user_id):
        User.query.get_or_404(user_id)  # valida existência
        addrs = AddressService.list_by_user(user_id)
        return jsonify([a.to_dict() for a in addrs])

    def get_address(user_id, addr_id):
        addr = AddressService.get(user_id, addr_id)
        return jsonify(addr.to_dict())
    
    def create_address(user_id):
        data = request.get_json(silent=True) or {}
        # ajuste os obrigatórios conforme sua regra (aqui, logradouro/cidade/estado ou full_address)
        required = ["cidade", "estado","numero","logradouro","bairro", "estado"]
        missing = _validate_payload(data, required)
        if missing:
            return jsonify({"error":"Campos obrigatórios ausentes", "missing": missing}), 400
        try:
            addr = AddressService.create(user_id, data)
            return jsonify(addr.to_dict()), 201
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao criar endereço","detail":str(e)}), 500
        
    def update_address(user_id, addr_id):
        data = request.get_json(silent=True) or {}
        try:
            addr = AddressService.update(user_id, addr_id, data)
            return jsonify(addr.to_dict())
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao atualizar endereço","detail":str(e)}), 500
        

    def delete_address(user_id, addr_id):
        try:
            AddressService.delete(user_id, addr_id)
            return jsonify({"ok": True})
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao remover endereço","detail":str(e)}), 500

    def set_primary_address(user_id, addr_id):
        try:
            addr = AddressService.set_primary(user_id, addr_id)
            return jsonify(addr.to_dict())
        except SQLAlchemyError as e:
            return jsonify({"error":"Falha ao definir endereço principal","detail":str(e)}), 500