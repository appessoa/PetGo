from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.utils import ImageReader
from io import BytesIO
from decimal import Decimal
from datetime import datetime
import gzip

def _fmt_money(v) -> str:
    if isinstance(v, Decimal):
        v = float(v)
    if v is None:
        v = 0.0
    s = f"{v:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")

def _get_logo_image(companie_obj):
    raw_gz = getattr(companie_obj, "imagem_bloob", None)
    if not raw_gz:
        return None
    try:
        raw = gzip.decompress(raw_gz)
        return ImageReader(BytesIO(raw))
    except Exception:
        return None

def _as_str(x, default=""):
    return str(x) if x is not None else default


def gerar_pdf_recibo_venda(
    companie_obj,
    venda_dict: dict,
    titulo_recibo="RECIBO DE VENDA",
    observacoes_finais="Documento gerado para conferência interna do administrador."
):
    # -------- Empresa
    empresa_nome = _as_str(getattr(companie_obj, "nome", "") or "")
    empresa_cnpj = _as_str(getattr(companie_obj, "cnpj", "") or "-")
    empresa_end  = _as_str(getattr(companie_obj, "endereco", "") or "-")
    empresa_num  = _as_str(getattr(companie_obj, "numero", "") or "-")

    # -------- Venda
    numero_recibo = venda_dict.get("id") or venda_dict.get("id_pedido") or 0
    created_raw   = venda_dict.get("created_at")
    try:
        created_dt = datetime.fromisoformat(created_raw) if created_raw else datetime.now()
    except Exception:
        created_dt = datetime.now()
    data_emissao  = created_dt.strftime("%d/%m/%Y %H:%M")
    status_venda  = _as_str(venda_dict.get("status", ""))
    total_final   = Decimal(str(venda_dict.get("total", 0) or 0))

    # -------- Usuário (comprador) — novo
    user_block   = venda_dict.get("user") or {}
    comprador_nm = _as_str(user_block.get("name") or venda_dict.get("user_name") or "-")
    comprador_em = _as_str(user_block.get("email") or venda_dict.get("user_email") or "-")
    comprador_doc = _as_str(user_block.get("cpf") or "-")
    comprador_tel = _as_str(user_block.get("phone") or "-")

    addr = user_block.get("address") or {}
    # prioriza full_address se existir — senão, monta uma linha simples
    full_addr = _as_str(
        addr.get("full_address") or
        ", ".join(filter(None, [
            addr.get("logradouro"),
            addr.get("numero"),
            addr.get("bairro"),
            addr.get("cidade"),
            addr.get("estado"),
        ])) or "-", "-"
    )

    # Responsável/admin (se quiser manter no recibo)
    resp_nome  = _as_str(venda_dict.get("user_name") or "-")
    resp_email = _as_str(venda_dict.get("user_email") or "-")

    # -------- Itens
    itens = venda_dict.get("items") or []
    linhas_itens = []
    subtotal_calc = Decimal("0")
    for it in itens:
        nome = _as_str(it.get("produto_nome") or it.get("descricao") or "-")
        unit = Decimal(str(it.get("preco_unit", 0) or 0))
        qtd  = int(it.get("qtd") or 0)
        sub  = unit * qtd
        subtotal_calc += sub
        linhas_itens.append([nome, str(qtd), f"R$ {_fmt_money(unit)}", f"R$ {_fmt_money(sub)}"])

    # -------- PDF setup
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    margin_left, margin_right = 20 * mm, 20 * mm
    max_width = largura - margin_left - margin_right
    cursor_y  = altura - 20 * mm
    right_x   = largura - margin_right

    # Estilos
    style_normal = ParagraphStyle(name="Normal", fontName="Helvetica", fontSize=9, leading=12, alignment=TA_LEFT, textColor=colors.black)
    style_section_title = ParagraphStyle(name="SectionTitle", parent=style_normal, fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=colors.HexColor("#2563eb"))
    style_right  = ParagraphStyle(name="Right", parent=style_normal, alignment=TA_RIGHT)
    style_total_value = ParagraphStyle(name="TotalValue", parent=style_normal, alignment=TA_RIGHT, textColor=colors.HexColor("#2563eb"), fontName="Helvetica-Bold", fontSize=11)

    # -------- Cabeçalho
    logo_img = _get_logo_image(companie_obj)
    left_x = margin_left
    if logo_img:
        c.drawImage(logo_img, left_x, cursor_y - 20 * mm, width=22 * mm, height=22 * mm, preserveAspectRatio=True, mask="auto")
        text_block_x = left_x + 24 * mm
    else:
        text_block_x = left_x

    c.setFont("Helvetica-Bold", 10)
    c.drawString(text_block_x, cursor_y - 6, empresa_nome)
    c.setFont("Helvetica", 8)
    c.drawString(text_block_x, cursor_y - 18, f"CNPJ: {empresa_cnpj}")
    c.drawString(text_block_x, cursor_y - 28, f"{empresa_end}, Nº {empresa_num}")

    meta_lines = [
        f"{titulo_recibo} Nº {int(numero_recibo):04d}",
        f"Data/Hora: {data_emissao}",
        f"Status: {status_venda}",
    ]
    c.setFont("Helvetica", 8)
    tw = max(c.stringWidth(l, "Helvetica", 8) for l in meta_lines)
    meta_x = right_x - tw
    ty = cursor_y - 6
    for l in meta_lines:
        c.drawString(meta_x, ty, l)
        ty -= 10

    cursor_y -= 30 * mm
    c.setStrokeColor(colors.HexColor("#2563eb")); c.setLineWidth(1)
    c.line(margin_left, cursor_y, right_x, cursor_y)
    cursor_y -= 8

    # -------- Dados do Comprador (novo bloco)
    p_title = Paragraph("Dados do Comprador", style_section_title)
    w, h = p_title.wrapOn(c, max_width, 100)
    p_title.drawOn(c, margin_left, cursor_y - h); cursor_y -= (h + 4)

    comprador_text = (
        f"<b>Nome:</b> {comprador_nm}<br/>"
        f"<b>E-mail:</b> {comprador_em}<br/>"
        f"<b>CPF:</b> {comprador_doc}<br/>"
        f"<b>Telefone:</b> {comprador_tel}<br/>"
        f"<b>Endereço:</b> {full_addr}"
    )
    p_cli = Paragraph(comprador_text, style_normal)
    w, h = p_cli.wrapOn(c, max_width, 200)
    p_cli.drawOn(c, margin_left, cursor_y - h)
    cursor_y -= (h + 10)

    # -------- Responsável (Admin) – opcional: exibe só se tiver nome/email
    if resp_nome or resp_email:
        p_resp_title = Paragraph("Responsável (Admin)", style_section_title)
        w, h = p_resp_title.wrapOn(c, max_width, 100)
        p_resp_title.drawOn(c, margin_left, cursor_y - h); cursor_y -= (h + 4)

        resp_text = f"<b>Nome:</b> {resp_nome} &nbsp;&nbsp; <b>E-mail:</b> {resp_email}"
        p_resp = Paragraph(resp_text, style_normal)
        w, h = p_resp.wrapOn(c, max_width, 80)
        p_resp.drawOn(c, margin_left, cursor_y - h)
        cursor_y -= (h + 12)

    # -------- Itens
    p_itens_title = Paragraph("Itens da Venda", style_section_title)
    w, h = p_itens_title.wrapOn(c, max_width, 100)
    if cursor_y - h < 60 * mm:
        c.showPage(); cursor_y = altura - 20 * mm
    p_itens_title.drawOn(c, margin_left, cursor_y - h); cursor_y -= (h + 4)

    table_data = [["Produto/Serviço", "Qtd", "Unitário (R$)", "Subtotal (R$)"]] + linhas_itens
    col_widths = [max_width * 0.50, max_width * 0.10, max_width * 0.15, max_width * 0.25]
    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('FONT', (0,0), (-1,0), 'Helvetica-Bold', 9),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f9fafb")),
        ('ALIGN', (1,1), (-1,-1), 'RIGHT'),
        ('ALIGN', (0,1), (0,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor("#d1d5db")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#d1d5db")),
    ]))
    tw, th = tbl.wrapOn(c, max_width, cursor_y - 30 * mm)
    if cursor_y - th < 60 * mm:
        c.showPage(); cursor_y = altura - 20 * mm
    tbl.drawOn(c, margin_left, cursor_y - th)
    cursor_y -= (th + 16)

    # -------- Totais
    if cursor_y < 70 * mm:
        c.showPage(); cursor_y = altura - 20 * mm
    totais_rows = [
        [Paragraph("Subtotal calculado:", style_normal), Paragraph(f"R$ {_fmt_money(subtotal_calc)}", style_right)],
        [Paragraph("<b>Total (registrado):</b>", style_normal), Paragraph(f"<b>R$ {_fmt_money(total_final)}</b>", style_total_value)],
    ]
    totais_tbl = Table(totais_rows, colWidths=[max_width * 0.35, max_width * 0.20], hAlign='RIGHT')
    totais_tbl.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOX', (0,0), (-1,-1), 0, colors.white),
        ('INNERGRID', (0,0), (-1,-1), 0, colors.white),
        ('FONT', (0,-1), (-1,-1), 'Helvetica-Bold', 10),
        ('TEXTCOLOR', (0,-1), (-1,-1), colors.HexColor("#2563eb")),
    ]))
    tw_tot, th_tot = totais_tbl.wrapOn(c, max_width, 9999)
    totais_x = margin_left + max_width - tw_tot
    totais_tbl.drawOn(c, totais_x, cursor_y - th_tot)
    cursor_y -= (th_tot + 20)

    # -------- Rodapé
    c.setStrokeColor(colors.HexColor("#e5e7eb")); c.setLineWidth(0.5)
    c.line(margin_left, 20 * mm, right_x, 20 * mm)
    c.setFont("Helvetica", 7); c.setFillColor(colors.HexColor("#6b7280"))
    c.drawRightString(right_x, 17 * mm, f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")

    c.showPage(); c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
