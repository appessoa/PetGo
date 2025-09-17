from flask import jsonify, request, session
from service.petsService import create_pet, update_pet, delete_pet, list_pets

class PetsController:

    @staticmethod
    def get_pets():
        owner_id = session.get("user_id")
        pets = list_pets(owner_id)
        return jsonify([p.to_dict() for p in pets]), 200

    @staticmethod
    def create():
        data = request.get_json()
        owner_id = session.get("user_id")
        try:
            pet = create_pet(owner_id, data)
            return jsonify(pet.to_dict()), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @staticmethod
    def update(pet_id):
        data = request.get_json()
        try:
            pet = update_pet(pet_id, data)
            return jsonify(pet.to_dict()), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @staticmethod
    def delete(pet_id):
        try:
            delete_pet(pet_id)
            return jsonify({"message": "Pet deletado com sucesso"}), 204
        except Exception as e:
            return jsonify({"error": str(e)}), 400

