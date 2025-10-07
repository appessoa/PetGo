from flask import request, jsonify, send_file
from werkzeug.exceptions import NotFound, BadRequest
from io import BytesIO
from typing import Any, Dict, Optional

# importa do teu service (o código que você mandou)
from service.produtoService import (
    list_produtos,
    get_produto,
    create_produto,
    update_produto,
    set_estoque,
    deleted_produto,
    ValidationError,
)

class produtoController:

    def serialize_produto(p) -> Dict[str, Any]:
        "Serializa o produto para JSON (não envia o blob)."
        data = {
            "id": getattr(p, "id_produto", getattr(p, "id", None)),
            "nome": p.nome,
            "descricao": p.descricao,
            "preco": p.preco,
            "estoque": p.estoque,
            "categoria": p.categoria,
            "imagem_url": p.imagem
        }
        return data

    def parse_bool(value: Optional[str], default: bool = True) -> bool:
        if value is None:
            return default
        return str(value).lower() in {"1", "true", "t", "yes", "y", "on"}
    

    def get_all():
        """
        GET /produtos?categoria=...&only_active=true|false&page=1&per_page=20
        Retorna lista (com paginação simples opcional).
        """
        categoria = request.args.get("categoria") or None

        # paginação opcional (feita no controller para não mexer no service)
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))
        per_page = max(1, min(per_page, 100))

        all_items = list_produtos(categoria=categoria)
        total = len(all_items)
        start = (page - 1) * per_page
        end = start + per_page
        items = all_items[start:end]

        return jsonify({
            "items": [p.to_dict() for p in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_next": end < total,
                "has_prev": start > 0,
            }
        }),200

    def get_one(produto_id : int):
        """
        GET /produtos/:id
        """
        p = get_produto(produto_id)
        return jsonify(p.to_dict()),200
    
    def create_one():
        """
        POST /produtos
        Body JSON esperado:
        {
        "nome": "...", "descricao": "...", "preco": 10.5, "estoque": 3,
        "categoria": "...", "is_active": true,
        "imagem": "data:image/png;base64,...."  # opcional (data URL)
        }
        """
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise BadRequest("JSON inválido ou ausente.")

        p = create_produto(data)
        return jsonify(p.to_dict()), 201
    
    def update_one(produto_id: int):
        """
        PUT/PATCH /produtos/:id
        Body JSON: quaisquer campos aceitos pelo service (parciais ok)
        """
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise BadRequest("JSON inválido ou ausente.")

        p = update_produto(produto_id, data)
        return jsonify(p.to_dict),200
    
    def update_stock(produto_id: int):
        """
        PATCH /produtos/:id/estoque
        Body JSON: { "estoque": 42 }
        """
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or "estoque" not in data:
            raise BadRequest("Campo 'estoque' é obrigatório.")
        try:
            novo_estoque = int(data["estoque"])
        except (TypeError, ValueError):
            raise ValidationError("Estoque inválido.", field="estoque")

        p = set_estoque(produto_id, novo_estoque)
        return jsonify(p.to_dict())
    
    def get_imagem(produto_id: int):
        """
        GET /produtos/:id/imagem
        Retorna o blob como arquivo. Se você salvar o MIME no banco,
        troque 'image/jpeg' pelo mimetype real.
        """
        p = get_produto(produto_id)
        blob = getattr(p, "imagem_bloob", None)
        if not blob:
            raise NotFound("Produto sem imagem.")

        # Ajuste o mimetype se você persistir o tipo real no model (ex.: p.imagem_mime)
        return send_file(BytesIO(blob), mimetype="image/jpeg", download_name=f"produto_{produto_id}.jpg")
    
    def deleted_product(produto_id: int):
        
        deleted_produto(produto_id)

        return jsonify({"sucesso": f"produto '{produto_id}' com sucesso"}),201