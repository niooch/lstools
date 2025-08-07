from import db

class OAuth2Client(db.Model):
    __tablename__ = 'oauth2_clients'
    id = db.Column(db.Integer, primary_key=True)
