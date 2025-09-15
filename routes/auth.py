from flask import Blueprint, request, redirect, url_for, render_template, session, flash
from models.userModel import User
from config.db import db
from flask_bcrypt import Bcrypt
from flask import jsonify, session

bcrypt = Bcrypt()
auth_bp = Blueprint("auth", __name__)

@auth_bp.get("/login")
def login_form():
    return render_template("login.html")

@auth_bp.post("/login")
def login():
    email = request.form.get("email")
    password = request.form.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        flash("Credenciais inválidas", "danger")
        return redirect(url_for("auth.login_form"))

    # salva id e username na sessão
    session["user_id"] = user.id_user
    session["username"] = user.username
    return redirect(url_for("front.index"))


@auth_bp.get("/me")
def me():
    if "user_id" in session:
        return jsonify({
            "logged_in": True,
            "username": session["username"]
        })
    return jsonify({"logged_in": False})

@auth_bp.get("/logout")
def logout():
    """Remove dados da sessão e volta para a home"""
    session.clear()
    flash("Você saiu da sua conta.", "info")
    return redirect(url_for("front.index"))