from config.db import db

class Scheduling(db.Model):
    __tablename__ = "scheduling"

    id_agendamento = db.Column(db.Integer, primary_key=True)

    # FK: ajuste os nomes das tabelas/colunas se seu projeto usar outros
    user_id = db.Column(db.Integer, db.ForeignKey("users.id_user"), nullable=False, index=True)
    pet_id  = db.Column(db.Integer, db.ForeignKey("pets.id_pet"),  nullable=False, index=True)
    vet_id = db.Column(db.Integer, db.ForeignKey("veterinarians.id_veterinarian"), nullable=True, index=True)
    
    # FK para prontuário (opcional)
    pront_id = db.Column(db.Integer, db.ForeignKey("prontuarios.id_prontuario"), nullable=True, index=True)

    service = db.Column(db.String(30), nullable=False, index=True)   # ex: banho, veterinario, passeio, hotel
    date    = db.Column(db.Date,       nullable=False, index=True)
    time    = db.Column(db.Time,       nullable=False)
    notes   = db.Column(db.Text,nullable=True)

    status  = db.Column(db.String(20), nullable=False, default="marcado", index=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now(), onupdate=db.func.now())

    user = db.relationship("User", backref=db.backref("agendamentos", lazy="dynamic"))
    pet  = db.relationship("Pet",  backref=db.backref("agendamentos", lazy="dynamic"))
    vet = db.relationship(
        "veterinarianModel",
        back_populates="schedulings",
        lazy="joined",
        foreign_keys=[vet_id],
    )
    # relacionamento para prontuário
    prontuario = db.relationship("ProntuarioModel", back_populates="agendamentos", lazy="joined", foreign_keys=[pront_id])

    __table_args__ = (
        db.Index("idx_sched_user_date", "user_id", "date","vet_id","status","pet_id"),
    )

    def to_dict(self):
        return {
            "id_agendamento": self.id_agendamento,
            "pet_id": self.pet_id,
            "vet_id": self.vet_id,
            "service": self.service,
            "date": self.date.isoformat(),
            "time": self.time.strftime("%H:%M"),
            "notes": self.notes,
            "status": self.status,
            "pront_id": self.pront_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # extras úteis no front:
            "pet": {"id": self.pet_id,
                     "nome": getattr(self.pet, "nome", None) or getattr(self.pet, "name", None),
                     "raca": getattr(self.pet, "raca", None) or getattr(self.pet, "breed", None),
                     "especie":getattr(self.pet, "species", None),
                     "sexo": getattr(self.pet, "sexo", None),
                     } if self.pet else None,
            "vet": {
                "id": self.vet_id, 
                "name": getattr(self.vet, "name", None) or None, 
                "especialidade": getattr(self.vet, "especialidade", None) or None
                } if self.vet else None,
            "user": {"id": self.user_id, "nome": getattr(self.user, "nome", None) or None}
        }
