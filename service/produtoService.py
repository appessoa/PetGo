from models.produtoModel import produto
from config.db import db

def get_produto_by_id(produto_id):
    return produto.query.get(produto_id)

def get_all_produtos():
    return produto.query.all()
def create_produto(nome, descricao, preco, estoque, categoria=None, imagem_bloob=None):
    new_produto = produto(
        nome=nome,
        descricao=descricao,
        preco=preco,
        estoque=estoque,
        categoria=categoria,
        imagem_bloob=imagem_bloob
    )
    db.session.add(new_produto)
    db.session.commit()
    return new_produto

# services/produtosService.py
from typing import Optional, List, Dict, Any
from config.db import db
from models.produtoModel import produto
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from flask import current_app
import base64, binascii, re

DATA_URL_RE = re.compile(r'^data:(?P<mime>[\w/+.-]+);base64,(?P<b64>.+)$')
MAX_IMG_BYTES = 10 * 1024 * 1024  # 10 MB

class ValidationError(ValueError):
    def __init__(self, message, field: Optional[str] = None):
        super().__init__(message)
        self.field = field

def _set_image_from_payload(p: produto, data: Dict[str, Any]):
    """
    Aceita 'imagem' como data URL base64 (data:image/...;base64,...) e salva em imagem_bloob.
    """
    imagem = data.get("imagem")
    if not imagem:
        return
    m = DATA_URL_RE.match(imagem)
    if not m:
        raise ValidationError("Formato de imagem inválido (esperado data URL).", field="imagem")

    try:
        raw = base64.b64decode(m.group('b64'), validate=True)
    except binascii.Error as e:
        raise ValidationError(f"Base64 inválido: {e}", field="imagem") from e

    if len(raw) > MAX_IMG_BYTES:
        raise ValidationError(f"Imagem excede {MAX_IMG_BYTES//(1024*1024)}MB.", field="imagem")

    p.imagem_bloob = raw  # (mantendo SEM gzip para produto, como seu model original)

def list_produtos(categoria: Optional[str] = None, only_active: bool = True) -> List[produto]:
    q = produto.query
    if only_active:
        q = q.filter_by(is_active=True)
    if categoria:
        q = q.filter_by(categoria=categoria)
    return q.order_by(produto.id_produto.desc()).all()

def get_produto(produto_id: int) -> produto:
    return produto.query.get_or_404(produto_id)

def create_produto(data: Dict[str, Any]) -> produto:
    nome = (data.get("nome") or "").strip()
    if not nome:
        raise ValidationError("Nome é obrigatório.", field="nome")

    try:
        preco = float(data.get("preco"))
    except (TypeError, ValueError):
        raise ValidationError("Preço inválido.", field="preco")

    try:
        estoque = int(data.get("estoque") or 0)
    except (TypeError, ValueError):
        raise ValidationError("Estoque inválido.", field="estoque")

    p = produto(
        nome=nome,
        descricao=data.get("descricao"),
        preco=preco,
        estoque=estoque,
        categoria=(data.get("categoria") or None),
        is_active=bool(data.get("is_active", True)),
    )
    _set_image_from_payload(p, data)

    try:
        db.session.add(p)
        db.session.commit()
        return p
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao criar produto")
        raise ValidationError("Violação de integridade ao salvar o produto.") from e
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao criar produto")
        raise RuntimeError("Erro de banco ao criar produto.") from e

def update_produto(produto_id: int, data: Dict[str, Any]) -> produto:
    p = produto.query.get_or_404(produto_id)

    if "nome" in data:
        novo = (data.get("nome") or "").strip()
        if not novo:
            raise ValidationError("Nome não pode ser vazio.", field="nome")
        p.nome = novo

    if "descricao" in data:
        p.descricao = data.get("descricao")

    if "preco" in data:
        try:
            p.preco = float(data.get("preco"))
        except (TypeError, ValueError):
            raise ValidationError("Preço inválido.", field="preco")

    if "estoque" in data:
        try:
            p.estoque = int(data.get("estoque"))
        except (TypeError, ValueError):
            raise ValidationError("Estoque inválido.", field="estoque")

    if "categoria" in data:
        p.categoria = (data.get("categoria") or None)

    if "is_active" in data:
        p.is_active = bool(data.get("is_active"))

    if "imagem" in data:
        _set_image_from_payload(p, data)

    try:
        db.session.commit()
        return p
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao atualizar produto")
        raise ValidationError("Violação de integridade ao atualizar produto.") from e
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao atualizar produto")
        raise RuntimeError("Erro de banco ao atualizar produto.") from e

def set_estoque(produto_id: int, novo_estoque: int) -> produto:
    if novo_estoque < 0:
        raise ValidationError("Estoque não pode ser negativo.", field="estoque")
    p = produto.query.get_or_404(produto_id)
    p.estoque = novo_estoque
    try:
        db.session.commit()
        return p
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro ao ajustar estoque")
        raise RuntimeError("Erro ao ajustar estoque.") from e

def toggle_ativo(produto_id: int, ativo: bool) -> produto:
    p = produto.query.get_or_404(produto_id)
    p.is_active = bool(ativo)
    try:
        db.session.commit()
        return p
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro ao alterar status do produto")
        raise RuntimeError("Erro ao alterar status do produto.") from e
