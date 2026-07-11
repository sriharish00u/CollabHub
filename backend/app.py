from typing import List
from datetime import datetime
import os
import logging

from pydantic import BaseModel, EmailStr
from fastapi import FastAPI, Depends, HTTPException, Query, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError

from func import (
    db, get_db, settings,
    users_col, skills_col, user_skills_col, activities_col,
    activity_skills_col, join_requests_col, messages_col,
    next_id,
    UserCreate, UserLogin, UserUpdate, UserResponse,
    UserSkillCreate, UserSkillResponse,
    SkillCreate, SkillResponse,
    ActivityCreate, ActivityUpdate, ActivityResponse, ActivitySkillResponse,
    CreatorInfo,
    JoinRequestResponse, JoinRequestAction,
    MessageCreate, MessageResponse,
    hash_password, verify_password, create_access_token, get_current_user,
    check_eligibility,
)

app = FastAPI(title="CollabHub API", version="0.1.0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("collabhub")

allowed_origins = [o.strip() for o in settings.FRONTEND_ORIGIN.split(",") if o.strip()]
logger.info(f"CORS allowed_origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f">>> {request.method} {request.url.path} Origin={request.headers.get('origin', 'none')}")
    response = await call_next(request)
    logger.info(f"<<< {request.method} {request.url.path} -> {response.status_code}")
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def startup():
    logger.info("Starting CollabHub API...")
    logger.info(f"FRONTEND_ORIGIN raw value: {settings.FRONTEND_ORIGIN!r}")
    users_col.create_index("email", unique=True)
    logger.info("MongoDB unique index on users.email created")


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate):
    logger.info(f"Register request: email={payload.email}")
    existing = users_col.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user_id = next_id("users")
    user = {
        "id": user_id,
        "name": payload.name,
        "email": payload.email,
        "password": hash_password(payload.password),
        "college": payload.college,
        "department": payload.department,
        "year": payload.year,
        "bio": None,
        "photo_url": None,
        "security_question": payload.security_question,
        "security_answer_hash": hash_password(payload.security_answer) if payload.security_answer else None,
        "onboarding_complete": False,
        "created_at": datetime.utcnow(),
    }
    try:
        users_col.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    token = create_access_token(data={"sub": str(user_id)})
    return {"access_token": token, "token_type": "bearer", "user": UserResponse(**user).model_dump()}


@app.post("/auth/login")
def login(payload: UserLogin):
    logger.info(f"Login request: email={payload.email}")
    user = users_col.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(data={"sub": str(user["id"])})
    return {"access_token": token, "token_type": "bearer", "user": UserResponse(**user).model_dump()}


class ForgotPasswordVerify(BaseModel):
    email: EmailStr
    security_answer: str

class ForgotPasswordReset(BaseModel):
    email: EmailStr
    security_answer: str
    new_password: str


@app.post("/auth/forgot-password/verify")
def forgot_password_verify(payload: ForgotPasswordVerify):
    user = users_col.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email")
    if not user.get("security_answer_hash"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No security question set for this account")
    if not verify_password(payload.security_answer, user["security_answer_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect answer")
    return {"valid": True}


@app.post("/auth/forgot-password/reset")
def forgot_password_reset(payload: ForgotPasswordReset):
    user = users_col.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email")
    if not user.get("security_answer_hash"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No security question set for this account")
    if not verify_password(payload.security_answer, user["security_answer_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect answer")
    users_col.update_one({"id": user["id"]}, {"$set": {"password": hash_password(payload.new_password)}})
    return {"success": True}


# ── Users ────────────────────────────────────────────────────────────────────

@app.get("/users/me", response_model=UserResponse)
def get_profile(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)


@app.put("/users/me", response_model=UserResponse)
def update_profile(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    updates = {}
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "skills":
            continue
        if v is not None:
            updates[k] = v
    if updates:
        users_col.update_one({"id": current_user["id"]}, {"$set": updates})
    user = users_col.find_one({"id": current_user["id"]})
    return UserResponse(**user)


@app.get("/users/me/member-activities", response_model=List[ActivityResponse])
def get_my_member_activities(current_user: dict = Depends(get_current_user)):
    approved_jrs = list(join_requests_col.find({"user_id": current_user["id"], "status": "Approved"}))
    act_ids = [jr["activity_id"] for jr in approved_jrs]
    if not act_ids:
        return []
    activities = list(activities_col.find({"id": {"$in": act_ids}}))
    return [_act_resp(a) for a in activities]


@app.get("/users/me/skills", response_model=List[UserSkillResponse])
def get_my_skills(current_user: dict = Depends(get_current_user)):
    rows = list(user_skills_col.find({"user_id": current_user["id"]}))
    result = []
    for us in rows:
        skill = skills_col.find_one({"id": us["skill_id"]})
        result.append(UserSkillResponse(skill_id=us["skill_id"], skill_name=skill["skill_name"] if skill else "Unknown", level=us["level"]))
    return result


@app.post("/users/me/skills", response_model=UserSkillResponse, status_code=status.HTTP_201_CREATED)
def add_skill(payload: UserSkillCreate, current_user: dict = Depends(get_current_user)):
    skill = skills_col.find_one({"id": payload.skill_id})
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    if payload.level < 1 or payload.level > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Level must be 1-5")
    existing = user_skills_col.find_one({"user_id": current_user["id"], "skill_id": payload.skill_id})
    if existing:
        user_skills_col.update_one({"_id": existing["_id"]}, {"$set": {"level": payload.level}})
    else:
        user_skills_col.insert_one({"user_id": current_user["id"], "skill_id": payload.skill_id, "level": payload.level})
    return UserSkillResponse(skill_id=skill["id"], skill_name=skill["skill_name"], level=payload.level)


@app.delete("/users/me/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_skill(skill_id: int, current_user: dict = Depends(get_current_user)):
    row = user_skills_col.find_one({"user_id": current_user["id"], "skill_id": skill_id})
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    user_skills_col.delete_one({"_id": row["_id"]})


# ── Skills Catalog ───────────────────────────────────────────────────────────

@app.get("/skills", response_model=List[SkillResponse])
def list_skills():
    return [SkillResponse(**s) for s in skills_col.find().sort("skill_name", 1)]


@app.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillCreate):
    existing = skills_col.find_one({"skill_name": payload.skill_name})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skill already exists")
    skill_id = next_id("skills")
    skill = {"id": skill_id, "skill_name": payload.skill_name}
    skills_col.insert_one(skill)
    return SkillResponse(**skill)


# ── Activities ───────────────────────────────────────────────────────────────

def _act_resp(activity: dict) -> ActivityResponse:
    activity_skills = list(activity_skills_col.find({"activity_id": activity["id"]}))
    skills_list = []
    for as_ in activity_skills:
        skill = skills_col.find_one({"id": as_["skill_id"]})
        skills_list.append(ActivitySkillResponse(
            skill_id=as_["skill_id"],
            skill_name=skill["skill_name"] if skill else "Unknown",
            required_level=as_["required_level"],
        ))
    members_count = join_requests_col.count_documents({"activity_id": activity["id"], "status": "Approved"})
    creator_user = users_col.find_one({"id": activity["creator_id"]})
    creator_info = None
    if creator_user:
        creator_info = CreatorInfo(
            id=creator_user["id"],
            name=creator_user["name"],
            email=creator_user.get("email"),
            avatar_url=creator_user.get("photo_url"),
        )
    return ActivityResponse(
        id=activity["id"], creator_id=activity["creator_id"],
        title=activity["title"], description=activity.get("description"),
        category=activity["category"], mode=activity["mode"],
        max_members=activity["max_members"], deadline=activity["deadline"],
        status=activity.get("status", "open"), created_at=activity.get("created_at"),
        skills=skills_list, members_count=members_count, creator=creator_info,
    )


def _load_act(activity_id: int) -> dict:
    activity = activities_col.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return activity


@app.get("/activities", response_model=List[ActivityResponse])
def list_activities(
    category: str = Query(None), mode: str = Query(None),
    skill: str = Query(None), status_filter: str = Query(None, alias="status"),
):
    filters = {}
    if category:
        filters["category"] = category
    if mode:
        filters["mode"] = mode
    if status_filter:
        filters["status"] = status_filter
    cursor = activities_col.find(filters).sort("created_at", -1)
    activities = list(cursor)

    if skill:
        matching_skills = list(skills_col.find({"skill_name": {"$regex": skill, "$options": "i"}}))
        skill_ids = [s["id"] for s in matching_skills]
        if skill_ids:
            matching_act_ids = set()
            for as_ in activity_skills_col.find({"skill_id": {"$in": skill_ids}}):
                matching_act_ids.add(as_["activity_id"])
            activities = [a for a in activities if a["id"] in matching_act_ids]
        else:
            activities = []

    return [_act_resp(a) for a in activities]


@app.post("/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityCreate, current_user: dict = Depends(get_current_user)):
    act_id = next_id("activities")
    activity = {
        "id": act_id,
        "creator_id": current_user["id"],
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "mode": payload.mode,
        "max_members": payload.max_members,
        "deadline": payload.deadline,
        "status": "open",
        "created_at": datetime.utcnow(),
    }
    activities_col.insert_one(activity)

    for s in payload.skills:
        skill = skills_col.find_one({"id": s.skill_id})
        if not skill:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Skill id {s.skill_id} not found")
        activity_skills_col.insert_one({
            "activity_id": act_id,
            "skill_id": s.skill_id,
            "required_level": s.required_level,
        })

    return _act_resp(activity)


@app.get("/activities/{activity_id}", response_model=ActivityResponse)
def get_activity(activity_id: int):
    return _act_resp(_load_act(activity_id))


@app.put("/activities/{activity_id}", response_model=ActivityResponse)
def update_activity(activity_id: int, payload: ActivityUpdate, current_user: dict = Depends(get_current_user)):
    activity = _load_act(activity_id)
    if activity["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator can update")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True, exclude={"skills"}).items() if v is not None}
    if updates:
        activities_col.update_one({"id": activity_id}, {"$set": updates})

    if payload.skills is not None:
        activity_skills_col.delete_many({"activity_id": activity_id})
        for s in payload.skills:
            skill = skills_col.find_one({"id": s.skill_id})
            if not skill:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Skill id {s.skill_id} not found")
            activity_skills_col.insert_one({
                "activity_id": activity_id,
                "skill_id": s.skill_id,
                "required_level": s.required_level,
            })

    return _act_resp(activities_col.find_one({"id": activity_id}))


@app.post("/activities/{activity_id}/apply", response_model=JoinRequestResponse, status_code=status.HTTP_201_CREATED)
def apply_to_activity(activity_id: int, current_user: dict = Depends(get_current_user)):
    activity = _load_act(activity_id)
    if activity["creator_id"] == current_user["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot apply to your own activity")
    if activity.get("status") != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activity is not open")
    if activity.get("deadline") and activity["deadline"] < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activity deadline has passed")

    existing = join_requests_col.find_one({"activity_id": activity_id, "user_id": current_user["id"]})
    if existing and existing["status"] == "Approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a member")
    if existing and existing["status"] == "Pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already pending")

    member_count = join_requests_col.count_documents({"activity_id": activity_id, "status": "Approved"})
    if member_count >= activity["max_members"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activity is full")

    if existing:
        join_requests_col.update_one({"_id": existing["_id"]}, {"$set": {"status": "Pending"}})
        jr = join_requests_col.find_one({"_id": existing["_id"]})
    else:
        jr_id = next_id("join_requests")
        jr = {
            "id": jr_id,
            "activity_id": activity_id,
            "user_id": current_user["id"],
            "status": "Pending",
            "created_at": datetime.utcnow(),
        }
        join_requests_col.insert_one(jr)

    return JoinRequestResponse(
        id=jr["id"], activity_id=jr["activity_id"], user_id=jr["user_id"],
        status=jr["status"], created_at=jr.get("created_at"),
        user_name=current_user["name"], user_email=current_user["email"],
    )


@app.get("/activities/{activity_id}/applicants", response_model=List[JoinRequestResponse])
def list_applicants(activity_id: int, current_user: dict = Depends(get_current_user)):
    activity = _load_act(activity_id)
    if activity["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator can view applicants")
    requests = list(join_requests_col.find({"activity_id": activity_id}).sort("created_at", 1))
    result = []
    for jr in requests:
        user = users_col.find_one({"id": jr["user_id"]})
        result.append(JoinRequestResponse(
            id=jr["id"], activity_id=jr["activity_id"], user_id=jr["user_id"],
            status=jr["status"], created_at=jr.get("created_at"),
            user_name=user["name"] if user else "Unknown",
            user_email=user["email"] if user else "Unknown",
        ))
    return result


@app.put("/activities/{activity_id}/applicants/{join_request_id}", response_model=JoinRequestResponse)
def process_join_request(activity_id: int, join_request_id: int, payload: JoinRequestAction, current_user: dict = Depends(get_current_user)):
    if payload.status not in ("Approved", "Rejected"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be Approved or Rejected")
    activity = _load_act(activity_id)
    if activity["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator can process requests")

    jr = join_requests_col.find_one({"id": join_request_id, "activity_id": activity_id})
    if not jr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Join request not found")
    if payload.status == "Approved":
        member_count = join_requests_col.count_documents({"activity_id": activity_id, "status": "Approved"})
        if member_count >= activity["max_members"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activity is full")

    join_requests_col.update_one({"_id": jr["_id"]}, {"$set": {"status": payload.status}})
    jr = join_requests_col.find_one({"_id": jr["_id"]})
    user = users_col.find_one({"id": jr["user_id"]})

    return JoinRequestResponse(
        id=jr["id"], activity_id=jr["activity_id"], user_id=jr["user_id"],
        status=jr["status"], created_at=jr.get("created_at"),
        user_name=user["name"] if user else "Unknown",
        user_email=user["email"] if user else "Unknown",
    )


@app.get("/activities/{activity_id}/members", response_model=List[dict])
def list_members(activity_id: int):
    activity = _load_act(activity_id)
    creator = users_col.find_one({"id": activity["creator_id"]})
    members = [{"user_id": activity["creator_id"], "name": creator["name"], "email": creator["email"], "role": "creator"}] if creator else []

    approved = list(join_requests_col.find({"activity_id": activity_id, "status": "Approved"}))
    for jr in approved:
        user = users_col.find_one({"id": jr["user_id"]})
        if user:
            members.append({"user_id": user["id"], "name": user["name"], "email": user["email"], "role": "member"})
    return members


@app.get("/activities/{activity_id}/eligibility")
def get_eligibility(activity_id: int, current_user: dict = Depends(get_current_user)):
    _load_act(activity_id)
    return check_eligibility(current_user["id"], activity_id)


# ── Chat ─────────────────────────────────────────────────────────────────────

def _require_member(activity_id: int, user_id: int):
    activity = activities_col.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    if activity["creator_id"] == user_id:
        return activity
    approved = join_requests_col.find_one({"activity_id": activity_id, "user_id": user_id, "status": "Approved"})
    if not approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member")
    return activity


@app.get("/chat/{activity_id}/messages", response_model=List[MessageResponse])
def get_messages(activity_id: int, before: int = Query(None), limit: int = Query(50, ge=1, le=200), current_user: dict = Depends(get_current_user)):
    _require_member(activity_id, current_user["id"])
    filters = {"activity_id": activity_id}
    if before is not None:
        filters["id"] = {"$lt": before}
    messages = list(messages_col.find(filters).sort("id", -1).limit(limit))
    messages.reverse()
    result = []
    for m in messages:
        user = users_col.find_one({"id": m["user_id"]})
        result.append(MessageResponse(
            id=m["id"], activity_id=m["activity_id"], user_id=m["user_id"],
            user_name=user["name"] if user else "Unknown",
            message=m["message"], created_at=m.get("created_at"),
        ))
    return result


@app.post("/chat/{activity_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(activity_id: int, payload: MessageCreate, current_user: dict = Depends(get_current_user)):
    _require_member(activity_id, current_user["id"])
    msg_id = next_id("messages")
    msg = {
        "id": msg_id,
        "activity_id": activity_id,
        "user_id": current_user["id"],
        "message": payload.message,
        "created_at": datetime.utcnow(),
    }
    messages_col.insert_one(msg)
    return MessageResponse(
        id=msg["id"], activity_id=msg["activity_id"], user_id=msg["user_id"],
        user_name=current_user["name"], message=msg["message"], created_at=msg["created_at"],
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
