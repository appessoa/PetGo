from datetime import datetime
from config.db import db

class veterinarianModel(db.Model):

    __tablename__ = 'veterinarians'

    id_veterinarian = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    CRMV = db.Column(db.String(20), unique=True, nullable=False)
    especialidade = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    status = db.Column(db.Boolean, nullable=True, default=True)  # ativo/inativo
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Boolean, default=False)

    consultations = db.relationship(
        "Consultation", back_populates="vet", passive_deletes=True
    )
    schedulings = db.relationship(
        "Scheduling",
        back_populates="vet",
        passive_deletes=True,
        lazy="selectin",
        cascade="all, delete-orphan"
    )
    # Índices úteis
    __table_args__ = (
        db.Index("ix_veterinarians_username", "username"),
        db.Index("ix_veterinarians_email", "email"),
        db.Index("ix_veterinarians_crmv", "CRMV"),
    )

    def to_dict(self):
        return {
            "id_veterinarian": self.id_veterinarian,
            "name": self.name,
            "username": self.username,
            "CRMV": self.CRMV,
            "especialidade": self.especialidade,
            "phone": self.phone,
            "email": self.email,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "deleted": self.deleted,
            "schedulings": [s.to_dict() for s in self.schedulings],
        }