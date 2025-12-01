from config.db import db
from models.mixins import TimestampMixin
class Vaccine(db.Model,TimestampMixin):
    """ Modelo para tabela de vacinas
    
    id: int - PK
    pet_id: int - FK para o pet
    name: str - Nome da vacina
    date: str - Data da aplicação (ISO string)
    next: str - Data da próxima aplicação (ISO string)
    notes: str - Notas adicionais
    pet: Pet - Relacionamento com o modelo Pet

    """
    __tablename__ = "vaccines"

    id_vacina     = db.Column(db.Integer, primary_key=True)
    pet_id = db.Column(db.Integer, db.ForeignKey("pets.id_pet"), nullable=False)

    name   = db.Column(db.String(120), nullable=False)
    date   = db.Column(db.String(20), nullable=False)  # ISO string
    next   = db.Column(db.String(20))                  # ISO string
    notes  = db.Column(db.Text)

    pet = db.relationship("Pet", back_populates="vaccines")

    def to_dict(self):
        return {"id": self.id_vacina, "name": self.name, "date": self.date, "next": self.next, "notes": self.notes}
