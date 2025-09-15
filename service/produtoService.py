from models.produtoModel import produto
from config.db import db

def get_produto_by_id(produto_id):
    return produto.query.get(produto_id)

def get_all_produtos():
    return produto.query.all()
def create_produto(nome, descricao, preco, estoque, categoria=None, imagem_bloob=None):
    new_produto = produto(
        nome=nome,
        descricao=descricao,
        preco=preco,
        estoque=estoque,
        categoria=categoria,
        imagem_bloob=imagem_bloob
    )
    db.session.add(new_produto)
    db.session.commit()
    return new_produto

def update_produto(produto_id, **kwargs):
    prod = produto.query.get(produto_id)
    if not prod:
        return None
    for key, value in kwargs.items():
        if hasattr(prod, key):
            setattr(prod, key, value)
    db.session.commit()
    return prod

def delete_produto(produto_id):
    prod = produto.query.get(produto_id)
    if not prod:
        return None
    db.session.delete(prod)
    db.session.commit()
    return prod

def get_active_produtos():
    return produto.query.filter_by(is_active=True).all()

def set_produto_active_status(produto_id, is_active):
    prod = produto.query.get(produto_id)
    if not prod:
        return None
    prod.is_active = is_active
    db.session.commit()
    return prod

def get_produtos_by_categoria(categoria):
    return produto.query.filter_by(categoria=categoria).all()

def search_produtos_by_name(name_substring):
    return produto.query.filter(produto.nome.ilike(f"%{name_substring}%")).all()

def update_produto_stock(produto_id, new_stock):
    prod = produto.query.get(produto_id)
    if not prod:
        return None
    prod.estoque = new_stock
    db.session.commit()
    return prod 

def get_produtos_below_stock(threshold):
    return produto.query.filter(produto.estoque < threshold).all()

def get_produtos_in_price_range(min_price, max_price):
    return produto.query.filter(produto.preco.between(min_price, max_price)).all()

def get_produtos_sorted_by_price(ascending=True):
    if ascending:
        return produto.query.order_by(produto.preco.asc()).all()
    else:
        return produto.query.order_by(produto.preco.desc()).all()
