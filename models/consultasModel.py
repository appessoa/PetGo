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
    pet_id = db.Column(db.Integer, db.ForeignKey("pets.id_pet"), nullable=False)

    date   = db.Column(db.String(20), nullable=False)  # ISO string
    reason = db.Column(db.String(200))
    notes  = db.Column(db.Text)

    pet = db.relationship("Pet", back_populates="consultations")

    def to_dict(self):
        return {"id": self.id_consulta, "date": self.date, "reason": self.reason, "notes": self.notes}
