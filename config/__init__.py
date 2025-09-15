import os
import sys
from dotenv import load_dotenv

if getattr(sys, 'frozen', False):
    base_dir = os.path.dirname(sys.executable)
else:
    base_dir = os.path.dirname(__file__)

env_file = os.getenv("ENV_FILE", ".env")

load_dotenv(os.path.join(base_dir, env_file))

class config:
    ENV = os.getenv('ENV')
    TEMPLATE_FOLDER = os.getenv("TEMPLATE_FOLDER")
    STATIC_FOLDER = os.getenv("STATIC_FOLDER")
