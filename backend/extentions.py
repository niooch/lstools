from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_oauth2 import AuthorizationServer

db = SQLAlchemy()
authorization = AuthorizationServer()
require_oauth = ResourceProtector()
