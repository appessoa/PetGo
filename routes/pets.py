import gzip
from flask import Blueprint, Response, jsonify, request
from config.db import db
from controllers.petsController import PetsController
from models.consultasModel import Consultation
from models.petsModel import Pet
from models.vacinaModel import Vaccine
from service.Helpers import api_error
from config.decorators import login_required

pets_api = Blueprint("pets_api", __name__, url_prefix="/api")

pets_api.get("/pets")(login_required(PetsController.get_pets))
pets_api.post("/pets")(login_required(PetsController.create))
pets_api.put("/pets/<int:pet_id>")(login_required(PetsController.update))
pets_api.delete("/pets/<int:pet_id>")(login_required(PetsController.delete))

@pets_api.post('/pets/<int:pid>/vaccines')
@login_required
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
@login_required
def del_vaccine(pid, vid):
    try:
        v = Vaccine.query.get_or_404(vid)
        v.deleted = vid  
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro ao remover vacina", exc=e)

@pets_api.post('/pets/<int:pid>/consultations')
@login_required
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
@login_required
def del_consult(pid, cid):
    try:
        c = Consultation.query.get_or_404(cid)
        c.deleted = cid  
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return api_error(500, "Erro ao remover consulta", exc=e)

@pets_api.get('/pets/<int:pid>/photo')
@login_required
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