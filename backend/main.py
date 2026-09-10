import os
import random
import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from bson import ObjectId

from database import db, serialize_doc
from auth import hash_password, verify_password, create_access_token, get_current_user

app = FastAPI(title="Huddle Swap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Collections
users_col = db["users"]
items_col = db["items"]
teams_col = db["teams"]
swaps_col = db["swaps"]

# Pydantic Schemas
class RegisterSchema(BaseModel):
    name: str
    email: str
    password: str
    bio: Optional[str] = ""
    skills: Optional[List[str]] = []

class LoginSchema(BaseModel):
    email: str
    password: str

class ProfileUpdateSchema(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None

class ItemCreateSchema(BaseModel):
    title: str
    description: str
    type: str  # "product" or "skill"
    category: str
    value_estimate: str
    image_url: Optional[str] = ""

class TeamCreateSchema(BaseModel):
    title: str
    description: str
    required_skills: List[str]

class SwapCreateSchema(BaseModel):
    requested_item_id: str
    offered_item_id: str

class ChatMessageSchema(BaseModel):
    text: str

class FulfillmentSchema(BaseModel):
    type: Optional[str] = "fulfillment"
    value: Optional[str] = ""
    tracking_number: Optional[str] = ""
    url_link: Optional[str] = ""

class VerifyPinSchema(BaseModel):
    pin: str

# Helpers
def generate_pin() -> str:
    return str(random.randint(100000, 999999))

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/register")
def register(data: RegisterSchema):
    if users_col.find_one({"email": data.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "name": data.name,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "bio": data.bio or "",
        "skills": data.skills or [],
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    res = users_col.insert_one(user_doc)
    user_id = str(res.inserted_id)
    token = create_access_token(user_id, data.email.lower())
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": data.name,
            "email": data.email.lower(),
            "bio": data.bio or "",
            "skills": data.skills or []
        }
    }

@app.post("/api/auth/login")
def login(data: LoginSchema):
    user = users_col.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    token = create_access_token(user_id, user["email"])
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
            "bio": user.get("bio", ""),
            "skills": user.get("skills", [])
        }
    }

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "bio": user.get("bio", ""),
        "skills": user.get("skills", [])
    }

@app.put("/api/auth/me")
def update_me(data: ProfileUpdateSchema, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.bio is not None:
        update_data["bio"] = data.bio
    if data.skills is not None:
        update_data["skills"] = data.skills
        
    if update_data:
        users_col.update_one({"_id": ObjectId(current_user["id"])}, {"$set": update_data})
        
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "bio": user.get("bio", ""),
        "skills": user.get("skills", [])
    }

# --- ITEMS ENDPOINTS ---
@app.post("/api/items")
def create_item(data: ItemCreateSchema, current_user: dict = Depends(get_current_user)):
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    
    item_doc = {
        "user_id": current_user["id"],
        "user_name": user["name"] if user else "Anonymous",
        "title": data.title,
        "description": data.description,
        "type": data.type,  # "product" or "skill"
        "category": data.category,
        "value_estimate": data.value_estimate,
        "image_url": data.image_url or "",
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    
    res = items_col.insert_one(item_doc)
    item_doc["_id"] = res.inserted_id
    return serialize_doc(item_doc)

@app.get("/api/items")
def get_items(
    search: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None
):
    query = {}
    if type and type != "all":
        query["type"] = type
    if category and category != "all":
        query["category"] = category
    if user_id:
        query["user_id"] = user_id
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}}
        ]
        
    items = list(items_col.find(query).sort("created_at", -1))
    return serialize_doc(items)

@app.delete("/api/items/{item_id}")
def delete_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = items_col.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    items_col.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Item deleted successfully"}

