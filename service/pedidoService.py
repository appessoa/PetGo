# service/orderService.py
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from config.db import db
# utils_pedido_payload.py
from datetime import datetime
from typing import Optional
from models.pedidoModel import Order, OrderItem        # ajuste o path se o arquivo tiver outro nome
from models.cartModel import Cart
from models.produtoModel import produto
from app.enums.cartEnum import CartStatus
from app.erros import ValidationError
from models.userModel import User

STATUS_ALIASES = {
    "processed": {"processed", "processado", "andamento"},
    "completed": {"completed", "FINALIZADO", "concluido"},
    "shipped":   {"shipped", "enviado"},
    "cancelled": {"cancelled", "cancelado"},
}
def _expand_status_filter(status_val: str):
    """Recebe 'processed' e expande para {'processed','processado','andamento'}.
       Se não estiver no mapa, usa o próprio valor."""
    if not status_val:
        return None
    key = status_val.strip().lower()
    return STATUS_ALIASES.get(key, {key})

def _parse_date_yyyy_mm_dd(s: str):
    if not s:
        return None
    try:
        # retorna datetime (início do dia)
        d = datetime.strptime(s, "%Y-%m-%d")
        return d
    except Exception:
        return None
    
def _get_open_cart(uid: int) -> Optional[Cart]:
    return (
        Cart.query
        .options(selectinload(Cart.items))
        .filter_by(id_usuario=uid, status=CartStatus.ABERTO.name, is_active=True)
        .first()
    )


def create_order_from_cart(uid: int,
                           payment_method: str = "credit_card",
                           payment_data: Optional[dict] = None) -> Order:
    """
    Converte o carrinho ABERTO do usuário em um Order + OrderItems.
    Fecha o carrinho após sucesso.
    Lança ValidationError para problemas de negócio e propaga SQLAlchemyError para o controller tratar como 500.
    """
    cart = _get_open_cart(uid)
    if not cart:
        raise ValidationError("Carrinho vazio ou inexistente.")

    # Filtra itens válidos (ativos e quantidade > 0)
    valid_items = [
        it for it in (cart.items or [])
        if getattr(it, "is_active", True) and (it.quantidade or 0) > 0
    ]
    if not valid_items:
        raise ValidationError("Carrinho sem itens válidos.")

    order = Order(user_id=uid, total=0.0, status="FINALIZADO")
    db.session.add(order)

    total = 0.0

    try:
        for it in valid_items:
            # Tenta carregar o produto para snapshot de nome
            prod: Optional[produto] = db.session.get(produto, it.id_produto)
            # respeita soft-delete de produto (deleted != 0/True)
            is_prod_ok = (
                prod is not None and
                getattr(prod, "is_active", True) and
                (getattr(prod, "deleted", 0) in (0, False, None))
            )
            nome_snap = prod.nome if is_prod_ok else f"Produto #{it.id_produto}"

            unit = float(it.preco_unitario)
            qtd  = int(it.quantidade)

            total += unit * qtd

            db.session.add(OrderItem(
                order        = order,
                produto_id   = it.id_produto,
                produto_nome = nome_snap,
                qtd          = qtd,
                preco_unit   = unit
            ))

            # controle de estoque — descomente se quiser abater:
            if is_prod_ok:
                 if prod.estoque < qtd:
                     raise ValidationError(f"Estoque insuficiente para {prod.nome}.")
                 prod.estoque -= qtd

        order.total = round(total, 2)

        # Fecha o carrinho
        cart.status = CartStatus.FECHADO.name
        cart.is_active = False

        db.session.commit()

        #reabrir um novo carrinho vazio:
        new_cart = Cart(id_usuario=uid, status=CartStatus.ABERTO.name, is_active=True)
        db.session.add(new_cart)
        db.session.commit()

        return order

    except ValidationError:
        db.session.rollback()
        raise
    except SQLAlchemyError:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        # Mapeia qualquer erro inesperado como ValidationError genérica ou deixe para o controller 500
        raise


def list_orders_by_user(uid: int) -> list[Order]:
    return (
        Order.query
        .options(selectinload(Order.items))
        .filter_by(user_id=uid)
        .order_by(Order.id_pedido.desc())
        .all()
    )


def get_order_for_user(uid: int, order_id: int, *, is_admin: bool = False) -> Order:
    order = (
        Order.query
        .options(selectinload(Order.items))
        .get_or_404(order_id)
    )
    if not is_admin and order.user_id != uid:
        raise ValidationError("Acesso negado ao pedido.")
    return order


