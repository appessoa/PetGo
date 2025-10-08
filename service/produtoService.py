import gzip
from models.produtoModel import produto
from typing import Optional, List, Dict, Any
from config.db import db
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from flask import current_app
import base64, binascii, re
from app.erros import ValidationError
from sqlalchemy import or_

DATA_URL_RE = re.compile(r'^data:(?P<mime>[\w/+.-]+);base64,(?P<b64>.+)$')
MAX_IMG_BYTES = 10 * 1024 * 1024  # 10 MB

def _set_image_from_payload(p: produto, data: Dict[str, Any]):
    """Aceita 'photo' como dataURL base64 e compacta com gzip."""
    photo = data.get("imagem")
    if not photo:
        return
    m = DATA_URL_RE.match(photo)
    if not m:
        raise ValidationError("Formato de foto inválido (esperado data URL).", field="photo")

    try:
        raw = base64.b64decode(m.group('b64'), validate=True)
    except binascii.Error as e:
        raise ValidationError(f"Base64 inválido: {e}", field="photo") from e

    if len(raw) > MAX_IMG_BYTES:
        raise ValidationError(f"Foto excede {MAX_IMG_BYTES//(1024*1024)}MB.", field="photo")

    try:
        p.imagem_bloob = gzip.compress(raw, compresslevel=6)
        if hasattr(p, "imagem_mime"):
            p.imagem_mime = m.group('mime')[:50]
    except Exception as e:
        raise ValidationError("Falha ao comprimir a foto.", field="photo") from e

# produtoService.py

def list_produtos(
    categoria: Optional[str] = None,
    especie: Optional[str] = None,
    q: Optional[str] = None,
    preco_min: Optional[float] = None,
    preco_max: Optional[float] = None,
    sort: Optional[str] = None,
    page: Optional[int] = None,
    per_page: Optional[int] = None,
):
    """
    Retorna (items, total) aplicando filtros no banco.
    sort: 'nome-asc'|'nome-desc'|'preco-asc'|'preco-desc'|None
    """
    query = produto.query.filter_by(is_active=True, deleted=0)

    if categoria:
        query = query.filter(produto.categoria == categoria)

    if especie:
        query = query.filter(produto.especie == especie)

    if q:
        q_like = f"%{q.strip()}%"
        # ilike para case-insensitive; se houver extensão unaccent no banco, pode aplicar func.unaccent
        query = query.filter(or_(
            produto.nome.ilike(q_like),
            produto.categoria.ilike(q_like),
            produto.especie.ilike(q_like),
            produto.descricao.ilike(q_like),
        ))

    if preco_min is not None:
        query = query.filter(produto.preco >= float(preco_min))
    if preco_max is not None:
        query = query.filter(produto.preco <= float(preco_max))

    # ordenação
    if sort == 'nome-asc':
        query = query.order_by(produto.nome.asc())
    elif sort == 'nome-desc':
        query = query.order_by(produto.nome.desc())
    elif sort == 'preco-asc':
        query = query.order_by(produto.preco.asc())
    elif sort == 'preco-desc':
        query = query.order_by(produto.preco.desc())
    else:
        query = query.order_by(produto.id_produto.desc())

    total = query.count()

    if page and per_page:
        items = query.offset((page - 1) * per_page).limit(per_page).all()
    else:
        items = query.all()

    return items, total


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
        especie = data.get("especie")
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

def deleted_produto(produto_id:int)-> produto:

    Produto = produto.query.get_or_404(produto_id)
    Produto.deleted = Produto.id_produto  # marca como deletado
    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        raise RuntimeError("Falha ao deletar usuário") from e
    except Exception as e:
        db.session.rollback()
        raise RuntimeError("Erro inesperado ao deletar produto") from e
    return True


