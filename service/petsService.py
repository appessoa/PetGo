from typing import Optional, Dict, Any, List, Tuple
from config.db import db
from models.petsModel import Pet
from models.vacinaModel import Vaccine
from models.consultasModel import Consultation
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from flask import current_app
import gzip, base64, re, binascii

DATE_FMT = "%Y-%m-%d"
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
        q = q.filter_by(dono=owner_id, deleted = 0)
    return q.order_by(Pet.id_pet.desc()).all()


from datetime import datetime

def create_pet(owner_id: Optional[int], data: Dict[str, Any]) -> Pet:
    nome = (data.get("name") or data.get("nome") or "").strip()
    if not nome:
        raise ValidationError("Nome é obrigatório.", field="name")

    raca = (data.get("breed") or data.get("raca") or "").strip()
    if not raca:
        raise ValidationError("Raça é obrigatória.", field="breed")
    peso_val = (data.get("weight") or data.get("peso"))
    if peso_val is None:
        raise ValidationError("Peso é obrigatório.", field="weight")
    try:
        peso_val = float(peso_val)
    except (TypeError, ValueError):
        raise ValidationError("Peso inválido.", field="weight")
    # dob: "2024-08-12"
    dob = None
    dob_str = data.get("dob")
    if dob_str:
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError("Formato de data inválido (use YYYY-MM-DD).", field="dob")

    p = Pet(
        dono=owner_id,
        nome=nome,
        dob=dob,    
        sexo= (data.get("sexo") or "").strip(), 
        species = (data.get("species") or "").strip(),           
        raca=raca,
        peso=peso_val,
        descricao=data.get("descricao"),
        adocao=bool(data.get("adocao")),
    )
    _set_photo_from_payload(p, data)

    try:
        db.session.add(p)
        db.session.commit()
        return p
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao criar pet")
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

    if "dob" in data:
        dob_str = data.get("dob")
        if dob_str:
            try:
                p.dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("Formato de data inválido (use YYYY-MM-DD).", field="dob")
        else:
            p.dob = None

    if "species" in data:
        p.species = (data.get("species") or "").strip()  

    if "breed" in data or "raca" in data:
        nova_raca = (data.get("breed") or data.get("raca") or "").strip()
        if not nova_raca:
            raise ValidationError("Raça não pode ser vazia.", field="breed")
        p.raca = nova_raca
    if "sexo" in data:
        p.sexo = (data.get("sexo") or "").strip()

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


class ValidationError(ValueError):
    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message)
        self.field = field

# ----------------- Vacinas -----------------
def add_vaccine(pet_id: int, data: Dict[str, Any]) -> Vaccine:
    # FK obrigatória
    Pet.query.get_or_404(pet_id)

    name = (data.get("name") or "").strip()
    date_str = data.get("date")
    next_str = data.get("next")
    notes = data.get("notes")

    if not name:
        raise ValidationError("Nome é obrigatório.", field="name")
    if not date_str:
        raise ValidationError("Data é obrigatória.", field="date")

    # (Se precisar converter a coluna para date, faça aqui. Se seu modelo aceita string, pode passar direto.)
    # Vou normalizar para 'YYYY-MM-DD'
    try:
        _ = datetime.strptime(date_str, DATE_FMT).date()
    except ValueError:
        raise ValidationError("Formato de data inválido (use YYYY-MM-DD).", field="date")

    if next_str:
        try:
            _ = datetime.strptime(next_str, DATE_FMT).date()
        except ValueError:
            raise ValidationError("Formato de data inválido (use YYYY-MM-DD).", field="next")

    v = Vaccine(
        pet_id=pet_id,
        name=name,
        date=date_str,
        next=next_str,
        notes=notes
    )
    try:
        db.session.add(v)
        db.session.commit()
        return v
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao adicionar vacina")
        raise ValidationError("Violação de integridade ao adicionar vacina.")
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao adicionar vacina")
        raise RuntimeError("Erro de banco ao adicionar vacina.") from e


def delete_vaccine(pet_id: int, vac_id: int) -> None:
    # compat: id_vacina ou id
    if hasattr(Vaccine, "id_vacina"):
        v = Vaccine.query.filter_by(pet_id=pet_id, id_vacina=vac_id).first_or_404()
    else:
        v = Vaccine.query.filter_by(pet_id=pet_id, id=vac_id).first_or_404()
    try:
        db.session.delete(v)
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        from flask import current_app
        current_app.logger.exception("Erro de banco ao remover vacina")
        raise RuntimeError("Erro de banco ao remover vacina.") from e


# --------------- Consultas -----------------
def add_consultation(pet_id: int, data: Dict[str, Any]) -> Consultation:
    Pet.query.get_or_404(pet_id)

    date_str = data.get("date")
    reason = data.get("reason")
    notes = data.get("notes")

    if not date_str:
        raise ValidationError("Data é obrigatória.", field="date")
    try:
        _ = datetime.strptime(date_str, DATE_FMT).date()
    except ValueError:
        raise ValidationError("Formato de data inválido (use YYYY-MM-DD).", field="date")

    c = Consultation(
        pet_id=pet_id,
        date=date_str,
        reason=reason,
        notes=notes
    )
    try:
        db.session.add(c)
        db.session.commit()
        return c
    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao adicionar consulta")
        raise ValidationError("Violação de integridade ao adicionar consulta.")
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.exception("Erro de banco ao adicionar consulta")
        raise RuntimeError("Erro de banco ao adicionar consulta.") from e


def delete_consultation(pet_id: int, cons_id: int) -> None:
    if hasattr(Consultation, "id_consulta"):
        c = Consultation.query.filter_by(pet_id=pet_id, id_consulta=cons_id).first_or_404()
    else:
        c = Consultation.query.filter_by(pet_id=pet_id, id=cons_id).first_or_404()
    try:
        db.session.delete(c)
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        from flask import current_app
        current_app.logger.exception("Erro de banco ao remover consulta")
        raise RuntimeError("Erro de banco ao remover consulta.") from e

def get_pet_photo_bytes(pid: int) -> Tuple[bytes, str]:
    """
    Retorna (raw_bytes, mime) prontos para enviar no Response.
    Descompacta se for gzip.
    """
    import gzip as _gzip

    p = Pet.query.get_or_404(pid)
    if not p.foto_bloob:
        raise FileNotFoundError("Foto não encontrada")

    data = bytes(p.foto_bloob)
    # assinatura gzip
    if len(data) >= 2 and data[:2] == b'\x1f\x8b':
        try:
            raw = _gzip.decompress(data)
        except Exception:
            raw = data
    else:
        raw = data
    mime = getattr(p, "foto_mime", None) or "image/jpeg"
    return raw, mime