def update_order_status(order_id: int, new_status: str,
                        acting_user_id: int, *, is_admin: bool = False) -> Order:
    """
    Regra simples:
      - Usuário (não-admin) só pode cancelar o próprio pedido quando status == 'andamento'
      - Admin pode alterar livremente (ajuste conforme necessário)
    """
    order = Order.query.get_or_404(order_id)

    new_status = (new_status or "").strip().lower()
    if not new_status:
        raise ValidationError("Campo 'status' é obrigatório.")

    if not is_admin:
        if order.user_id != acting_user_id:
            raise ValidationError("Acesso negado ao pedido.")
        if order.status != "andamento" or new_status != "cancelado":
            raise ValidationError("Operação não permitida.")

    try:
        order.status = new_status
        db.session.commit()
        return order
    except SQLAlchemyError:
        db.session.rollback()
        raise
def _parse_date_yyyy_mm_dd(s: str):
    if not s:
        return None
    try:
        # retorna datetime (início do dia)
        d = datetime.strptime(s, "%Y-%m-%d")
        return d
    except Exception:
        return None

def list_orders_admin(*, status: str = "", date_from: str = "", date_to: str = "", q: str = "",
                      page: int = 1, per_page: int = 50):
    """
    Lista pedidos para o painel admin com filtros.
    - status: aceita 'processed', 'completed', etc. (com aliases pt/en)
    - date_from / date_to: 'YYYY-MM-DD'
    - q: busca por id do pedido, nome do usuário ou email
    - paginação
    """
    status_set = _expand_status_filter(status)
    dt_from = _parse_date_yyyy_mm_dd(date_from)
    dt_to   = _parse_date_yyyy_mm_dd(date_to)
    if dt_to:
        # incluir o dia inteiro
        dt_to = dt_to + timedelta(days=1) - timedelta(seconds=1)

    # Query base com join no usuário (para poder buscar por nome/email)
    query = db.session.query(Order, User).join(User, Order.user_id == User.id_user)

    if status_set:
        query = query.filter(func.lower(Order.status).in_([s.lower() for s in status_set]))

    if dt_from:
        query = query.filter(Order.created_at >= dt_from)
    if dt_to:
        query = query.filter(Order.created_at <= dt_to)

    if q:
        q_norm = f"%{q.strip().lower()}%"
        # Se q for número, permite filtrar por id também
        conds = [
            func.lower(User.name).like(q_norm),
            func.lower(User.email).like(q_norm),
        ]
        if q.isdigit():
            conds.append(Order.id_pedido == int(q))
        query = query.filter(or_(*conds))

    # Ordena do mais recente para o mais antigo
    query = query.order_by(Order.created_at.desc())

    # Paginação
    page = max(1, int(page or 1))
    per_page = max(1, min(int(per_page or 50), 200))
    total = query.count()
    rows = query.limit(per_page).offset((page - 1) * per_page).all()

    items = []
    for order, user in rows:
        d = order.to_dict()
        # enriquece com info do usuário
        d["user_id"] = order.user_id
        d["user_name"] = getattr(user, "name", None) or getattr(user, "username", None) or getattr(user, "email", None)
        d["user_email"] = getattr(user, "email", None)
        items.append(d)

    return {
        "items": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_prev": page > 1,
            "has_next": (page * per_page) < total
        }
    }

def get_order_by_id(order_id: int) -> dict | None:
    """
    Busca um pedido por ID com itens (e produto) já carregados.
    Retorna um dict pronto p/ JSON ou None se não existir.
    """
    order: Order = (
        Order.query
        .options(
            selectinload(Order.items).joinedload(OrderItem.produto)  # carrega itens e produto
        )
        .filter_by(id_pedido=order_id)
        .first()
    )
    if not order:
        return None

    # Tenta pegar o usuário (caso Order não tenha relacionamento .user)
    user = None
    try:
        user = getattr(order, "user", None) or db.session.get(User, order.user_id)
    except Exception:
        user = None

    # Calcula total "on the fly" se vier 0 (snapshot do momento da compra)
    total = float(order.total or 0.0)
    if total <= 0:
        total = sum((it.qtd or 0) * float(it.preco_unit or 0) for it in (order.items or []))

    # Monta resposta
    data = {
        "id": order.id_pedido,
        "user_id": order.user_id,
        "user_name": getattr(user, "username", None) or getattr(user, "name", None) or None,
        "user_email": getattr(user, "email", None) or None,
        "status": order.status,
        "total": round(total, 2),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": []
    }

    for it in (order.items or []):
        produto = getattr(it, "produto", None)
        data["items"].append({
            "id": it.id_item,
            "produto_id": it.produto_id,
            "produto_nome": it.produto_nome,
            "qtd": it.qtd,
            "preco_unit": float(it.preco_unit or 0),
            "subtotal": round((it.qtd or 0) * float(it.preco_unit or 0), 2),
            # extras do produto (se existir relação)
            "produto": {
                "nome": getattr(produto, "nome", None),
                "imagem": getattr(produto, "imagem", None),
                "preco": float(getattr(produto, "preco", 0) or 0),
            } if produto else None
        })

    return data

