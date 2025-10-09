from flask import  request, jsonify, send_file, session, current_app
from sqlalchemy.exc import SQLAlchemyError

from service.pedidoService import (
    create_order_from_cart,
    get_order_by_id,
    list_orders_admin,
    list_orders_by_user,
    get_order_for_user,
    update_order_status
)
from app.erros import ValidationError

def _require_user():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Unauthorized"}), 401)
    return uid, None


def _is_admin() -> bool:
    # ajuste conforme sua sessão/ACL
    return bool(session.get("is_admin"))

class pedidoController:
    
    def checkout():
        uid, err = _require_user()
        if err: return err

        data = request.get_json(silent=True) or {}
        payment_method = (data.get("payment_method") or "credit_card").strip()
        payment_data   = data.get("payment_data") or {}

        try:
            order = create_order_from_cart(uid, payment_method, payment_data)
            return jsonify({
                "id_pedido": order.id_pedido,
                "total": order.total,
                "status": order.status
            }), 201

        except ValidationError as ve:
            return jsonify({"error": str(ve)}), 400
        except SQLAlchemyError:
            current_app.logger.exception("Erro de banco no checkout")
            return jsonify({"error": "Erro de banco de dados."}), 500
        except Exception:
            current_app.logger.exception("Erro inesperado no checkout")
            return jsonify({"error": "Erro inesperado no checkout."}), 500


    def my_orders():
        uid, err = _require_user()
        if err: return err

        try:
            orders = list_orders_by_user(uid)
            return jsonify([o.to_dict() for o in orders]), 200
        except SQLAlchemyError:
            current_app.logger.exception("Erro de banco ao listar pedidos")
            return jsonify({"error": "Erro de banco de dados."}), 500
        

    def my_order_detail(order_id: int):
        uid, err = _require_user()
        if err: return err

        try:
            order = get_order_for_user(uid, order_id, is_admin=_is_admin())
            return jsonify(order.to_dict()), 200
        except ValidationError as ve:
            return jsonify({"error": str(ve)}), 403
        except SQLAlchemyError:
            current_app.logger.exception("Erro de banco ao buscar pedido")
            return jsonify({"error": "Erro de banco de dados."}), 500
        
    def patch_order_status(order_id: int):
        uid, err = _require_user()
        if err: return err

        data = request.get_json(silent=True) or {}
        new_status = data.get("status")

        try:
            order = update_order_status(order_id, new_status, uid, is_admin=_is_admin())
            return jsonify(order.to_dict()), 200
        except ValidationError as ve:
            # regras de negócio / autorização
            return jsonify({"error": str(ve)}), 400
        except SQLAlchemyError:
            current_app.logger.exception("Erro de banco ao atualizar status do pedido")
            return jsonify({"error": "Erro de banco de dados."}), 500
        except Exception:
            current_app.logger.exception("Erro inesperado ao atualizar status do pedido")
            return jsonify({"error": "Erro inesperado."}), 500
    def admin_list_orders():
        status = request.args.get("status", "", type=str)
        date_from = request.args.get("date_from", "", type=str)
        date_to   = request.args.get("date_to", "", type=str)
        q         = request.args.get("q", "", type=str)
        page      = request.args.get("page", 1, type=int)
        per_page  = request.args.get("per_page", 50, type=int)

        data = list_orders_admin(
            status=status,
            date_from=date_from,
            date_to=date_to,
            q=q,
            page=page,
            per_page=per_page
        )

        return jsonify(data), 200
    
    def admin_get_order_detail(order_id: int):

        data = get_order_by_id(order_id)
        if not data:
            return jsonify({"error": "Pedido não encontrado"}), 404
        return jsonify(data), 200
    
