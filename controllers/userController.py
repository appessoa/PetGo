# controller/usersController.py
import re
from flask import request, jsonify, session, current_app
from config.db import db
from models.userModel import User
from models.petsModel import Pet
from models.pedidoModel import Order
from service.Helpers import api_error
from sqlalchemy import or_
from flask_bcrypt import Bcrypt

from sqlalchemy.exc import SQLAlchemyError, IntegrityError

bcrypt = Bcrypt()
# tentamos reaproveitar uma instância de Bcrypt do app; se não houver, criamos on the fly
def _get_bcrypt():
    ext = getattr(current_app, "extensions", {}) or {}
    bc = ext.get("bcrypt")
    if bc:
        return bc
    bc = Bcrypt(current_app)
    return bc

def _s(v):  # string safe trim
    return (v or "").strip()

def _require_login():
    uid = session.get("user_id")
    if not uid:
        return None, api_error(401, "Não autenticado")
    return uid, None

def _user_to_dict(u: User):
    return {
        "id": u.id_user,
        "username": u.username,
        "email": u.email,
        "cpf": getattr(u, "cpf", None),
        "nome": getattr(u, "nome", None),
        "numero": getattr(u, "numero", None),
        "endereco": getattr(u, "endereco", None),
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
    }

class UsersController:

    @staticmethod
    def me():
        uid, err = _require_login()
        if err: return err
        u = User.query.get_or_404(uid)
        return jsonify(_user_to_dict(u)), 200

    @staticmethod
    def update_me():
        uid, err = _require_login()
        if err: return err
        data = request.get_json(silent=True) or {}
        u = User.query.get_or_404(uid)

        # campos permitidos (adicione os que existem no seu model)
        allowed = ("username", "email", "cpf", "nome", "numero", "endereco")
        for field in allowed:
            if field in data and data[field] is not None:
                setattr(u, field, _s(data[field]))

        # exemplo de checagem de unicidade para email/username (opcional)
        if "email" in data and data["email"]:
            q = User.query.filter(User.email == u.email, User.id_user != u.id_user).first()
            if q:
                return api_error(400, "Email já está em uso.", details={"field": "email"})
        if "username" in data and data["username"]:
            q = User.query.filter(User.username == u.username, User.id_user != u.id_user).first()
            if q:
                return api_error(400, "Username já está em uso.", details={"field": "username"})

        try:
            db.session.commit()
            return jsonify(_user_to_dict(u)), 200
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.exception("Violação de integridade ao atualizar user")
            return api_error(400, "Violação de integridade ao atualizar perfil", exc=e)
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.exception("Falha de banco ao atualizar user")
            return api_error(500, "Falha ao atualizar perfil", exc=e)

    @staticmethod
    def change_password():
        uid, err = _require_login()
        if err: return err
        data = request.get_json(silent=True) or {}
        old_pw = _s(data.get("old_password"))
        new_pw = _s(data.get("new_password"))

        if len(new_pw) < 6:
            return api_error(400, "A nova senha deve ter pelo menos 6 caracteres.", details={"field": "new_password"})

        u = User.query.get_or_404(uid)
        bcrypt = _get_bcrypt()

        if not bcrypt.check_password_hash(u.password, old_pw):
            return api_error(400, "Senha atual incorreta.", details={"field": "old_password"})

        try:
            u.password = bcrypt.generate_password_hash(new_pw).decode("utf-8")
            db.session.commit()
            return jsonify({"message": "Senha alterada com sucesso"}), 200
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.exception("Falha ao alterar senha")
            return api_error(500, "Falha ao alterar senha", exc=e)

    @staticmethod
    def my_pets():
        uid, err = _require_login()
        if err: return err
        pets = Pet.query.filter_by(dono=uid, adotado=True, deleted=0).order_by(Pet.id_pet.desc()).all()

        def ser(p: Pet):
            if hasattr(p, "to_dict"):
                # sem filhos aqui pra ficar leve na página da conta
                d = p.to_dict(with_children=False)
                # se quiser mandar idade calculada no server também:
                # d["idade_str"] = getattr(p, "idade_str", None)
                return d
            return {
                "id": p.id_pet,
                "name": getattr(p, "name", None) or p.nome,
                "breed": getattr(p, "breed", None) or p.raca,
                "dob": getattr(p, "dob", None).isoformat() if getattr(p, "dob", None) else None,
                "weight": getattr(p, "weight", None) or p.peso,
                "species": getattr(p, "species", None) or getattr(p, "especies", None),
                "photo": getattr(p, "photo", None),
            }

        return jsonify([ser(p) for p in pets]), 200

    @staticmethod
    def my_orders():
        uid, err = _require_login()
        if err: return err
        orders = Order.query.filter_by(user_id=uid).order_by(Order.id_pedido.desc()).all()

        def ser(o: Order):
            if hasattr(o, "to_dict"):
                return o.to_dict()
            # fallback simples (ajuste aos seus campos reais)
            return {
                "id": getattr(o, "id_pedido", None) or getattr(o, "id", None),
                "status": getattr(o, "status", None),
                "total": getattr(o, "total", None),
                "created_at": o.created_at.isoformat() if getattr(o, "created_at", None) else None,
                "updated_at": o.updated_at.isoformat() if getattr(o, "updated_at", None) else None,
                "items": [i.to_dict() for i in getattr(o, "items", [])] if hasattr(o, "items") else [],
            }

        return jsonify([ser(o) for o in orders]), 200

    @staticmethod
    def create_user():
        _email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

        data = request.get_json(silent=True) or {}

        username = _s(data.get("username"))
        email    = _s(data.get("email"))
        nome     = _s(data.get("name"))
        cpf      = _s(data.get("cpf"))
        celular  = _s(data.get("phone"))
        senha    = data.get("password")
        conf     = data.get("confirm_password")

        required = {
        "username": username,
        "email": email,
        "name": nome,
        "cpf": cpf,
        "phone": celular,
        "password": senha,
        "confirm_password": conf,
        }

        missing = [k for k, v in required.items() if not v]
        problems = {}
        if missing:
            return api_error(400, f"Campos obrigatórios ausentes.{missing}", {"required": missing})

        if not _email_re.match(email):
            problems["email"] = "E-mail inválido."

        if len(senha)< 6:
            problems["password"]= "Senha deve contar ao menos 6 caracteres"

        if senha != conf:
            problems["confirm_password"] = "As senhas não coincidem."
        
        if problems:
            return api_error(400, "Falha de validação.", problems)
        
        # 4) unicidade (username, email, cpf)
        already = (User.query
                .filter(or_(User.username == username,
                            User.email == email,))
                .first())
        if already:
            dup = []
            if already.username == username: dup.append("username")
            if already.email == email: dup.append("email")
            return api_error(409, f"Dados já cadastrados.{dup}", {"conflicts": dup})
        
        try:
            user = User(username=username, email=email.lower(),
                        nome=nome, numero = celular,cpf=cpf,password = bcrypt.generate_password_hash(senha).decode("utf-8"))
            
            db.session.add(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(e)
            return api_error(500, "Erro ao criar usuário.", {"exception": str(e)})
        
        session["user_id"] = user.id_user
        session["username"] = user.username
        return jsonify({
                "id": user.id_user,
                "username": user.username,
                "email": user.email,
                "name": user.nome,
            }), 201