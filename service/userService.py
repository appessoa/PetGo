from typing import Optional

from flask import jsonify
from models.userModel import User
from config.db import db
from flask_bcrypt import Bcrypt
from service.Helpers import api_error
from sqlalchemy.exc import SQLAlchemyError
bcrypt = Bcrypt()


def get_user_by_id(user_id):
    return User.query.get(user_id)

def get_all_users():
    return User.query.all(deleted=0)

def create_user(username, email, password):

    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    new_user = User(username=username, email=email, password=hashed)
    db.session.add(new_user)
    db.session.commit()
    return new_user

def check_password(user, password):
    return bcrypt.check_password_hash(user.password, password)

def get_user_by_email(email):
    return User.query.filter_by(email=email,deleted=0).first()

def get_user_by_username(username):
    return User.query.filter_by(username=username, deleted=0).first()

def authenticate_user(username, password):
    user = User.query.filter_by(username=username,deleted=0).first()
    if user and user.password == password:
        return user
    return None

def change_password(user_id, new_password):
    user = User.query.get(user_id)
    if not user:
        return None
    user.password = new_password
    db.session.commit()
    return user

def get_active_users():
    return User.query.filter_by(is_active=True).all()

def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    user.deleted = user_id  # marca como deletado
    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        return api_error(500, "Falha ao deletar usuário", exc=e)
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro inesperado ao deletar usuário", exc=e)
    return jsonify({'message': "Usuario excluido com sucesso!"})

def _fmt_address_from_dict(address: dict | None) -> str | None:
    """
    Monta uma linha única de endereço a partir do dict retornado por address.to_dict().
    Não assume chaves fixas: tenta campos comuns e, se faltar, concatena todos os valores não-vazios.
    """
    if not isinstance(address, dict):
        return None

    prefer = (
        "logradouro", "rua", "endereco", "street",
        "numero", "number",
        "complemento", "complement",
        "bairro", "district",
        "cidade", "city",
        "estado", "state", "uf",
        "cep", "zip"
    )

    parts = []
    for key in prefer:
        v = address.get(key)
        if v:
            parts.append(str(v))

    # Se não encontrou nada “preferido”, junta todos os valores não-vazios
    if not parts:
        parts = [str(v) for v in address.values() if v]

    return ", ".join(parts) if parts else None

def try_vet_by_username(username: str) -> Optional[User]:
    """
    Tenta carregar um veterinário pelo username e retorna como User (se existir).
    Retorna None se não encontrar ou se estiver marcado como deletado (soft delete).
    """
    from models.veterinarioModel import veterinarianModel

    vet = veterinarianModel.query.filter_by(username=username, deleted=False).first()
    if not vet:
        return None

    # Converte veterinarianModel para User
    user_equiv = User(
        id_user=vet.id_veterinarian,
        username=vet.username,
        nome=vet.name,
        email=vet.email,
        password=vet.password,
        is_active=vet.status,
        is_admin=False,  # veterinários não são admins por padrão
        deleted=False
    )
    return user_equiv

def get_user_public_info(user_id: int) -> Optional[dict]:
    """
    Carrega o usuário pelo ID e retorna um dicionário 'seguro' para uso no PDF/JSON.
    Campos expostos: id, username, nome, email, cpf, phone (numero), address_line, is_active, is_admin, address (dict).
    Retorna None se não encontrar o usuário ou se estiver marcado como deletado (soft delete).
    """
    if not user_id:
        return None

    user: User = db.session.get(User, user_id)
    if not user or getattr(user, "deleted", False):
        return None

    # Tenta obter o endereço principal como dict (se existir)
    address_dict = None
    try:
        address_dict = user.primary_address.to_dict() if user.primary_address else None
    except Exception:
        address_dict = None

    return {
        "id": user.id_user,
        "username": user.username,
        "nome": user.nome,
        "email": user.email,
        "cpf": user.cpf,           
        "phone": user.numero,      
        "address_line": _fmt_address_from_dict(address_dict),
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "address": address_dict,  
    }