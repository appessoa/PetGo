from flask import jsonify
from sqlalchemy import select
from sqlalchemy.orm import selectinload, with_loader_criteria
from config.db import db
from models.cartModel import Cart, CartItem
from models.produtoModel import produto
from app.enums.cartEnum import CartStatus
from app.enums.modos import modos
from sqlalchemy.exc import SQLAlchemyError


def get_or_create_my_cart(uid : int) -> Cart:
    cart = (
        db.session.execute(
            select(Cart)
            .where(Cart.id_usuario == uid,
                    Cart.status == CartStatus.ABERTO.name,
                    Cart.is_active == True)
            .limit(1)
            ).scalars().first()
    )
    if cart:
        return cart
    cart = Cart(id_usuario=uid, status=CartStatus.ABERTO.name, is_active=True)
    db.session.add(cart)
    db.session.commit()
    return cart



def add_or_set_item(uid: int, id_produto: int, quantidade: int, *, modo: str = modos.SETAR.value) -> CartItem | None:
    if quantidade <= 0 and modo != modos.REMOVER.value:
        raise ValueError("Quantidade deve ser maior que 0")

    cart = get_or_create_my_cart(uid)

    prod: produto = db.session.get(produto, id_produto)
    if not prod or not getattr(prod, "is_active", True):
        raise ValueError("Produto indisponível")

    preco_unit = float(prod.preco)

    item = (
        db.session.execute(
            select(CartItem)
            .where(CartItem.id_cart == cart.id_cart, CartItem.id_produto == id_produto, CartItem.is_active == True, CartItem.deleted == 0)
            .limit(1)
        ).scalars().first()
    )

    if item:
        if modo == modos.INCLUIR.name:
            item.quantidade = item.quantidade + quantidade
            item.preco_unitario = preco_unit

        elif modo == modos.REMOVER.name:
            nova_qtd = item.quantidade - max(1, quantidade)
            if nova_qtd <= 0:
                deleted_produto(item.id_cart_item)
                return None
            item.quantidade = nova_qtd
            item.preco_unitario = preco_unit

        elif modo == modos.SETAR.name:  # SETAR
            item.quantidade = quantidade
            item.preco_unitario = preco_unit
    else:
        if modo == modos.REMOVER.name:
            return None
        item = CartItem(
            id_cart=cart.id_cart,
            id_produto=id_produto,
            quantidade=quantidade,
            preco_unitario=preco_unit,
        )
        db.session.add(item)

    db.session.commit()
    return item

def get_cart(uid):
     
    cart = (Cart.query
        .options(selectinload(Cart.items),
                 with_loader_criteria(CartItem, CartItem.deleted == 0)
                 )
        .filter_by(id_usuario=uid, status=CartStatus.ABERTO.name, is_active=True)
        .first())

    items = [it.to_dict() for it in (cart.items if cart else [])]
    subtotal = round(sum(i["subtotal_item"] for i in items), 2)

    return jsonify({
        "id_cart": cart.id_cart if cart else None,
        "status": cart.status if cart else CartStatus.ABERTO.name,
        "items": items,
        "subtotal": subtotal
    })

def deleted_produto(id_cart_item:int)-> produto:
    item = CartItem.query.get_or_404(id_cart_item)

    item.deleted = item.id_cart_item  # marca como deletado
    item.is_active = False

    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        raise RuntimeError("Falha ao deletar usuário") from e
    except Exception as e:
        db.session.rollback()
        raise RuntimeError("Erro inesperado ao deletar produto") from e
    return True
