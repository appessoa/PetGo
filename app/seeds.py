# seeds.py
from config.db import db
from models.produtoModel import produto
from models.userModel import User
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()

def get_or_create(model, defaults=None, **filters):
    """Idempotente: busca por filtros; se não existir, cria com defaults."""
    instance = model.query.filter_by(**filters).first()
    if instance:
        return instance, False
    params = {**filters, **(defaults or {})}
    instance = model(**params)
    db.session.add(instance)
    return instance, True

def seed_db(config):

    # Produtos (apenas se não existem)
    get_or_create(produto, 
                  nome="Ração Premium 10kg",
                  descricao="Ração seca premium",
                  preco=1299,
                  estoque=12,
                  categoria="Rações",
                  imagem_bloob=None)

    get_or_create(produto, 
                  nome="Bolinha Mordedora",
                  descricao="Brinquedo de borracha resistente",
                  preco=2990,
                  estoque=50,
                  categoria="Brinquedos",
                  imagem_bloob=None)

    get_or_create(produto, 
                  nome="Coleira Ajustável",
                  descricao="Coleira nylon com ajuste",
                  preco=4590,
                  estoque=30,
                  categoria="Acessórios",
                  imagem_bloob=None)

    # Admin (apenas se não existe)
    admin = User.query.filter_by(email=config.ADMIN_EMAIL).first()
    if not admin:
        hashed = bcrypt.generate_password_hash(config.ADMIN_PASS).decode("utf-8")
        admin = User(username=config.ADMIN_USER, email=config.ADMIN_EMAIL, password=hashed, nome=config.NAME, endereco=config.Endereco,
                     numero= config.Telefone, cpf= config.CPF, is_active=True)
        db.session.add(admin)

    db.session.commit()
