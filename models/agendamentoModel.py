from config.db import db

class Scheduling(db.Model):
    __tablename__ = "scheduling"

    id_agendamento = db.Column(db.Integer, primary_key=True)

    # FK: ajuste os nomes das tabelas/colunas se seu projeto usar outros
    user_id = db.Column(db.Integer, db.ForeignKey("users.id_user"), nullable=False, index=True)
    pet_id  = db.Column(db.Integer, db.ForeignKey("pets.id_pet"),  nullable=False, index=True)

    service = db.Column(db.String(30), nullable=False, index=True)   # ex: banho, veterinario, passeio, hotel
    date    = db.Column(db.Date,       nullable=False, index=True)
    time    = db.Column(db.Time,       nullable=False)
    notes   = db.Column(db.Text)

    status  = db.Column(db.String(20), nullable=False, default="marcado", index=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now(), onupdate=db.func.now())

    user = db.relationship("User", backref=db.backref("agendamentos", lazy="dynamic"))
    pet  = db.relationship("Pet",  backref=db.backref("agendamentos", lazy="dynamic"))

    __table_args__ = (
        db.Index("idx_sched_user_date", "user_id", "date"),
    )

    def to_dict(self):
        return {
            "id": self.id_agendamento,
            "user_id": self.user_id,
            "pet_id": self.pet_id,
            "service": self.service,
            "date": self.date.isoformat(),
            "time": self.time.strftime("%H:%M"),
            "notes": self.notes,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # extras úteis no front:
            "pet": {"id": self.pet_id, "nome": getattr(self.pet, "nome", None) or getattr(self.pet, "name", None)},
        }
