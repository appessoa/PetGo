from flask import Blueprint, render_template


front_bp = Blueprint('front',__name__)

@front_bp.route('/')
def index():
    return render_template('index.html')

@front_bp.route('/produtos')
def produtos():
    return render_template('produtos.html')

@front_bp.route('/servicos')
def servicos():
    return render_template('servicos.html')
@front_bp.route('/PetGoAdocao')
def adocao():
    return render_template('PetGoAdocao.html')