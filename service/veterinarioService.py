from config.db import db
from flask_bcrypt import Bcrypt
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

def get_all_veterinarios():
    from models.veterinarioModel import veterinarianModel
    from models.agendamentoModel import Scheduling
    vets = veterinarianModel.query.filter_by(deleted=False).join(Scheduling,  Scheduling.vet_id == veterinarianModel.id_veterinarian,).all()
    return [vet.to_dict() for vet in vets]

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
    vet.deleted = vet.id_veterinarian  # marca como deletado
    db.session.commit()
    return True


def get_veterinarios_disponiveis():
    from models.veterinarioModel import veterinarianModel
    vets = veterinarianModel.query.filter_by(status=True, deleted=False).all()
    return [vet.to_dict() for vet in vets]