# --- TEAMS ENDPOINTS ---
@app.post("/api/teams")
def create_team(data: TeamCreateSchema, current_user: dict = Depends(get_current_user)):
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    user_name = user["name"] if user else "Anonymous"
    
    team_doc = {
        "owner_id": current_user["id"],
        "owner_name": user_name,
        "title": data.title,
        "description": data.description,
        "required_skills": data.required_skills,
        "members": [{
            "user_id": current_user["id"],
            "user_name": user_name,
            "role": "Owner"
        }],
        "messages": [{
            "sender_id": "system",
            "sender_name": "System",
            "text": f"🎉 Team '{data.title}' created by {user_name}! Welcome aboard.",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }],
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    
    res = teams_col.insert_one(team_doc)
    team_doc["_id"] = res.inserted_id
    return serialize_doc(team_doc)

@app.get("/api/teams")
def get_teams(search: Optional[str] = None, skill: Optional[str] = None):
    query = {}
    if skill and skill != "all":
        query["required_skills"] = skill
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"owner_name": {"$regex": search, "$options": "i"}}
        ]
        
    teams = list(teams_col.find(query).sort("created_at", -1))
    return serialize_doc(teams)

@app.get("/api/teams/{team_id}")
def get_team_detail(team_id: str):
    team = teams_col.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return serialize_doc(team)

