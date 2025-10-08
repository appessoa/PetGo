from flask import request, jsonify, send_file
from werkzeug.exceptions import NotFound, BadRequest
from io import BytesIO
from app.enums.categoriasEnum import Categorias
from app.enums.especies import Especies

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

    def get_all():
        """
        GET /produtos?q=...&categoria=...&especie=...&preco_min=..&preco_max=..
                 &sort=nome-asc|nome-desc|preco-asc|preco-desc
                 &page=1&per_page=24
        """
        args = request.args

        categoria = args.get("categoria") or None
        especie   = args.get("especie") or None
        q         = args.get("q") or None
        sort      = args.get("sort") or None

        # paginação
        try:
            page = int(args.get("page", 1))
        except ValueError:
            page = 1
        try:
            per_page = int(args.get("per_page", 24))
        except ValueError:
            per_page = 24
        per_page = max(1, min(per_page, 100))

        # faixa de preço
        preco_min = args.get("preco_min")
        preco_max = args.get("preco_max")
        try:
            preco_min = float(preco_min) if preco_min is not None else None
        except ValueError:
            raise BadRequest("preco_min inválido")
        try:
            preco_max = float(preco_max) if preco_max is not None else None
        except ValueError:
            raise BadRequest("preco_max inválido")

        items, total = list_produtos(
            categoria=categoria,
            especie=especie,
            q=q,
            preco_min=preco_min,
            preco_max=preco_max,
            sort=sort,
            page=page,
            per_page=per_page,
        )

        return jsonify({
            "items": [p.to_dict() for p in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_next": page * per_page < total,
                "has_prev": page > 1,
            }
        }), 200

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
        return jsonify(p.to_dict()),200
    
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
    
    def get_categorias():
        return [{"key":c.name , "value":c.value } for c in Categorias]
    
    def get_especies():
        return [{"key":c.name , "value":c.value } for c in Especies]