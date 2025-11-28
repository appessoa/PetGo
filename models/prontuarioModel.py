from datetime import datetime
from config.db import db

class ProntuarioModel(db.Model):

    __tablename__ = 'prontuarios'

    id_prontuario = db.Column(db.Integer, primary_key=True, autoincrement=True)
    Diagnóstico = db.Column(db.String(100), nullable=False)
    Anamnese = db.Column(db.String(500), nullable=False)
    Tratamento = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Integer, default=False)

    # Foreign keys
    pet_id = db.Column(db.Integer, db.ForeignKey("pets.id_pet"), nullable=False, index=True)
    vet_id = db.Column(db.Integer, db.ForeignKey("veterinarians.id_veterinarian"), nullable=True, index=True)

    # Relacionamentos
    consultations = db.relationship(
        "Consultation", back_populates="pront", passive_deletes=True, cascade="all, delete-orphan", lazy="selectin"
    )
    # ligação com veterinário
    vet = db.relationship("veterinarianModel", back_populates="prontuarios", lazy="joined")
    # ligação com pet
    pet = db.relationship("Pet", back_populates="prontuarios", lazy="joined")

    def to_dict(self):
        return {
            "id_prontuario": self.id_prontuario,
            "diagnostico": getattr(self, "Diagnóstico", None),
            "anamnese": getattr(self, "Anamnese", None),
            "tratamento": getattr(self, "Tratamento", None),
            "pet_id": self.pet_id,
            "vet_id": self.vet_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "deleted": self.deleted,
            "consultations": [c.to_dict() for c in self.consultations],
        }