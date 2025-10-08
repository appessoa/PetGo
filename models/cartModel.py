# models/cartModel.py
from datetime import datetime
from sqlalchemy import CheckConstraint
from config.db import db
from app.enums.cartEnum import CartStatus
from models.produtoModel import produto

class Cart(db.Model):
    __tablename__ = 'carts'

    id_cart    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('users.id_user'), nullable=False, index=True)
    status     = db.Column(db.String(50), nullable=False, default=CartStatus.ABERTO.name)
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user  = db.relationship('User', back_populates='carts', lazy='joined')
    items = db.relationship('CartItem', back_populates='cart',
                            cascade='all, delete-orphan', lazy='selectin')


class CartItem(db.Model):
    __tablename__ = 'cart_items'

    id_cart_item   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_cart        = db.Column(db.Integer, db.ForeignKey('carts.id_cart'), nullable=False, index=True)
    id_produto     = db.Column(db.Integer, nullable=False, index=True)
    quantidade     = db.Column(db.Integer, nullable=False)
    preco_unitario = db.Column(db.Float, nullable=False)
    is_active      = db.Column(db.Boolean, default=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Integer, nullable = False, default = False)

    __table_args__ = (
        CheckConstraint('quantidade > 0'),
        CheckConstraint('preco_unitario >= 0'),
    )

    cart = db.relationship('Cart', back_populates='items', lazy='joined')

    product = db.relationship('produto',
         primaryjoin='foreign(CartItem.id_produto)==remote(produto.id_produto)',
         lazy='joined')

    def to_dict(self):
        return {
            "id_cart_item": self.id_cart_item,
            "id_cart": self.id_cart,
            "id_produto": self.id_produto,
            "quantidade": self.quantidade,
            "preco_unitario": self.preco_unitario,
            "subtotal_item": round(self.quantidade * self.preco_unitario, 2),
            "is_active": self.is_active,
        }
