from datetime import datetime
from config.db import db
class produto(db.Model):
    """ Modelo para tabela de produtos
    
    id_produto: int - PK
    nome: str - Nome do produto
    descricao: str - Descrição do produto
    preco: float - Preço do produto
    estoque: int - Quantidade em estoque
    categoria: str - Categoria do produto
    imagem_bloob: bytes - Imagem do produto em formato binário
    is_active: bool - Indica se o produto está ativo
    created_at: datetime - Timestamp de criação do registro
    updated_at: datetime - Timestamp da última atualização do registro

    """
    __tablename__ = 'produtos'

    id_produto = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(100), nullable=False)
    descricao = db.Column(db.String(255), nullable=True)
    preco = db.Column(db.Float, nullable=False)
    estoque = db.Column(db.Integer, nullable=False)
    categoria = db.Column(db.String(100), nullable=True)
    imagem_bloob = db.Column(db.LargeBinary, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