@app.post("/api/teams/{team_id}/join")
def join_team(team_id: str, current_user: dict = Depends(get_current_user)):
    team = teams_col.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    user_name = user["name"] if user else "Anonymous"
    
    # Check if already a member
    for m in team.get("members", []):
        if m["user_id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Already a member of this team")
            
    new_member = {
        "user_id": current_user["id"],
        "user_name": user_name,
        "role": "Member"
    }
    
    system_msg = {
        "sender_id": "system",
        "sender_name": "System",
        "text": f"👋 {user_name} joined the team!",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    teams_col.update_one(
        {"_id": ObjectId(team_id)},
        {
            "$push": {
                "members": new_member,
                "messages": system_msg
            }
        }
    )
    
    updated_team = teams_col.find_one({"_id": ObjectId(team_id)})
    return serialize_doc(updated_team)

@app.post("/api/teams/{team_id}/chat")
def send_team_chat_message(team_id: str, data: ChatMessageSchema, current_user: dict = Depends(get_current_user)):
    team = teams_col.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    
    # Check if user is a member of the team
    is_member = any(m["user_id"] == current_user["id"] for m in team.get("members", []))
    if not is_member:
        raise HTTPException(status_code=403, detail="You must join the team to chat")
        
    msg = {
        "sender_id": current_user["id"],
        "sender_name": user["name"] if user else "Member",
        "text": data.text,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    teams_col.update_one(
        {"_id": ObjectId(team_id)},
        {"$push": {"messages": msg}}
    )
    
    updated_team = teams_col.find_one({"_id": ObjectId(team_id)})
    return serialize_doc(updated_team)

# --- SWAPS ENDPOINTS ---
@app.post("/api/swaps")
def create_swap(data: SwapCreateSchema, current_user: dict = Depends(get_current_user)):
    requested_item = items_col.find_one({"_id": ObjectId(data.requested_item_id)})
    offered_item = items_col.find_one({"_id": ObjectId(data.offered_item_id)})
    
    if not requested_item or not offered_item:
        raise HTTPException(status_code=404, detail="Requested or offered item not found")
        
    if requested_item["user_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot swap with your own item")
        
    if offered_item["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Offered item must belong to you")
        
    owner_user = users_col.find_one({"_id": ObjectId(requested_item["user_id"])})
    requester_user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    
    swap_doc = {
        "owner_id": requested_item["user_id"],
        "owner_name": owner_user["name"] if owner_user else "Owner",
        "requester_id": current_user["id"],
        "requester_name": requester_user["name"] if requester_user else "Requester",
        "requested_item": {
            "id": str(requested_item["_id"]),
            "title": requested_item["title"],
            "type": requested_item["type"],
            "value_estimate": requested_item.get("value_estimate", ""),
            "image_url": requested_item.get("image_url", "")
        },
        "offered_item": {
            "id": str(offered_item["_id"]),
            "title": offered_item["title"],
            "type": offered_item["type"],
            "value_estimate": offered_item.get("value_estimate", ""),
            "image_url": offered_item.get("image_url", "")
        },
        "status": "pending",  # "pending", "active", "completed", "cancelled"
        "confirmations": {
            "owner_confirmed": False,
            "requester_confirmed": False
        },
        "fulfillment": {
            "owner_fulfillment": None,
            "requester_fulfillment": None
        },
        "pins": {
            "pin_a_to_b": None,
            "pin_b_to_a": None
        },
        "verifications": {
            "owner_verified": False,
            "requester_verified": False
        },
        "messages": [
            {
                "sender_id": "system",
                "sender_name": "System",
                "text": f"Swap requested! {requester_user['name']} wants '{requested_item['title']}' in exchange for '{offered_item['title']}'. Discuss details here and click Confirm when ready.",
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
        ],
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    
    res = swaps_col.insert_one(swap_doc)
    swap_doc["_id"] = res.inserted_id
    return serialize_doc(swap_doc)

@app.get("/api/swaps")
def get_user_swaps(current_user: dict = Depends(get_current_user)):
    swaps = list(swaps_col.find({
        "$or": [
            {"owner_id": current_user["id"]},
            {"requester_id": current_user["id"]}
        ]
    }).sort("created_at", -1))
    
    return serialize_doc(swaps)

@app.get("/api/swaps/{swap_id}")
def get_swap_detail(swap_id: str, current_user: dict = Depends(get_current_user)):
    swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
        
    if current_user["id"] not in [swap["owner_id"], swap["requester_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized to view this swap")
        
    return serialize_doc(swap)

@app.post("/api/swaps/{swap_id}/chat")
def send_chat_message(swap_id: str, data: ChatMessageSchema, current_user: dict = Depends(get_current_user)):
    swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
    if current_user["id"] not in [swap["owner_id"], swap["requester_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = users_col.find_one({"_id": ObjectId(current_user["id"])})
    
    msg = {
        "sender_id": current_user["id"],
        "sender_name": user["name"] if user else "User",
        "text": data.text,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    swaps_col.update_one(
        {"_id": ObjectId(swap_id)},
        {"$push": {"messages": msg}}
    )
    
    updated_swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    return serialize_doc(updated_swap)

@app.post("/api/swaps/{swap_id}/confirm")
def confirm_swap(swap_id: str, current_user: dict = Depends(get_current_user)):
    swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
        
    user_id = current_user["id"]
    if user_id == swap["owner_id"]:
        swaps_col.update_one({"_id": ObjectId(swap_id)}, {"$set": {"confirmations.owner_confirmed": True}})
    elif user_id == swap["requester_id"]:
        swaps_col.update_one({"_id": ObjectId(swap_id)}, {"$set": {"confirmations.requester_confirmed": True}})
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    updated = swaps_col.find_one({"_id": ObjectId(swap_id)})
    conf = updated.get("confirmations", {})
    
    # If both confirmed, transition to "active" and generate PINs
    if conf.get("owner_confirmed") and conf.get("requester_confirmed") and updated.get("status") == "pending":
        pin_a_to_b = generate_pin()
        pin_b_to_a = generate_pin()
        
        system_msg = {
            "sender_id": "system",
            "sender_name": "System",
            "text": "🎉 Both users confirmed! The swap is now ACTIVE. Please provide tracking numbers (for products) or links (for skills) below, and exchange your confirmation PINs once items/services are received.",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        
        swaps_col.update_one(
            {"_id": ObjectId(swap_id)},
            {
                "$set": {
                    "status": "active",
                    "pins.pin_a_to_b": pin_a_to_b,
                    "pins.pin_b_to_a": pin_b_to_a
                },
                "$push": {"messages": system_msg}
            }
        )
        
    final_swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    return serialize_doc(final_swap)

@app.post("/api/swaps/{swap_id}/fulfillment")
def submit_fulfillment(swap_id: str, data: FulfillmentSchema, current_user: dict = Depends(get_current_user)):
    swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
        
    user_id = current_user["id"]
    is_owner = (user_id == swap["owner_id"])
    is_requester = (user_id == swap["requester_id"])
    
    if not is_owner and not is_requester:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tracking = (data.tracking_number or "").strip()
    url = (data.url_link or "").strip()
    val = (data.value or "").strip()
    
    if not tracking and not url and val:
        if val.startswith("http://") or val.startswith("https://"):
            url = val
        else:
            tracking = val

    fulfillment_obj = {
        "type": data.type or "fulfillment",
        "value": val or (f"Tracking: {tracking}" if tracking else f"Link: {url}"),
        "tracking_number": tracking,
        "url_link": url,
        "submitted": True,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    field = "fulfillment.owner_fulfillment" if is_owner else "fulfillment.requester_fulfillment"
    user_name = swap["owner_name"] if is_owner else swap["requester_name"]
    
    details_str = []
    if tracking: details_str.append(f"Tracking #: {tracking}")
    if url: details_str.append(f"URL: {url}")
    summary = " | ".join(details_str) if details_str else val

    system_msg = {
        "sender_id": "system",
        "sender_name": "System",
        "text": f"📦 {user_name} updated fulfillment info: {summary}",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    swaps_col.update_one(
        {"_id": ObjectId(swap_id)},
        {
            "$set": {field: fulfillment_obj},
            "$push": {"messages": system_msg}
        }
    )
    
    updated_swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    return serialize_doc(updated_swap)

@app.post("/api/swaps/{swap_id}/verify_pin")
def verify_pin(swap_id: str, data: VerifyPinSchema, current_user: dict = Depends(get_current_user)):
    swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap not found")
        
    user_id = current_user["id"]
    is_owner = (user_id == swap["owner_id"])
    is_requester = (user_id == swap["requester_id"])
    
    if not is_owner and not is_requester:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    pins = swap.get("pins", {})
    verifications = swap.get("verifications", {})
    
    # Direction A -> B: Owner (A) sends item to Requester (B). 
    # Owner A holds pin_a_to_b. Requester B enters pin_a_to_b to confirm receiving A's item.
    # Direction B -> A: Requester (B) sends item to Owner (A).
    # Requester B holds pin_b_to_a. Owner A enters pin_b_to_a to confirm receiving B's item.
    if is_owner:
        # Owner A is verifying receipt of B's item (needs pin_b_to_a from B)
        expected_pin = pins.get("pin_b_to_a")
        if data.pin.strip() != expected_pin:
            raise HTTPException(status_code=400, detail="Invalid PIN for receiving partner's item")
        swaps_col.update_one({"_id": ObjectId(swap_id)}, {"$set": {"verifications.owner_verified": True}})
        verified_msg = f"✅ {swap['owner_name']} confirmed receipt of {swap['requester_name']}'s item using PIN!"
    else:
        # Requester B is verifying receipt of A's item (needs pin_a_to_b from A)
        expected_pin = pins.get("pin_a_to_b")
        if data.pin.strip() != expected_pin:
            raise HTTPException(status_code=400, detail="Invalid PIN for receiving partner's item")
        swaps_col.update_one({"_id": ObjectId(swap_id)}, {"$set": {"verifications.requester_verified": True}})
        verified_msg = f"✅ {swap['requester_name']} confirmed receipt of {swap['owner_name']}'s item using PIN!"
        
    system_msg = {
        "sender_id": "system",
        "sender_name": "System",
        "text": verified_msg,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    swaps_col.update_one({"_id": ObjectId(swap_id)}, {"$push": {"messages": system_msg}})

    updated = swaps_col.find_one({"_id": ObjectId(swap_id)})
    v = updated.get("verifications", {})
    
    # If both verified, complete the swap!
    if v.get("owner_verified") and v.get("requester_verified") and updated.get("status") != "completed":
        complete_msg = {
            "sender_id": "system",
            "sender_name": "System",
            "text": "🎉 BOTH 2-way PINs verified successfully! Swap completed!",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        swaps_col.update_one(
            {"_id": ObjectId(swap_id)},
            {
                "$set": {"status": "completed"},
                "$push": {"messages": complete_msg}
            }
        )
        
    final_swap = swaps_col.find_one({"_id": ObjectId(swap_id)})
    return serialize_doc(final_swap)

# Serve Frontend static files
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
