<<<<<<< HEAD
# models.py - Модели базы данных
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(200))
    role = db.Column(db.String(50), default='manager')  # admin, manager, master
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    projects = db.relationship('Project', backref='user', lazy=True)
    
    def get_id(self):
        return str(self.id)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Информация о заказчике
    client_name = db.Column(db.String(200))
    client_phone = db.Column(db.String(50))
    client_email = db.Column(db.String(120))
    
    # Параметры заказа
    mode = db.Column(db.String(50), default='engraving')  # engraving, photo
    shape = db.Column(db.String(50), default='none')
    stone = db.Column(db.String(50), default='classic')
    texture = db.Column(db.String(200))
    
    # Параметры обработки
    blur = db.Column(db.Float, default=3.0)
    depth = db.Column(db.Float, default=0.9)
    halo = db.Column(db.Integer, default=35)
    contrast = db.Column(db.Float, default=3.0)
    brightness = db.Column(db.Integer, default=0)
    
    # Параметры позиции
    scale = db.Column(db.Float, default=0.8)
    offset_x = db.Column(db.Float, default=0.0)
    offset_y = db.Column(db.Float, default=0.0)
    offset_z = db.Column(db.Float, default=-0.1)
    
    # Кадрирование
    crop_top = db.Column(db.Float, default=2.0)
    crop_bottom = db.Column(db.Float, default=2.0)
    crop_left = db.Column(db.Float, default=2.0)
    crop_right = db.Column(db.Float, default=2.0)
    
    # Фото-настройки
    photo_mode = db.Column(db.String(20), default='color')
    photo_brightness = db.Column(db.Integer, default=0)
    photo_contrast = db.Column(db.Float, default=1.0)
    
    # Данные изображений (base64)
    original_image = db.Column(db.Text)  # base64 оригинал
    enhanced_image = db.Column(db.Text)  # base64 улучшенное
    engraving_image = db.Column(db.Text)  # base64 результат
    mask_image = db.Column(db.Text)  # base64 маска
    
    # Статус
    status = db.Column(db.String(50), default='draft')  # draft, processing, ready, printed, delivered
    
    # Даты
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    printed_at = db.Column(db.DateTime)
    delivered_at = db.Column(db.DateTime)
    
    # Комментарии
    notes = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'client_name': self.client_name,
            'client_phone': self.client_phone,
            'mode': self.mode,
            'stone': self.stone,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
=======
# models.py - Модели базы данных
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(200))
    role = db.Column(db.String(50), default='manager')  # admin, manager, master
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    projects = db.relationship('Project', backref='user', lazy=True)
    
    def get_id(self):
        return str(self.id)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Информация о заказчике
    client_name = db.Column(db.String(200))
    client_phone = db.Column(db.String(50))
    client_email = db.Column(db.String(120))
    
    # Параметры заказа
    mode = db.Column(db.String(50), default='engraving')  # engraving, photo
    shape = db.Column(db.String(50), default='none')
    stone = db.Column(db.String(50), default='classic')
    texture = db.Column(db.String(200))
    
    # Параметры обработки
    blur = db.Column(db.Float, default=3.0)
    depth = db.Column(db.Float, default=0.9)
    halo = db.Column(db.Integer, default=35)
    contrast = db.Column(db.Float, default=3.0)
    brightness = db.Column(db.Integer, default=0)
    
    # Параметры позиции
    scale = db.Column(db.Float, default=0.8)
    offset_x = db.Column(db.Float, default=0.0)
    offset_y = db.Column(db.Float, default=0.0)
    offset_z = db.Column(db.Float, default=-0.1)
    
    # Кадрирование
    crop_top = db.Column(db.Float, default=2.0)
    crop_bottom = db.Column(db.Float, default=2.0)
    crop_left = db.Column(db.Float, default=2.0)
    crop_right = db.Column(db.Float, default=2.0)
    
    # Фото-настройки
    photo_mode = db.Column(db.String(20), default='color')
    photo_brightness = db.Column(db.Integer, default=0)
    photo_contrast = db.Column(db.Float, default=1.0)
    
    # Данные изображений (base64)
    original_image = db.Column(db.Text)  # base64 оригинал
    enhanced_image = db.Column(db.Text)  # base64 улучшенное
    engraving_image = db.Column(db.Text)  # base64 результат
    mask_image = db.Column(db.Text)  # base64 маска
    
    # Статус
    status = db.Column(db.String(50), default='draft')  # draft, processing, ready, printed, delivered
    
    # Даты
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    printed_at = db.Column(db.DateTime)
    delivered_at = db.Column(db.DateTime)
    
    # Комментарии
    notes = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'client_name': self.client_name,
            'client_phone': self.client_phone,
            'mode': self.mode,
            'stone': self.stone,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
>>>>>>> 8e734ba9ce21e78239c78bba23747082f52e579a
        }