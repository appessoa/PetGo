# seeds.py
import gzip
import mimetypes
from config.db import db
from models.produtoModel import produto
from models.userModel import User
from flask_bcrypt import Bcrypt
from models.companieModel import companie

bcrypt = Bcrypt()
def carregar_imagem_gzip_e_mime(path_img: str) -> tuple[bytes, str]:
    """
    Lê uma imagem do disco, retorna (bytes_gzip, mime_type).
    Ex.: (b'...', 'image/png')
    """
    # lê os bytes da imagem original
    with open(path_img, "rb") as f:
        raw_bytes = f.read()

    # compacta em gzip (é isso que está indo pro BLOB no seu print)
    gz_bytes = gzip.compress(raw_bytes)

    # tenta descobrir o mime_type pelo nome do arquivo
    mime_type, _ = mimetypes.guess_type(path_img)
    if mime_type is None:
        mime_type = "application/octet-stream"  # fallback

    return gz_bytes, mime_type

def get_or_create(model, defaults=None, **filters):
    """Idempotente: busca por filtros; se não existir, cria com defaults."""
    instance = model.query.filter_by(**filters).first()
    if instance:
        return instance, False
    params = {**filters, **(defaults or {})}
    instance = model(**params)
    db.session.add(instance)
    return instance, True

def seed_db(config):

       # Admin (apenas se não existe)
    admin = User.query.filter_by(email="admin@admin.com").first()
    if not admin:
        hashed = bcrypt.generate_password_hash("001305").decode("utf-8")
        admin = User(username="Admin", email="admin@admin.com", password=hashed, nome="Admin", is_active=True, is_admin=True)
        db.session.add(admin)

    Companie = companie.query.filter_by(nome="PetGo").first() 
    if not Companie:
        imagem,mime = carregar_imagem_gzip_e_mime("app/logo_paw_1024.png")
        Companie = companie(
            nome="PetGo",
            endereco="Rua Exemplo, 123, Cidade, País",
            numero="+55 11 91234-5678",
            cnpj="12.345.678/0001-90",
            imagem_bloob=imagem,
            imagem_mime=mime,
            deleted=False
        )
        db.session.add(Companie)

    

    db.session.commit()
