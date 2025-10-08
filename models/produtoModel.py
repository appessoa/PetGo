import base64
from datetime import datetime
import gzip
from config.db import db
class produto(db.Model):
    """ Modelo para tabela de produtos
    
    id_produto: int - PK
    nome: str - Nome do produto
    descricao: str - Descrição do produto
    preco: float - Preço do produto
    estoque: int - Quantidade em estoque
    categoria: str - Categoria do produto
    imagem_bloob: bytes - Imagem do produto em formato binário
    is_active: bool - Indica se o produto está ativo
    created_at: datetime - Timestamp de criação do registro
    updated_at: datetime - Timestamp da última atualização do registro

    """
    __tablename__ = 'produtos'

    id_produto = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(100), nullable=False)
    descricao = db.Column(db.String(255), nullable=True)
    preco = db.Column(db.Float, nullable=False)
    estoque = db.Column(db.Integer, nullable=False)
    categoria = db.Column(db.String(100), nullable=True)
    especie = db.Column(db.String(20), nullable=False)
    imagem_bloob = db.Column(db.LargeBinary, nullable=True)
    imagem_mime = db.Column(db.String(20), nullable = True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted = db.Column(db.Integer, nullable = False, default = False)

    @staticmethod
    def _is_gzip(data: bytes) -> bool:
        # assinatura do gzip: 1f 8b
        return isinstance(data, (bytes, bytearray)) and len(data) >= 2 and data[:2] == b'\x1f\x8b'

    def set_photo_bytes(self, raw_bytes: bytes, mime: str | None = None, compresslevel: int = 6):
        """
        Salva foto compactada com gzip em foto_bloob.
        - raw_bytes: bytes originais do arquivo (jpg/png)
        - mime: 'image/jpeg' | 'image/png' 
        """
        if not raw_bytes:
            self.imagem_bloob = None
            self.imagem_mime = None
            return
        # sempre compacta; (nota: jpeg/png já são comprimidos, mas gzip ajuda mais)
        self.imagem_bloob = gzip.compress(raw_bytes, compresslevel=compresslevel)
        # guarda mime para montar o data URL corretamente
        self.imagem_mime = (mime or self.imagem_mime or 'image/jpeg')[:50]

    def get_photo_bytes(self) -> bytes | None:
        """
        Retorna bytes descompactados da foto (ou None).
        Aguenta dados antigos não-gzip (backward compatibility).
        """
        if not self.imagem_bloob:
            return None
        data = bytes(self.imagem_bloob)
        if self._is_gzip(data):
            try:
                return gzip.decompress(data)
            except Exception:
                # se estiver corrompido, retorna como está
                return data
        # dados legados sem gzip
        return data
    @property
    def photo(self) -> str | None:
        """
        Data URL para o front (<img src="...">). Descompacta na hora.
        Se não houver foto, retorna None (o JS usa placeholder).
        """
        raw = self.get_photo_bytes()
        if not raw:
            return None
        mime = self.imagem_mime or 'image/jpeg'
        b64 = base64.b64encode(raw).decode('utf-8')
        return f"data:{mime};base64,{b64}"
    
    def to_dict(self):
        data = {
            "id": self.id_produto,
            "nome": self.nome,
            "preco": self.preco,
            "descricao":self.descricao,
            "categoria": self.categoria,
            "especie": self.especie,
            "estoque": self.estoque,
            "imagem": self.photo
        }
        return data