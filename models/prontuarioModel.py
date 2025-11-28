from datetime import datetime
from config.db import db
from models.mixins import TimestampMixin

class ProntuarioModel(db.Model, TimestampMixin):

    __tablename__ = 'prontuarios'

    id_prontuario = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # remover acentos e padronizar
    diagnostico = db.Column(db.String(100), nullable=False)
    anamnese = db.Column(db.String(500), nullable=False)
    tratamento = db.Column(db.String(500), nullable=False)

    # Foreign keys
    pet_id = db.Column(db.Integer, db.ForeignKey("pets.id_pet"), nullable=False, index=True)
    vet_id = db.Column(db.Integer, db.ForeignKey("veterinarians.id_veterinarian"), nullable=True, index=True)

    # ligação com veterinário
    vet = db.relationship("veterinarianModel", back_populates="prontuarios", lazy="joined")
    # ligação com pet
    pet = db.relationship("Pet", back_populates="prontuarios", lazy="joined")
    # ligação com agendamentos (scheduling)
    agendamentos = db.relationship("Scheduling", back_populates="prontuario", passive_deletes=True, lazy="selectin")
    
    def to_dict(self):
        base = {
            "id": self.id_prontuario,
            "pront_id": self.id_prontuario,
            "id_prontuario": self.id_prontuario,
            "diagnostico": getattr(self, "diagnostico", None),
            "anamnese": getattr(self, "anamnese", None),
            "tratamento": getattr(self, "tratamento", None),
            "pet_id": self.pet_id,
            "vet_id": self.vet_id,
            
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "deleted": self.deleted,
            "agendamentos": [a.to_dict() for a in self.agendamentos] if getattr(self, "agendamentos", None) else [],
        }
        # incluir nome do pet/tutor se relacionamento estiver carregado
        if getattr(self, "pet", None):
            try:
                base["pet_name"] = getattr(self.pet, "nome", None) or getattr(self.pet, "name", None)
            except Exception:
                base["pet_name"] = None
        return base
