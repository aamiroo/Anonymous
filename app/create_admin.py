"""Utility for creating an initial admin account."""


from pwdlib import PasswordHash

from .database import Base, SessionLocal, engine
from .models import Admin

pass_hash = PasswordHash.recommended()

def create_admin():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        username = input("Admin username: ")
        password = input("Admin password: ")

        existing_admin =(
        db.query(Admin)
        .filter(Admin.user_name == username)
        .first()
        )

        if existing_admin:
            print("Admin already exists.")
            return

        admin = Admin(
            user_name = username,
            pass_hash = pass_hash.hash(password),
    
        )

        db.add(admin)
        db.commit()

        print("Admin created successfully")

    finally:
        db.close()

if __name__ == "__main__":
    create_admin()