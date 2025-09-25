from config.db import db

class Consultation(db.Model):
    """ Modelo para tabela de consultas

    id: int - PK
    pet_id: int - FK para o pet
    date: str - Data da consulta (ISO string)
    reason: str - Motivo da consulta
    notes: str - Notas adicionais
    pet: Pet - Relacionamento com o modelo Pet

    """
    __tablename__ = "consultations"
    id_consulta     = db.Column(db.Integer, primary_key=True)
    pet_id = db.Column(db.Integer, db.ForeignKey("pets.id_pet"), nullable=False, index=True)
    vet_id= db.Column(db.Integer, db.ForeignKey("veterinarians.id_veterinarian"), nullable=True, index=True)
    date   = db.Column(db.String(20), nullable=False)  # ISO string
    reason = db.Column(db.String(200))
    notes  = db.Column(db.Text)

    pet = db.relationship("Pet", back_populates="consultations")
    vet = db.relationship("veterinarianModel", back_populates="consultations")

    __table_args__ = (
        db.Index("ix_consultations_pet_date", "pet_id", "date"),
    )

    def to_dict(self):
        return {"id": self.id_consulta, "date": self.date, "reason": self.reason, "notes": self.notes}
