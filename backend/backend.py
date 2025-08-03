from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['OAUTH2_REFRESH_TOKEN_GENERATOR'] = True
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

#print the secret key and database URI for debugging purposes
print(f"Secret Key: {app.config['SECRET_KEY']}")
print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")

db = SQLAlchemy(app)

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    def __repr__(self):
        return f"<Role id={self.id} name={self.name}>"

if __name__ == '__main__':
    with app.app_context():
        try:
            roles = Role.query.all()
            if roles:
                print("Roles in the database:")
                for role in roles:
                    print(role)
            else:
                print("No roles found in the database.")
        except Exception as e:
            print(f"Error querying roles: {e}")

