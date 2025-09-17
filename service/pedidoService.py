# services/ordersService.py
from typing import List, Dict, Any, Optional
from config.db import db
from models.pedidoModel import Order, OrderItem
from models.produtoModel import produto
from sqlalchemy.exc import SQLAlchemyError
from flask import current_app

class ValidationError(ValueError):
    def __init__(self, message, field: Optional[str] = None):
        super().__init__(message)
        self.field = field

def list_orders(user_id: int) -> List[Order]:
    return Order.query.filter_by(user_id=user_id).order_by(Order.id_pedido.desc()).all()

def get_order(user_id: int, order_id: int) -> Order:
    o = Order.query.get_or_404(order_id)
    if o.user_id != user_id:
        raise ValidationError("Pedido não pertence ao usuário.", field="order_id")
    return o

def create_order(user_id: int, items: List[Dict[str, Any]]) -> Order:
    """
    items: [{ "produto_id": int, "qtd": int }]
    - valida estoque
    - debita estoque
    - grava snapshot (nome e preco no momento)
    """
    if not items:
        raise ValidationError("Nenhum item informado.", field="items")

    order = Order(user_id=user_id, total=0.0, status="andamento")
    total = 0.0

    try:
        for it in items:
            pid = it.get("produto_id")
            qtd = int(it.get("qtd", 1))
            if not pid or qtd <= 0:
                raise ValidationError("Item inválido (produto_id/qtd).", field="items")

            prod = produto.query.get_or_404(pid)

            if not prod.is_active:
                raise ValidationError(f"Produto inativo: {prod.nome}", field="produto_id")

            if prod.estoque < qtd:
                raise ValidationError(f"Estoque insuficiente para {prod.nome}", field="estoque")

            # debita estoque
            prod.estoque -= qtd

            item = OrderItem(
                produto_id=prod.id_produto,
                produto_nome=prod.nome,
                qtd=qtd,
                preco_unit=prod.preco
            )
            total += prod.preco * qtd
            order.items.append(item)

        order.total = total
        db.session.add(order)
        db.session.commit()
        return order

    except ValidationError:
        db.session.rollback()
        raise
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao criar pedido")
        raise RuntimeError("Erro de banco ao criar pedido.") from e

def cancel_order(user_id: int, order_id: int) -> Order:
    """
    Cancela pedido (se possível) e devolve estoque.
    Regra simples: só permite cancelar se status == 'andamento'.
    """
    o = get_order(user_id, order_id)
    if o.status != "andamento":
        raise ValidationError("Somente pedidos em andamento podem ser cancelados.", field="status")

    try:
        # devolve estoque
        for it in o.items:
            prod = produto.query.get(it.produto_id)
            if prod:
                prod.estoque += it.qtd
        o.status = "cancelado"
        db.session.commit()
        return o
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao cancelar pedido")
        raise RuntimeError("Erro de banco ao cancelar pedido.") from e
