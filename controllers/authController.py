
from flask import flash, jsonify, redirect, render_template, request, session, url_for
from flask_bcrypt import Bcrypt
from models.userModel import User
bcrypt = Bcrypt()

class authController():

    @staticmethod
    def login():
        username = request.form.get("username")
        password = request.form.get("password")

        try:
            user = User.query.filter_by(username=username).first()
            if not user or not bcrypt.check_password_hash(user.password, password):
                print("Erro ao fazer login:", "Credenciais inválidas")
                jsonify({"error": "Credenciais inválidas"}), 401
                return redirect(url_for("auth.login_form"))

            # salva id e username na sessão
            session["user_id"] = user.id_user
            session["username"] = user.username
            return redirect(url_for("front.index"))
        except Exception as e:
            print("Erro ao fazer login:", e)
            jsonify({"error": "Erro ao fazer login"}), 500
            return redirect(url_for("auth.login_form"))
        
    @staticmethod
    def me():
        if "user_id" in session:
            return jsonify({
                "logged_in": True,
                "username": session["username"]
            })
        return jsonify({"logged_in": False})
    
    @staticmethod
    def logout():
        """Remove dados da sessão e volta para a home"""
        session.clear()
        flash("Você saiu da sua conta.", "info")
        return redirect(url_for("front.index"))

    @staticmethod
    def login_form():
        return render_template("login.html")