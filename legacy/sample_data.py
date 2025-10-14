from app import db, User

a=User("admin","admin",True)
b=User("man","man",False,True)
db.session.add_all([a,b])
db.session.commit()
