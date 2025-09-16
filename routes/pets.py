from flask import Blueprint, jsonify, request, session, current_app, Response, url_for
from config.db import db
from models.petsModel import Pet
from models.vacinaModel import Vaccine
from models.consultasModel import Consultation
from service.petsService import (
    list_pets as svc_list,
    create_pet as svc_create,
    update_pet as svc_update,
    delete_pet as svc_delete,
    ValidationError,
)
from service.Helpers import api_error
import base64, gzip

pets_api = Blueprint('pets_api', __name__, url_prefix='/api')

def _pet_to_dict(p: Pet):
    if hasattr(p, "to_dict"):
        return p.to_dict(with_children=True)
    return {
        "id": p.id_pet,
        "name": getattr(p, "name", None) or p.nome,
        "species": getattr(p, "species", None),
        "breed": getattr(p, "breed", None) or p.raca,
        "dob": getattr(p, "dob", None),
        "weight": getattr(p, "weight", None) or p.peso,
        "photo": getattr(p, "photo", None),
        "vaccines": [ {"id": v.id_vacina, "name": v.name, "date": v.date, "next": v.next, "notes": v.notes} for v in getattr(p, "vaccines", []) ],
        "consultations": [ {"id": c.id_consulta, "date": c.date, "reason": c.reason, "notes": c.notes} for c in getattr(p, "consultations", []) ],
        "uploads": []
    }

@pets_api.get('/pets')
def list_pets():
    try:
        uid = session.get('user_id')
        pets = svc_list(uid)
        return jsonify([_pet_to_dict(p) for p in pets])
    except Exception as e:
        return api_error(500, "Falha ao listar pets", exc=e)

@pets_api.post('/pets')
def create_pet():
    try:
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            form = request.form
            data = {
                "name": (form.get('nome') or form.get('name') or '').strip(),
                "idade": form.get('idade'),
                "breed": (form.get('raca') or form.get('breed') or '').strip(),
                "weight": form.get('peso') or form.get('weight'),
                "descricao": form.get('descricao'),
                "adocao": form.get('adocao'),
            }
            file = request.files.get('foto')
            if file and file.filename:
                b64 = base64.b64encode(file.read()).decode('utf-8')
                data["photo"] = f"data:{file.mimetype or 'image/jpeg'};base64,{b64}"
        else:
            data = request.get_json(silent=True) or {}

        p = svc_create(session.get('user_id'), data)
        if hasattr(p, "foto_url") and not p.foto_url:
            p.foto_url = url_for('pets_api.pet_photo', pid=p.id_pet, _external=True)
            db.session.commit()
        return jsonify(_pet_to_dict(p)), 201

    except ValidationError as ve:
        return api_error(400, "Validação falhou", cause=str(ve), details={"field": ve.field})
    except Exception as e:
        return api_error(500, "Erro inesperado ao criar pet", exc=e)

@pets_api.put('/pets/<int:pid>')
def update_pet(pid):
    try:
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            form = request.form
            data = {
                "name": (form.get('nome') or form.get('name')),
                "idade": form.get('idade'),
                "breed": (form.get('raca') or form.get('breed')),
                "weight": form.get('peso') or form.get('weight'),
                "descricao": form.get('descricao'),
                "adocao": form.get('adocao'),
            }
            file = request.files.get('foto')
            if file and file.filename:
                b64 = base64.b64encode(file.read()).decode('utf-8')
                data["photo"] = f"data:{file.mimetype or 'image/jpeg'};base64,{b64}"
        else:
            data = request.get_json(silent=True) or {}

        p = svc_update(pid, data)
        if hasattr(p, "foto_url") and not p.foto_url:
            p.foto_url = url_for('pets_api.pet_photo', pid=p.id_pet, _external=True)
            db.session.commit()
        return jsonify(_pet_to_dict(p))

    except ValidationError as ve:
        return api_error(400, "Validação falhou", cause=str(ve), details={"field": ve.field})
    except Exception as e:
        return api_error(500, "Erro inesperado ao atualizar pet", exc=e)

@pets_api.delete('/pets/<int:pid>')
def delete_pet(pid):
    try:
        svc_delete(pid)
        return '', 204
    except Exception as e:
        return api_error(500, "Erro ao excluir (soft) pet", exc=e)

@pets_api.post('/pets/<int:pid>/vaccines')
def add_vaccine(pid):
    try:
        Pet.query.get_or_404(pid)  # valida FK
        data = request.get_json(silent=True) or {}
        if not data.get("name") or not data.get("date"):
            return api_error(400, "Nome e data são obrigatórios.", details={"required": ["name", "date"]})
        v = Vaccine(
            pet_id=pid,
            name=data["name"],
            date=data["date"],
            next=data.get("next"),
            notes=data.get("notes")
        )
        db.session.add(v); db.session.commit()
        return jsonify({"id": getattr(v, "id_vacina", getattr(v, "id", None)),
                        "name": v.name, "date": v.date, "next": v.next, "notes": v.notes}), 201
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro ao adicionar vacina", exc=e)

@pets_api.delete('/pets/<int:pid>/vaccines/<int:vid>')
def del_vaccine(pid, vid):
    try:
        v = Vaccine.query.filter_by(pet_id=pid).filter(
            (getattr(Vaccine, "id_vacina", None) == vid) if hasattr(Vaccine, "id_vacina") else (Vaccine.id == vid)
        ).first_or_404()
        db.session.delete(v); db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro ao remover vacina", exc=e)

@pets_api.post('/pets/<int:pid>/consultations')
def add_consult(pid):
    try:
        Pet.query.get_or_404(pid)
        data = request.get_json(silent=True) or {}
        if not data.get("date"):
            return api_error(400, "Data é obrigatória.", details={"required": ["date"]})
        c = Consultation(
            pet_id=pid,
            date=data["date"],
            reason=data.get("reason"),
            notes=data.get("notes")
        )
        db.session.add(c); db.session.commit()
        return jsonify({"id": getattr(c, "id_consulta", getattr(c, "id", None)),
                        "date": c.date, "reason": c.reason, "notes": c.notes}), 201
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro ao adicionar consulta", exc=e)

@pets_api.delete('/pets/<int:pid>/consultations/<int:cid>')
def del_consult(pid, cid):
    try:
        c = Consultation.query.filter_by(pet_id=pid).filter(
            (getattr(Consultation, "id_consulta", None) == cid) if hasattr(Consultation, "id_consulta") else (Consultation.id == cid)
        ).first_or_404()
        db.session.delete(c); db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro ao remover consulta", exc=e)

@pets_api.get('/pets/<int:pid>/photo')
def pet_photo(pid):
    try:
        p = Pet.query.get_or_404(pid)
        if not p.foto_bloob:
            return api_error(404, "Foto não encontrada")
        data = bytes(p.foto_bloob)
        try:
            raw = gzip.decompress(data) if data[:2] == b'\x1f\x8b' else data
        except Exception:
            raw = data
        mime = getattr(p, "foto_mime", None) or "image/jpeg"
        resp = Response(raw, mimetype=mime)
        resp.headers['Cache-Control'] = 'public, max-age=86400'
        return resp
    except Exception as e:
        return api_error(500, "Erro ao servir foto", exc=e)
