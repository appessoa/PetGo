
from flask import jsonify, request, session
from sqlalchemy import func
from config.db import db
from models.agendamentoModel import Scheduling
from models.petsModel import Pet
from routes.utils.auth import current_user_id
from service.Helpers import api_error
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
    
    @staticmethod
    def get_agendamentos_por_veterinario(vet_id):
        from service.veterinarioService import get_agendamentos_por_veterinario
        agendamentos = get_agendamentos_por_veterinario(vet_id)
        return {"agendamentos": agendamentos}, 200
    
    
    @staticmethod
    def get_agendamentos_por_veterinario_me():
        from service.veterinarioService import get_agendamentos_por_veterinario
        vet_id = session.get("user_id")
        agendamentos = get_agendamentos_por_veterinario(vet_id)
        return {"agendamentos": agendamentos}, 200
    
    
    @staticmethod
    def get_pacientes_por_veterinario_me():
        """
        GET /api/vets/me/pacientes?page=1&per_page=10&q=...
        Retorna pacientes distintos vinculados a agendamentos do vet logado.
        Resposta:
        { "patients": [...], "page": n, "per_page": m, "total": T, "pages": P }
        """
        try:
            uid = current_user_id()
            try:
                page = max(1, int(request.args.get("page", 1)))
            except Exception:
                page = 1
            try:
                per_page = max(1, min(100, int(request.args.get("per_page", 10))))
            except Exception:
                per_page = 10

            qstr = (request.args.get("q") or "").strip()

            # base query: pets que aparecem em agendamentos atribuídos a este veterinário
            query = db.session.query(Pet).join(Scheduling, Scheduling.pet_id == Pet.id_pet).filter(Scheduling.vet_id == uid)

            # busca por nome do pet (simplificada)
            if qstr:
                try:
                    query = query.filter(Pet.nome.ilike(f"%{qstr}%"))
                except Exception:
                    pass

            # evitar duplicatas: agrupa por id_pet
            query = query.group_by(Pet.id_pet).order_by(Pet.nome.asc())

            # paginação e contagem
            total = query.count()
            pages = (total + per_page - 1) // per_page if total > 0 else 1
            items = query.offset((page - 1) * per_page).limit(per_page).all()

            # buscar ultima consulta por pet (em lote) para evitar N+1
            pet_ids = [p.id_pet for p in items] if items else []
            last_dates = {}
            if pet_ids:
                rows = db.session.query(Scheduling.pet_id, func.max(Scheduling.date)).filter(
                    Scheduling.pet_id.in_(pet_ids),
                    Scheduling.vet_id == uid
                ).group_by(Scheduling.pet_id).all()
                # rows: list of (pet_id, last_date)
                # formata para dd/mm/aaaa
                last_dates = {}
                for pid, d in rows:
                    if d:
                        try:
                            last_dates[pid] = d.strftime("%d/%m/%Y")
                        except Exception:
                            # fallback se não for datetime.date
                            last_dates[pid] = str(d)
                    else:
                        last_dates[pid] = None

            # serializa
            patients = []
            for p in items:
                owner = getattr(p, "owner", None)  # relação User (lazy joined no model)
                tutor_name = None
                if owner:
                    tutor_name = getattr(owner, "nome", None) or getattr(owner, "name", None)
                if not tutor_name:
                    tutor_name = getattr(p, "dono", None)

                patients.append({
                    "id_pet": getattr(p, "id_pet", None),
                    "nome": getattr(p, "nome", None) or getattr(p, "name", None),
                    "especie": getattr(p, "species", None) or getattr(p, "especie", None),
                    "raca": getattr(p, "raca", None) or getattr(p, "breed", None),
                    "tutor": tutor_name,
                    "ultima_consulta": last_dates.get(p.id_pet)  # formato "dd/mm/aaaa" ou None
                })

            return jsonify({
                "patients": patients,
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages
            }), 200

        except PermissionError as e:
            return api_error(403, str(e), exc=e)
        except Exception as e:
            return api_error(500, "Erro ao listar pacientes.", exc=e)
