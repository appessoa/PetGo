from typing import Optional, Dict, Any, List
from config.db import db
from models.petsModel import Pet
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from flask import current_app
import gzip, base64, re, binascii

# regex para dataURL (quando vier do front)
DATA_URL_RE = re.compile(r'^data:(?P<mime>[\w/+.-]+);base64,(?P<b64>.+)$')
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10MB limite bruto

class ValidationError(ValueError):
    def __init__(self, message, field=None):
        super().__init__(message)
        self.field = field

def _set_photo_from_payload(p: Pet, data: Dict[str, Any]):
    """Aceita 'photo' como dataURL base64 e compacta com gzip."""
    photo = data.get("photo")
    if not photo:
        return
    m = DATA_URL_RE.match(photo)
    if not m:
        raise ValidationError("Formato de foto inválido (esperado data URL).", field="photo")

    try:
        raw = base64.b64decode(m.group('b64'), validate=True)
    except binascii.Error as e:
        raise ValidationError(f"Base64 inválido: {e}", field="photo") from e

    if len(raw) > MAX_PHOTO_BYTES:
        raise ValidationError(f"Foto excede {MAX_PHOTO_BYTES//(1024*1024)}MB.", field="photo")

    try:
        p.foto_bloob = gzip.compress(raw, compresslevel=6)
        if hasattr(p, "foto_mime"):
            p.foto_mime = m.group('mime')[:50]
    except Exception as e:
        raise ValidationError("Falha ao comprimir a foto.", field="photo") from e


def list_pets(owner_id: Optional[int]) -> List[Pet]:
    q = Pet.query
    if owner_id:
        q = q.filter_by(dono=owner_id)
    return q.order_by(Pet.id_pet.desc()).all()


def create_pet(owner_id: Optional[int], data: Dict[str, Any]) -> Pet:
    # Validações mínimas
    nome = (data.get("name") or data.get("nome") or "").strip()
    if not nome:
        raise ValidationError("Nome é obrigatório.", field="name")

    raca = (data.get("breed") or data.get("raca") or "").strip()
    if not raca:
        raise ValidationError("Raça é obrigatória.", field="breed")

    try:
        peso_val = float(data.get("weight") or 0)
    except (TypeError, ValueError):
        raise ValidationError("Peso inválido.", field="weight")

    p = Pet(
        dono=owner_id,
        nome=nome,
        idade=data.get("idade") or 0,
        raca=raca,
        peso=peso_val,
        descricao=data.get("descricao"),
        adocao=bool(data.get("adocao")),
    )

    # Foto (opcional)
    _set_photo_from_payload(p, data)

    try:
        db.session.add(p)
        db.session.commit()
        return p
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao criar pet")
        # Ex.: violação de UNIQUE / FK
        raise ValidationError("Violação de integridade ao salvar o pet.", field=None) from e
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao criar pet")
        raise RuntimeError("Erro de banco ao criar pet.") from e


def update_pet(pet_id: int, data: Dict[str, Any]) -> Pet:
    p = Pet.query.get_or_404(pet_id)

    if "name" in data or "nome" in data:
        novo_nome = (data.get("name") or data.get("nome") or "").strip()
        if not novo_nome:
            raise ValidationError("Nome não pode ser vazio.", field="name")
        p.nome = novo_nome

    if "idade" in data:
        p.idade = data.get("idade") or p.idade

    if "breed" in data or "raca" in data:
        nova_raca = (data.get("breed") or data.get("raca") or "").strip()
        if not nova_raca:
            raise ValidationError("Raça não pode ser vazia.", field="breed")
        p.raca = nova_raca

    if "weight" in data:
        try:
            p.peso = float(data.get("weight"))
        except (TypeError, ValueError):
            raise ValidationError("Peso inválido.", field="weight")

    if "descricao" in data:
        p.descricao = data.get("descricao")

    if "adocao" in data:
        p.adocao = bool(data.get("adocao"))

    if "photo" in data:
        _set_photo_from_payload(p, data)

    try:
        db.session.commit()
        return p
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao atualizar pet")
        raise ValidationError("Violação de integridade ao atualizar o pet.", field=None) from e
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao atualizar pet")
        raise RuntimeError("Erro de banco ao atualizar pet.") from e


def delete_pet(pet_id: int) -> None:
    p = Pet.query.get_or_404(pet_id)
    p.deleted = p.id_pet  # soft delete
    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        from flask import current_app
        current_app.logger.exception("Erro de banco ao deletar (soft) pet")
        raise RuntimeError("Erro de banco ao deletar (soft) pet.") from e
