from flask import Blueprint, render_template

from config.decorators import login_required, admin_required


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

@login_required
@front_bp.route('/PetGoHealth')
def health():
    return render_template('PetGoHealth.html')

@front_bp.route('/PetGoFormularioAdocao')
def formularioAdocao():
    return render_template('PetGoFormularioAdocao.html')

@front_bp.route('/PetGoProdutosV2')
def produtosV2():
    return render_template('PetGoProdutosV2.html')

@login_required
@front_bp.route('/UserPage')
def userPage():
    return render_template('PetGoUserPage.html')

@front_bp.route('/cadastro')
def cadastro():
    return render_template('cadastro.html')

@front_bp.route('/adminPage')
@admin_required
def adminPage():
    return render_template('admin.html')

@front_bp.route('/carrinho')
@login_required
def carrinho():
    return render_template('carrinho.html')

@front_bp.route('/checkout')
@login_required
def checkout():
    return render_template('pagamento.html')

@front_bp.route('/orderConfirmed')
@login_required
def historico():
    return render_template('confirmacao.html')

@front_bp.route('/vet_page')
@admin_required
def veterinarios():
    return render_template('veterinarios.html')

@front_bp.route('/produtosadmin')
@admin_required
def produtosadmin():
    return render_template('produtosadmin.html')

@front_bp.route('/histvendas')
@admin_required
def histvendas():
    return render_template('histvendas.html')

@front_bp.route('/detail')
def detail_product():
    return render_template('detalheprod.html')

@login_required
@front_bp.route('/adress/cadastro')
def endereco_cadastro():
    return render_template('endereco.html')

@login_required
@front_bp.route('/adress/')
def endereco():
    return render_template('meusendereco.html')

@login_required
@front_bp.route('/adress/cadastro/<int:addr_id>', methods=['GET'])
def adress_cadastro(addr_id=None):
        return render_template('endereco.html', addr_id=addr_id)

@front_bp.route('/vetDashboard')
@login_required
def vetDashboard():
    return render_template('vetmed.html')