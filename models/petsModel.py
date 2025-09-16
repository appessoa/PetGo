from datetime import datetime
import gzip
from config.db import db
import base64

class Pet(db.Model):  # corrigido de db.model -> db.Model
    __tablename__ = 'pets'

    id_pet = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    idade = db.Column(db.Integer, nullable=False)
    raca = db.Column(db.String(100), nullable=False)
    peso = db.Column(db.Float, nullable=False)
    descricao = db.Column(db.Text, nullable=True) 
    adotado = db.Column(db.Boolean, default=False)
    foto_bloob = db.Column(db.LargeBinary, nullable=True)  # <-- FOTO REAL
    foto_mime = db.Column(db.String(50), nullable=True)  # ex: 'image/jpeg', 'image/png'
    adocao = db.Column(db.Boolean, default=False)
    dono = db.Column(db.Integer, db.ForeignKey('users.id_user'), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Integer, default=0) # 0 = ativo, id = deletado 

    # Relacionamentos
    owner = db.relationship("User", back_populates="pets", lazy="joined")
    vaccines = db.relationship("Vaccine", back_populates="pet", cascade="all, delete-orphan", lazy="selectin")
    consultations = db.relationship("Consultation", back_populates="pet", cascade="all, delete-orphan", lazy="selectin")

    # Índices
    __table_args__ = (
        db.Index("ix_pets_dono", "dono"),
        db.Index("ix_pets_raca", "raca"),
        db.Index("ix_pets_adocao", "adocao"),
        db.Index("ix_pets_adotado", "adotado"),
    )

    @staticmethod
    def _is_gzip(data: bytes) -> bool:
        # assinatura do gzip: 1f 8b
        return isinstance(data, (bytes, bytearray)) and len(data) >= 2 and data[:2] == b'\x1f\x8b'

    def set_photo_bytes(self, raw_bytes: bytes, mime: str | None = None, compresslevel: int = 6):
        """
        Salva foto compactada com gzip em foto_bloob.
        - raw_bytes: bytes originais do arquivo (jpg/png)
        - mime: 'image/jpeg' | 'image/png' (opcional, mas recomendado)
        """
        if not raw_bytes:
            self.foto_bloob = None
            self.foto_mime = None
            return
        # sempre compacta; (nota: jpeg/png já são comprimidos, mas gzip ajuda mais)
        self.foto_bloob = gzip.compress(raw_bytes, compresslevel=compresslevel)
        # guarda mime para montar o data URL corretamente
        self.foto_mime = (mime or self.foto_mime or 'image/jpeg')[:50]

    def get_photo_bytes(self) -> bytes | None:
        """
        Retorna bytes descompactados da foto (ou None).
        Aguenta dados antigos não-gzip (backward compatibility).
        """
        if not self.foto_bloob:
            return None
        data = bytes(self.foto_bloob)
        if self._is_gzip(data):
            try:
                return gzip.decompress(data)
            except Exception:
                # se estiver corrompido, retorna como está
                return data
        # dados legados sem gzip
        return data


    
    # Aliases para o front
    @property
    def name(self): return self.nome
    @property
    def species(self): return None  # não temos campo, mas pode mapear da raça
    @property
    def breed(self): return self.raca
    @property
    def dob(self): return None  # se quiser mapear de idade
    @property
    def weight(self): return self.peso
    @property
    def photo(self) -> str | None:
        """
        Data URL para o front (<img src="...">). Descompacta na hora.
        Se não houver foto, retorna None (o JS usa placeholder).
        """
        raw = self.get_photo_bytes()
        if not raw:
            return None
        mime = self.foto_mime or 'image/jpeg'
        b64 = base64.b64encode(raw).decode('utf-8')
        return f"data:{mime};base64,{b64}"
    
    def to_dict(self, with_children: bool = True):
        data = {
            "id": self.id_pet,
            "name": self.name,
            "species": self.species,
            "breed": self.breed,
            "dob": self.dob,
            "weight": self.weight,
            "photo": self.photo,  
            "descricao": self.descricao,
            "adotado": self.adotado,
            "adocao": self.adocao,
            "dono": self.dono,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "deleted": self.deleted,
        }
        if with_children:
            data["vaccines"] = [v.to_dict() for v in getattr(self, "vaccines", [])]
            data["consultations"] = [c.to_dict() for c in getattr(self, "consultations", [])]
            data["uploads"] = []
        return data

    def __repr__(self):
        return f"<Pet id={self.id_pet} nome={self.nome!r}>"
