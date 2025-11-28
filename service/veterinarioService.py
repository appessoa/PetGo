from datetime import date

from flask import jsonify, request
from config.db import db
from flask_bcrypt import Bcrypt

from models.agendamentoModel import Scheduling
from models.petsModel import Pet
from routes.utils.auth import current_user_id
from service.Helpers import api_error
bcrypt = Bcrypt()

def created_veterinario(data):
    from models.veterinarioModel import veterinarianModel
    new_vet = veterinarianModel(
        name=data.get('name'),
        username=data.get('username'),
        password=bcrypt.generate_password_hash(data.get('password')).decode('utf-8'),
        CRMV=data.get('CRMV'),
        especialidade=data.get('especialidade'),
        phone=data.get('phone'),
        email=data.get('email')
    )
    db.session.add(new_vet)
    db.session.commit()
    return new_vet.to_dict()

from sqlalchemy.orm import selectinload
from models.veterinarioModel import veterinarianModel


from datetime import date

def get_all_veterinarios():
    vets = (
        veterinarianModel.query
        .filter_by(deleted=False)
        .options(selectinload(veterinarianModel.schedulings))
        .all()
    )

    hoje = date.today()
    resultado = []

    for vet in vets:
        d = vet.to_dict()
        scheds = getattr(vet, "schedulings", [])

        # Filtra apenas agendamentos do dia atual ou futuros
        future_scheds = [s for s in scheds if s.date >= hoje]

        if not future_scheds:
            d.pop("schedulings", None)
            d["has_schedulings"] = False
        else:
            d["schedulings"] = [s.to_dict() for s in future_scheds]
            d["has_schedulings"] = True

        resultado.append(d)

    return resultado


def get_veterinario_by_id(vet_id):
    from models.veterinarioModel import veterinarianModel
    vet = veterinarianModel.query.get(vet_id)
    if vet and not vet.deleted:
        return vet.to_dict()
    return None

def update_veterinario(vet_id, data):
    from models.veterinarioModel import veterinarianModel
    vet = veterinarianModel.query.get(vet_id)
    if not vet or vet.deleted:
        return None
    vet.name = data.get('name', vet.name)
    vet.username = data.get('username', vet.username)
    if 'password' in data:
        vet.password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    vet.CRMV = data.get('CRMV', vet.CRMV)
    vet.especialidade = data.get('especialidade', vet.especialidade)
    vet.phone = data.get('phone', vet.phone)
    vet.email = data.get('email', vet.email)
    vet.status = data.get('status', vet.status)
    db.session.commit()
    return vet.to_dict()


def delete_veterinario(vet_id):
    from models.veterinarioModel import veterinarianModel
    vet = veterinarianModel.query.get(vet_id)
    if not vet or vet.deleted:
        return False
    vet.deleted = vet_id  # marca como deletado
    db.session.commit()
    return True


def get_veterinarios_disponiveis():
    from models.veterinarioModel import veterinarianModel
    vets = veterinarianModel.query.filter_by(status=True, deleted=False).all()
    return [vet.to_dict() for vet in vets]

def get_agendamentos_por_veterinario(vet_id):
    from models.veterinarioModel import veterinarianModel
    vet = veterinarianModel.query.get(vet_id)
    if not vet or vet.deleted:
        return []
    schedulings = getattr(vet, "schedulings", [])
    return [s.to_dict() for s in schedulings]


def get_pacientes_por_veterinario_me():
        """
        Retorna pacientes distintos atendidos pelo veterinário logado.
        Query params:
          - page (int, default 1)
          - per_page (int, default 10)
          - q (string, opcional, busca por nome do pet ou tutor)
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

            # subquery: pets vinculados a agendamentos cujo vet_id == uid
            # buscamos pets distintos via join com Scheduling e Pet
            query = db.session.query(Pet).join(Scheduling, Scheduling.pet_id == Pet.id_pet).filter(Scheduling.vet_id == uid)

            if qstr:
                # busca simples por nome do pet ou tutor (ajuste nomes dos campos conforme seu modelo)
                query = query.filter(
                    (Pet.nome.ilike(f"%{qstr}%")) | (Pet.tutor.ilike(f"%{qstr}%"))  # ajusta tutor -> campo real (ex: dono, owner)
                )

            # distinct pets (SQLAlchemy may duplicate; use group_by or distinct)
            query = query.group_by(Pet.id_pet).order_by(Pet.nome.asc())

            # paginação manual usando offset/limit (portable)
            total = query.count()
            pages = (total + per_page - 1) // per_page
            items = query.offset((page - 1) * per_page).limit(per_page).all()

            # serializa
            patients = []
            for p in items:
                patients.append({
                    "id_pet": getattr(p, "id_pet", None),
                    "nome": getattr(p, "nome", None),
                    "especie": getattr(p, "especie", None) or getattr(p, "species", None),
                    "raca": getattr(p, "raca", None) or getattr(p, "breed", None),
                    "tutor": getattr(p, "tutor", None) or getattr(p, "dono", None) or getattr(p, "owner_name", None),
                    "ultima_consulta": None  # opcional: preencher com subquery se desejar
                })

            return jsonify({
                "patients": patients,
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages
            })
        except PermissionError as e:
            return api_error(403, str(e), exc=e)
        except Exception as e:
            return api_error(500, "Erro ao listar pacientes.", exc=e)