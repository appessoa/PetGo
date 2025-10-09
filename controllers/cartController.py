# controllers/cartController.py
from flask import jsonify, request, session
from werkzeug.exceptions import BadRequest, Unauthorized
from app.enums.modos import modos
from service.cartService import deleted_produto, add_or_set_item, get_cart

class cartController:

    @staticmethod
    def _get_uid():
        uid = session.get('user_id')          # <<< pega da sessão
        if uid is None:
            raise Unauthorized("Usuário não autenticado")
        try:
            return int(uid)
        except (TypeError, ValueError):
            raise Unauthorized("Sessão inválida")
        
    @staticmethod
    def get_my_cart():
        uid = cartController._get_uid()
        return get_cart(uid)  # já retorna jsonify({...})

    @staticmethod
    def add_item():
        """
        POST /carrinho/items
        body: { "id_produto": 123, "quantidade": 1, "modo": "INCLUIR"|"SETAR" }
        """
        uid = cartController._get_uid()
        data = request.get_json(silent=True) or {}
        try:
            id_produto  = int(data.get("id_produto"))
            quantidade  = int(data.get("quantidade") or 1)
            modo = data.get("modo") or modos.INCLUIR.value  # default inclui
            if not modos[modo]:
                modo = modos.INCLUIR.value
        except (TypeError, ValueError):
            raise BadRequest("Payload inválido")

        item = add_or_set_item(uid, id_produto, quantidade, modo=modo)
        # após adicionar, devolve o carrinho inteiro para atualizar badge
        return get_cart(uid)
    
    def deleted_product_cart(id_cart_item: int):
        
        deleted_produto(id_cart_item)

        return jsonify({"sucesso": f"produto '{id_cart_item}' deletado com sucesso"}),201
    