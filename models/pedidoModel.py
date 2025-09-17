from datetime import datetime
from config.db import db

class Order(db.Model):
    __tablename__ = "orders"

    id_pedido  = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id_user"), nullable=False)
    total      = db.Column(db.Float, nullable=False, default=0.0)
    status     = db.Column(db.String(30), nullable=False, default="andamento")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id_pedido,
            "total": self.total,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "items": [i.to_dict() for i in self.items],
        }

class OrderItem(db.Model):
    __tablename__ = "order_items"

    id_item   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id  = db.Column(db.Integer, db.ForeignKey("orders.id_pedido"), nullable=False)
    produto_id= db.Column(db.Integer, db.ForeignKey("produtos.id_produto"), nullable=True)

    produto_nome  = db.Column(db.String(120), nullable=False)  # snapshot
    qtd           = db.Column(db.Integer, nullable=False, default=1)
    preco_unit    = db.Column(db.Float, nullable=False, default=0.0)

    order   = db.relationship("Order", back_populates="items")
    produto = db.relationship("produto", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id_item,
            "produto_id": self.produto_id,
            "produto_nome": self.produto_nome,
            "qtd": self.qtd,
            "preco_unit": self.preco_unit,
        }
