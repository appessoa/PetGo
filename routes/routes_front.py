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

@front_bp.route('/PetGoHotelzinho')
def hotelzinho():
    return render_template('PetGoHotelzinho.html')
@front_bp.route('/PetGoAgendamento')
def agendamento():
    return render_template('PetGoAgendamento.html')
@front_bp.route('/PetGoHealth')
def health():
    return render_template('PetGoHealth.html')
@front_bp.route('/PetGoFormularioAdocao')
def formularioAdocao():
    return render_template('PetGoFormularioAdocao.html')
@front_bp.route('/PetGoProdutosV2')
def produtosV2():
    return render_template('PetGoProdutosV2.html')
@front_bp.route('/UserPage')
def userPage():
    return render_template('PetGoUserPage.html')