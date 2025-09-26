
from flask import request
from service.veterinarioService import (
    get_all_veterinarios,
    created_veterinario,
    get_veterinario_by_id,
    update_veterinario,
    delete_veterinario
)
class veterinarioController:

    @staticmethod
    def get_all_veterinarios():
        data = get_all_veterinarios()
        return {"veterinarios": data}, 200

    @staticmethod
    def create_veterinario():
        data = request.get_json()
        nome = data.get('name')
        email= data.get('email')
        password = data.get('password')
        CRMV = data.get('CRMV')
        especialidade = data.get('especialidade')
        phone = data.get('phone')
        username = data.get('username')

        required = {
        "username": username,
        "email": email,
        "name": nome,
        "CRMV": CRMV,
        "phone": phone,
        "especialidade": especialidade,
        "password": password,
        }

        missing = [k for k, v in required.items() if not v]
        problems = {}
        if missing:
            problems["missing_fields"] = missing
            return {"error": f"Campos obrigatórios faltando {missing}", "details": problems}, 400
        
        try:
            new_vet = created_veterinario(data)
            return {"veterinario": new_vet}, 201
        except Exception as e:  
            return {"error": str(e)}, 400 
        

    @staticmethod
    def get_veterinario_by_id(vet_id):
        vet = get_veterinario_by_id(vet_id)
        if vet:
            return {"veterinario": vet}, 200
        return {"error": "Veterinário não encontrado"}, 404

    @staticmethod
    def update_veterinario(vet_id):
        data = request.get_json()
        vet = update_veterinario(vet_id, data)
        if vet:
            return {"veterinario": vet}, 200
        return {"error": "Veterinário não encontrado"}, 404
    @staticmethod
    def delete_veterinario(vet_id):
        success = delete_veterinario(vet_id)
        if success:
            return {"message": "Veterinário deletado com sucesso"}, 204
        return {"error": "Veterinário não encontrado"}, 404
    
    @staticmethod
    def get_veterinarios_disponiveis():
        from service.veterinarioService import get_veterinarios_disponiveis
        vets = get_veterinarios_disponiveis()
        return {"veterinarios": vets}, 200
    