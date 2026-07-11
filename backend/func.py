from datetime import datetime, timedelta
from typing import Optional, List, Dict
from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings
import pathlib
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pymongo import MongoClient
from bson import ObjectId


# ── Config ───────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    DATABASE_URL: str = "mongodb://localhost:27017"
    SECRET_KEY: str = "changeme-generate-a-real-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DB_NAME: str = "collabhub"
    FRONTEND_ORIGIN: str = "http://localhost:5500,http://127.0.0.1:5500"
    model_config = {"env_file": str(pathlib.Path(__file__).parent / ".env")}

settings = Settings()


# ── Database ─────────────────────────────────────────────────────────────────

client = MongoClient(settings.DATABASE_URL)
db = client[settings.DB_NAME]

users_col = db["users"]
skills_col = db["skills"]
user_skills_col = db["user_skills"]
activities_col = db["activities"]
activity_skills_col = db["activity_skills"]
join_requests_col = db["join_requests"]
messages_col = db["messages"]


def get_db():
    return db


# ── Auto-increment helper ────────────────────────────────────────────────────

def next_id(counter_name: str) -> int:
    result = db["counters"].find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return result["seq"]


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    college: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    security_question: Optional[str] = None
    security_answer: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    onboarding_complete: Optional[bool] = None
    skills: Optional[List[dict]] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    college: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    security_question: Optional[str] = None
    onboarding_complete: Optional[bool] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class SkillCreate(BaseModel):
    skill_name: str

class SkillResponse(BaseModel):
    id: int
    skill_name: str
    model_config = {"from_attributes": True}

class UserSkillCreate(BaseModel):
    skill_id: int
    level: int

class UserSkillResponse(BaseModel):
    skill_id: int
    skill_name: str
    level: int
    model_config = {"from_attributes": True}

class ActivitySkillCreate(BaseModel):
    skill_id: int
    required_level: int

class ActivitySkillResponse(BaseModel):
    skill_id: int
    skill_name: str
    required_level: int
    model_config = {"from_attributes": True}

class CreatorInfo(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    model_config = {"from_attributes": True}

class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    mode: str
    max_members: int = 5
    deadline: datetime
    skills: List[ActivitySkillCreate] = []

class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    mode: Optional[str] = None
    max_members: Optional[int] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    skills: Optional[List[ActivitySkillCreate]] = None

class ActivityResponse(BaseModel):
    id: int
    creator_id: int
    title: str
    description: Optional[str] = None
    category: str
    mode: str
    max_members: int
    deadline: datetime
    status: str
    created_at: Optional[datetime] = None
    skills: List[ActivitySkillResponse] = []
    members_count: int = 0
    creator: Optional[CreatorInfo] = None
    model_config = {"from_attributes": True}

class JoinRequestResponse(BaseModel):
    id: int
    activity_id: int
    user_id: int
    status: str
    created_at: Optional[datetime] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    model_config = {"from_attributes": True}

class JoinRequestAction(BaseModel):
    status: str

class MessageCreate(BaseModel):
    message: str

class MessageResponse(BaseModel):
    id: int
    activity_id: int
    user_id: int
    user_name: Optional[str] = None
    message: str
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Auth ─────────────────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    _db=Depends(get_db),
):
    cred_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise cred_exception
    except JWTError:
        raise cred_exception
    user = users_col.find_one({"id": int(user_id)})
    if user is None:
        raise cred_exception
    return user


# ── Eligibility Engine (PRD §12) ─────────────────────────────────────────────

def calculate_match_score(user_id: int, activity_id: int) -> float:
    required_skills = list(activity_skills_col.find({"activity_id": activity_id}))
    if not required_skills:
        return 100.0
    scores: List[float] = []
    for req in required_skills:
        us = user_skills_col.find_one({"user_id": user_id, "skill_id": req["skill_id"]})
        if us:
                scores.append(min(us["level"] / req["required_level"] * 100, 100.0) if req["required_level"] else 100.0)
        else:
            scores.append(0.0)
    return sum(scores) / len(scores)

def check_eligibility(user_id: int, activity_id: int) -> Dict:
    required_skills = list(activity_skills_col.find({"activity_id": activity_id}))
    details: List[Dict] = []
    for req in required_skills:
        us = user_skills_col.find_one({"user_id": user_id, "skill_id": req["skill_id"]})
        user_level = us["level"] if us else 0
        match_pct = min(user_level / req["required_level"] * 100, 100.0) if req["required_level"] else 100.0
        skill = skills_col.find_one({"id": req["skill_id"]})
        details.append({
            "skill_id": req["skill_id"],
            "skill_name": skill["skill_name"] if skill else "Unknown",
            "required_level": req["required_level"],
            "user_level": user_level,
            "match_pct": round(match_pct, 2),
        })
    overall = sum(s["match_pct"] for s in details) / len(details) if details else 100.0
    return {"overall_score": round(overall, 2), "match_score": round(overall / 100, 4), "skills": details}
