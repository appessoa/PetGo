from flask import jsonify, redirect, render_template, request, session, url_for
from flask_bcrypt import Bcrypt
from models.userModel import User
from service.userService import get_user_by_email, get_user_by_username , try_vet_by_username
bcrypt = Bcrypt()

class authController():

    @staticmethod
    def login():
        username = request.form.get("username")
        password = request.form.get("password")

        try:
            user = get_user_by_username(username)
            if not user:
                user = get_user_by_email(username)
            if not user:
                user= try_vet_by_username(username)
                if user:
                    session["is_vet"] = True
            if not user:
                return jsonify({"error": "Usuario inexistente"}), 401

            if not bcrypt.check_password_hash(user.password, password):
                print("Erro ao fazer login:", "Credenciais inválidas")
                return jsonify({"error": "Credenciais inválidas"}), 401


            # salva id e username na sessão
            session["user_id"] = user.id_user
            session["username"] = user.username
            session["is_admin"] = user.is_admin

            if session.get("is_vet"):
                return redirect(url_for("front.vetDashboard"))
            if user.is_admin:
                return redirect(url_for("front.adminPage"))
            return redirect(url_for("front.index"))
        except Exception as e:
            print("Erro ao fazer login:", e)
            jsonify({"error": "Erro ao fazer login"}), 500
            return redirect(url_for("auth.login_form"))
        
    @staticmethod
    def me():
        if "user_id" in session:
            print(session)
            return jsonify({
                "logged_in": True,
                "username": session["username"],
                "is_admin": session.get("is_admin", False),
                "is_vet": session.get("is_vet", False)
            })
        return jsonify({"logged_in": False})
    
    @staticmethod
    def logout():
        """Remove dados da sessão e volta para a home"""
        session.clear()
        return redirect(url_for("front.index"))

    @staticmethod
    def login_form():
        return render_template("login.html")