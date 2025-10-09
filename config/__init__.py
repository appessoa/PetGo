import os
from dotenv import load_dotenv

# raiz do projeto (um nível acima de config/)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, os.getenv("ENV_FILE", ".env")))

def _abs(p: str | None, default_rel: str) -> str:
    p = p or default_rel
    return p if os.path.isabs(p) else os.path.join(BASE_DIR, p)

class Config:
    TEMPLATE_FOLDER = _abs(os.getenv("TEMPLATE_FOLDER", "views"), "views")
    STATIC_FOLDER   = _abs(os.getenv("STATIC_FOLDER",   "public"), "public")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "SQLALCHEMY_DATABASE_URI",
        f"sqlite:///{os.path.join(BASE_DIR,'petgo.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY")
    SEED_ON_STARTUP = os.getenv("SEED_ON_STARTUP", "false").lower() == "true"
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@petgo.com")
    ADMIN_USER  = os.getenv("ADMIN_USER",  "admin")
    ADMIN_PASS  = os.getenv("ADMIN_PASS",  "Admin123!")
    NAME = os.getenv("NAME", "Pedro Augusto Borges Quintas")
    Endereco = os.getenv("Endereco", "Rua Exemplo, 123")
    Telefone = os.getenv("Telefone", "(11) 91234-5678")
    CPF = os.getenv("CPF", "123.456.789-00")
    nome= os.getenv("nome"),
    cnpj = os.getenv("cnpj"),
    endereco_empresa = os.getenv("endereco_empresa"),
    contato = os.getenv("contato")
    logo_b64 = os.getenv("logo_b64")

config = Config()
