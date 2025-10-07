
from flask import jsonify
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from config.db import db
from models.cartModel import Cart, CartItem
from models.produtoModel import produto
from app.enums.cartEnum import CartStatus
from app.enums.modos import modos

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


def add_or_set_item(uid: int, id_produto: int, quantidade: int, *, modo: str = modos.SETAR.value) -> CartItem:
    if quantidade <= 0:
        raise ValueError("Quantidade deve ser maior que 0")

    cart = get_or_create_my_cart(uid)

    # busca produto
    prod: produto = db.session.get(produto, id_produto)
    if not prod or not getattr(prod, "is_active", True):
        raise ValueError("Produto indisponível")

    # pegue o preço do campo correto do seu modelo
    preco_unit = float(prod.preco)

    # procura item existente
    item = (
        db.session.execute(
            select(CartItem)
            .where(CartItem.id_cart == cart.id_cart, CartItem.id_produto == id_produto)
            .limit(1)
        ).scalars().first()
    )

    if item:
        nova_qtd = item.quantidade + quantidade if modo == modos.INCLUIR.value else quantidade
        item.quantidade = nova_qtd
        item.preco_unitario = preco_unit
    else:
        item = CartItem(
            id_cart=cart.id_cart,
            id_produto=id_produto,
            quantidade=quantidade,
            preco_unitario=preco_unit
        )
        db.session.add(item)

    db.session.commit()
    return item

def get_cart(uid):
     

    cart = (Cart.query
        .options(selectinload(Cart.items))
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